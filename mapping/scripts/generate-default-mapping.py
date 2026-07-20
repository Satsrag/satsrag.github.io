#!/usr/bin/env python3
"""Generate the editable ZVVNMOD → UTN57 mapping JSON from both inventories."""

from __future__ import annotations

import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

POSITIONS = ("isol", "init", "medi", "fina")
POSITION_NAMES = {"isol": "isol", "i": "init", "m": "medi", "f": "fina"}
RETAINED_MERGED_CODES = {"N_AA_FINA", "HX_AA_FINA"}


class WrittenUnitTargetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.targets: list[dict[str, Any]] = []
        self._target: dict[str, Any] | None = None
        self._wu_depth = 0
        self._glyph_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        classes = set((values.get("class") or "").split())
        if tag == "td" and "variant" in classes and "undefined" not in classes:
            match = re.fullmatch(r"(.+)-(isol|init|medi|fina)", values.get("id") or "")
            if match:
                unit, position = match.groups()
                self._target = {"id": f"{unit}:{position}", "unit": unit, "position": position}
                self._glyph_parts = []
        if self._target is not None and tag == "span":
            if self._wu_depth or "wu" in classes:
                self._wu_depth += 1

    def handle_data(self, data: str) -> None:
        if self._target is not None and self._wu_depth:
            self._glyph_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "span" and self._wu_depth:
            self._wu_depth -= 1
        if tag == "td" and self._target is not None:
            self._target["glyph"] = "".join(self._glyph_parts).strip()
            self._target["order"] = len(self.targets)
            self.targets.append(self._target)
            self._target = None
            self._glyph_parts = []
            self._wu_depth = 0


def editable_codes(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Return decomposed ZVVNMOD codes plus the two retained chachlag forms."""
    codes: list[dict[str, Any]] = []
    for group in payload["groups"]:  # type: ignore[index]
        for position in POSITIONS:
            codes.extend(group["single"][position])  # type: ignore[index]
        for position in POSITIONS:
            codes.extend(
                code
                for code in group["merged"][position]  # type: ignore[index]
                if code["const"] in RETAINED_MERGED_CODES
            )
        codes.extend(group["special"])  # type: ignore[index]
    return codes


def semantic_targets(name: str, valid_targets: set[str]) -> list[str]:
    if name == "Nirugu":
        return []
    parts = name.split()
    if len(parts) % 2:
        return []
    targets: list[str] = []
    for index in range(0, len(parts), 2):
        unit, short_position = parts[index : index + 2]
        position = POSITION_NAMES.get(short_position)
        if position is None:
            return []
        target = f"{unit}:{position}"
        if target not in valid_targets:
            return []
        targets.append(target)
    return targets


def build_mapping(codes_path: Path, written_units_path: Path) -> dict[str, Any]:
    parser = WrittenUnitTargetParser()
    parser.feed(written_units_path.read_text())
    targets = parser.targets
    valid_targets = {target["id"] for target in targets}
    code_payload = json.loads(codes_path.read_text())
    codes = editable_codes(code_payload)
    sources = [
        {
            "id": code["const"],
            "name": code["name"],
            "codepoint": code["codepoint"],
            "value": code["value"],
            "glyph": chr(code["value"]),
            "order": order,
        }
        for order, code in enumerate(codes)
    ]

    mappings = []
    represented_targets: set[str] = set()
    for code in codes:
        target_sequence = semantic_targets(str(code["name"]), valid_targets)
        represented_targets.update(target_sequence)
        source_sequence = [code["const"]]
        mappings.append(
            {
                "id": f"source:{code['const']}",
                "sources": source_sequence,
                "targets": target_sequence,
                "note": "",
            }
        )

    for target in targets:
        if target["id"] in represented_targets:
            continue
        mappings.append(
            {
                "id": f"target:{target['id']}",
                "sources": [],
                "targets": [target["id"]],
                "note": "",
            }
        )

    return {
        "schema": "zvvnmod-utn57-map-v3",
        "description": "Editable aligned Rust-named ZVVNMOD and UTN57 code sequences; either side may be empty or contain multiple codes.",
        "sources": sources,
        "targets": targets,
        "mappings": mappings,
    }


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    mapping_dir = script_dir.parent
    parser = argparse.ArgumentParser()
    parser.add_argument("--codes", type=Path, default=mapping_dir / "data/zvvnmod-codes.json")
    parser.add_argument(
        "--written-units", type=Path, default=mapping_dir / "data/utn57-written-units.html"
    )
    parser.add_argument(
        "--output", type=Path, default=mapping_dir / "data/zvvnmod-utn57-map.json"
    )
    args = parser.parse_args()

    payload = build_mapping(args.codes, args.written_units)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    direct = sum(
        bool(entry["sources"] and entry["targets"])
        for entry in payload["mappings"]  # type: ignore[index]
    )
    print(
        f"generated {len(payload['mappings'])} mappings "
        f"({direct} direct, {len(payload['mappings']) - direct} unmapped) "
        f"and {len(payload['targets'])} UTN57 targets -> {args.output}"
    )


if __name__ == "__main__":
    main()
