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

ROOT = Path(__file__).resolve().parents[2]
MAPPING = ROOT / "mapping"
ROOT_FIELDS = {"schema", "description", "sources", "targets", "mappings"}
SOURCE_FIELDS = {"id", "name", "codepoint", "value", "glyph", "order"}
TARGET_FIELDS = {"id", "unit", "position", "glyph", "order"}
MAPPING_FIELDS = {"id", "sources", "targets", "note"}
PARTICLE_ROOT_FIELDS = {"schema", "description", "provenance", "mappings"}
PARTICLE_MAPPING_FIELDS = {"id", "pattern", "particleIndices", "sources", "targets", "note"}
PARTICLE_IMMUTABLE_FIELDS = ("id", "pattern", "particleIndices")
CHACHLAG_OBSERVATIONS_SHA256 = "2fa08f0f03dd6e86ab2a53706a847c3045de4fe256294c5e3fdbf7ffd975499b"


def check(condition: object, message: str) -> None:
    if not condition:
        raise SystemExit(f"verification failed: {message}")


def md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes(), usedforsecurity=False).hexdigest()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mapping-json",
        type=Path,
        default=MAPPING / "data/zvvnmod-utn57-map.json",
        help="editable mapping JSON to validate",
    )
    parser.add_argument(
        "--particle-json",
        type=Path,
        default=MAPPING / "data/zvvnmod-utn57-particles.json",
        help="generated particle mapping JSON to validate",
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
        isinstance(observations, list) and len(observations) == 22,
        "expected 22 chachlag observations",
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
    check(len(observed) == 22, "chachlag observation patterns must be unique")
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
    for pattern, (raw_codes, glyph_names) in expected_a_vectors.items():
        check(
            observed.get(pattern, {}).get("rawZvvnmodCodes") == raw_codes,
            f"{pattern} ZVVNMOD observation drifted",
        )
        check(
            observed.get(pattern, {}).get("utn57GlyphNames") == glyph_names,
            f"{pattern} UTN57 observation drifted",
        )

    mapping_path = args.mapping_json
    mapping = json.loads(mapping_path.read_text())
    check(isinstance(mapping, dict), "mapping root must be an object")
    check(set(mapping) == ROOT_FIELDS, "mapping root fields differ from schema")
    check(mapping.get("schema") == "zvvnmod-utn57-map-v3", "mapping schema mismatch")
    check(isinstance(mapping.get("description"), str), "mapping description must be a string")
    check(isinstance(mapping.get("sources"), list), "mapping sources must be an array")
    check(isinstance(mapping.get("targets"), list), "mapping targets must be an array")
    check(isinstance(mapping.get("mappings"), list), "mappings must be an array")

    with tempfile.TemporaryDirectory() as temporary:
        generated_path = Path(temporary) / "mapping.json"
        subprocess.run(
            [
                sys.executable,
                str(MAPPING / "scripts/generate-default-mapping.py"),
                "--output",
                str(generated_path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        generated = json.loads(generated_path.read_text())

        generated_particles_path = Path(temporary) / "particles.json"
        subprocess.run(
            [
                sys.executable,
                str(MAPPING / "scripts/generate-particle-mapping.py"),
                "--output",
                str(generated_particles_path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        generated_particles = json.loads(generated_particles_path.read_text())
        particle_mapping = json.loads(args.particle_json.read_text())

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

    for index, source in enumerate(mapping["sources"]):
        check(isinstance(source, dict), f"ZVVNMOD source {index} must be an object")
        check(set(source) == SOURCE_FIELDS, f"ZVVNMOD source {index} fields differ from schema")
        check(source.get("order") == index, f"ZVVNMOD source order mismatch at index {index}")
    check(mapping["sources"] == generated["sources"], "ZVVNMOD source catalogue differs from generated inventory")
    source_ids = [source["id"] for source in mapping["sources"]]
    check(len(source_ids) == len(set(source_ids)) == 80, "mapping must contain 80 unique ZVVNMOD sources")
    valid_sources = set(source_ids)

    for index, target in enumerate(mapping["targets"]):
        check(isinstance(target, dict), f"UTN57 target {index} must be an object")
        check(set(target) == TARGET_FIELDS, f"UTN57 target {index} fields differ from schema")
        check(target.get("order") == index, f"UTN57 target order mismatch at index {index}")
    check(mapping["targets"] == generated["targets"], "UTN57 target catalogue differs from generated inventory")
    target_ids = [target["id"] for target in mapping["targets"]]
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
        len(mapping["mappings"]) == len(generated["mappings"]) == 100,
        "mapping must contain 100 alignment rows",
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

    check(len(row_ids) == 100, "mapping must contain 100 unique alignment row IDs")

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
    check('src="workbench.js?v=7"' in mapping_page, "mapping page has stale workbench controller")
    check(
        'src="particle-mappings.js?v=4"' in mapping_page,
        "mapping page does not load particle controller",
    )
    workbench_controller = (MAPPING / "workbench.js").read_text()
    check(
        'from "./combined-workbench-model.mjs?v=4"' in workbench_controller,
        "combined workbench model import is not cache-busted with its controller",
    )
    check(
        'from "./workbench-model.mjs?v=5"' in workbench_controller,
        "mapping model import is not cache-busted with its controller",
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
        "and Flutter PWA routing"
    )


if __name__ == "__main__":
    main()
