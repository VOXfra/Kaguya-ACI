from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
import shutil
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

TOOL_VERSION = "0.0.1-dev.15.5"
FIVEFURY_VERSION = "0.4.21"
TARGET_MODEL = "prop_roadcone02a"
TARGET_LOGICAL_PATH = (
    "x64f.rpf/levels/gta5/props/roadside/v_construction.rpf/prop_roadcone02a.ydr"
)
DEFAULT_SCALE = 1.65


class CompactRecoveryError(RuntimeError):
    pass


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _safe_parts(value: str) -> list[str]:
    normalized = value.replace("\\", "/").strip("/")
    parts = list(PurePosixPath(normalized).parts)
    if not parts or any(part in ("", ".", "..") for part in parts):
        raise CompactRecoveryError(f"Unsafe path: {value!r}")
    if any(":" in part for part in parts):
        raise CompactRecoveryError(f"Path contains drive/URI component: {value!r}")
    return parts


def compact_archive_info(logical_path: str) -> tuple[str, str, str, str]:
    parts = _safe_parts(logical_path)
    if len(parts) < 4:
        raise CompactRecoveryError(f"Asset path is too short: {logical_path!r}")
    outer = parts[0]
    if not outer.lower().startswith("x64") or not outer.lower().endswith(".rpf"):
        raise CompactRecoveryError(f"Expected base x64*.rpf asset, got {logical_path!r}")
    rpf_indexes = [index for index, part in enumerate(parts[:-1]) if part.lower().endswith(".rpf")]
    if len(rpf_indexes) < 2:
        raise CompactRecoveryError("Selected asset is not inside a nested RPF.")
    nested_index = rpf_indexes[-1]
    nested_entry = "/".join(parts[1 : nested_index + 1])
    target_relative = "/".join(parts[nested_index + 1 :])
    destination_relative = PurePosixPath("newmods", "platform", *parts[1 : nested_index + 1]).as_posix()
    return outer, nested_entry, target_relative, destination_relative


def _probe_root(gta_root: Path) -> Path:
    return gta_root / "VOXModernOverhaul" / "visual_probe"


def _work_root(gta_root: Path) -> Path:
    return _probe_root(gta_root) / "work"


def _manifest_path(gta_root: Path) -> Path:
    return _probe_root(gta_root) / "visual_probe_manifest.json"


def _report_path(gta_root: Path) -> Path:
    return _probe_root(gta_root) / "visual_probe_report.txt"


def _save_manifest(gta_root: Path, manifest: dict[str, Any]) -> None:
    path = _manifest_path(gta_root)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".json.tmp")
    temp.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    os.replace(temp, path)


def _load_manifest(gta_root: Path) -> dict[str, Any]:
    path = _manifest_path(gta_root)
    if not path.is_file():
        raise CompactRecoveryError("visual_probe_manifest.json is missing.")
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict):
        raise CompactRecoveryError("visual_probe_manifest.json is not a JSON object.")
    return value


def _write_report(gta_root: Path, lines: list[str]) -> None:
    path = _report_path(gta_root)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def _require_hash(value: Any, name: str) -> str:
    text = str(value or "").lower()
    if len(text) != 64 or any(ch not in "0123456789abcdef" for ch in text):
        raise CompactRecoveryError(f"Manifest {name} is not a SHA-256 value.")
    return text


def _snapshot_path(path: Path) -> dict[str, Any]:
    if path.is_file():
        return {"kind": "file", "sha256": sha256_file(path)}
    if not path.is_dir():
        raise CompactRecoveryError(f"Cannot snapshot unsupported path type: {path}")
    files: list[dict[str, str]] = []
    for item in sorted((p for p in path.rglob("*") if p.is_file()), key=lambda p: p.as_posix().lower()):
        files.append({
            "path": item.relative_to(path).as_posix(),
            "sha256": sha256_file(item),
        })
    return {"kind": "directory", "files": files}


