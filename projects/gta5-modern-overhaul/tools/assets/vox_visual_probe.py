from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import math
import os
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Iterable

TOOL_VERSION = "0.0.1-dev.15"
FIVEFURY_VERSION = "0.4.21"
DEFAULT_SCALE = 1.65

CANDIDATES: tuple[tuple[str, str], ...] = (
    ("prop_traffic_01a", "traffic light"),
    ("prop_traffic_01b", "traffic light"),
    ("prop_traffic_03a", "traffic light"),
    ("prop_streetlight_01", "street light"),
    ("prop_streetlight_03", "street light"),
    ("prop_bin_01a", "street bin"),
    ("prop_roadcone02a", "road cone"),
    ("prop_palm_sm_01a", "palm tree"),
    ("prop_tree_cedar_02", "cedar tree"),
    ("prop_tree_pine_01", "pine tree"),
)


class VisualProbeError(RuntimeError):
    pass


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _normalized_parts(logical_path: str) -> list[str]:
    normalized = logical_path.replace("\\", "/").strip("/")
    parts = list(PurePosixPath(normalized).parts)
    if not parts:
        raise VisualProbeError("Asset path is empty.")
    if any(part in ("", ".", "..") for part in parts):
        raise VisualProbeError(f"Unsafe asset path: {logical_path!r}")
    if any(":" in part for part in parts):
        raise VisualProbeError(f"Asset path contains a drive/URI component: {logical_path!r}")
    return parts


def rageopenv_platform_mirror_relative(logical_path: str) -> Path:
    """Map a base x64*.rpf chain into RageOpenV's newmods/platform mount."""
    parts = _normalized_parts(logical_path)
    outer = parts[0].lower()
    if not (outer.startswith("x64") and outer.endswith(".rpf")):
        raise VisualProbeError(
            "The first visual proof accepts only base-game x64*.rpf assets; "
            f"got {logical_path!r}."
        )
    if len(parts) < 2 or not parts[-1].lower().endswith(".ydr"):
        raise VisualProbeError(f"Expected a YDR below a base x64 RPF: {logical_path!r}")
    return Path("newmods") / "platform" / Path(*parts[1:])


def _components(value: Any) -> tuple[float, float, float]:
    values = tuple(value.components) if hasattr(value, "components") else tuple(value)
    if len(values) != 3:
        raise VisualProbeError(f"Expected 3D vector, got {values!r}")
    return float(values[0]), float(values[1]), float(values[2])


def _all_positions(ydr: Any) -> list[Any]:
    result: list[Any] = []
    for mesh in ydr.iter_meshes():
        result.extend(mesh.positions)
    return result


def _assert_scaled(before: Iterable[float], after: Iterable[float], scale: float) -> None:
    left = tuple(float(value) for value in before)
    right = tuple(float(value) for value in after)
    if len(left) != len(right):
        raise VisualProbeError("Scaled vector length mismatch.")
    for original, transformed in zip(left, right):
        expected = original * scale
        tolerance = max(1e-5, abs(expected) * 2e-5)
        if abs(transformed - expected) > tolerance:
            raise VisualProbeError(
                f"Geometry verification failed: {original} * {scale} != {transformed}."
            )


