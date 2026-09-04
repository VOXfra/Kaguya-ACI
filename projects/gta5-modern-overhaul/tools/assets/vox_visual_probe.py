from __future__ import annotations

import argparse
import hashlib
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

# Intentionally common, static world props. The first compatible base-game YDR wins.
# The visual proof is deliberately exaggerated and is not production artwork.
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
    """Map a base x64*.rpf asset chain to RageOpenV's newmods/platform mirror.

    Example:
      x64i.rpf/levels/gta5/props/vegetation/v_trees.rpf/tree.ydr
    becomes:
      newmods/platform/levels/gta5/props/vegetation/v_trees.rpf/tree.ydr

    We fail closed for update/DLC/loose assets because their virtual mount rules differ.
    """
    parts = _normalized_parts(logical_path)
    outer = parts[0].lower()
    if not (outer.startswith("x64") and outer.endswith(".rpf")):
        raise VisualProbeError(
            "Only base-game x64*.rpf assets are accepted by the first visual probe; "
            f"got {logical_path!r}."
        )
    if len(parts) < 2:
        raise VisualProbeError(f"Asset path has no entry below its outer RPF: {logical_path!r}")
    if not parts[-1].lower().endswith(".ydr"):
        raise VisualProbeError(f"Visual probe only accepts YDR assets: {logical_path!r}")
    return Path("newmods") / "platform" / Path(*parts[1:])


def _all_positions(ydr: Any) -> list[Any]:
    positions: list[Any] = []
    for mesh in ydr.iter_meshes():
        positions.extend(mesh.positions)
    return positions


def _components(value: Any) -> tuple[float, float, float]:
    if hasattr(value, "components"):
        values = tuple(value.components)
    else:
        values = tuple(value)
    if len(values) != 3:
        raise VisualProbeError(f"Expected a 3D vector, got {values!r}")
    return float(values[0]), float(values[1]), float(values[2])


def scale_ydr_render_geometry(ydr: Any, scale: float) -> dict[str, Any]:
    if not math.isfinite(scale) or scale <= 1.0 or scale > 3.0:
        raise VisualProbeError("Scale factor must be finite, > 1.0 and <= 3.0.")

    from fivefury import Vector3

    before_positions = _all_positions(ydr)
    if not before_positions:
        raise VisualProbeError("Candidate YDR contains no render vertices.")

    vertex_count = 0
    for mesh in ydr.iter_meshes():
        scaled = []
        for position in mesh.positions:
            x, y, z = _components(position)
            scaled.append(Vector3(x * scale, y * scale, z * scale))
            vertex_count += 1
        mesh.positions = scaled

    after_positions = _all_positions(ydr)
    xs = [_components(value)[0] for value in after_positions]
    ys = [_components(value)[1] for value in after_positions]
    zs = [_components(value)[2] for value in after_positions]
    minimum = Vector3(min(xs), min(ys), min(zs))
    maximum = Vector3(max(xs), max(ys), max(zs))
    center = Vector3(
        (minimum.x + maximum.x) * 0.5,
        (minimum.y + maximum.y) * 0.5,
        (minimum.z + maximum.z) * 0.5,
    )
    radius = max(
        math.sqrt(
            (_components(value)[0] - center.x) ** 2
            + (_components(value)[1] - center.y) ** 2
            + (_components(value)[2] - center.z) ** 2
        )
        for value in after_positions
    )

    ydr.bounding_box_min = minimum
    ydr.bounding_box_max = maximum
    ydr.bounding_center = center
    ydr.bounding_sphere_radius = float(radius)

    # Keep the model visible farther away after the deliberately exaggerated scale.
    for lod, distance in list(ydr.lod_distances.items()):
        if float(distance) > 0.0:
            ydr.lod_distances[lod] = float(distance) * scale

    before_first = _components(before_positions[0])
    after_first = _components(after_positions[0])
    return {
        "vertex_count": vertex_count,
        "first_vertex_before": before_first,
        "first_vertex_after": after_first,
        "bounding_box_min": _components(minimum),
        "bounding_box_max": _components(maximum),
        "bounding_center": _components(center),
        "bounding_sphere_radius": float(radius),
        "has_embedded_collision": ydr.bound is not None,
        "has_skeleton": ydr.skeleton is not None,
        "embedded_light_count": len(ydr.lights),
    }


def _assert_scaled(before: Iterable[float], after: Iterable[float], scale: float) -> None:
    before_values = tuple(float(value) for value in before)
    after_values = tuple(float(value) for value in after)
    if len(before_values) != len(after_values):
        raise VisualProbeError("Scaled vector length mismatch.")
    for original, transformed in zip(before_values, after_values):
        expected = original * scale
        tolerance = max(1e-5, abs(expected) * 2e-5)
        if abs(transformed - expected) > tolerance:
            raise VisualProbeError(
                f"Geometry verification failed: {original} * {scale} != {transformed}."
            )


