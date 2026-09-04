from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any

TOOL_VERSION = "0.0.1-dev.15.4"
FIVEFURY_VERSION = "0.4.21"


class CompactRpfError(RuntimeError):
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
        raise CompactRpfError(f"Unsafe path: {value!r}")
    if any(":" in part for part in parts):
        raise CompactRpfError(f"Path contains drive/URI component: {value!r}")
    return parts


def compact_archive_info(logical_path: str) -> tuple[str, str, str, str]:
    parts = _safe_parts(logical_path)
    if len(parts) < 4:
        raise CompactRpfError(f"Asset path is too short: {logical_path!r}")
    outer = parts[0]
    if not outer.lower().startswith("x64") or not outer.lower().endswith(".rpf"):
        raise CompactRpfError(f"Expected base x64*.rpf asset, got {logical_path!r}")
    rpf_indexes = [index for index, part in enumerate(parts[:-1]) if part.lower().endswith(".rpf")]
    if len(rpf_indexes) < 2:
        raise CompactRpfError("Selected asset is not inside a nested RPF.")
    nested_index = rpf_indexes[-1]
    nested_entry = "/".join(parts[1 : nested_index + 1])
    target_relative = "/".join(parts[nested_index + 1 :])
    if not target_relative:
        raise CompactRpfError("Selected asset has no path inside its nested RPF.")
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


def _load_manifest(gta_root: Path) -> dict[str, Any]:
    path = _manifest_path(gta_root)
    if not path.is_file():
        raise CompactRpfError(
            "visual_probe_manifest.json is missing. Keep the previous visual-probe state; "
            "do not delete VOXModernOverhaul\\visual_probe before this migration."
        )
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict):
        raise CompactRpfError("Visual probe manifest is not a JSON object.")
    return value


def _save_manifest(gta_root: Path, manifest: dict[str, Any]) -> None:
    path = _manifest_path(gta_root)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".json.tmp")
    temp.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    os.replace(temp, path)


def _write_report(gta_root: Path, lines: list[str]) -> None:
    path = _report_path(gta_root)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def _require_hash(value: Any, name: str) -> str:
    text = str(value or "").lower()
    if len(text) != 64 or any(ch not in "0123456789abcdef" for ch in text):
        raise CompactRpfError(f"Manifest {name} is not a SHA-256 value.")
    return text


def _make_cache(gta_root: Path) -> Any:
    import importlib.metadata
    from fivefury import GameFileCache, GameTarget

    version = importlib.metadata.version("fivefury")
    if version != FIVEFURY_VERSION:
        raise CompactRpfError(f"FiveFury version mismatch: expected {FIVEFURY_VERSION}, got {version}")
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


def _archive_snapshot(archive: Any) -> dict[str, str]:
    from fivefury.rpf import RpfFileEntry

    result: dict[str, str] = {}
    for entry in archive.iter_entries(include_directories=False, include_root=False):
        if not isinstance(entry, RpfFileEntry):
            continue
        key = str(entry.path).replace("\\", "/").lower()
        if key in result:
            raise CompactRpfError(f"Duplicate RPF member path: {entry.path}")
        result[key] = sha256_bytes(archive.read_entry_standalone(entry))
    if not result:
        raise CompactRpfError("Nested RPF contains no file entries.")
    return result


def _extract_original_nested_rpf(
    gta_root: Path,
    outer_name: str,
    nested_entry_path: str,
    target_relative: str,
    source_target_hash: str,
) -> tuple[bytes, dict[str, str]]:
    from fivefury.rpf import RpfArchive, RpfFileEntry

    cache = _make_cache(gta_root)
    try:
        outer_path = gta_root / Path(*_safe_parts(outer_name))
        if not outer_path.is_file():
            raise CompactRpfError(f"Outer Rockstar archive is missing: {outer_path}")
        outer = RpfArchive.from_path(outer_path, crypto=cache.crypto)
        try:
            entry = outer.find_entry(nested_entry_path)
            if not isinstance(entry, RpfFileEntry):
                raise CompactRpfError(f"Nested RPF entry was not found: {nested_entry_path}")
            nested_bytes = outer.read_entry_standalone(entry)
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
                raise CompactRpfError(f"Target is missing from extracted nested RPF: {target_relative}")
            observed_target_hash = sha256_bytes(nested.read_entry_standalone(target))
            if observed_target_hash != source_target_hash:
                raise CompactRpfError(
                    "Nested RPF target does not match the source YDR hash recorded by the real dev.15.1 extraction."
                )
            snapshot = _archive_snapshot(nested)
        finally:
            nested.close()
        return nested_bytes, snapshot
    finally:
        cache.close()


