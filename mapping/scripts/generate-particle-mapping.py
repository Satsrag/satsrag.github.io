#!/usr/bin/env python3
"""Generate nominal-context particle alignments from recorded upstream shaping observations."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import unicodedata
from pathlib import Path
from typing import Any

POSITIONS = {"isol", "init", "medi", "fina"}
SCHEMA = "zvvnmod-utn57-particles-v3"
MONGFONTBUILDER_COMMIT = "539b455075486f70889e6de9909eac5dea839d8a"
MECO_COMMIT = "7edff334d33fc367596d1d33406b33bccb8ddc60"
PARTICLE_SNAPSHOT_SHA256 = "937392156ea469cc033ff70b2cc505a3342f5dc9df0afd0918d0c731ca8eb65b"
ALIASES_SNAPSHOT_SHA256 = "0b271c9d803f8b65f3cf76438661000b51172bf703ca3b4a922c5973c093bdde"
OBSERVATION_SNAPSHOT_SHA256 = "b480e08b16c7efd531b968612a53e6718a96c11578a9d71670994b7033c793ab"
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
    "Compact editable Rust-named ZVVNMOD and UTN57 particle sequences with leading MVS/NNBSP "
    "context omitted; either ordered side may contain a different number of values."
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


def semantic_zvvnmod_sequence(
    utn_shapes: list[str], mapping_payload: dict[str, Any]
) -> list[str]:
    targets = {str(target["id"]): target for target in mapping_payload["targets"]}
    source_ids = {str(source["id"]) for source in mapping_payload["sources"]}

    sequence: list[str] = []
    for shape_id in utn_shapes:
        target = targets.get(shape_id)
        if target is None:
            raise ValueError(f"unknown UTN57 shape: {shape_id}")
        unit = re.sub(
            r"(?<=[a-z0-9])(?=[A-Z])", "_", str(target["unit"])
        ).upper()
        expected_const = f"{unit}_{str(target['position']).upper()}"
        if expected_const in source_ids:
            sequence.append(expected_const)
    return sequence


def strip_leading_particle_context(
    pattern: str, particle_indices: list[int], utn_shapes: list[str]
) -> tuple[str, list[int], list[str]]:
    tokens = pattern.split()
    if not tokens:
        raise ValueError("particle pattern must not be empty")
    if tokens[0] not in {"mvs", "nnbsp"}:
        return pattern, list(particle_indices), list(utn_shapes)
    if not utn_shapes or utn_shapes[0] != "MVS":
        raise ValueError(f"{tokens[0]} context must shape to leading MVS")
    if any(index < 1 for index in particle_indices):
        raise ValueError("leading particle context cannot be a particle index")
    return (
        " ".join(tokens[1:]),
        [index - 1 for index in particle_indices],
        utn_shapes[1:],
    )


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


def load_mapping_catalogues(codes_path: Path, targets_path: Path) -> dict[str, Any]:
    code_payload = load_json(codes_path)
    source_ids = {
        str(code["const"])
        for group in code_payload["groups"]
        for code in [
            *(code for values in group["single"].values() for code in values),
            *(code for values in group["merged"].values() for code in values),
            *group["special"],
        ]
    }
    with targets_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != ["id", "unit", "position", "glyph"]:
            raise ValueError("UTN57 target CSV headers differ from schema")
        targets = list(reader)
        if any(None in row for row in targets):
            raise ValueError("UTN57 target CSV contains a malformed row")
    return {
        "sources": [{"id": source_id} for source_id in sorted(source_ids)],
        "targets": targets,
    }


def build_particle_mapping(
    particles_path: Path,
    aliases_path: Path,
    observations_path: Path,
    codes_path: Path,
    targets_path: Path,
) -> dict[str, Any]:
    particles = load_json(particles_path)
    aliases = load_json(aliases_path)
    observations = load_json(observations_path)
    mapping_payload = load_mapping_catalogues(codes_path, targets_path)

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

    valid_targets = {str(target["id"]) for target in mapping_payload["targets"]}

    observation_rows = observations["observations"]
    if not isinstance(observation_rows, list) or len(observation_rows) != len(
        mng_particles
    ):
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
        if not isinstance(raw_codes, list) or not all(
            isinstance(code, str) for code in raw_codes
        ):
            raise ValueError(f"observation {number}: invalid raw ZVVNMOD codes")
        if not isinstance(glyph_names, list) or not all(
            isinstance(name, str) for name in glyph_names
        ):
            raise ValueError(f"observation {number}: invalid UTN57 glyph names")
        utn_shapes = utn57_shape_sequence(glyph_names, valid_targets)
        compact_pattern, compact_indices, compact_targets = strip_leading_particle_context(
            pattern, indices, utn_shapes
        )
        compact_sources = semantic_zvvnmod_sequence(compact_targets, mapping_payload)
        rows.append(
            {
                "id": f"particle:{number:02d}",
                "pattern": compact_pattern,
                "particleIndices": compact_indices,
                "sources": compact_sources,
                "targets": compact_targets,
                "note": "",
            }
        )

    return {
        "schema": SCHEMA,
        "description": DESCRIPTION,
        "provenance": observations["sources"],
        "mappings": rows,
    }


def apply_reviewed_particles(path: Path, payload: dict[str, Any]) -> None:
    if not path.exists():
        return
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or not lines[0].startswith("# metadata="):
        raise ValueError("reviewed particle CSV metadata differs from schema")
    with io.StringIO("\n".join(lines[1:]) + "\n", newline="") as handle:
        reader = csv.DictReader(handle)
        fields = ["id", "pattern", "particleIndices", "sources", "targets", "note"]
        if reader.fieldnames != fields:
            raise ValueError("reviewed particle CSV headers differ from schema")
        reviewed = list(reader)
        if any(None in row for row in reviewed):
            raise ValueError("reviewed particle CSV contains a malformed row")
    generated = payload["mappings"]
    reviewed_scaffold = [
        (row["id"], row["pattern"], row["particleIndices"])
        for row in reviewed
    ]
    generated_scaffold = [
        (row["id"], row["pattern"], " ".join(str(value) for value in row["particleIndices"]))
        for row in generated
    ]
    if reviewed_scaffold != generated_scaffold:
        raise ValueError("reviewed particle CSV scaffold differs from source observations")
    for target, source in zip(generated, reviewed, strict=True):
        sources = [] if source["sources"] == "" else source["sources"].split(" ")
        targets = [] if source["targets"] == "" else source["targets"].split(" ")
        if not sources and not targets:
            raise ValueError(f"reviewed particle {source['id']} has both sides blank")
        target["sources"] = sources
        target["targets"] = targets
        target["note"] = source["note"]


def particle_csv(payload: dict[str, Any]) -> str:
    metadata = {key: payload[key] for key in ("schema", "description", "provenance")}
    buffer = io.StringIO(newline="")
    buffer.write("# metadata=" + json.dumps(metadata, ensure_ascii=False, separators=(",", ":")) + "\n")
    fields = ["id", "pattern", "particleIndices", "sources", "targets", "note"]
    writer = csv.DictWriter(buffer, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    for row in payload["mappings"]:
        writer.writerow(
            {
                "id": row["id"],
                "pattern": row["pattern"],
                "particleIndices": " ".join(str(value) for value in row["particleIndices"]),
                "sources": " ".join(row["sources"]),
                "targets": " ".join(row["targets"]),
                "note": row["note"],
            }
        )
    return buffer.getvalue()


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
    parser.add_argument(
        "--codes", type=Path, default=mapping_dir / "data/zvvnmod-codes.json"
    )
    parser.add_argument(
        "--targets", type=Path, default=mapping_dir / "data/utn57-written-units.csv"
    )
    parser.add_argument(
        "--reviewed",
        type=Path,
        default=mapping_dir / "data/zvvnmod-utn57-particles.csv",
        help="tracked reviewed particle values to apply to the generated scaffold",
    )
    parser.add_argument(
        "--output", type=Path, default=mapping_dir / "data/zvvnmod-utn57-particles.csv"
    )
    args = parser.parse_args()

    payload = build_particle_mapping(
        args.particles, args.aliases, args.observations, args.codes, args.targets
    )
    apply_reviewed_particles(args.reviewed, payload)
    args.output.write_text(particle_csv(payload), encoding="utf-8")
    unequal = sum(
        len(row["sources"]) != len(row["targets"])
        for row in payload["mappings"]  # type: ignore[index]
    )
    print(
        f"generated {len(payload['mappings'])} particle rows "
        f"({unequal} with unequal sequence lengths) -> {args.output}"
    )


if __name__ == "__main__":
    main()