def scale_ydr_render_geometry(ydr: Any, scale: float) -> dict[str, Any]:
    if not math.isfinite(scale) or scale <= 1.0 or scale > 3.0:
        raise VisualProbeError("Scale must be finite, > 1.0 and <= 3.0.")

    from fivefury import Vector3

    before_positions = _all_positions(ydr)
    if not before_positions:
        raise VisualProbeError("Candidate YDR contains no render vertices.")

    vertex_count = 0
    for mesh in ydr.iter_meshes():
        transformed = []
        for position in mesh.positions:
            x, y, z = _components(position)
            transformed.append(Vector3(x * scale, y * scale, z * scale))
            vertex_count += 1
        mesh.positions = transformed

    after_positions = _all_positions(ydr)
    xyz = [_components(value) for value in after_positions]
    minimum = Vector3(
        min(value[0] for value in xyz),
        min(value[1] for value in xyz),
        min(value[2] for value in xyz),
    )
    maximum = Vector3(
        max(value[0] for value in xyz),
        max(value[1] for value in xyz),
        max(value[2] for value in xyz),
    )
    center = Vector3(
        (minimum.x + maximum.x) * 0.5,
        (minimum.y + maximum.y) * 0.5,
        (minimum.z + maximum.z) * 0.5,
    )
    radius = max(
        math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2 + (z - center.z) ** 2)
        for x, y, z in xyz
    )

    ydr.bounding_box_min = minimum
    ydr.bounding_box_max = maximum
    ydr.bounding_center = center
    ydr.bounding_sphere_radius = float(radius)
    for lod, distance in list(ydr.lod_distances.items()):
        if float(distance) > 0.0:
            ydr.lod_distances[lod] = float(distance) * scale

    return {
        "vertex_count": vertex_count,
        "first_vertex_before": _components(before_positions[0]),
        "first_vertex_after": _components(after_positions[0]),
        "bounding_box_min": _components(minimum),
        "bounding_box_max": _components(maximum),
        "bounding_sphere_radius": float(radius),
        "has_embedded_collision": ydr.bound is not None,
        "has_skeleton": ydr.skeleton is not None,
        "embedded_light_count": len(ydr.lights),
    }


def transform_ydr(source: Path, destination: Path, scale: float) -> dict[str, Any]:
    from fivefury import read_ydr

    ydr = read_ydr(source, path=source)
    positions = _all_positions(ydr)
    if not positions:
        raise VisualProbeError("Source YDR contains no render geometry.")
    before_first = _components(positions[0])
    source_version = int(ydr.version)

    stats = scale_ydr_render_geometry(ydr, scale)
    destination.parent.mkdir(parents=True, exist_ok=True)
    ydr.save(destination)

    rebuilt = read_ydr(destination, path=destination)
    if int(rebuilt.version) != source_version:
        raise VisualProbeError(
            f"YDR version changed during rewrite: {source_version} -> {rebuilt.version}."
        )
    validation = rebuilt.validate()
    if not validation.valid:
        details = "; ".join(f"[{item.code}] {item.message}" for item in validation.errors)
        raise VisualProbeError(f"FiveFury validation failed: {details}")
    rebuilt_positions = _all_positions(rebuilt)
    if not rebuilt_positions:
        raise VisualProbeError("Rebuilt YDR contains no render geometry.")
    _assert_scaled(before_first, _components(rebuilt_positions[0]), scale)

    minimum = _components(rebuilt.bounding_box_min)
    maximum = _components(rebuilt.bounding_box_max)
    if any(low > high for low, high in zip(minimum, maximum)):
        raise VisualProbeError("Rebuilt YDR has an invalid bounding box.")
    stats["source_ydr_version"] = source_version
    stats["rebuilt_ydr_version"] = int(rebuilt.version)
    stats["validation_warning_count"] = len(validation.warnings)
    return stats


def _safe_base_matches(cache: Any, model_name: str) -> list[Any]:
    result: list[Any] = []
    for asset in cache.find_assets(model_name, kind=".ydr", exact=True, limit=64):
        try:
            rageopenv_platform_mirror_relative(asset.path)
        except VisualProbeError:
            continue
        result.append(asset)
    return result


def choose_candidate(cache: Any, gta_root: Path) -> tuple[Any, str]:
    for model_name, description in CANDIDATES:
        for asset in _safe_base_matches(cache, model_name):
            destination = gta_root / rageopenv_platform_mirror_relative(asset.path)
            if not destination.exists():
                return asset, description
    raise VisualProbeError(
        "No safe base-game candidate was found without colliding with an existing override. "
        "Nothing was modified."
    )


def _probe_root(gta_root: Path) -> Path:
    return gta_root / "VOXModernOverhaul" / "visual_probe"


def _manifest_path(gta_root: Path) -> Path:
    return _probe_root(gta_root) / "visual_probe_manifest.json"


def _report_path(gta_root: Path) -> Path:
    return _probe_root(gta_root) / "visual_probe_report.txt"


