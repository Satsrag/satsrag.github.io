#!/usr/bin/env python3
"""Generate CSV authorities for the editable ZVVNMOD → UTN57 workbench."""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

from strict_csv import parse_metadata_table

POSITIONS = ("isol", "init", "medi", "fina")
POSITION_NAMES = {"isol": "isol", "i": "init", "m": "medi", "f": "fina"}
RETAINED_MERGED_CODES = {"N_AA_FINA", "HX_AA_FINA"}
FORMAT_CONTROL_SCHEMA = "utn57-format-controls-v1"
CHACHLAG_NOTE = "UTN chachlag onset-plus-suffix shape alignment."
CANONICAL_SOURCE_TARGETS = {
    "AA_FINA": ("Aa:isol",),
    "N_AA_FINA": ("N:fina", "MVS", "Aa:isol"),
    "HX_AA_FINA": ("Hx:fina", "MVS", "Aa:isol"),
}
POSITIONAL_RULES = (
    (
        "context:A_MEDI_AA_FINA",
        ("A_MEDI", "AA_FINA"),
        ("Aa:fina",),
        "A_MEDI and AA_FINA jointly represent a connected Aa final.",
    ),
)
CHACHLAG_RULES = (
    (
        "chachlag:M_FINA_AA_FINA",
        ("M_FINA", "AA_FINA"),
        ("M:fina", "MVS", "Aa:isol"),
    ),
    (
        "chachlag:L_FINA_AA_FINA",
        ("L_FINA", "AA_FINA"),
        ("L:fina", "MVS", "Aa:isol"),
    ),
    (
        "chachlag:S_FINA_AA_FINA",
        ("S_FINA", "AA_FINA"),
        ("S:fina", "MVS", "Aa:isol"),
    ),
    (
        "chachlag:R_FINA_AA_FINA",
        ("R_FINA", "AA_FINA"),
        ("R:fina", "MVS", "Aa:isol"),
    ),
    (
        "chachlag:I_ISOL_AA_FINA",
        ("I_ISOL", "AA_FINA"),
        ("I:isol", "MVS", "Aa:isol"),
    ),
    ("chachlag:I_FINA_AA_FINA", ("I_FINA", "AA_FINA"), ("I:fina", "MVS", "Aa:isol")),
    ("chachlag:U_FINA_AA_FINA", ("U_FINA", "AA_FINA"), ("U:fina", "MVS", "Aa:isol")),
    ("chachlag:H_FINA_AA_FINA", ("H_FINA", "AA_FINA"), ("H:fina", "MVS", "Aa:isol")),
)


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
        return ["Nirugu"] if "Nirugu" in valid_targets else []
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


def format_control_targets(path: Path, start_order: int) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text())
    if set(payload) != {"schema", "description", "provenance", "controls"}:
        raise ValueError("UTN57 format-control root fields differ from schema")
    if payload["schema"] != FORMAT_CONTROL_SCHEMA or not isinstance(payload["controls"], list):
        raise ValueError(f"UTN57 format controls must use {FORMAT_CONTROL_SCHEMA}")
    targets = []
    for offset, control in enumerate(payload["controls"]):
        if set(control) != {"id", "unit", "position", "codepoint", "glyph"}:
            raise ValueError(f"UTN57 format control {offset} fields differ from schema")
        codepoint = str(control["codepoint"])
        if not re.fullmatch(r"U\+[0-9A-F]{4,6}", codepoint):
            raise ValueError(f"UTN57 format control {offset} has invalid codepoint")
        value = int(codepoint[2:], 16)
        if control["glyph"] != chr(value) or control["position"] != "control":
            raise ValueError(f"UTN57 format control {offset} metadata is inconsistent")
        targets.append(
            {
                "id": str(control["id"]),
                "unit": str(control["unit"]),
                "position": "control",
                "glyph": str(control["glyph"]),
                "order": start_order + offset,
            }
        )
    return targets


def build_mapping(
    codes_path: Path, written_units_path: Path, format_controls_path: Path
) -> dict[str, Any]:
    parser = WrittenUnitTargetParser()
    parser.feed(written_units_path.read_text())
    targets = parser.targets + format_control_targets(format_controls_path, len(parser.targets))
    if len({target["id"] for target in targets}) != len(targets):
        raise ValueError("UTN57 target IDs must be unique")
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
        canonical_targets = CANONICAL_SOURCE_TARGETS.get(str(code["const"]))
        target_sequence = (
            list(canonical_targets)
            if canonical_targets is not None
            else semantic_targets(str(code["name"]), valid_targets)
        )
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

    valid_sources = {source["id"] for source in sources}
    for row_id, source_sequence, target_sequence, note in POSITIONAL_RULES:
        if not set(source_sequence) <= valid_sources:
            raise ValueError(f"positional rule {row_id} references an unknown ZVVNMOD source")
        if not set(target_sequence) <= valid_targets:
            raise ValueError(f"positional rule {row_id} references an unknown UTN57 target")
        mappings.append(
            {
                "id": row_id,
                "sources": list(source_sequence),
                "targets": list(target_sequence),
                "note": note,
            }
        )

    for row_id, source_sequence, target_sequence in CHACHLAG_RULES:
        if not set(source_sequence) <= valid_sources:
            raise ValueError(f"chachlag rule {row_id} references an unknown ZVVNMOD source")
        if not set(target_sequence) <= valid_targets:
            raise ValueError(f"chachlag rule {row_id} references an unknown UTN57 target")
        mappings.append(
            {
                "id": row_id,
                "sources": list(source_sequence),
                "targets": list(target_sequence),
                "note": CHACHLAG_NOTE,
            }
        )

    return {
        "schema": "zvvnmod-utn57-map-v3",
        "description": "Editable aligned Rust-named ZVVNMOD and UTN57 code sequences; either side may be empty or contain multiple codes.",
        "sources": sources,
        "targets": targets,
        "mappings": mappings,
    }


