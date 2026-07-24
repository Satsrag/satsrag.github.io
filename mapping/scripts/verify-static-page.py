#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools==4.59.0"]
# ///

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from fontTools.ttLib import TTFont
from strict_csv import parse_metadata_table

ROOT = Path(__file__).resolve().parents[2]
MAPPING = ROOT / "mapping"
RUNTIME_ROOT_FIELDS = {"schema", "baseline", "mappings"}
ROOT_FIELDS = {"schema", "description", "mappings"}
MAPPING_FIELDS = {"id", "sources", "targets", "note"}
PARTICLE_ROOT_FIELDS = {"schema", "description", "provenance", "mappings"}
PARTICLE_MAPPING_FIELDS = {"id", "pattern", "particleIndices", "sources", "targets", "note"}
PARTICLE_IMMUTABLE_FIELDS = ("id", "pattern", "particleIndices")
CHACHLAG_OBSERVATIONS_SHA256 = "cb10b161465fe497d936833032dd09a690659e0354dd9c93f5388a2f5e5710f9"
REVIEWED_RUNTIME_BASELINE = "sha256:83a60c3e1ac9df98a14c1a6d979f7c5c8733f1e70d52b81f41de1dd321ea5016"


def check(condition: object, message: str) -> None:
    if not condition:
        raise SystemExit(f"verification failed: {message}")


def md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes(), usedforsecurity=False).hexdigest()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_metadata_csv(
    path: Path, fields: list[str], metadata_fields: list[str]
) -> tuple[dict, list[dict[str, str]]]:
    try:
        return parse_metadata_table(path.read_text(encoding="utf-8"), fields, metadata_fields)
    except ValueError as error:
        raise SystemExit(f"verification failed: {path.name}: {error}") from error


def sequence(value: str) -> list[str]:
    return [] if value == "" else value.split(" ")


def mapping_csv_payload(path: Path) -> dict:
    first_line = path.read_text(encoding="utf-8").partition("\n")[0]
    try:
        metadata_fields = list(json.loads(first_line.removeprefix("# metadata=")))
    except (json.JSONDecodeError, TypeError):
        metadata_fields = []
    check(
        metadata_fields in (["schema", "baseline"], ["schema", "description"]),
        f"{path.name} metadata fields differ from mapping schemas",
    )
    metadata, rows = read_metadata_csv(
        path, ["id", "sources", "targets", "note"], metadata_fields
    )
    return {
        **metadata,
        "mappings": [
            {**row, "sources": sequence(row["sources"]), "targets": sequence(row["targets"])}
            for row in rows
        ],
    }


def particle_index(value: str) -> int:
    check(
        re.fullmatch(r"0|[1-9][0-9]*", value) is not None,
        f"invalid particle index: {value!r}",
    )
    return int(value)


def particle_csv_payload(path: Path) -> dict:
    metadata, rows = read_metadata_csv(
        path,
        ["id", "pattern", "particleIndices"],
        ["schema", "description", "provenance"],
    )
    return {
        **metadata,
        "mappings": [
            {
                **row,
                "particleIndices": [particle_index(value) for value in sequence(row["particleIndices"])],
            }
            for row in rows
        ],
    }