def _validate_directory_mirror(gta_root: Path, manifest: dict[str, Any], mirror_root: Path) -> None:
    entries = manifest.get("archive_mirror_files")
    if not isinstance(entries, list) or not entries:
        raise CompactRpfError("dev.15.3 archive mirror manifest is missing its member list.")
    expected: dict[str, str] = {}
    for item in entries:
        if not isinstance(item, dict):
            raise CompactRpfError("Malformed dev.15.3 archive mirror member.")
        rel = PurePosixPath(*_safe_parts(str(item.get("path", "")))).as_posix().lower()
        expected[rel] = _require_hash(item.get("sha256"), f"archive_mirror_files[{rel}]")
    actual_files = [path for path in mirror_root.rglob("*") if path.is_file()]
    actual = {path.relative_to(mirror_root).as_posix().lower(): path for path in actual_files}
    if set(actual) != set(expected):
        raise CompactRpfError("dev.15.3 mirror file set changed; refusing automatic migration.")
    for rel, path in actual.items():
        if sha256_file(path) != expected[rel]:
            raise CompactRpfError(f"dev.15.3 mirror member changed: {rel}; refusing migration.")


def _validate_single_file_virtual_archive(
    manifest: dict[str, Any], mirror_root: Path, target_relative: str
) -> None:
    target = mirror_root / Path(*_safe_parts(target_relative))
    files = [path for path in mirror_root.rglob("*") if path.is_file()]
    if len(files) != 1 or not target.is_file() or files[0].resolve() != target.resolve():
        raise CompactRpfError("Legacy one-file virtual archive changed; refusing automatic migration.")
    expected = _require_hash(manifest.get("generated_sha256"), "generated_sha256")
    if sha256_file(target) != expected:
        raise CompactRpfError("Legacy one-file override hash changed; refusing automatic migration.")


def _prepare_existing_destination(
    gta_root: Path,
    manifest: dict[str, Any],
    destination: Path,
    target_relative: str,
) -> str:
    mode = str(manifest.get("probe_mode", ""))
    if not destination.exists():
        if mode == "COMPACT_RPF_ROLLED_BACK":
            return "NONE"
        raise CompactRpfError(
            f"Expected previous VOX visual override at {destination} but it is absent. "
            "Refusing to guess ownership."
        )
    if destination.is_file():
        if mode not in {"COMPACT_RPF_IDENTITY", "COMPACT_RPF_TRANSFORMED"}:
            raise CompactRpfError("A real RPF already occupies the destination but the manifest does not own it.")
        expected = _require_hash(manifest.get("compact_rpf_active_sha256"), "compact_rpf_active_sha256")
        if sha256_file(destination) != expected:
            raise CompactRpfError("Existing compact RPF changed; refusing replacement.")
        return "COMPACT_FILE"
    if not destination.is_dir():
        raise CompactRpfError("Visual override destination is neither file nor directory.")
    if mode in {"FULL_ARCHIVE_IDENTITY", "FULL_ARCHIVE_TRANSFORMED"}:
        _validate_directory_mirror(gta_root, manifest, destination)
        return "FULL_DIRECTORY"
    if mode in {"IDENTITY_OVERRIDE", "INSTALLED", ""}:
        _validate_single_file_virtual_archive(manifest, destination, target_relative)
        return "SINGLE_DIRECTORY"
    raise CompactRpfError(f"Unsupported prior visual-probe mode for migration: {mode!r}")


