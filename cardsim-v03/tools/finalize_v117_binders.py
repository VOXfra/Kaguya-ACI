#!/usr/bin/env python3
"""Thin release wrapper for the product-recovery finalizer.

Some TCGplayer group names intentionally include the era while the canonical
pokemon-tcg-data set name does not. Keep those source-specific aliases here so the
main reconciler stays metadata-driven and this exceptional mapping remains explicit.
"""
import finalize_v117_binders_impl as impl

_base_english_map = impl._english_map


def _english_map(index_by_id):
    mapped, source_id = _base_english_map(index_by_id)
    # pokemon-tcg-data calls this set simply "151" while TCGplayer's product
    # group is "Scarlet & Violet 151". Both identifiers point to the same real
    # 2023 special expansion; the explicit alias avoids a weak fuzzy match.
    if "sv03.5" in index_by_id:
        mapped["sv03.5"] = "Scarlet & Violet 151"
        source_id["sv03.5"] = "sv3pt5"
    return mapped, source_id


impl._english_map = _english_map

if __name__ == "__main__":
    raise SystemExit(impl.main())