def _verify_snapshot(path: Path, snapshot: dict[str, Any]) -> None:
    kind = str(snapshot.get("kind", ""))
    if kind == "file":
        expected = _require_hash(snapshot.get("sha256"), "preexisting_override.sha256")
        if not path.is_file() or sha256_file(path) != expected:
            raise CompactRecoveryError("Preserved pre-existing file changed; refusing restore.")
        return
    if kind != "directory":
        raise CompactRecoveryError(f"Unknown pre-existing snapshot kind: {kind!r}")
    if not path.is_dir():
        raise CompactRecoveryError("Preserved pre-existing directory is missing.")
    entries = snapshot.get("files")
    if not isinstance(entries, list):
        raise CompactRecoveryError("Malformed pre-existing directory snapshot.")
    expected: dict[str, str] = {}
    for item in entries:
        if not isinstance(item, dict):
            raise CompactRecoveryError("Malformed pre-existing directory file entry.")
        rel = PurePosixPath(*_safe_parts(str(item.get("path", "")))).as_posix().lower()
        expected[rel] = _require_hash(item.get("sha256"), f"preexisting_override.files[{rel}]")
    actual_files = [p for p in path.rglob("*") if p.is_file()]
    actual = {p.relative_to(path).as_posix().lower(): p for p in actual_files}
    if set(actual) != set(expected):
        raise CompactRecoveryError("Preserved pre-existing directory file set changed; refusing restore.")
    for rel, item in actual.items():
        if sha256_file(item) != expected[rel]:
            raise CompactRecoveryError(f"Preserved pre-existing directory member changed: {rel}")


def _make_cache(gta_root: Path) -> Any:
    from fivefury import GameFileCache, GameTarget

    version = importlib.metadata.version("fivefury")
    if version != FIVEFURY_VERSION:
        raise CompactRecoveryError(f"FiveFury version mismatch: expected {FIVEFURY_VERSION}, got {version}")
    cache = GameFileCache(
        gta_root,
        game=GameTarget.GTA5_ENHANCED,
        use_index_cache=True,
        index_cache_path=_work_root(gta_root) / "fivefury-game-index.bin",
        load_vehicles=False,
        load_peds=False,
        load_audio=False,
    )
    cache.scan_game(use_index_cache=True)
    return cache


def _find_target_asset(cache: Any) -> Any:
    matches = list(cache.find_assets(TARGET_MODEL, kind=".ydr", exact=True, limit=64))
    exact = [asset for asset in matches if str(asset.path).replace("\\", "/").lower() == TARGET_LOGICAL_PATH.lower()]
    if len(exact) != 1:
        observed = ", ".join(str(asset.path) for asset in matches[:8]) or "none"
        raise CompactRecoveryError(
            f"Expected exactly one retail target at {TARGET_LOGICAL_PATH}, found {len(exact)}. Candidates: {observed}"
        )
    return exact[0]


def _extract_nested_rpf(
    gta_root: Path,
    cache: Any,
    outer_name: str,
    nested_entry_path: str,
    target_relative: str,
    source_target_hash: str,
) -> tuple[bytes, int]:
    from fivefury.rpf import RpfArchive, RpfFileEntry

    outer_path = gta_root / Path(*_safe_parts(outer_name))
    if not outer_path.is_file():
        raise CompactRecoveryError(f"Outer Rockstar archive is missing: {outer_path}")
    outer = RpfArchive.from_path(outer_path, crypto=cache.crypto)
    try:
        nested_entry = outer.find_entry(nested_entry_path)
        if not isinstance(nested_entry, RpfFileEntry):
            raise CompactRecoveryError(f"Nested RPF entry was not found: {nested_entry_path}")
        nested_bytes = outer.read_entry_standalone(nested_entry)
    finally:
        outer.close()

    nested = RpfArchive.from_bytes(
        nested_bytes,
        name=PurePosixPath(nested_entry_path).name,
        crypto=cache.crypto,
    )
    try:
        target = nested.find_entry(target_relative)
        if not isinstance(target, RpfFileEntry):
            raise CompactRecoveryError(f"Target is missing from nested RPF: {target_relative}")
        observed = sha256_bytes(nested.read_entry_standalone(target))
        if observed != source_target_hash:
            raise CompactRecoveryError("Target bytes inside original nested RPF do not match locally extracted source YDR.")
        count = sum(1 for entry in nested.iter_entries(include_directories=False, include_root=False) if isinstance(entry, RpfFileEntry))
        if count <= 0:
            raise CompactRecoveryError("Original nested RPF contains no file entries.")
    finally:
        nested.close()
    return nested_bytes, count