def join_particle_relations(metadata: dict, runtime_rows: list[dict]) -> dict:
    runtime_particles = {
        row["id"]: row for row in runtime_rows if row["id"].startswith("particle:")
    }
    check(
        len(runtime_particles) == len(metadata["mappings"]),
        "particle metadata and runtime relation counts differ",
    )
    mappings = []
    for row in metadata["mappings"]:
        relation = runtime_particles.get(row["id"])
        check(relation is not None, f"missing runtime particle relation: {row['id']}")
        assert relation is not None
        mappings.append({**row, **relation})
    return {**metadata, "mappings": mappings}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mapping-csv",
        type=Path,
        default=MAPPING / "data/zvvnmod-utn57-map.csv",
        help="runtime relation authority CSV to validate",
    )
    parser.add_argument(
        "--particle-csv",
        type=Path,
        default=MAPPING / "data/zvvnmod-utn57-particles.csv",
        help="generated particle mapping CSV to validate",
    )
    parser.add_argument(
        "--chachlag-json",
        type=Path,
        default=MAPPING / "data/chachlag-shaping-observations.json",
        help="pinned chachlag observation JSON to validate",
    )
    args = parser.parse_args()

    rows = list(csv.DictReader((MAPPING / "data/zvvnmod-unicode-names.csv").open()))
    codepoints = [int(row["unicode"], 16) for row in rows]
    check(len(codepoints) == 139 == len(set(codepoints)), "ZVVNMOD CSV must contain 139 unique codes")
    check(not set(range(0xE140, 0xE144)) & set(codepoints), "legacy controls entered shape inventory")

    names = {int(row["unicode"], 16): row["name"] for row in rows}
    check(names.get(0xE034) == "Hx i", "E034 name must be Hx i")
    check(names.get(0xE09D) == "Hx f Aa f", "E09D name must be Hx f Aa f")

    payload = json.loads((MAPPING / "data/zvvnmod-codes.json").read_text())
    grouped = [
        code["value"]
        for group in payload["groups"]
        for family in ("single", "merged")
        for codes in group[family].values()
        for code in codes
    ] + [code["value"] for group in payload["groups"] for code in group["special"]]
    check(payload["count"] == 139, "ZVVNMOD JSON count must be 139")
    check(len(payload["groups"]) == 32, "ZVVNMOD JSON group count must be 32")
    check(sorted(grouped) == sorted(codepoints), "ZVVNMOD CSV/JSON codepoints differ")

    utn_table = (MAPPING / "data/utn57-written-units.html").read_text()
    check(utn_table.count("<tr") == 40, "UTN57 table must contain 38 body rows")
    check(utn_table.count('scope="row"') == 38, "all UTN57 IDs must be row headers")
    format_controls = json.loads((MAPPING / "data/utn57-format-controls.json").read_text())
    check(format_controls.get("schema") == "utn57-format-controls-v1", "UTN57 control schema mismatch")
    check(
        format_controls.get("provenance")
        == {
            "title": "Unicode Technical Note #57: Encoding and Shaping of the Mongolian Script",
            "version": 4,
            "date": "2024-08-14",
            "url": "https://www.unicode.org/notes/tn57/tn57-4.html",
            "section": "2.2.2 Format controls",
        },
        "UTN57 format-control provenance differs",
    )
    check(
        format_controls.get("controls")
        == [
            {
                "id": "Nirugu",
                "unit": "Nirugu",
                "position": "control",
                "codepoint": "U+180A",
                "glyph": "᠊",
            },
            {
                "id": "MVS",
                "unit": "MVS",
                "position": "control",
                "codepoint": "U+180E",
                "glyph": "᠎",
            },
        ],
        "UTN57 format-control inventory differs",
    )

    chachlag_path = args.chachlag_json
    check(
        sha256(chachlag_path) == CHACHLAG_OBSERVATIONS_SHA256,
        "chachlag observation snapshot differs",
    )
    chachlag = json.loads(chachlag_path.read_text())
    check(
        set(chachlag) == {"schema", "description", "sources", "observations"},
        "chachlag observation root fields differ",
    )
    check(
        chachlag.get("schema") == "zvvnmod-utn57-chachlag-observations-v1",
        "chachlag observation schema mismatch",
    )
    check(
        chachlag.get("sources")
        == {
            "mongfontbuilder": {
                "repository": "https://github.com/Kushim-Jiang/mongfontbuilder",
                "commit": "539b455075486f70889e6de9909eac5dea839d8a",
                "rulesPath": "lib/mongfontbuilder/otl/iii.py",
                "aliasesPath": "lib/mongfontbuilder/data/aliases.json",
            },
            "meco": {
                "repository": "https://github.com/Satsrag/meco",
                "commit": "7edff334d33fc367596d1d33406b33bccb8ddc60",
            },
        },
        "chachlag observation provenance differs",
    )
    observations = chachlag.get("observations")
    check(
        isinstance(observations, list) and len(observations) == 38,
        "expected 38 chachlag observations",
    )
    observation_fields = {
        "pattern",
        "nominalCodePoints",
        "rawZvvnmodCodes",
        "utn57GlyphNames",
    }
    check(
        all(isinstance(item, dict) and set(item) == observation_fields for item in observations),
        "chachlag observation fields differ",
    )
    observed = {item["pattern"]: item for item in observations}
    check(len(observed) == 38, "chachlag observation patterns must be unique")
    expected_a_vectors = {
        "mvs a": (["U+E00D"], ["uni180E.Narrowspace.nomi", "u1820.Aa.isol"]),
        "n mvs a": (
            ["U+E027", "U+E00D"],
            ["u1828.N.init._isol", "uni180E.Narrowspace.nomi", "u1820.Aa.isol"],
        ),
        "j mvs a": (
            ["U+E01A", "U+E00D"],
            ["u1835.I.isol", "uni180E.Narrowspace.nomi", "u1820.Aa.isol"],
        ),
        "w mvs a": (
            ["U+E056", "U+E00D"],
            ["u1838.W.init._isol", "uni180E.Narrowspace.nomi", "u1820.Aa.isol"],
        ),
        "h mvs a": (
            ["U+E030", "U+E00D"],
            ["u182C.H.init._isol", "uni180E.Narrowspace.nomi", "u1820.Aa.isol"],
        ),
        "g mvs a": (
            ["U+E030", "U+E00D"],
            ["u182D.Hx.init._isol", "uni180E.Narrowspace.nomi", "u1820.Aa.isol"],
        ),
        "a n mvs a": (
            ["U+E000", "U+E005", "U+E077"],
            [
                "u1820.AA.init",
                "u1828.N.fina",
                "uni180E.Narrowspace.nomi",
                "u1820.Aa.isol",
            ],
        ),
        "a j mvs a": (
            ["U+E000", "U+E005", "U+E04E", "U+E00D"],
            [
                "u1820.AA.init",
                "u1835.I.fina",
                "uni180E.Narrowspace.nomi",
                "u1820.Aa.isol",
            ],
        ),
        "a w mvs a": (
            ["U+E000", "U+E005", "U+E011", "U+E00D"],
            [
                "u1820.AA.init",
                "u1838.U.fina",
                "uni180E.Narrowspace.nomi",
                "u1820.Aa.isol",
            ],
        ),
        "a h mvs a": (
            ["U+E000", "U+E005", "U+E032", "U+E00D"],
            [
                "u1820.AA.init",
                "u182C.H.fina",
                "uni180E.Narrowspace.nomi",
                "u1820.Aa.isol",
            ],
        ),
        "a g mvs a": (
            ["U+E000", "U+E005", "U+E09D"],
            [
                "u1820.AA.init",
                "u182D.Hx.fina",
                "uni180E.Narrowspace.nomi",
                "u1820.Aa.isol",
            ],
        ),
    }
    expected_a_vectors.update(
        {
            "m mvs a": (
                ["U+E036", "U+E00D"],
                ["u182E.M.init._isol", "uni180E.Narrowspace.nomi", "u1820.Aa.isol"],
            ),
            "l mvs a": (
                ["U+E039", "U+E00D"],
                ["u182F.L.init._isol", "uni180E.Narrowspace.nomi", "u1820.Aa.isol"],
            ),
            "s mvs a": (
                ["U+E03C", "U+E00D"],
                ["u1830.S.init._isol", "uni180E.Narrowspace.nomi", "u1820.Aa.isol"],
            ),
            "r mvs a": (
                ["U+E053", "U+E00D"],
                ["u1837.R.init._isol", "uni180E.Narrowspace.nomi", "u1820.Aa.isol"],
            ),
            "a m mvs a": (
                ["U+E000", "U+E005", "U+E038", "U+E00D"],
                ["u1820.AA.init", "u182E.M.fina", "uni180E.Narrowspace.nomi", "u1820.Aa.isol"],
            ),
            "a l mvs a": (
                ["U+E000", "U+E005", "U+E03B", "U+E00D"],
                ["u1820.AA.init", "u182F.L.fina", "uni180E.Narrowspace.nomi", "u1820.Aa.isol"],
            ),
            "a s mvs a": (
                ["U+E000", "U+E005", "U+E03D", "U+E00D"],
                ["u1820.AA.init", "u1830.S.fina", "uni180E.Narrowspace.nomi", "u1820.Aa.isol"],
            ),
            "a r mvs a": (
                ["U+E000", "U+E005", "U+E055", "U+E00D"],
                ["u1820.AA.init", "u1837.R.fina", "uni180E.Narrowspace.nomi", "u1820.Aa.isol"],
            ),
        }
    )
    for pattern, (raw_codes, glyph_names) in expected_a_vectors.items():
        check(
            observed.get(pattern, {}).get("rawZvvnmodCodes") == raw_codes,
            f"{pattern} ZVVNMOD observation drifted",
        )
        check(
            observed.get(pattern, {}).get("utn57GlyphNames") == glyph_names,
            f"{pattern} UTN57 observation drifted",
        )

    runtime_mapping = mapping_csv_payload(args.mapping_csv)
    check(isinstance(runtime_mapping, dict), "runtime mapping root must be an object")
    check(set(runtime_mapping) == RUNTIME_ROOT_FIELDS, "runtime mapping root fields differ from schema")
    check(runtime_mapping.get("schema") == "zvvnmod-utn57-runtime-map-v1", "runtime mapping schema mismatch")
    check(
        isinstance(runtime_mapping.get("baseline"), str)
        and re.fullmatch(r"sha256:[0-9a-f]{64}", runtime_mapping["baseline"]),
        "runtime baseline must be a SHA-256 digest",
    )
    tracked_runtime = mapping_csv_payload(MAPPING / "data/zvvnmod-utn57-map.csv")
    check(
        tracked_runtime["baseline"] == REVIEWED_RUNTIME_BASELINE,
        "tracked runtime baseline differs from the independently reviewed lock",
    )
    check(
        runtime_mapping["baseline"] == tracked_runtime["baseline"],
        "runtime mapping baseline differs from the checked Git baseline",
    )
    check(isinstance(runtime_mapping.get("mappings"), list), "runtime mappings must be an array")
    runtime_ids: set[str] = set()
    for index, row in enumerate(runtime_mapping["mappings"]):
        check(set(row) == MAPPING_FIELDS, f"runtime mapping {index} fields differ from schema")
        check(row["id"] not in runtime_ids, f"duplicate runtime mapping ID: {row['id']}")
        runtime_ids.add(row["id"])
        check(
            bool(row["sources"]) and bool(row["targets"]),
            f"runtime mapping {row['id']} must have both sides",
        )

    with tempfile.TemporaryDirectory() as temporary:
        temporary_path = Path(temporary)
        nonexistent_review = temporary_path / "no-reviewed.csv"
        generated_path = temporary_path / "mapping.csv"
        generated_targets_path = temporary_path / "targets.csv"
        subprocess.run(
            [
                sys.executable,
                str(MAPPING / "scripts/generate-default-mapping.py"),
                "--reviewed",
                str(nonexistent_review),
                "--output",
                str(generated_path),
                "--targets-output",
                str(generated_targets_path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        generated = mapping_csv_payload(generated_path)
        derived_path = temporary_path / "derived-mapping.csv"
        subprocess.run(
            [
                sys.executable,
                str(MAPPING / "scripts/generate-default-mapping.py"),
                "--reviewed",
                str(args.mapping_csv),
                "--output",
                str(derived_path),
                "--targets-output",
                str(generated_targets_path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        mapping = mapping_csv_payload(derived_path)
        check(set(mapping) == ROOT_FIELDS, "derived mapping root fields differ from schema")
        check(mapping.get("schema") == "zvvnmod-utn57-map-v3", "derived mapping schema mismatch")

        generated_particles_path = temporary_path / "particles.csv"
        subprocess.run(
            [
                sys.executable,
                str(MAPPING / "scripts/generate-particle-mapping.py"),
                "--targets",
                str(generated_targets_path),
                "--reviewed",
                str(nonexistent_review),
                "--output",
                str(generated_particles_path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        generated_particles = particle_csv_payload(generated_particles_path)
        particle_metadata = particle_csv_payload(args.particle_csv)
        particle_mapping = join_particle_relations(
            particle_metadata, runtime_mapping["mappings"]
        )
        check(
            generated_targets_path.read_bytes()
            == (MAPPING / "data/utn57-written-units.csv").read_bytes(),
            "UTN57 target CSV differs from generated inventory",
        )
        generated_runtime_path = temporary_path / "runtime.csv"
        generated_browser_scaffold_path = temporary_path / "browser-scaffold.json"
        subprocess.run(
            [
                "node",
                str(MAPPING / "scripts/generate-runtime-mapping.mjs"),
                str(generated_runtime_path),
                str(generated_browser_scaffold_path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        generated_browser_scaffold = json.loads(
            generated_browser_scaffold_path.read_text(encoding="utf-8")
        )
        check(
            generated_browser_scaffold == generated,
            "browser and Python inventory-derived default main scaffolds differ",
        )
        check(
            generated_runtime_path.read_bytes()
            == (MAPPING / "data/zvvnmod-utn57-map.csv").read_bytes(),
            "runtime mapping CSV differs from browser download projection",
        )
        generated_runtime = mapping_csv_payload(generated_runtime_path)
        check(
            len(generated_runtime["mappings"]) == 147
            and all(row["sources"] and row["targets"] for row in generated_runtime["mappings"]),
            "runtime mapping CSV must contain 147 two-sided relations",
        )

    check(isinstance(particle_mapping, dict), "particle mapping root must be an object")
    check(
        set(particle_mapping) == PARTICLE_ROOT_FIELDS,
        "particle mapping root fields differ from schema",
    )
    check(particle_mapping["schema"] == "zvvnmod-utn57-particles-v3", "particle schema mismatch")
    check(
        particle_mapping["description"] == generated_particles["description"],
        "particle description differs from generated scaffold",
    )
    check(
        particle_mapping["provenance"] == generated_particles["provenance"],
        "particle provenance differs from generated scaffold",
    )
    check(len(particle_mapping["mappings"]) == 47, "particle mapping must contain 47 rows")
    check(mapping["description"] == generated["description"], "mapping description differs from generated scaffold")

    retained = {"N_AA_FINA", "HX_AA_FINA"}
    valid_sources = {
        code["const"]
        for group in payload["groups"]
        for position in ("isol", "init", "medi", "fina")
        for code in group["single"][position]
    } | {
        code["const"]
        for group in payload["groups"]
        for position in ("isol", "init", "medi", "fina")
        for code in group["merged"][position]
        if code["const"] in retained
    } | {code["const"] for group in payload["groups"] for code in group["special"]}
    check(len(valid_sources) == 80, "mapping must use an 80-code ZVVNMOD source catalogue")

    with (MAPPING / "data/utn57-written-units.csv").open(newline="", encoding="utf-8") as handle:
        target_reader = csv.DictReader(handle)
        check(
            target_reader.fieldnames == ["id", "unit", "position", "glyph"],
            "UTN57 target CSV headers differ from schema",
        )
        targets = list(target_reader)
        check(all(None not in target for target in targets), "UTN57 target CSV contains malformed rows")
    target_ids = [target["id"] for target in targets]
    check(len(target_ids) == len(set(target_ids)) == 97, "mapping must contain 97 unique UTN57 targets")
    check(target_ids[0] == "A:isol", "UTN57 target catalogue must start at A:isol")
    check(
        target_ids[-2:] == ["Nirugu", "MVS"],
        "UTN57 target catalogue must end with Nirugu and MVS controls",
    )
    valid_targets = set(target_ids)
    particle_ids: set[str] = set()
    for index, (row, default_row) in enumerate(
        zip(particle_mapping["mappings"], generated_particles["mappings"], strict=True)
    ):
        check(isinstance(row, dict), f"particle mapping {index} must be an object")
        check(
            set(row) == PARTICLE_MAPPING_FIELDS,
            f"particle mapping {index} fields differ from schema",
        )
        for field in PARTICLE_IMMUTABLE_FIELDS:
            check(
                row.get(field) == default_row[field],
                f"particle mapping {index} changed generated field {field}",
            )
        row_id = row["id"]
        check(row_id not in particle_ids, f"duplicate particle mapping id: {row_id}")
        particle_ids.add(row_id)

        current_sources = row.get("sources")
        check(
            isinstance(current_sources, list)
            and all(isinstance(source, str) for source in current_sources),
            f"particle mapping {index} sources must be strings",
        )
        for source in current_sources:
            check(source in valid_sources, f"unknown particle ZVVNMOD source: {source}")

        current_targets = row.get("targets")
        check(
            isinstance(current_targets, list)
            and all(isinstance(target, str) for target in current_targets),
            f"particle mapping {index} targets must be strings",
        )
        for target in current_targets:
            check(target in valid_targets, f"unknown particle UTN57 target: {target}")
        check(
            current_sources or current_targets,
            f"particle mapping {index} cannot have both sides empty",
        )
        check(
            not row["pattern"].startswith(("mvs ", "nnbsp ")),
            f"particle mapping {index} retained leading context",
        )
        check(
            isinstance(row.get("note"), str),
            f"particle mapping {index} note must be a string",
        )

    check(len(particle_ids) == 47, "particle mapping IDs must be unique")

    check(
        len(mapping["mappings"]) == len(generated["mappings"]) == 106,
        "mapping must contain 106 alignment rows",
    )
    row_ids: set[str] = set()

    for index, (entry, default_entry) in enumerate(zip(mapping["mappings"], generated["mappings"])):
        check(isinstance(entry, dict), f"mapping {index} must be an object")
        check(set(entry) == MAPPING_FIELDS, f"mapping {index} fields differ from schema")
        check(entry.get("id") == default_entry["id"], f"mapping {index} changed generated field id")
        row_id = entry["id"]
        check(isinstance(row_id, str) and row_id, f"mapping {index} has invalid id")
        check(row_id not in row_ids, f"duplicate mapping id: {row_id}")
        row_ids.add(row_id)

        current_sources = entry.get("sources")
        check(
            isinstance(current_sources, list) and all(isinstance(source, str) for source in current_sources),
            f"mapping {index} sources must be strings",
        )
        for source in current_sources:
            check(source in valid_sources, f"unknown ZVVNMOD source: {source}")

        current_targets = entry.get("targets")
        check(
            isinstance(current_targets, list) and all(isinstance(target, str) for target in current_targets),
            f"mapping {index} targets must be strings",
        )
        for target in current_targets:
            check(target in valid_targets, f"unknown UTN57 target: {target}")
        check(current_sources or current_targets, f"mapping {index} cannot have both sides empty")

        check(isinstance(entry.get("note"), str), f"mapping {index} note must be a string")

    check(len(row_ids) == 106, "mapping must contain 106 unique alignment row IDs")
    generated_mappings_by_id = {entry["id"]: entry for entry in generated["mappings"]}
    current_mappings_by_id = {entry["id"]: entry for entry in mapping["mappings"]}
    check(
        generated_mappings_by_id["source:AA_FINA"]["sources"] == ["AA_FINA"]
        and generated_mappings_by_id["source:AA_FINA"]["targets"] == ["Aa:isol"],
        "generated standalone AA_FINA default differs",
    )
    check(
        generated_mappings_by_id["target:Aa:fina"]["sources"] == []
        and generated_mappings_by_id["target:Aa:fina"]["targets"] == ["Aa:fina"],
        "generated Aa:fina target-only scaffold differs",
    )
    check(
        generated_mappings_by_id["context:A_MEDI_AA_FINA"]["sources"]
        == ["A_MEDI", "AA_FINA"]
        and generated_mappings_by_id["context:A_MEDI_AA_FINA"]["targets"] == ["Aa:fina"],
        "generated A_MEDI AA_FINA positional default differs",
    )
    aa_final_candidates = [
        (entry["id"], tuple(entry["targets"]))
        for entry in mapping["mappings"]
        if entry["sources"] == ["AA_FINA"]
    ]
    check(
        len(aa_final_candidates) == 2
        and set(aa_final_candidates)
        == {
            ("source:AA_FINA", ("Aa:isol",)),
            ("target:Aa:fina", ("Aa:fina",)),
        },
        "reviewed AA_FINA positional candidate identities differ",
    )
    check(
        current_mappings_by_id["context:A_MEDI_AA_FINA"]["sources"]
        == ["A_MEDI", "AA_FINA"]
        and current_mappings_by_id["context:A_MEDI_AA_FINA"]["targets"] == ["Aa:fina"],
        "reviewed A_MEDI AA_FINA relation differs",
    )
    expected_chachlag_mappings = {
        "source:N_AA_FINA": (["N_AA_FINA"], ["N:fina", "MVS", "Aa:isol"]),
        "source:HX_AA_FINA": (["HX_AA_FINA"], ["Hx:fina", "MVS", "Aa:isol"]),
        "chachlag:M_FINA_AA_FINA": (
            ["M_FINA", "AA_FINA"],
            ["M:fina", "MVS", "Aa:isol"],
        ),
        "chachlag:L_FINA_AA_FINA": (
            ["L_FINA", "AA_FINA"],
            ["L:fina", "MVS", "Aa:isol"],
        ),
        "chachlag:S_FINA_AA_FINA": (
            ["S_FINA", "AA_FINA"],
            ["S:fina", "MVS", "Aa:isol"],
        ),
        "chachlag:R_FINA_AA_FINA": (
            ["R_FINA", "AA_FINA"],
            ["R:fina", "MVS", "Aa:isol"],
        ),
        "chachlag:I_ISOL_AA_FINA": (
            ["I_ISOL", "AA_FINA"],
            ["I:isol", "MVS", "Aa:isol"],
        ),
        "chachlag:I_FINA_AA_FINA": (
            ["I_FINA", "AA_FINA"],
            ["I:fina", "MVS", "Aa:isol"],
        ),
        "chachlag:U_FINA_AA_FINA": (
            ["U_FINA", "AA_FINA"],
            ["U:fina", "MVS", "Aa:isol"],
        ),
        "chachlag:H_FINA_AA_FINA": (
            ["H_FINA", "AA_FINA"],
            ["H:fina", "MVS", "Aa:isol"],
        ),
    }
    for row_id, (expected_sources, expected_targets) in expected_chachlag_mappings.items():
        check(row_id in generated_mappings_by_id, f"missing generated chachlag default: {row_id}")
        check(
            generated_mappings_by_id[row_id]["sources"] == expected_sources
            and generated_mappings_by_id[row_id]["targets"] == expected_targets,
            f"generated chachlag default differs: {row_id}",
        )
    observed_chachlag_onsets: set[str] = set()
    for observation in observations:
        glyph_names = observation["utn57GlyphNames"]
        mvs_index = next(
            (index for index, glyph_name in enumerate(glyph_names) if "Narrowspace" in glyph_name),
            None,
        )
        if mvs_index is None or mvs_index == 0:
            continue
        onset_index = mvs_index - 1
        while onset_index >= 0 and glyph_names[onset_index].startswith("fvs"):
            onset_index -= 1
        if onset_index < 0:
            continue
        onset_match = re.search(r"\.([A-Za-z0-9]+)\.(isol|fina)$", glyph_names[onset_index])
        if onset_match:
            observed_chachlag_onsets.add(f"{onset_match.group(1)}:{onset_match.group(2)}")
    generated_chachlag_onsets = {
        next(target for target in generated_mappings_by_id[row_id]["targets"] if target not in {"MVS", "Aa:isol"})
        for row_id in expected_chachlag_mappings
    }
    check(
        generated_chachlag_onsets == observed_chachlag_onsets,
        "generated chachlag onset shapes do not exactly cover pinned shaping observations",
    )

    font_path = MAPPING / "assets/zvvnmod.ttf"
    font = TTFont(font_path)
    cmap = set().union(*(table.cmap.keys() for table in font["cmap"].tables))
    check(not (set(codepoints) - cmap), "ZVVNMOD font cmap does not cover inventory")
    font_script = (MAPPING / "scripts/generate-zvvnmod-font.sh").read_text()
    expected_font_hash = re.search(r'readonly (?:EXPECTED_)?FONT_SHA256="([0-9a-f]{64})"', font_script)
    if expected_font_hash is None:
        raise SystemExit("verification failed: font generator has no pinned SHA-256")
    check(sha256(font_path) == expected_font_hash.group(1), "checked-in ZVVNMOD font hash differs")

    manifest = json.loads((ROOT / "manifest.json").read_text())
    check(manifest.get("id") == "/", "PWA id must remain /")
    check(manifest.get("start_url") == "/flutter.html", "PWA must launch flutter.html")
    check(manifest.get("scope") == "/", "PWA scope must remain /")

    bootstrap = (ROOT / "flutter_bootstrap.js").read_text()
    expected_worker_url = "flutter_service_worker.js?v=2026071702"
    expected_worker_version = expected_worker_url.rsplit("=", 1)[1]
    check(
        f'serviceWorkerVersion: "{expected_worker_version}"' in bootstrap,
        "Flutter bootstrap service-worker version is stale",
    )
    worker = (ROOT / "flutter_service_worker.js").read_text()
    resources = dict(re.findall(r'"([^"\n]+)": "([0-9a-f]{32})"', worker.split("};", 1)[0]))
    for name, expected_hash in resources.items():
        if name == "/":
            check(expected_hash == resources["index.html"], "root and index resource hashes differ")
            continue
        resource = ROOT / name
        check(resource.is_file(), f"service-worker resource is missing: {name}")
        check(md5(resource) == expected_hash, f"service-worker resource hash is stale: {name}")
    core = re.search(r"const CORE = \[(.*?)\];", worker, re.S)
    if core is None:
        raise SystemExit("verification failed: service-worker CORE is missing")
    check('"flutter.html"' in core.group(1), "Flutter shell must include flutter.html")
    check('"index.html"' not in core.group(1), "landing page must not enter Flutter CORE")

    landing = (ROOT / "index.html").read_text()
    check('href="mapping/"' in landing, "landing has no mapping link")
    check('href="flutter.html"' in landing, "landing has no Flutter link")

    mapping_page = (MAPPING / "index.html").read_text()
    utn_index = mapping_page.index('id="utn57"')
    zvvnmod_index = mapping_page.index('id="zvvnmod"')
    workbench_index = mapping_page.index('id="mapping-workbench"')
    particle_index = mapping_page.index('id="particle-mappings"')
    check(
        utn_index < zvvnmod_index < workbench_index < particle_index,
        "particle mappings must follow the workbench and both inventories",
    )
    check('src="workbench.js?v=10"' in mapping_page, "mapping page has stale workbench controller")
    check(
        'src="particle-mappings.js?v=6"' in mapping_page,
        "mapping page does not load particle controller",
    )
    workbench_controller = (MAPPING / "workbench.js").read_text()
    check(
        'from "./combined-workbench-model.mjs?v=6"' in workbench_controller,
        "combined workbench model import is not cache-busted with its controller",
    )
    check(
        'from "./workbench-model.mjs?v=6"' in workbench_controller,
        "mapping model import is not cache-busted with its controller",
    )
    check(
        'from "./csv-data.mjs?v=3"' in workbench_controller,
        "CSV model import is not cache-busted with its controller",
    )
    particle_controller = (MAPPING / "particle-mappings.js").read_text()
    check(
        'from "./particle-model.mjs?v=5"' in particle_controller,
        "particle model import is not cache-busted with its controller",
    )

    unequal_particle_rows = sum(
        len(row["sources"]) != len(row["targets"])
        for row in particle_mapping["mappings"]
    )
    print(
        "verified: 38 UTN57 rows, 32 ZVVNMOD groups, 139 font-backed codes, "
        f"80 editable ZVVNMOD sources, {len(target_ids)} UTN57 targets, "
        f"{len(row_ids)} alignment rows, "
        f"47 compact editable particle rows ({unequal_particle_rows} with unequal sequence lengths), "
        "147 directly reusable runtime relations, and Flutter PWA routing"
    )


if __name__ == "__main__":
    main()