def transform_ydr(source: Path, destination: Path, scale: float) -> dict[str, Any]:
    from fivefury import read_ydr

    ydr = read_ydr(source, path=source)
    source_version = int(ydr.version)
    before_first = _components(_all_positions(ydr)[0]) if _all_positions(ydr) else None
    stats = scale_ydr_render_geometry(ydr, scale)
    destination.parent.mkdir(parents=True, exist_ok=True)
    ydr.save(destination)

    rebuilt = read_ydr(destination, path=destination)
    if int(rebuilt.version) != source_version:
        raise VisualProbeError(
            f"YDR edition/version drifted during save: {source_version} -> {rebuilt.version}."
        )
    report = rebuilt.validate()
    if not report.valid:
        details = "; ".join(f"[{issue.code}] {issue.message}" for issue in report.errors)
        raise VisualProbeError(f"Rebuilt YDR failed FiveFury validation: {details}")

    rebuilt_positions = _all_positions(rebuilt)
    if not rebuilt_positions or before_first is None:
        raise VisualProbeError("Rebuilt YDR contains no render vertices.")
    _assert_scaled(before_first, _components(rebuilt_positions[0]), scale)

    rebuilt_min = _components(rebuilt.bounding_box_min)
    rebuilt_max = _components(rebuilt.bounding_box_max)
    if any(low > high for low, high in zip(rebuilt_min, rebuilt_max)):
        raise VisualProbeError("Rebuilt YDR has an inverted bounding box.")

    stats.update(
        {
            "source_ydr_version": source_version,
            "rebuilt_ydr_version": int(rebuilt.version),
            "validation_warning_count": len(report.warnings),
        }
    )
    return stats


def _base_asset_matches(cache: Any, name: str) -> list[Any]:
    matches = cache.find_assets(name, kind=".ydr", exact=True, limit=64)
    result = []
    for asset in matches:
        try:
            rageopenv_platform_mirror_relative(asset.path)
        except VisualProbeError:
            continue
        result.append(asset)
    return result


def choose_candidate(cache: Any, gta_root: Path) -> tuple[Any, str]:
    for model_name, description in CANDIDATES:
        for asset in _base_asset_matches(cache, model_name):
            relative = rageopenv_platform_mirror_relative(asset.path)
            destination = gta_root / relative
            if destination.exists():
                # Never overwrite another loose override. Re-running our own probe is handled
                # by the manifest conflict check before scanning.
                continue
            return asset, description
    raise VisualProbeError(
        "No safe base-game visual-probe candidate was found. Nothing was modified. "
        "The report can be used to extend the candidate list for this installation."
    )


def _manifest_path(gta_root: Path) -> Path:
    return gta_root / "VOXModernOverhaul" / "visual_probe" / "visual_probe_manifest.json"


def _report_path(gta_root: Path) -> Path:
    return gta_root / "VOXModernOverhaul" / "visual_probe" / "visual_probe_report.txt"