def _backup_previous_manifest(gta_root: Path) -> str | None:
    manifest = _manifest_path(gta_root)
    if not manifest.is_file():
        return None
    backup_dir = _work_root(gta_root) / "recovery_backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup = backup_dir / f"previous_manifest_{uuid.uuid4().hex}.json"
    shutil.copy2(manifest, backup)
    return backup.relative_to(gta_root).as_posix()


def _activate_identity_from_materials(
    gta_root: Path,
    *,
    source_logical_path: str,
    source_archive_path: str,
    source_hash: str,
    transformed_hash: str,
    nested_bytes: bytes,
    member_count: int,
    scale: float,
    previous_manifest_backup: str | None,
) -> dict[str, Any]:
    outer_name, nested_entry, target_relative, destination_relative = compact_archive_info(source_logical_path)
    del outer_name
    destination = gta_root / Path(*PurePosixPath(destination_relative).parts)
    compact_root = _work_root(gta_root) / "compact_rpf"
    original_dir = compact_root / "original"
    staging_dir = compact_root / "staging"
    original_dir.mkdir(parents=True, exist_ok=True)
    staging_dir.mkdir(parents=True, exist_ok=True)

    archive_name = PurePosixPath(nested_entry).name
    original_rpf = original_dir / archive_name
    original_rpf.write_bytes(nested_bytes)
    identity_hash = sha256_file(original_rpf)
    staging_rpf = staging_dir / archive_name
    shutil.copy2(original_rpf, staging_rpf)
    if sha256_file(staging_rpf) != identity_hash:
        raise CompactRecoveryError("Staged compact identity RPF failed SHA-256 verification.")

    backup_relative: str | None = None
    backup_snapshot: dict[str, Any] | None = None
    backup_path: Path | None = None
    if destination.exists():
        backup_snapshot = _snapshot_path(destination)
        backup_dir = _work_root(gta_root) / "recovery_backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        backup_path = backup_dir / f"{archive_name}.preexisting.{uuid.uuid4().hex}"
        destination.rename(backup_path)
        backup_relative = backup_path.relative_to(gta_root).as_posix()

    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.replace(staging_rpf, destination)
        if sha256_file(destination) != identity_hash:
            raise CompactRecoveryError("Installed compact identity RPF failed SHA-256 verification.")
    except Exception:
        if destination.exists():
            if destination.is_dir():
                shutil.rmtree(destination)
            else:
                destination.unlink()
        if backup_path is not None and backup_path.exists():
            backup_path.rename(destination)
        raise

    manifest: dict[str, Any] = {
        "schema_version": 2,
        "tool_version": TOOL_VERSION,
        "installed_at_utc": datetime.now(timezone.utc).isoformat(),
        "fivefury_version": FIVEFURY_VERSION,
        "probe_mode": "COMPACT_RPF_IDENTITY",
        "model_name": TARGET_MODEL,
        "scale_factor": scale,
        "source_logical_path": source_logical_path,
        "source_archive_path": source_archive_path,
        "source_sha256": source_hash,
        "transformed_sha256": transformed_hash,
        "generated_sha256": source_hash,
        "compact_rpf_nested_entry": nested_entry,
        "compact_rpf_target_relative": target_relative,
        "compact_rpf_relative_path": destination_relative,
        "compact_rpf_identity_sha256": identity_hash,
        "compact_rpf_active_sha256": identity_hash,
        "compact_rpf_member_count": member_count,
        "standalone_recovery_bootstrap": True,
    }
    if backup_relative is not None and backup_snapshot is not None:
        manifest["preexisting_override_backup_relative"] = backup_relative
        manifest["preexisting_override_snapshot"] = backup_snapshot
    if previous_manifest_backup is not None:
        manifest["previous_manifest_backup_relative"] = previous_manifest_backup
    _save_manifest(gta_root, manifest)
    return manifest


