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
ROOT_FIELDS = {"schema", "description", "targets", "mappings"}
TARGET_FIELDS = {"id", "unit", "position", "glyph", "order"}
MAPPING_FIELDS = {
    "source",
    "sourceName",
    "sourceConst",
    "sourceValue",
    "defaultTargets",
    "targets",
    "mode",
    "note",
}


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

    mapping_path = args.mapping_json
    mapping = json.loads(mapping_path.read_text())
    check(isinstance(mapping, dict), "mapping root must be an object")
    check(set(mapping) == ROOT_FIELDS, "mapping root fields differ from schema")
    check(mapping.get("schema") == "zvvnmod-utn57-map-v1", "mapping schema mismatch")
    check(isinstance(mapping.get("description"), str), "mapping description must be a string")
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

    check(mapping["description"] == generated["description"], "mapping description differs from generated scaffold")
    for index, target in enumerate(mapping["targets"]):
        check(isinstance(target, dict), f"UTN57 target {index} must be an object")
        check(set(target) == TARGET_FIELDS, f"UTN57 target {index} fields differ from schema")
    check(mapping["targets"] == generated["targets"], "UTN57 target catalogue differs from generated inventory")
    check(len(mapping["mappings"]) == len(generated["mappings"]) == 139, "mapping must contain 139 entries")
    target_ids = [target["id"] for target in mapping["targets"]]
    check(len(target_ids) == len(set(target_ids)) == 95, "mapping must contain 95 unique UTN57 targets")
    check(target_ids[0] == "A:isol", "UTN57 target catalogue must start at A:isol")
    valid_targets = set(target_ids)
    source_keys: set[tuple[str, ...]] = set()
    modes = {"direct": 0, "special": 0, "unmapped": 0}
    immutable_fields = ("source", "sourceName", "sourceConst", "sourceValue", "defaultTargets")

    for index, (entry, default_entry) in enumerate(zip(mapping["mappings"], generated["mappings"])):
        check(isinstance(entry, dict), f"mapping {index} must be an object")
        check(set(entry) == MAPPING_FIELDS, f"mapping {index} fields differ from schema")
        for field in immutable_fields:
            check(entry.get(field) == default_entry[field], f"mapping {index} changed generated field {field}")
        source = entry["source"]
        check(isinstance(source, list) and source and all(isinstance(item, str) for item in source), f"mapping {index} has invalid source")
        source_key = tuple(source)
        check(source_key not in source_keys, f"duplicate source sequence: {' '.join(source)}")
        source_keys.add(source_key)

        current_targets = entry.get("targets")
        check(
            isinstance(current_targets, list) and all(isinstance(target, str) for target in current_targets),
            f"mapping {index} targets must be strings",
        )
        for target in current_targets:
            check(target in valid_targets, f"unknown UTN57 target: {target}")

        if current_targets != entry["defaultTargets"]:
            expected_mode = "special"
        else:
            expected_mode = "direct" if entry["defaultTargets"] else "unmapped"
        check(entry.get("mode") == expected_mode, f"mapping {index} mode must be {expected_mode}")
        check(isinstance(entry.get("note"), str), f"mapping {index} note must be a string")
        modes[expected_mode] += 1

    check(len(source_keys) == 139, "mapping must cover 139 unique source sequences")

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
    check(utn_index < zvvnmod_index < workbench_index, "workbench must follow both inventory tables")
    check('src="workbench.js' in mapping_page, "mapping page does not load workbench controller")

    print(
        "verified: 38 UTN57 rows, 32 ZVVNMOD groups, 139 font-backed codes, "
        "139 editable mappings, and Flutter PWA routing"
    )


if __name__ == "__main__":
    main()