def install_identity(gta_root: Path) -> int:
    gta_root = gta_root.resolve()
    if not (gta_root / "GTA5_Enhanced.exe").is_file():
        raise CompactRpfError(f"GTA5_Enhanced.exe not found in {gta_root}")
    if not (gta_root / "RageOpenV.asi").is_file():
        raise CompactRpfError("RageOpenV.asi is missing.")

    manifest = _load_manifest(gta_root)
    logical_path = str(manifest.get("source_logical_path", ""))
    model = str(manifest.get("model_name", ""))
    if not model:
        raise CompactRpfError("Manifest model_name is missing.")
    source_hash = _require_hash(manifest.get("source_sha256"), "source_sha256")
    transformed_hash = _require_hash(
        manifest.get("transformed_sha256", manifest.get("generated_sha256")),
        "transformed_sha256/generated_sha256",
    )
    transformed = _work_root(gta_root) / "generated" / f"{model}.ydr"
    if not transformed.is_file() or sha256_file(transformed) != transformed_hash:
        raise CompactRpfError("Preserved transformed YDR is missing or changed.")

    outer_name, nested_entry, target_relative, destination_relative = compact_archive_info(logical_path)
    destination = gta_root / Path(*PurePosixPath(destination_relative).parts)
    prior_kind = _prepare_existing_destination(gta_root, manifest, destination, target_relative)

    nested_bytes, identity_snapshot = _extract_original_nested_rpf(
        gta_root, outer_name, nested_entry, target_relative, source_hash
    )
    compact_root = _work_root(gta_root) / "compact_rpf"
    original_dir = compact_root / "original"
    staging_dir = compact_root / "staging"
    original_dir.mkdir(parents=True, exist_ok=True)
    staging_dir.mkdir(parents=True, exist_ok=True)
    archive_name = PurePosixPath(nested_entry).name
    original_rpf = original_dir / archive_name
    original_rpf.write_bytes(nested_bytes)
    identity_rpf_hash = sha256_file(original_rpf)

    staging_rpf = staging_dir / archive_name
    shutil.copy2(original_rpf, staging_rpf)
    if sha256_file(staging_rpf) != identity_rpf_hash:
        raise CompactRpfError("Staged identity RPF failed SHA-256 verification.")

    destination.parent.mkdir(parents=True, exist_ok=True)
    backup = compact_root / "previous_virtual_archive_backup"
    if backup.exists():
        if backup.is_dir():
            shutil.rmtree(backup)
        else:
            backup.unlink()
    if destination.exists():
        destination.rename(backup)
    try:
        os.replace(staging_rpf, destination)
    except Exception:
        if destination.exists():
            if destination.is_dir():
                shutil.rmtree(destination)
            else:
                destination.unlink()
        if backup.exists():
            backup.rename(destination)
        raise
    if backup.exists():
        if backup.is_dir():
            shutil.rmtree(backup)
        else:
            backup.unlink()

    manifest["probe_mode"] = "COMPACT_RPF_IDENTITY"
    manifest["tool_version"] = TOOL_VERSION
    manifest["transformed_sha256"] = transformed_hash
    manifest["generated_sha256"] = source_hash
    manifest["compact_rpf_outer_archive"] = outer_name
    manifest["compact_rpf_nested_entry"] = nested_entry
    manifest["compact_rpf_target_relative"] = target_relative
    manifest["compact_rpf_relative_path"] = destination_relative
    manifest["compact_rpf_identity_sha256"] = identity_rpf_hash
    manifest["compact_rpf_active_sha256"] = identity_rpf_hash
    manifest["compact_rpf_member_count"] = len(identity_snapshot)
    manifest["compact_rpf_prior_kind"] = prior_kind
    for key in (
        "archive_mirror_root_relative",
        "archive_mirror_file_count",
        "archive_mirror_files",
        "archive_nested_prefix",
        "archive_target_relative",
    ):
        manifest.pop(key, None)
    _save_manifest(gta_root, manifest)
    _write_report(
        gta_root,
        [
            "VOX GTA V Enhanced compact-RPF visual isolation",
            f"tool_version={TOOL_VERSION}",
            "status=COMPACT_RPF_IDENTITY_INSTALLED",
            f"model={model}",
            f"source={logical_path}",
            f"compact_rpf={destination_relative}",
            f"compact_rpf_sha256={identity_rpf_hash}",
            f"member_count={len(identity_snapshot)}",
            f"target={target_relative}",
            f"target_sha256={source_hash}",
            f"migrated_from={prior_kind}",
            "",
            "This is a real RPF file, not a directory named .rpf.",
            "Its bytes are extracted from the user's own original nested RPF.",
            "The selected YDR is still byte-identical to Rockstar for this identity/performance test.",
        ],
    )
    print("VOX_COMPACT_RPF_IDENTITY_INSTALLED")
    print(f"VOX_COMPACT_RPF_PATH={destination_relative}")
    print(f"VOX_COMPACT_RPF_MEMBERS={len(identity_snapshot)}")
    print(f"VOX_COMPACT_RPF_SHA256={identity_rpf_hash}")
    return 0