def install_identity(gta_root: Path) -> int:
    gta_root = gta_root.resolve()
    if not (gta_root / "GTA5_Enhanced.exe").is_file():
        raise CompactRecoveryError(f"GTA5_Enhanced.exe not found in {gta_root}")
    if not (gta_root / "RageOpenV.asi").is_file():
        raise CompactRecoveryError("RageOpenV.asi is missing.")

    existing_manifest_path = _manifest_path(gta_root)
    if existing_manifest_path.is_file():
        try:
            existing = _load_manifest(gta_root)
            if str(existing.get("probe_mode", "")) == "COMPACT_RPF_IDENTITY":
                relative = str(existing.get("compact_rpf_relative_path", ""))
                expected = _require_hash(existing.get("compact_rpf_active_sha256"), "compact_rpf_active_sha256")
                active = gta_root / Path(*_safe_parts(relative))
                if active.is_file() and sha256_file(active) == expected:
                    print("VOX_COMPACT_RPF_IDENTITY_ALREADY_INSTALLED")
                    return 0
        except Exception:
            pass

    previous_manifest_backup = _backup_previous_manifest(gta_root)
    work = _work_root(gta_root)
    source = work / "original" / f"{TARGET_MODEL}.ydr"
    transformed = work / "generated" / f"{TARGET_MODEL}.ydr"
    source.parent.mkdir(parents=True, exist_ok=True)
    transformed.parent.mkdir(parents=True, exist_ok=True)

    cache = _make_cache(gta_root)
    try:
        asset = _find_target_asset(cache)
        extracted = cache.extract_asset(asset, source)
        if extracted is None or not source.is_file():
            raise CompactRecoveryError(f"Could not extract {asset.path}")
        source_hash = sha256_file(source)

        from vox_visual_probe import transform_ydr

        transform_ydr(source, transformed, DEFAULT_SCALE)
        transformed_hash = sha256_file(transformed)
        if transformed_hash == source_hash:
            raise CompactRecoveryError("Transformed YDR is unexpectedly identical to source.")

        outer_name, nested_entry, target_relative, _ = compact_archive_info(str(asset.path))
        nested_bytes, member_count = _extract_nested_rpf(
            gta_root,
            cache,
            outer_name,
            nested_entry,
            target_relative,
            source_hash,
        )
        manifest = _activate_identity_from_materials(
            gta_root,
            source_logical_path=str(asset.path),
            source_archive_path=str(getattr(asset, "source_path", "")),
            source_hash=source_hash,
            transformed_hash=transformed_hash,
            nested_bytes=nested_bytes,
            member_count=member_count,
            scale=DEFAULT_SCALE,
            previous_manifest_backup=previous_manifest_backup,
        )
    finally:
        cache.close()

    _write_report(
        gta_root,
        [
            "VOX GTA V Enhanced compact-RPF standalone recovery",
            f"tool_version={TOOL_VERSION}",
            "status=COMPACT_RPF_IDENTITY_INSTALLED",
            f"model={TARGET_MODEL}",
            f"source={manifest['source_logical_path']}",
            f"compact_rpf={manifest['compact_rpf_relative_path']}",
            f"compact_rpf_sha256={manifest['compact_rpf_identity_sha256']}",
            f"member_count={manifest['compact_rpf_member_count']}",
            "standalone_recovery_bootstrap=true",
            f"preexisting_override_quarantined={'preexisting_override_backup_relative' in manifest}",
            "",
            "No prior visual_probe manifest was required.",
            "Any pre-existing override at the destination was moved intact to VOX recovery storage, not deleted.",
            "There should be no visual difference in this identity test.",
        ],
    )
    print("VOX_COMPACT_RPF_STANDALONE_BOOTSTRAP_OK")
    print("VOX_COMPACT_RPF_IDENTITY_INSTALLED")
    print(f"VOX_COMPACT_RPF_PATH={manifest['compact_rpf_relative_path']}")
    print(f"VOX_COMPACT_RPF_MEMBERS={manifest['compact_rpf_member_count']}")
    return 0


