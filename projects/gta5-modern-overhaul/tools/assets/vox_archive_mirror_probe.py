from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any, Iterable

TOOL_VERSION = "0.0.1-dev.15.3"
FIVEFURY_VERSION = "0.4.21"


class ArchiveMirrorError(RuntimeError):
    pass


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
        raise ArchiveMirrorError(f"Unsafe path: {value!r}")
    if any(":" in part for part in parts):
        raise ArchiveMirrorError(f"Path contains drive/URI component: {value!r}")
    return parts


def nested_archive_info(logical_path: str) -> tuple[str, str, str]:
    parts = _safe_parts(logical_path)
    if len(parts) < 3 or not parts[0].lower().startswith("x64") or not parts[0].lower().endswith(".rpf"):
        raise ArchiveMirrorError(f"Expected base x64*.rpf asset, got {logical_path!r}")
    parent_indexes = [index for index, part in enumerate(parts[:-1]) if part.lower().endswith(".rpf")]
    if len(parent_indexes) < 2:
        raise ArchiveMirrorError(
            "The current RageOpenV directory probe requires an asset inside a nested RPF."
        )
    nested_index = parent_indexes[-1]
    nested_prefix = "/".join(parts[: nested_index + 1])
    mirror_relative = PurePosixPath("newmods", "platform", *parts[1 : nested_index + 1]).as_posix()
    target_relative = "/".join(parts[nested_index + 1 :])
    if not target_relative:
        raise ArchiveMirrorError("Selected asset has no path inside its nested archive.")
    return nested_prefix, mirror_relative, target_relative


def _manifest_path(gta_root: Path) -> Path:
    return gta_root / "VOXModernOverhaul" / "visual_probe" / "visual_probe_manifest.json"


def _report_path(gta_root: Path) -> Path:
    return gta_root / "VOXModernOverhaul" / "visual_probe" / "visual_probe_report.txt"


def _work_root(gta_root: Path) -> Path:
    return gta_root / "VOXModernOverhaul" / "visual_probe" / "work"


def _load_manifest(gta_root: Path) -> dict[str, Any]:
    path = _manifest_path(gta_root)
    if not path.is_file():
        raise ArchiveMirrorError("visual_probe_manifest.json is missing. Keep the dev.15.1/15.2 probe state.")
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict):
        raise ArchiveMirrorError("Visual probe manifest is not a JSON object.")
    return value


def _save_manifest(gta_root: Path, manifest: dict[str, Any]) -> None:
    path = _manifest_path(gta_root)
    temp = path.with_suffix(".json.tmp")
    temp.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    os.replace(temp, path)


def _write_report(gta_root: Path, lines: Iterable[str]) -> None:
    path = _report_path(gta_root)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def _require_hash(value: Any, name: str) -> str:
    text = str(value or "").lower()
    if len(text) != 64 or any(ch not in "0123456789abcdef" for ch in text):
        raise ArchiveMirrorError(f"Manifest {name} is not a SHA-256 value.")
    return text


def _tree_records(cache: Any, nested_prefix: str) -> list[Any]:
    prefix = nested_prefix.lower().rstrip("/") + "/"
    result = [record for record in cache if str(record.path).replace("\\", "/").lower().startswith(prefix)]
    result.sort(key=lambda record: str(record.path).lower())
    if not result:
        raise ArchiveMirrorError(f"No indexed entries were found below {nested_prefix}")
    return result


def _relative_inside_archive(record_path: str, nested_prefix: str) -> Path:
    normalized = record_path.replace("\\", "/")
    prefix = nested_prefix.rstrip("/") + "/"
    if not normalized.lower().startswith(prefix.lower()):
        raise ArchiveMirrorError(f"Record escaped nested archive: {record_path}")
    relative = normalized[len(prefix) :]
    parts = _safe_parts(relative)
    return Path(*parts)


def _make_cache(gta_root: Path) -> Any:
    import importlib.metadata

    version = importlib.metadata.version("fivefury")
    if version != FIVEFURY_VERSION:
        raise ArchiveMirrorError(f"FiveFury version mismatch: expected {FIVEFURY_VERSION}, got {version}")
    from fivefury import GameFileCache, GameTarget

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


