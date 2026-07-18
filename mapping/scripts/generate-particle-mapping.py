#!/usr/bin/env python3
"""Generate nominal-context particle alignments from recorded upstream shaping observations."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Any

LEGACY_CONTROLS = range(0xE140, 0xE144)
POSITIONS = {"isol", "init", "medi", "fina"}
SCHEMA = "zvvnmod-utn57-particles-v1"
MONGFONTBUILDER_COMMIT = "539b455075486f70889e6de9909eac5dea839d8a"
MECO_COMMIT = "7edff334d33fc367596d1d33406b33bccb8ddc60"
PARTICLE_SNAPSHOT_SHA256 = "937392156ea469cc033ff70b2cc505a3342f5dc9df0afd0918d0c731ca8eb65b"
ALIASES_SNAPSHOT_SHA256 = "0b271c9d803f8b65f3cf76438661000b51172bf703ca3b4a922c5973c093bdde"
OBSERVATION_SNAPSHOT_SHA256 = "b480e08b16c7efd531b968612a53e6718a96c11578a9d71670994b7033c793ab"
RETAINED_MERGED_IDS = {"U+E077", "U+E09D"}
EXPECTED_SOURCES = {
    "mongfontbuilder": {
        "repository": "https://github.com/Kushim-Jiang/mongfontbuilder",
        "commit": MONGFONTBUILDER_COMMIT,
        "particlesPath": "lib/mongfontbuilder/data/particles.json",
        "aliasesPath": "lib/mongfontbuilder/data/aliases.json",
    },
    "meco": {
        "repository": "https://github.com/Satsrag/meco",
        "commit": MECO_COMMIT,
    },
}
DESCRIPTION = (
    "Mongfontbuilder MNG particle patterns aligned from canonical ZVVNMOD shape sequences "
    "to UTN57 shape sequences; nominal pattern context is retained because some canonical "
    "ZVVNMOD sequences are ambiguous."
)


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text())
    if not isinstance(payload, dict):
        raise ValueError(f"{path}: expected a JSON object")
    return payload


def require_keys(value: dict[str, Any], expected: set[str], label: str) -> None:
    if set(value) != expected:
        raise ValueError(f"{label}: expected keys {sorted(expected)}, got {sorted(value)}")


def nominal_code_points(pattern: str, aliases: dict[str, Any]) -> list[str]:
    code_points: list[str] = []
    for token in pattern.split():
        matching_names = [
            unicode_name
            for unicode_name, alias in aliases.items()
            if alias == token or (isinstance(alias, dict) and alias.get("MNG") == token)
        ]
        if len(matching_names) != 1:
            raise ValueError(
                f"particle token {token!r}: expected one MNG Unicode alias, got {len(matching_names)}"
            )
        character = unicodedata.lookup(matching_names[0])
        code_points.append(f"U+{ord(character):04X}")
    return code_points


def all_zvvnmod_codes(payload: dict[str, Any]) -> list[dict[str, Any]]:
    codes: list[dict[str, Any]] = []
    for group in payload["groups"]:
        for kind in ("single", "merged"):
            for entries in group[kind].values():
                codes.extend(entries)
        codes.extend(group["special"])
    return codes


def canonical_zvvnmod_sequence(
    raw_codes: list[str],
    code_by_id: dict[str, dict[str, Any]],
    editable_ids: set[str],
    single_by_name: dict[str, list[dict[str, Any]]],
    merged_ids: set[str],
) -> list[str]:
    result: list[str] = []
    for code_id in raw_codes:
        if not re.fullmatch(r"U\+[0-9A-F]{4,6}", code_id):
            raise ValueError(f"invalid ZVVNMOD code ID: {code_id}")
        if int(code_id[2:], 16) in LEGACY_CONTROLS:
            continue
        code = code_by_id.get(code_id)
        if code is None:
            raise ValueError(f"unknown raw ZVVNMOD code: {code_id}")
        if code_id in RETAINED_MERGED_IDS:
            if code_id not in merged_ids or code_id not in editable_ids:
                raise ValueError(f"retained merged code is not in the expected catalogues: {code_id}")
            result.append(code_id)
            continue
        if code_id not in merged_ids:
            if code_id not in editable_ids:
                raise ValueError(f"raw ZVVNMOD code is not editable: {code_id}")
            result.append(code_id)
            continue
        name_parts = str(code["name"]).split()
        if not name_parts or len(name_parts) % 2:
            raise ValueError(f"cannot decompose {code_id} from name {code['name']!r}")
        for index in range(0, len(name_parts), 2):
            component_name = " ".join(name_parts[index : index + 2])
            matches = single_by_name.get(component_name, [])
            if len(matches) != 1:
                raise ValueError(
                    f"{code_id}: expected one single code named {component_name!r}, got {len(matches)}"
                )
            component_id = str(matches[0]["codepoint"])
            if component_id not in editable_ids:
                raise ValueError(f"{code_id}: decomposed component is not editable: {component_id}")
            result.append(component_id)
    if not result:
        raise ValueError("canonical ZVVNMOD particle sequence cannot be empty")
    return result


def positions_for_units(position: str, count: int) -> list[str]:
    if position not in POSITIONS or count < 1:
        raise ValueError(f"invalid written-unit position/count: {position}/{count}")
    if count == 1:
        return [position]
    if position == "isol":
        return ["init", *(["medi"] * (count - 2)), "fina"]
    if position == "init":
        return ["init", *(["medi"] * (count - 1))]
    if position == "medi":
        return ["medi"] * count
    return [*(["medi"] * (count - 1)), "fina"]


def utn57_shape_sequence(glyph_names: list[str], valid_targets: set[str]) -> list[str]:
    result: list[str] = []
    for glyph_name in glyph_names:
        if glyph_name == "mvs.wide":
            result.append("MVS")
            continue
        parts = glyph_name.split(".")
        if len(parts) < 3:
            raise ValueError(f"unsupported HarfBuzz glyph name: {glyph_name}")
        units = re.findall(r"[A-Z][a-z0-9]*", parts[-2])
        positions = positions_for_units(parts[-1], len(units))
        targets = [f"{unit}:{position}" for unit, position in zip(units, positions)]
        unknown = set(targets) - valid_targets
        if unknown:
            raise ValueError(f"{glyph_name}: unknown UTN57 targets: {sorted(unknown)}")
        result.extend(targets)
    if not result:
        raise ValueError("UTN57 particle shape sequence cannot be empty")
    return result


def build_particle_mapping(
    particles_path: Path,
    aliases_path: Path,
    observations_path: Path,
    codes_path: Path,
    mapping_path: Path,
) -> dict[str, Any]:
    particles = load_json(particles_path)
    aliases = load_json(aliases_path)
    observations = load_json(observations_path)
    codes_payload = load_json(codes_path)
    mapping_payload = load_json(mapping_path)

    require_keys(observations, {"schema", "sources", "observations"}, "observations")
    if observations["schema"] != "zvvnmod-utn57-particle-observations-v1":
        raise ValueError("unsupported particle observation schema")
    if observations["sources"] != EXPECTED_SOURCES:
        raise ValueError("particle observation source provenance mismatch")
    if file_sha256(observations_path) != OBSERVATION_SNAPSHOT_SHA256:
        raise ValueError("particle observation snapshot checksum mismatch")
    if file_sha256(particles_path) != PARTICLE_SNAPSHOT_SHA256:
        raise ValueError("Mongfontbuilder particle snapshot checksum mismatch")
    if file_sha256(aliases_path) != ALIASES_SNAPSHOT_SHA256:
        raise ValueError("Mongfontbuilder aliases snapshot checksum mismatch")
    mng_particles = particles.get("MNG")
    if not isinstance(mng_particles, dict):
        raise ValueError("Mongfontbuilder snapshot has no MNG particle dictionary")
    if len(mng_particles) != 47:
        raise ValueError(f"expected 47 MNG particle patterns, got {len(mng_particles)}")

    code_list = all_zvvnmod_codes(codes_payload)
    code_by_id = {str(code["codepoint"]): code for code in code_list}
    merged_ids = {
        str(code["codepoint"])
        for group in codes_payload["groups"]
        for entries in group["merged"].values()
        for code in entries
    }
    if not RETAINED_MERGED_IDS <= merged_ids:
        raise ValueError("retained merged ZVVNMOD catalogue entries are missing")
    single_by_name: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for group in codes_payload["groups"]:
        for entries in group["single"].values():
            for code in entries:
                single_by_name[str(code["name"])].append(code)
    editable_ids = {str(source["id"]) for source in mapping_payload["sources"]}
    valid_targets = {str(target["id"]) for target in mapping_payload["targets"]}

    observation_rows = observations["observations"]
    if not isinstance(observation_rows, list) or len(observation_rows) != len(mng_particles):
        raise ValueError("particle observation count does not match the MNG dictionary")

    rows: list[dict[str, Any]] = []
    for number, ((pattern, indices), observation) in enumerate(
        zip(mng_particles.items(), observation_rows, strict=True), start=1
    ):
        if not isinstance(observation, dict):
            raise ValueError(f"observation {number}: expected an object")
        require_keys(
            observation,
            {
                "pattern",
                "particleIndices",
                "nominalCodePoints",
                "rawZvvnmodCodes",
                "utn57GlyphNames",
            },
            f"observation {number}",
        )
        if observation["pattern"] != pattern or observation["particleIndices"] != indices:
            raise ValueError(f"observation {number}: pattern or particle indices drifted")
        expected_nominal = nominal_code_points(pattern, aliases)
        if observation["nominalCodePoints"] != expected_nominal:
            raise ValueError(f"observation {number}: nominal code points do not match aliases")
        raw_codes = observation["rawZvvnmodCodes"]
        glyph_names = observation["utn57GlyphNames"]
        if not isinstance(raw_codes, list) or not all(isinstance(code, str) for code in raw_codes):
            raise ValueError(f"observation {number}: invalid raw ZVVNMOD codes")
        if not isinstance(glyph_names, list) or not all(isinstance(name, str) for name in glyph_names):
            raise ValueError(f"observation {number}: invalid UTN57 glyph names")
        rows.append(
            {
                "id": f"particle:{number:02d}",
                "pattern": pattern,
                "particleIndices": indices,
                "nominalCodePoints": expected_nominal,
                "rawZvvnmodCodes": raw_codes,
                "zvvnmodCodes": canonical_zvvnmod_sequence(
                    raw_codes, code_by_id, editable_ids, single_by_name, merged_ids
                ),
                "utn57Shapes": utn57_shape_sequence(glyph_names, valid_targets),
                "utn57GlyphNames": glyph_names,
                "ambiguous": False,
            }
        )

    targets_by_source: dict[tuple[str, ...], set[tuple[str, ...]]] = defaultdict(set)
    for row in rows:
        targets_by_source[tuple(row["zvvnmodCodes"])].add(tuple(row["utn57Shapes"]))
    for row in rows:
        row["ambiguous"] = len(targets_by_source[tuple(row["zvvnmodCodes"])]) > 1

    return {
        "schema": SCHEMA,
        "description": DESCRIPTION,
        "sources": observations["sources"],
        "mappings": rows,
    }


def main() -> None:
    mapping_dir = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--particles", type=Path, default=mapping_dir / "data/mongfontbuilder-particles.json"
    )
    parser.add_argument(
        "--aliases", type=Path, default=mapping_dir / "data/mongfontbuilder-aliases.json"
    )
    parser.add_argument(
        "--observations",
        type=Path,
        default=mapping_dir / "data/particle-shaping-observations.json",
    )
    parser.add_argument("--codes", type=Path, default=mapping_dir / "data/zvvnmod-codes.json")
    parser.add_argument(
        "--mapping", type=Path, default=mapping_dir / "data/zvvnmod-utn57-map.json"
    )
    parser.add_argument(
        "--output", type=Path, default=mapping_dir / "data/zvvnmod-utn57-particles.json"
    )
    args = parser.parse_args()

    payload = build_particle_mapping(
        args.particles, args.aliases, args.observations, args.codes, args.mapping
    )
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    ambiguous = sum(bool(row["ambiguous"]) for row in payload["mappings"])
    print(f"generated {len(payload['mappings'])} particle rows ({ambiguous} ambiguous) -> {args.output}")


if __name__ == "__main__":
    main()