def rollback(gta_root: Path) -> int:
    gta_root = gta_root.resolve()
    manifest = _load_manifest(gta_root)
    mode = str(manifest.get("probe_mode", ""))
    if mode not in {"COMPACT_RPF_IDENTITY", "COMPACT_RPF_TRANSFORMED"}:
        raise CompactRecoveryError(f"Recovery rollback cannot handle mode {mode!r}")
    relative = str(manifest.get("compact_rpf_relative_path", ""))
    parts = _safe_parts(relative)
    if parts[:2] != ["newmods", "platform"]:
        raise CompactRecoveryError("Compact RPF destination escaped newmods/platform.")
    destination = gta_root / Path(*parts)
    active_hash = _require_hash(manifest.get("compact_rpf_active_sha256"), "compact_rpf_active_sha256")
    if not destination.is_file() or sha256_file(destination) != active_hash:
        raise CompactRecoveryError("Active compact RPF is missing or changed; refusing rollback.")

    backup_relative = manifest.get("preexisting_override_backup_relative")
    backup_snapshot = manifest.get("preexisting_override_snapshot")
    backup: Path | None = None
    if backup_relative is not None:
        if not isinstance(backup_snapshot, dict):
            raise CompactRecoveryError("Pre-existing override backup snapshot is missing.")
        backup = gta_root / Path(*_safe_parts(str(backup_relative)))
        _verify_snapshot(backup, backup_snapshot)

    transaction = _work_root(gta_root) / "recovery_backups" / f"active_compact_rollback_{uuid.uuid4().hex}.rpf"
    transaction.parent.mkdir(parents=True, exist_ok=True)
    destination.rename(transaction)
    restored_previous = False
    try:
        if backup is not None:
            destination.parent.mkdir(parents=True, exist_ok=True)
            backup.rename(destination)
            restored_previous = True
        transaction.unlink()
    except Exception:
        if restored_previous and destination.exists():
            destination.rename(backup)  # type: ignore[arg-type]
        if transaction.exists():
            transaction.rename(destination)
        raise

    manifest["probe_mode"] = "COMPACT_RPF_ROLLED_BACK"
    manifest["rolled_back_at_utc"] = datetime.now(timezone.utc).isoformat()
    manifest["preexisting_override_restored"] = restored_previous
    manifest.pop("compact_rpf_active_sha256", None)
    _save_manifest(gta_root, manifest)
    _write_report(
        gta_root,
        [
            "VOX GTA V Enhanced compact-RPF standalone recovery",
            f"tool_version={TOOL_VERSION}",
            "status=COMPACT_RPF_ROLLED_BACK",
            f"previous_mode={mode}",
            f"removed={relative}",
            f"preexisting_override_restored={str(restored_previous).lower()}",
        ],
    )
    print("VOX_COMPACT_RPF_ROLLED_BACK")
    print(f"VOX_PREEXISTING_OVERRIDE_RESTORED={1 if restored_previous else 0}")
    return 0