def install_full_identity(gta_root: Path) -> int:
    gta_root = gta_root.resolve()
    if not (gta_root / "GTA5_Enhanced.exe").is_file():
        raise ArchiveMirrorError(f"GTA5_Enhanced.exe not found in {gta_root}")
    if not (gta_root / "RageOpenV.asi").is_file():
        raise ArchiveMirrorError("RageOpenV.asi is missing.")

    manifest = _load_manifest(gta_root)
    logical_path = str(manifest.get("source_logical_path", ""))
    model = str(manifest.get("model_name", ""))
    source_hash = _require_hash(manifest.get("source_sha256"), "source_sha256")
    transformed_hash = _require_hash(
        manifest.get("transformed_sha256", manifest.get("generated_sha256")),
        "transformed_sha256/generated_sha256",
    )
    nested_prefix, mirror_relative, target_relative = nested_archive_info(logical_path)
    mirror_root = gta_root / Path(*PurePosixPath(mirror_relative).parts)
    target = mirror_root / Path(*PurePosixPath(target_relative).parts)

    original = _work_root(gta_root) / "original" / f"{model}.ydr"
    transformed = _work_root(gta_root) / "generated" / f"{model}.ydr"
    if not original.is_file() or sha256_file(original) != source_hash:
        raise ArchiveMirrorError("Preserved extracted original is missing or its hash changed.")
    if not transformed.is_file() or sha256_file(transformed) != transformed_hash:
        raise ArchiveMirrorError("Preserved transformed YDR is missing or its hash changed.")

    if not target.is_file() or sha256_file(target) != source_hash:
        raise ArchiveMirrorError(
            "The active dev.15.2 identity target is not present/hash-identical. "
            "Do not guess; reinstall dev.15.2 identity isolation first."
        )

    current_files = [path for path in mirror_root.rglob("*") if path.is_file()]
    if len(current_files) != 1 or current_files[0].resolve() != target.resolve():
        raise ArchiveMirrorError(
            "The current virtual archive contains files other than the owned identity target. "
            "Refusing to overwrite a directory that may contain another mod."
        )

    cache = _make_cache(gta_root)
    try:
        records = _tree_records(cache, nested_prefix)
        staging_parent = _work_root(gta_root) / "archive_mirror_staging"
        staging = staging_parent / PurePosixPath(mirror_relative).name
        if staging_parent.exists():
            shutil.rmtree(staging_parent)
        staging.mkdir(parents=True, exist_ok=True)

        file_entries: list[dict[str, str]] = []
        seen: set[str] = set()
        for record in records:
            relative = _relative_inside_archive(str(record.path), nested_prefix)
            key = relative.as_posix().lower()
            if key in seen:
                raise ArchiveMirrorError(f"Duplicate indexed archive path: {relative.as_posix()}")
            seen.add(key)
            destination = staging / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            extracted = cache.extract_asset(record, destination, logical=False)
            if extracted is None or not destination.is_file():
                raise ArchiveMirrorError(f"Failed to extract complete archive member: {record.path}")
            file_entries.append({"path": relative.as_posix(), "sha256": sha256_file(destination)})

        staged_target = staging / Path(*PurePosixPath(target_relative).parts)
        if not staged_target.is_file():
            raise ArchiveMirrorError("Complete mirror did not contain the selected target YDR.")
        if sha256_file(staged_target) != source_hash:
            raise ArchiveMirrorError(
                "Selected YDR extracted from the complete archive does not match the preserved source hash."
            )

        old_root = _work_root(gta_root) / "incomplete_archive_backup"
        if old_root.exists():
            shutil.rmtree(old_root)
        old_root.parent.mkdir(parents=True, exist_ok=True)
        mirror_root.rename(old_root)
        try:
            staging.rename(mirror_root)
        except Exception:
            old_root.rename(mirror_root)
            raise
        shutil.rmtree(old_root)
        if staging_parent.exists():
            shutil.rmtree(staging_parent)

        manifest["probe_mode"] = "FULL_ARCHIVE_IDENTITY"
        manifest["tool_version"] = TOOL_VERSION
        manifest["archive_nested_prefix"] = nested_prefix
        manifest["archive_mirror_root_relative"] = mirror_relative
        manifest["archive_target_relative"] = target_relative
        manifest["archive_mirror_file_count"] = len(file_entries)
        manifest["archive_mirror_files"] = file_entries
        manifest["generated_sha256"] = source_hash
        manifest["transformed_sha256"] = transformed_hash
        _save_manifest(gta_root, manifest)

        _write_report(
            gta_root,
            [
                "VOX GTA V Enhanced visual archive-mirror isolation",
                f"tool_version={TOOL_VERSION}",
                "status=FULL_ARCHIVE_IDENTITY_INSTALLED",
                f"model={model}",
                f"nested_archive={nested_prefix}",
                f"mirror_root={mirror_relative}",
                f"mirrored_file_count={len(file_entries)}",
                f"target={target_relative}",
                f"target_sha256={source_hash}",
                "",
                "The complete nested RPF is now mirrored as a RageOpenV directory archive.",
                "Every mirrored member is extracted from the user's own GTA installation.",
                "The selected target remains byte-identical to Rockstar for this test.",
                "Launch Story Mode. If it loads, the previous crash was caused by replacing the whole nested RPF with an incomplete one-file directory.",
            ],
        )
        print("VOX_FULL_ARCHIVE_IDENTITY_INSTALLED")
        print(f"VOX_FULL_ARCHIVE_FILES={len(file_entries)}")
        print(f"VOX_FULL_ARCHIVE_ROOT={mirror_relative}")
        return 0
    finally:
        cache.close()