def _build_transformed_rpf(
    identity_path: Path,
    output_path: Path,
    target_relative: str,
    transformed_bytes: bytes,
    transformed_hash: str,
    crypto: Any | None = None,
) -> tuple[str, int]:
    from fivefury.rpf import RpfArchive, RpfFileEntry

    identity_bytes = identity_path.read_bytes()
    source_archive = RpfArchive.from_bytes(identity_bytes, name=identity_path.name, crypto=crypto)
    try:
        source_snapshot = _archive_snapshot(source_archive)
    finally:
        source_archive.close()
    target_key = target_relative.replace("\\", "/").lower()
    if target_key not in source_snapshot:
        raise CompactRpfError("Target is absent from preserved identity RPF.")

    archive = RpfArchive.from_bytes(identity_bytes, name=identity_path.name, crypto=crypto)
    try:
        archive.file(target_relative, transformed_bytes)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        archive.save(output_path)
    finally:
        archive.close()

    rebuilt = RpfArchive.from_path(output_path, crypto=crypto)
    try:
        rebuilt_snapshot = _archive_snapshot(rebuilt)
        target = rebuilt.find_entry(target_relative)
        if not isinstance(target, RpfFileEntry):
            raise CompactRpfError("Rebuilt compact RPF lost the transformed target.")
        if sha256_bytes(rebuilt.read_entry_standalone(target)) != transformed_hash:
            raise CompactRpfError("Rebuilt compact RPF target hash does not match transformed YDR.")
    finally:
        rebuilt.close()
    if set(rebuilt_snapshot) != set(source_snapshot):
        raise CompactRpfError("Compact RPF rebuild changed the member path set.")
    for key, digest in source_snapshot.items():
        if key == target_key:
            continue
        if rebuilt_snapshot[key] != digest:
            raise CompactRpfError(f"Compact RPF rebuild changed unrelated member: {key}")
    return sha256_file(output_path), len(rebuilt_snapshot)


def enable_transformed(gta_root: Path) -> int:
    gta_root = gta_root.resolve()
    manifest = _load_manifest(gta_root)
    if str(manifest.get("probe_mode", "")) != "COMPACT_RPF_IDENTITY":
        raise CompactRpfError("Compact identity mode is not active. Prove identity performance/stability first.")
    model = str(manifest.get("model_name", ""))
    transformed_hash = _require_hash(manifest.get("transformed_sha256"), "transformed_sha256")
    identity_rpf_hash = _require_hash(manifest.get("compact_rpf_identity_sha256"), "compact_rpf_identity_sha256")
    active_hash = _require_hash(manifest.get("compact_rpf_active_sha256"), "compact_rpf_active_sha256")
    if active_hash != identity_rpf_hash:
        raise CompactRpfError("Manifest identity/active compact RPF hashes disagree.")
    relative = str(manifest.get("compact_rpf_relative_path", ""))
    parts = _safe_parts(relative)
    if parts[:2] != ["newmods", "platform"]:
        raise CompactRpfError("Compact RPF destination escaped newmods/platform.")
    destination = gta_root / Path(*parts)
    if not destination.is_file() or sha256_file(destination) != identity_rpf_hash:
        raise CompactRpfError("Active compact identity RPF is missing or changed.")

    identity_path = _work_root(gta_root) / "compact_rpf" / "original" / destination.name
    if not identity_path.is_file() or sha256_file(identity_path) != identity_rpf_hash:
        raise CompactRpfError("Preserved compact identity RPF is missing or changed.")
    transformed = _work_root(gta_root) / "generated" / f"{model}.ydr"
    if not transformed.is_file() or sha256_file(transformed) != transformed_hash:
        raise CompactRpfError("Preserved transformed YDR is missing or changed.")
    target_relative = str(manifest.get("compact_rpf_target_relative", ""))

    cache = _make_cache(gta_root)
    try:
        staging = _work_root(gta_root) / "compact_rpf" / "staging" / (destination.name + ".transformed")
        transformed_rpf_hash, member_count = _build_transformed_rpf(
            identity_path,
            staging,
            target_relative,
            transformed.read_bytes(),
            transformed_hash,
            crypto=cache.crypto,
        )
    finally:
        cache.close()
    if transformed_rpf_hash == identity_rpf_hash:
        raise CompactRpfError("Transformed compact RPF is byte-identical to identity RPF.")
    os.replace(staging, destination)
    if sha256_file(destination) != transformed_rpf_hash:
        raise CompactRpfError("Installed transformed compact RPF failed SHA-256 verification.")

    manifest["probe_mode"] = "COMPACT_RPF_TRANSFORMED"
    manifest["generated_sha256"] = transformed_hash
    manifest["compact_rpf_active_sha256"] = transformed_rpf_hash
    manifest["compact_rpf_transformed_sha256"] = transformed_rpf_hash
    manifest["compact_rpf_member_count"] = member_count
    _save_manifest(gta_root, manifest)
    _write_report(
        gta_root,
        [
            "VOX GTA V Enhanced compact-RPF visual probe",
            f"tool_version={TOOL_VERSION}",
            "status=COMPACT_RPF_TRANSFORMED_INSTALLED",
            f"model={model}",
            f"compact_rpf={relative}",
            f"compact_rpf_sha256={transformed_rpf_hash}",
            f"member_count={member_count}",
            f"target={target_relative}",
            f"target_sha256={transformed_hash}",
            "",
            "Only the selected YDR differs from the preserved identity archive at the standalone-member level.",
        ],
    )
    print("VOX_COMPACT_RPF_TRANSFORMED_INSTALLED")
    print(f"VOX_COMPACT_RPF_SHA256={transformed_rpf_hash}")
    return 0