def _write_report(gta_root: Path, lines: list[str]) -> None:
    report = _report_path(gta_root)
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def install_probe(gta_root: Path, scale: float) -> int:
    gta_root = gta_root.resolve()
    if not (gta_root / "GTA5_Enhanced.exe").is_file():
        raise VisualProbeError(f"GTA5_Enhanced.exe not found in {gta_root}")
    if not (gta_root / "RageOpenV.asi").is_file():
        raise VisualProbeError(
            "RageOpenV.asi was not found. This checkpoint refuses direct edits to Rockstar archives."
        )

    manifest_path = _manifest_path(gta_root)
    if manifest_path.exists():
        existing = json.loads(manifest_path.read_text(encoding="utf-8"))
        relative = Path(str(existing.get("override_relative_path", "")))
        installed = gta_root / relative
        expected_hash = str(existing.get("generated_sha256", "")).lower()
        if installed.is_file() and expected_hash == sha256_file(installed):
            raise VisualProbeError(
                "A VOX visual probe is already installed. Run 03_ROLLBACK_VISUAL_PROBE.cmd first."
            )
        raise VisualProbeError(
            "A visual-probe manifest exists but its file no longer matches. Refusing overwrite."
        )

    runtime_version = importlib.metadata.version("fivefury")
    if runtime_version != FIVEFURY_VERSION:
        raise VisualProbeError(
            f"FiveFury version mismatch: expected {FIVEFURY_VERSION}, got {runtime_version}."
        )

    from fivefury import GameFileCache, GameTarget

    work_root = _probe_root(gta_root) / "work"
    work_root.mkdir(parents=True, exist_ok=True)
    index_cache_path = work_root / "fivefury-game-index.bin"
    _write_report(
        gta_root,
        [
            "VOX GTA V Enhanced visual probe",
            f"tool_version={TOOL_VERSION}",
            "status=SCANNING",
            f"fivefury={runtime_version}",
            "No Rockstar archive is modified in place.",
        ],
    )

    cache = GameFileCache(
        gta_root,
        game=GameTarget.GTA5_ENHANCED,
        use_index_cache=True,
        index_cache_path=index_cache_path,
        load_vehicles=False,
        load_peds=False,
        load_audio=False,
    )
    try:
        cache.scan_game(use_index_cache=True)
        asset, description = choose_candidate(cache, gta_root)
        relative = rageopenv_platform_mirror_relative(asset.path)
        destination = gta_root / relative

        source = work_root / "original" / asset.name
        generated = work_root / "generated" / asset.name
        source.parent.mkdir(parents=True, exist_ok=True)
        generated.parent.mkdir(parents=True, exist_ok=True)
        extracted = cache.extract_asset(asset, source)
        if extracted is None or not source.is_file():
            raise VisualProbeError(f"Could not extract {asset.path}")

        source_hash = sha256_file(source)
        stats = transform_ydr(source, generated, scale)
        generated_hash = sha256_file(generated)
        if source_hash == generated_hash:
            raise VisualProbeError("Generated asset is identical to source; refusing install.")
        if destination.exists():
            raise VisualProbeError(f"Override destination became occupied: {destination}")

        destination.parent.mkdir(parents=True, exist_ok=True)
        temp_destination = destination.with_name(destination.name + ".vox_tmp")
        shutil.copy2(generated, temp_destination)
        if sha256_file(temp_destination) != generated_hash:
            temp_destination.unlink(missing_ok=True)
            raise VisualProbeError("Override copy failed SHA-256 verification.")
        os.replace(temp_destination, destination)

        manifest = {
            "schema_version": 1,
            "tool_version": TOOL_VERSION,
            "installed_at_utc": datetime.now(timezone.utc).isoformat(),
            "fivefury_version": runtime_version,
            "scale_factor": scale,
            "model_name": asset.stem,
            "description": description,
            "source_logical_path": asset.path,
            "source_archive_path": asset.source_path,
            "source_sha256": source_hash,
            "generated_sha256": generated_hash,
            "override_relative_path": relative.as_posix(),
            "collision_scaled": False,
            "geometry_stats": stats,
        }
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        temp_manifest = manifest_path.with_suffix(".json.tmp")
        temp_manifest.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
        os.replace(temp_manifest, manifest_path)

        _write_report(
            gta_root,
            [
                "VOX GTA V Enhanced visual probe",
                f"tool_version={TOOL_VERSION}",
                "status=INSTALLED",
                f"model={asset.stem}",
                f"description={description}",
                f"source={asset.path}",
                f"override={relative.as_posix()}",
                f"scale_factor={scale}",
                f"vertex_count={stats['vertex_count']}",
                f"source_ydr_version={stats['source_ydr_version']}",
                f"generated_sha256={generated_hash}",
                "collision_scaled=false",
                "",
                "Expected result: streamed instances of this model are obviously oversized.",
                "This is deliberately ugly: it proves the Gen9 extraction/rewrite/override chain.",
                "Rollback: run 03_ROLLBACK_VISUAL_PROBE.cmd.",
            ],
        )
        print("VOX_VISUAL_PROBE_INSTALLED")
        print(f"VOX_VISUAL_PROBE_MODEL={asset.stem}")
        print(f"VOX_VISUAL_PROBE_SOURCE={asset.path}")
        print(f"VOX_VISUAL_PROBE_OVERRIDE={relative.as_posix()}")
        print(f"VOX_VISUAL_PROBE_SCALE={scale}")
        return 0
    finally:
        cache.close()