def enable_transformed(gta_root: Path) -> int:
    gta_root = gta_root.resolve()
    manifest = _load_manifest(gta_root)
    if str(manifest.get("probe_mode", "")) != "FULL_ARCHIVE_IDENTITY":
        raise ArchiveMirrorError("Full-archive identity mode is not active. Prove that Story Mode loads first.")
    source_hash = _require_hash(manifest.get("source_sha256"), "source_sha256")
    transformed_hash = _require_hash(manifest.get("transformed_sha256"), "transformed_sha256")
    model = str(manifest.get("model_name", ""))
    mirror_relative = str(manifest.get("archive_mirror_root_relative", ""))
    target_relative = str(manifest.get("archive_target_relative", ""))
    mirror_root = gta_root / Path(*PurePosixPath(mirror_relative).parts)
    target = mirror_root / Path(*PurePosixPath(target_relative).parts)
    transformed = _work_root(gta_root) / "generated" / f"{model}.ydr"
    if not target.is_file() or sha256_file(target) != source_hash:
        raise ArchiveMirrorError("Full-archive identity target changed before transform enable.")
    if not transformed.is_file() or sha256_file(transformed) != transformed_hash:
        raise ArchiveMirrorError("Preserved transformed YDR is missing or changed.")

    temp = target.with_name(target.name + ".vox_transform_tmp")
    shutil.copy2(transformed, temp)
    if sha256_file(temp) != transformed_hash:
        temp.unlink(missing_ok=True)
        raise ArchiveMirrorError("Transformed copy hash verification failed.")
    os.replace(temp, target)

    entries = manifest.get("archive_mirror_files")
    if not isinstance(entries, list):
        raise ArchiveMirrorError("Archive mirror file manifest is missing.")
    target_key = PurePosixPath(target_relative).as_posix().lower()
    updated = False
    for entry in entries:
        if isinstance(entry, dict) and str(entry.get("path", "")).lower() == target_key:
            entry["sha256"] = transformed_hash
            updated = True
            break
    if not updated:
        raise ArchiveMirrorError("Target is absent from archive mirror file manifest.")

    manifest["probe_mode"] = "FULL_ARCHIVE_TRANSFORMED"
    manifest["generated_sha256"] = transformed_hash
    _save_manifest(gta_root, manifest)
    _write_report(
        gta_root,
        [
            "VOX GTA V Enhanced visual archive-mirror probe",
            f"tool_version={TOOL_VERSION}",
            "status=FULL_ARCHIVE_TRANSFORMED_INSTALLED",
            f"model={model}",
            f"mirror_root={mirror_relative}",
            f"target={target_relative}",
            f"generated_sha256={transformed_hash}",
            "",
            "The complete nested archive remains mirrored; only the selected target is now the transformed YDR.",
            "Launch Story Mode and look for the oversized selected model.",
        ],
    )
    print("VOX_FULL_ARCHIVE_TRANSFORMED_INSTALLED")
    return 0