def rollback(gta_root: Path) -> int:
    gta_root = gta_root.resolve()
    manifest = _load_manifest(gta_root)
    mode = str(manifest.get("probe_mode", ""))
    if mode not in {"COMPACT_RPF_IDENTITY", "COMPACT_RPF_TRANSFORMED"}:
        raise CompactRpfError(f"Compact RPF rollback cannot handle mode {mode!r}")
    relative = str(manifest.get("compact_rpf_relative_path", ""))
    parts = _safe_parts(relative)
    if parts[:2] != ["newmods", "platform"]:
        raise CompactRpfError("Compact RPF destination escaped newmods/platform.")
    destination = gta_root / Path(*parts)
    active_hash = _require_hash(manifest.get("compact_rpf_active_sha256"), "compact_rpf_active_sha256")
    if not destination.is_file() or sha256_file(destination) != active_hash:
        raise CompactRpfError("Active compact RPF is missing or changed; refusing deletion.")
    destination.unlink()
    platform_root = (gta_root / "newmods" / "platform").resolve()
    parent = destination.parent
    while parent.exists() and parent.resolve() != platform_root:
        try:
            next(parent.iterdir())
            break
        except StopIteration:
            parent.rmdir()
            parent = parent.parent
    manifest["probe_mode"] = "COMPACT_RPF_ROLLED_BACK"
    manifest.pop("compact_rpf_active_sha256", None)
    _save_manifest(gta_root, manifest)
    _write_report(
        gta_root,
        [
            "VOX GTA V Enhanced compact-RPF visual probe",
            f"tool_version={TOOL_VERSION}",
            "status=COMPACT_RPF_ROLLED_BACK",
            f"previous_mode={mode}",
            f"removed={relative}",
            "Preserved local source/generated work remains available for further diagnosis.",
        ],
    )
    print("VOX_COMPACT_RPF_ROLLED_BACK")
    return 0


