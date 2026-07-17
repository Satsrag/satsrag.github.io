#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools==4.59.0"]
# ///

from __future__ import annotations

import csv
import hashlib
import json
import re
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
MAPPING = ROOT / "mapping"


def md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes(), usedforsecurity=False).hexdigest()


def main() -> None:
    rows = list(csv.DictReader((MAPPING / "data/zvvnmod-unicode-names.csv").open()))
    codepoints = [int(row["unicode"], 16) for row in rows]
    assert len(codepoints) == 139 == len(set(codepoints))
    assert not set(range(0xE140, 0xE144)) & set(codepoints)

    names = {int(row["unicode"], 16): row["name"] for row in rows}
    assert names[0xE034] == "Hx i"
    assert names[0xE09D] == "Hx f Aa f"

    payload = json.loads((MAPPING / "data/zvvnmod-codes.json").read_text())
    grouped = [
        code["value"]
        for group in payload["groups"]
        for family in ("single", "merged")
        for codes in group[family].values()
        for code in codes
    ] + [code["value"] for group in payload["groups"] for code in group["special"]]
    assert payload["count"] == 139
    assert len(payload["groups"]) == 32
    assert sorted(grouped) == sorted(codepoints)

    utn_table = (MAPPING / "data/utn57-written-units.html").read_text()
    assert utn_table.count("<tr") == 40
    assert utn_table.count('scope="row"') == 38

    font = TTFont(MAPPING / "assets/zvvnmod.ttf")
    cmap = set().union(*(table.cmap.keys() for table in font["cmap"].tables))
    assert not (set(codepoints) - cmap)

    manifest = json.loads((ROOT / "manifest.json").read_text())
    assert manifest["id"] == "/"
    assert manifest["start_url"] == "/flutter.html"
    assert manifest["scope"] == "/"

    worker = (ROOT / "flutter_service_worker.js").read_text()
    resources = dict(re.findall(r'"([^"\n]+)": "([0-9a-f]{32})"', worker.split("};", 1)[0]))
    for name in ("index.html", "flutter.html", "manifest.json", "flutter_bootstrap.js"):
        assert resources[name] == md5(ROOT / name)
    assert resources["/"] == resources["index.html"]
    core = re.search(r"const CORE = \[(.*?)\];", worker, re.S)
    assert core is not None
    assert '"flutter.html"' in core.group(1)
    assert '"index.html"' not in core.group(1)

    landing = (ROOT / "index.html").read_text()
    assert 'href="mapping/"' in landing
    assert 'href="flutter.html"' in landing

    print("verified: 38 UTN57 rows, 32 ZVVNMOD groups, 139 font-backed codes, and Flutter PWA routing")


if __name__ == "__main__":
    main()