def self_test() -> int:
    from fivefury import (
        Vector2,
        Vector3,
        YdrGen9Shader,
        YdrMeshInput,
        create_ydr,
        read_ydr,
    )

    expected = "newmods/platform/levels/gta5/props/vegetation/v_trees.rpf/prop_tree_cedar_02.ydr"
    actual = rageopenv_platform_mirror_relative(
        "x64i.rpf/levels/gta5/props/vegetation/v_trees.rpf/prop_tree_cedar_02.ydr"
    ).as_posix()
    if actual != expected:
        raise VisualProbeError(f"Mirror path mismatch: {actual} != {expected}")
    for unsafe in (
        "update/update.rpf/common/data/test.ydr",
        "../x64i.rpf/evil.ydr",
        "C:/x64i.rpf/evil.ydr",
        "x64i.rpf/../../evil.ydr",
    ):
        try:
            rageopenv_platform_mirror_relative(unsafe)
        except VisualProbeError:
            continue
        raise VisualProbeError(f"Unsafe path was accepted: {unsafe}")

    with tempfile.TemporaryDirectory(prefix="vox-visual-probe-") as temp:
        root = Path(temp)
        source = root / "probe.ydr"
        output = root / "probe_scaled.ydr"
        mesh = YdrMeshInput(
            positions=[
                Vector3(0.0, 0.0, 0.0),
                Vector3(1.0, 0.0, 0.0),
                Vector3(0.0, 2.0, 0.0),
            ],
            indices=[0, 1, 2],
            texcoords=[[Vector2(), Vector2(1.0, 0.0), Vector2(0.0, 1.0)]],
        )
        create_ydr(
            meshes=[mesh],
            shader=YdrGen9Shader.DEFAULT,
            name="vox_visual_probe_ci",
            version=159,
        ).save(source)
        if int(read_ydr(source).version) != 159:
            raise VisualProbeError("Synthetic Gen9 source is not version 159.")
        stats = transform_ydr(source, output, 1.5)
        if int(stats["vertex_count"]) != 3:
            raise VisualProbeError("Synthetic transform changed vertex count.")
        rebuilt = read_ydr(output)
        first_mesh = next(iter(rebuilt.iter_meshes()))
        _assert_scaled((1.0, 0.0, 0.0), _components(first_mesh.positions[1]), 1.5)
        if int(rebuilt.version) != 159:
            raise VisualProbeError("Gen9 version was not preserved.")

    print("VOX_VISUAL_PROBE_SELF_TEST_OK")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="VOX GTA V Enhanced visual asset probe")
    commands = parser.add_subparsers(dest="command", required=True)
    install = commands.add_parser("install")
    install.add_argument("--gta-root", type=Path, required=True)
    install.add_argument("--scale", type=float, default=DEFAULT_SCALE)
    commands.add_parser("self-test")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        if args.command == "install":
            return install_probe(args.gta_root, args.scale)
        if args.command == "self-test":
            return self_test()
        raise VisualProbeError(f"Unknown command: {args.command}")
    except Exception as exc:
        print(f"VOX_VISUAL_PROBE_ERROR={type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