def self_test() -> int:
    from fivefury import Vector2, Vector3, YdrGen9Shader, YdrMeshInput, create_ydr, read_ydr
    from fivefury.rpf import RpfArchive

    outer, nested, target, relative = compact_archive_info(
        "x64f.rpf/levels/gta5/props/roadside/v_construction.rpf/prop_roadcone02a.ydr"
    )
    if outer != "x64f.rpf":
        raise CompactRpfError(f"Unexpected outer RPF: {outer}")
    if nested != "levels/gta5/props/roadside/v_construction.rpf":
        raise CompactRpfError(f"Unexpected nested RPF entry: {nested}")
    if target != "prop_roadcone02a.ydr":
        raise CompactRpfError(f"Unexpected target: {target}")
    if relative != "newmods/platform/levels/gta5/props/roadside/v_construction.rpf":
        raise CompactRpfError(f"Unexpected compact destination: {relative}")

    with tempfile.TemporaryDirectory(prefix="vox-compact-rpf-") as temp:
        root = Path(temp)
        source_ydr = root / "source.ydr"
        transformed_ydr = root / "transformed.ydr"
        mesh = YdrMeshInput(
            positions=[Vector3(0.0, 0.0, 0.0), Vector3(1.0, 0.0, 0.0), Vector3(0.0, 1.0, 0.0)],
            indices=[0, 1, 2],
            texcoords=[[Vector2(), Vector2(1.0, 0.0), Vector2(0.0, 1.0)]],
        )
        create_ydr(meshes=[mesh], shader=YdrGen9Shader.DEFAULT, name="compact_probe", version=159).save(source_ydr)
        drawable = read_ydr(source_ydr)
        first_mesh = next(iter(drawable.iter_meshes()))
        for pos in first_mesh.positions:
            pos.x *= 1.5
            pos.y *= 1.5
            pos.z *= 1.5
        drawable.save(transformed_ydr)
        source_hash = sha256_file(source_ydr)
        transformed_hash = sha256_file(transformed_ydr)
        if source_hash == transformed_hash:
            raise CompactRpfError("Synthetic transformed YDR did not change.")

        nested_archive = RpfArchive.empty("v_construction.rpf")
        nested_archive.file("prop_roadcone02a.ydr", source_ydr.read_bytes())
        nested_archive.file("keep.bin", b"unchanged-member")
        nested_path = root / "v_construction.rpf"
        nested_archive.save(nested_path)
        nested_archive.close()

        outer_archive = RpfArchive.empty("x64f.rpf")
        outer_archive.file("levels/gta5/props/roadside/v_construction.rpf", nested_path.read_bytes(), compress_binary=True)
        outer_path = root / "x64f.rpf"
        outer_archive.save(outer_path)
        outer_archive.close()

        parsed_outer = RpfArchive.from_path(outer_path)
        try:
            nested_entry_obj = parsed_outer.find_entry("levels/gta5/props/roadside/v_construction.rpf")
            if nested_entry_obj is None:
                raise CompactRpfError("Synthetic outer RPF lost nested archive entry.")
            extracted = parsed_outer.read_entry_standalone(nested_entry_obj)
        finally:
            parsed_outer.close()
        if sha256_bytes(extracted) != sha256_file(nested_path):
            raise CompactRpfError("Synthetic nested RPF extraction was not byte-identical.")

        output = root / "v_construction_transformed.rpf"
        rebuilt_hash, member_count = _build_transformed_rpf(
            nested_path,
            output,
            "prop_roadcone02a.ydr",
            transformed_ydr.read_bytes(),
            transformed_hash,
        )
        if member_count != 2:
            raise CompactRpfError(f"Synthetic member count changed: {member_count}")
        if rebuilt_hash == sha256_file(nested_path):
            raise CompactRpfError("Synthetic compact RPF rebuild did not change archive bytes.")

    print("VOX_COMPACT_RPF_SELF_TEST_OK")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="VOX compact real-RPF visual probe")
    commands = parser.add_subparsers(dest="command", required=True)
    install = commands.add_parser("install-identity")
    install.add_argument("--gta-root", type=Path, required=True)
    transformed = commands.add_parser("enable-transformed")
    transformed.add_argument("--gta-root", type=Path, required=True)
    rb = commands.add_parser("rollback")
    rb.add_argument("--gta-root", type=Path, required=True)
    commands.add_parser("self-test")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        if args.command == "install-identity":
            return install_identity(args.gta_root)
        if args.command == "enable-transformed":
            return enable_transformed(args.gta_root)
        if args.command == "rollback":
            return rollback(args.gta_root)
        if args.command == "self-test":
            return self_test()
        raise CompactRpfError(f"Unknown command: {args.command}")
    except Exception as exc:
        print(f"VOX_COMPACT_RPF_ERROR={type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