def _write_report(gta_root: Path, lines: list[str]) -> None:
    path = _report_path(gta_root)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def install_probe(gta_root: Path, scale: float) -> int:
    gta_root = gta_root.resolve()
    exe = gta_root / "GTA5_Enhanced.exe"
    rageopenv = gta_root / "RageOpenV.asi"
    if not exe.is_file():
        raise VisualProbeError(f"GTA5_Enhanced.exe not found in {gta_root}")
    if not rageopenv.is_file():
        raise VisualProbeError(
            "RageOpenV.asi is required for this non-destructive Enhanced override proof. "
            "It was not found in the GTA root."
        )

    manifest_path = _manifest_path(gta_root)
    if manifest_path.exists():
        existing = json.loads(manifest_path.read_text(encoding="utf-8"))
        relative = Path(existing.get("override_relative_path", ""))
        installed = gta_root / relative
        if installed.is_file() and existing.get("generated_sha256") == sha256_file(installed):
            raise VisualProbeError(
                "A VOX visual probe is already installed. Run 03_ROLLBACK_VISUAL_PROBE.cmd "
                "before installing another one."
            )
        raise VisualProbeError(
            "A visual-probe manifest already exists but its generated file no longer matches. "
            "Refusing to overwrite anything; archive/send VOXModernOverhaul/visual_probe first."
        )

    from fivefury import GameFileCache, GameTarget, __version__ as fivefury_runtime_version

    if str(fivefury_runtime_version) != FIVEFURY_VERSION:
        raise VisualProbeError(
            f"FiveFury version mismatch: expected {FIVEFURY_VERSION}, got {fivefury_runtime_version}."
        )

    work_root = gta_root / "VOXModernOverhaul" / "visual_probe" / "work"
    work_root.mkdir(parents=True, exist_ok=True)
    index_cache = work_root / "fivefury-index"

    _write_report(
        gta_root,
        [
            "VOX GTA V Enhanced visual probe",
            f"tool_version={TOOL_VERSION}",
            "status=SCANNING",
            f"fivefury={fivefury_runtime_version}",
            f"gta_root={gta_root}",
            "No GTA archive is modified in place.",
        ],
    )

    cache = GameFileCache(
        gta_root,
        game=GameTarget.GTA5_ENHANCED,
        use_index_cache=True,
        index_cache_path=index_cache,
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
            raise VisualProbeError(f"FiveFury could not extract {asset.path}")

        source_hash = sha256_file(source)
        stats = transform_ydr(source, generated, scale)
        generated_hash = sha256_file(generated)
        if source_hash == generated_hash:
            raise VisualProbeError("Generated YDR is byte-identical to the source; refusing install.")
        if destination.exists():
            raise VisualProbeError(f"Override destination became occupied during build: {destination}")

        destination.parent.mkdir(parents=True, exist_ok=True)
        temp_destination = destination.with_name(destination.name + ".vox_tmp")
        shutil.copy2(generated, temp_destination)
        if sha256_file(temp_destination) != generated_hash:
            temp_destination.unlink(missing_ok=True)
            raise VisualProbeError("Copied override failed SHA-256 verification.")
        os.replace(temp_destination, destination)

        manifest = {
            "schema_version": 1,
            "tool_version": TOOL_VERSION,
            "installed_at_utc": datetime.now(timezone.utc).isoformat(),
            "fivefury_version": str(fivefury_runtime_version),
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
                "Expected result: every streamed instance of this model is visually oversized.",
                "This is an intentionally obvious pipeline proof, NOT final artwork.",
                "If it is visible in GTA, take a screenshot and send visual_probe_report.txt.",
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
    from fivefury import Vector2, Vector3, YdrGen9Shader, YdrMeshInput, create_ydr, read_ydr

    expected = Path(
        "newmods/platform/levels/gta5/props/vegetation/v_trees.rpf/prop_tree_cedar_02.ydr"
    )
    actual = rageopenv_platform_mirror_relative(
        "x64i.rpf/levels/gta5/props/vegetation/v_trees.rpf/prop_tree_cedar_02.ydr"
    )
    if actual.as_posix() != expected.as_posix():
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
            pass
        else:
            raise VisualProbeError(f"Unsafe path was accepted: {unsafe}")

    with tempfile.TemporaryDirectory(prefix="vox-visual-probe-") as temp_dir:
        root = Path(temp_dir)
        source = root / "probe.ydr"
        destination = root / "probe_scaled.ydr"
        mesh = YdrMeshInput(
            positions=[
                Vector3(0.0, 0.0, 0.0),
                Vector3(1.0, 0.0, 0.0),
                Vector3(0.0, 2.0, 0.0),
            ],
            indices=[0, 1, 2],
            texcoords=[[Vector2(0.0, 0.0), Vector2(1.0, 0.0), Vector2(0.0, 1.0)]],
        )
        build = create_ydr(
            meshes=[mesh],
            shader=YdrGen9Shader.DEFAULT,
            name="vox_visual_probe_ci",
            version=159,
        )
        build.save(source)
        source_ydr = read_ydr(source)
        if int(source_ydr.version) != 159:
            raise VisualProbeError(f"Synthetic Gen9 source version mismatch: {source_ydr.version}")
        stats = transform_ydr(source, destination, 1.5)
        if int(stats["vertex_count"]) != 3:
            raise VisualProbeError("Synthetic transform changed vertex count.")
        rebuilt = read_ydr(destination)
        positions = [_components(position) for position in rebuilt.iter_meshes().__next__().positions]
        _assert_scaled((1.0, 0.0, 0.0), positions[1], 1.5)
        if int(rebuilt.version) != 159:
            raise VisualProbeError("Synthetic transform did not preserve Gen9 version 159.")

    print("VOX_VISUAL_PROBE_SELF_TEST_OK")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="VOX GTA V Enhanced visual asset probe")
    sub = parser.add_subparsers(dest="command", required=True)
    install = sub.add_parser("install", help="scan GTA Enhanced and install one reversible visual proof")
    install.add_argument("--gta-root", type=Path, required=True)
    install.add_argument("--scale", type=float, default=DEFAULT_SCALE)
    sub.add_parser("self-test", help="run deterministic path + Enhanced YDR transform regression tests")
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