def self_test() -> int:
    from fivefury import Vector2, Vector3, YdrGen9Shader, YdrMeshInput, create_ydr
    from fivefury.rpf import RpfArchive
    from vox_visual_probe import transform_ydr

    with tempfile.TemporaryDirectory(prefix="vox-compact-recovery-") as temp:
        root = Path(temp)
        (root / "GTA5_Enhanced.exe").write_bytes(b"fixture")
        (root / "RageOpenV.asi").write_bytes(b"fixture")
        work = _work_root(root)
        source = work / "original" / f"{TARGET_MODEL}.ydr"
        transformed = work / "generated" / f"{TARGET_MODEL}.ydr"
        source.parent.mkdir(parents=True, exist_ok=True)
        transformed.parent.mkdir(parents=True, exist_ok=True)

        mesh = YdrMeshInput(
            positions=[Vector3(0.0, 0.0, 0.0), Vector3(1.0, 0.0, 0.0), Vector3(0.0, 1.0, 0.0)],
            indices=[0, 1, 2],
            texcoords=[[Vector2(), Vector2(1.0, 0.0), Vector2(0.0, 1.0)]],
        )
        create_ydr(meshes=[mesh], shader=YdrGen9Shader.DEFAULT, name=TARGET_MODEL, version=159).save(source)
        transform_ydr(source, transformed, DEFAULT_SCALE)
        source_hash = sha256_file(source)
        transformed_hash = sha256_file(transformed)

        nested = RpfArchive.empty("v_construction.rpf")
        nested.file(f"{TARGET_MODEL}.ydr", source.read_bytes())
        nested.file("keep.bin", b"sibling-must-survive")
        nested_path = work / "fixture_v_construction.rpf"
        nested.save(nested_path)
        nested.close()
        nested_bytes = nested_path.read_bytes()

        _, _, _, destination_relative = compact_archive_info(TARGET_LOGICAL_PATH)
        destination = root / Path(*PurePosixPath(destination_relative).parts)
        destination.mkdir(parents=True, exist_ok=True)
        (destination / f"{TARGET_MODEL}.ydr").write_bytes(b"old-virtual-target")
        (destination / "old-sibling.bin").write_bytes(b"old-virtual-sibling")
        previous_snapshot = _snapshot_path(destination)

        if _manifest_path(root).exists():
            raise CompactRecoveryError("Self-test unexpectedly started with a manifest.")
        manifest = _activate_identity_from_materials(
            root,
            source_logical_path=TARGET_LOGICAL_PATH,
            source_archive_path="fixture",
            source_hash=source_hash,
            transformed_hash=transformed_hash,
            nested_bytes=nested_bytes,
            member_count=2,
            scale=DEFAULT_SCALE,
            previous_manifest_backup=None,
        )
        if not destination.is_file() or sha256_file(destination) != sha256_bytes(nested_bytes):
            raise CompactRecoveryError("No-manifest recovery did not install the compact identity RPF.")
        if str(manifest.get("probe_mode")) != "COMPACT_RPF_IDENTITY":
            raise CompactRecoveryError("No-manifest recovery did not create identity manifest state.")
        backup_rel = str(manifest.get("preexisting_override_backup_relative", ""))
        if not backup_rel:
            raise CompactRecoveryError("No-manifest recovery did not quarantine the pre-existing override.")
        backup = root / Path(*_safe_parts(backup_rel))
        _verify_snapshot(backup, previous_snapshot)

        rollback(root)
        if not destination.is_dir():
            raise CompactRecoveryError("Rollback did not restore the pre-existing directory override.")
        _verify_snapshot(destination, previous_snapshot)
        rolled = _load_manifest(root)
        if str(rolled.get("probe_mode")) != "COMPACT_RPF_ROLLED_BACK":
            raise CompactRecoveryError("Rollback manifest state was not recorded.")

    print("VOX_COMPACT_RPF_RECOVERY_SELF_TEST_OK")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="VOX standalone compact-RPF recovery installer")
    commands = parser.add_subparsers(dest="command", required=True)
    install = commands.add_parser("install-identity")
    install.add_argument("--gta-root", type=Path, required=True)
    rollback_cmd = commands.add_parser("rollback")
    rollback_cmd.add_argument("--gta-root", type=Path, required=True)
    commands.add_parser("self-test")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        if args.command == "install-identity":
            return install_identity(args.gta_root)
        if args.command == "rollback":
            return rollback(args.gta_root)
        if args.command == "self-test":
            return self_test()
        raise CompactRecoveryError(f"Unknown command: {args.command}")
    except Exception as exc:
        print(f"VOX_COMPACT_RECOVERY_ERROR={type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