def rollback(gta_root: Path) -> int:
    gta_root = gta_root.resolve()
    manifest = _load_manifest(gta_root)
    mode = str(manifest.get("probe_mode", ""))
    if mode not in {"FULL_ARCHIVE_IDENTITY", "FULL_ARCHIVE_TRANSFORMED"}:
        raise ArchiveMirrorError(f"Full-archive rollback cannot handle mode {mode!r}")
    mirror_relative = str(manifest.get("archive_mirror_root_relative", ""))
    parts = _safe_parts(mirror_relative)
    if parts[:2] != ["newmods", "platform"]:
        raise ArchiveMirrorError("Archive mirror root is outside newmods/platform.")
    mirror_root = gta_root / Path(*parts)
    entries = manifest.get("archive_mirror_files")
    if not isinstance(entries, list) or not entries:
        raise ArchiveMirrorError("Archive mirror file manifest is empty.")

    expected: dict[str, str] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            raise ArchiveMirrorError("Malformed archive mirror file manifest entry.")
        relative = PurePosixPath(*_safe_parts(str(entry.get("path", "")))).as_posix()
        expected[relative.lower()] = _require_hash(entry.get("sha256"), f"archive_mirror_files[{relative}]")

    actual_files = [path for path in mirror_root.rglob("*") if path.is_file()] if mirror_root.exists() else []
    actual_keys = {path.relative_to(mirror_root).as_posix().lower() for path in actual_files}
    if actual_keys != set(expected):
        raise ArchiveMirrorError("Mirrored archive file set changed. Refusing recursive deletion.")
    for path in actual_files:
        key = path.relative_to(mirror_root).as_posix().lower()
        if sha256_file(path) != expected[key]:
            raise ArchiveMirrorError(f"Mirrored archive member changed: {key}. Refusing deletion.")

    shutil.rmtree(mirror_root)
    parent = mirror_root.parent
    platform_root = (gta_root / "newmods" / "platform").resolve()
    while parent.exists() and parent.resolve() != platform_root:
        try:
            next(parent.iterdir())
            break
        except StopIteration:
            parent.rmdir()
            parent = parent.parent

    work = _work_root(gta_root)
    if work.exists():
        shutil.rmtree(work)
    _manifest_path(gta_root).unlink(missing_ok=True)
    _write_report(
        gta_root,
        [
            "VOX GTA V Enhanced visual probe",
            f"tool_version={TOOL_VERSION}",
            "status=ROLLED_BACK",
            f"previous_mode={mode}",
            f"previous_mirror_root={mirror_relative}",
            "All full-archive mirror members were hash-verified before removal.",
        ],
    )
    print("VOX_FULL_ARCHIVE_ROLLED_BACK")
    return 0


class _FakeRecord:
    def __init__(self, path: str, data: bytes) -> None:
        self.path = path
        self.data = data


class _FakeCache:
    def __init__(self, records: list[_FakeRecord]) -> None:
        self.records = records

    def __iter__(self):
        return iter(self.records)

    def extract_asset(self, record: _FakeRecord, destination: Path, *, logical: bool = False):
        if logical:
            raise AssertionError("mirror must preserve standalone archive bytes")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(record.data)
        return destination


def self_test() -> int:
    nested, mirror, target = nested_archive_info(
        "x64c.rpf/levels/gta5/props/roadside/v_construction.rpf/prop_roadcone02a.ydr"
    )
    if nested != "x64c.rpf/levels/gta5/props/roadside/v_construction.rpf":
        raise ArchiveMirrorError(f"Unexpected nested prefix: {nested}")
    if mirror != "newmods/platform/levels/gta5/props/roadside/v_construction.rpf":
        raise ArchiveMirrorError(f"Unexpected mirror root: {mirror}")
    if target != "prop_roadcone02a.ydr":
        raise ArchiveMirrorError(f"Unexpected target relative path: {target}")

    records = [
        _FakeRecord(nested + "/prop_roadcone02a.ydr", b"cone"),
        _FakeRecord(nested + "/prop_barrier_work05.ydr", b"barrier"),
        _FakeRecord(nested + "/textures/roadwork.ytd", b"textures"),
    ]
    fake = _FakeCache(records)
    selected = _tree_records(fake, nested)
    if len(selected) != 3:
        raise ArchiveMirrorError("Complete nested archive selection lost records.")
    with tempfile.TemporaryDirectory(prefix="vox-rpf-mirror-") as temp:
        root = Path(temp)
        for record in selected:
            relative = _relative_inside_archive(record.path, nested)
            fake.extract_asset(record, root / relative, logical=False)
        if sorted(path.relative_to(root).as_posix() for path in root.rglob("*") if path.is_file()) != [
            "prop_barrier_work05.ydr",
            "prop_roadcone02a.ydr",
            "textures/roadwork.ytd",
        ]:
            raise ArchiveMirrorError("Complete archive mirror layout regression.")
    print("VOX_ARCHIVE_MIRROR_SELF_TEST_OK")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="VOX complete nested-RPF RageOpenV probe")
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("install-full-identity", "enable-transformed", "rollback"):
        command = commands.add_parser(name)
        command.add_argument("--gta-root", type=Path, required=True)
    commands.add_parser("self-test")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        if args.command == "install-full-identity":
            return install_full_identity(args.gta_root)
        if args.command == "enable-transformed":
            return enable_transformed(args.gta_root)
        if args.command == "rollback":
            return rollback(args.gta_root)
        if args.command == "self-test":
            return self_test()
        raise ArchiveMirrorError(f"Unknown command: {args.command}")
    except Exception as exc:
        print(f"VOX_ARCHIVE_MIRROR_ERROR={type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