def apply_reviewed_mapping(path: Path, payload: dict[str, Any]) -> None:
    if not path.exists():
        return
    metadata, reviewed = parse_metadata_table(
        path.read_text(encoding="utf-8"),
        ["id", "sources", "targets", "note"],
        ["schema", "baseline"],
    )
    if (
        metadata["schema"] != "zvvnmod-utn57-runtime-map-v1"
        or not isinstance(metadata["baseline"], str)
        or re.fullmatch(r"sha256:[0-9a-f]{64}", metadata["baseline"]) is None
    ):
        raise ValueError("reviewed mapping CSV metadata differs from schema")
    generated = payload["mappings"]
    reviewed = [row for row in reviewed if not row["id"].startswith("particle:")]
    reviewed_by_id = {row["id"]: row for row in reviewed}
    if len(reviewed_by_id) != len(reviewed):
        raise ValueError("reviewed runtime mapping CSV contains duplicate main IDs")
    generated_ids = {row["id"] for row in generated}
    unknown_ids = set(reviewed_by_id) - generated_ids
    if unknown_ids:
        raise ValueError(f"reviewed runtime mapping contains unknown main IDs: {sorted(unknown_ids)}")
    for target in generated:
        source = reviewed_by_id.get(target["id"])
        if source is None:
            if target["id"].startswith("target:"):
                target["sources"] = []
            else:
                target["targets"] = []
            continue
        source_values = [] if source["sources"] == "" else source["sources"].split(" ")
        target_values = [] if source["targets"] == "" else source["targets"].split(" ")
        if not source_values or not target_values:
            raise ValueError(f"runtime mapping {source['id']} must have both sides")
        target["sources"] = source_values
        target["targets"] = target_values
        target["note"] = source["note"]


def csv_document(fieldnames: list[str], rows: list[dict[str, Any]], metadata: dict[str, Any] | None = None) -> str:
    buffer = io.StringIO(newline="")
    if metadata is not None:
        buffer.write("# metadata=" + json.dumps(metadata, ensure_ascii=False, separators=(",", ":")) + "\n")
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


def write_csv_authorities(
    payload: dict[str, Any], mapping_path: Path | None, targets_path: Path
) -> None:
    mapping_rows = [
        {
            "id": row["id"],
            "sources": " ".join(row["sources"]),
            "targets": " ".join(row["targets"]),
            "note": row["note"],
        }
        for row in payload["mappings"]
    ]
    metadata = {"schema": payload["schema"], "description": payload["description"]}
    if mapping_path is not None:
        mapping_path.write_text(
            csv_document(["id", "sources", "targets", "note"], mapping_rows, metadata),
            encoding="utf-8",
        )
    target_rows = [
        {key: target[key] for key in ("id", "unit", "position", "glyph")}
        for target in payload["targets"]
    ]
    targets_path.write_text(
        csv_document(["id", "unit", "position", "glyph"], target_rows),
        encoding="utf-8",
    )


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    mapping_dir = script_dir.parent
    parser = argparse.ArgumentParser()
    parser.add_argument("--codes", type=Path, default=mapping_dir / "data/zvvnmod-codes.json")
    parser.add_argument(
        "--written-units", type=Path, default=mapping_dir / "data/utn57-written-units.html"
    )
    parser.add_argument(
        "--format-controls",
        type=Path,
        default=mapping_dir / "data/utn57-format-controls.json",
    )
    parser.add_argument(
        "--reviewed",
        type=Path,
        default=mapping_dir / "data/zvvnmod-utn57-map.csv",
        help="tracked runtime relation values to apply to the generated scaffold",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="optional temporary generated workbench scaffold for verification",
    )
    parser.add_argument(
        "--targets-output", type=Path, default=mapping_dir / "data/utn57-written-units.csv"
    )
    args = parser.parse_args()

    payload = build_mapping(args.codes, args.written_units, args.format_controls)
    apply_reviewed_mapping(args.reviewed, payload)
    write_csv_authorities(payload, args.output, args.targets_output)
    direct = sum(
        bool(entry["sources"] and entry["targets"])
        for entry in payload["mappings"]  # type: ignore[index]
    )
    print(
        f"generated {len(payload['mappings'])} mappings "
        f"({direct} direct, {len(payload['mappings']) - direct} unmapped) "
        f"and {len(payload['targets'])} UTN57 targets -> {args.output}, {args.targets_output}"
    )


if __name__ == "__main__":
    main()
