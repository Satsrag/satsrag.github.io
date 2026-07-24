from __future__ import annotations

import csv
import importlib.util
import io
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MAPPING_DATA = ROOT / "mapping/data"
RUNTIME_CSV = MAPPING_DATA / "zvvnmod-utn57-map.csv"
TARGETS_CSV = MAPPING_DATA / "utn57-written-units.csv"
CHACHLAG_JSON = MAPPING_DATA / "chachlag-shaping-observations.json"
CODES_JSON = MAPPING_DATA / "zvvnmod-codes.json"
PAGE_HTML = ROOT / "mapping/index.html"


class MappingDataTests(unittest.TestCase):
    def load_mapping(self) -> dict:
        with tempfile.TemporaryDirectory() as directory:
            generated = Path(directory) / "derived-main.csv"
            subprocess.run(
                [
                    "python3",
                    str(ROOT / "mapping/scripts/generate-default-mapping.py"),
                    "--reviewed",
                    str(RUNTIME_CSV),
                    "--output",
                    str(generated),
                    "--targets-output",
                    str(Path(directory) / "targets.csv"),
                ],
                cwd=ROOT,
                check=True,
                text=True,
                capture_output=True,
            )
            lines = generated.read_text().splitlines()
        metadata = json.loads(lines[0].removeprefix("# metadata="))
        rows = list(csv.DictReader(io.StringIO("\n".join(lines[1:]) + "\n")))
        mappings = [
            {
                "id": row["id"],
                "sources": row["sources"].split() if row["sources"] else [],
                "targets": row["targets"].split() if row["targets"] else [],
                "note": row["note"],
            }
            for row in rows
        ]
        codes = json.loads(CODES_JSON.read_text())
        retained = {"N_AA_FINA", "HX_AA_FINA"}
        editable = [
            code
            for group in codes["groups"]
            for position in ("isol", "init", "medi", "fina")
            for code in group["single"][position]
        ] + [
            code
            for group in codes["groups"]
            for position in ("isol", "init", "medi", "fina")
            for code in group["merged"][position]
            if code["const"] in retained
        ] + [code for group in codes["groups"] for code in group["special"]]
        sources = [
            {
                "id": code["const"],
                "name": code["name"],
                "codepoint": code["codepoint"],
                "value": code["value"],
                "glyph": chr(code["value"]),
                "order": order,
            }
            for order, code in enumerate(editable)
        ]
        with TARGETS_CSV.open(newline="", encoding="utf-8") as handle:
            targets = [
                {**row, "order": order}
                for order, row in enumerate(csv.DictReader(handle))
            ]
        return {**metadata, "sources": sources, "targets": targets, "mappings": mappings}

    def test_compact_rust_named_mapping_preserves_inventory_alignment(self) -> None:
        mapping = self.load_mapping()
        codes = json.loads(CODES_JSON.read_text())
        retained_merged = {"N_AA_FINA", "HX_AA_FINA"}
        expected_sources = [
            code["const"]
            for group in codes["groups"]
            for entries in group["single"].values()
            for code in entries
        ] + [
            code["const"]
            for group in codes["groups"]
            for entries in group["merged"].values()
            for code in entries
            if code["const"] in retained_merged
        ] + [code["const"] for group in codes["groups"] for code in group["special"]]
        source_ids = [source["id"] for source in mapping["sources"]]

        self.assertEqual(mapping["schema"], "zvvnmod-utn57-map-v3")
        self.assertEqual(len(source_ids), 80)
        self.assertEqual(set(source_ids), set(expected_sources))
        self.assertEqual(len(mapping["mappings"]), 106)
        self.assertEqual(sum(not entry["sources"] for entry in mapping["mappings"]), 5)
        self.assertEqual(sum(not entry["targets"] for entry in mapping["mappings"]), 1)
        self.assertTrue(all(entry["sources"] or entry["targets"] for entry in mapping["mappings"]))
        self.assertTrue(
            all(set(entry) == {"id", "sources", "targets", "note"} for entry in mapping["mappings"])
        )
        self.assertTrue(all("const" not in source for source in mapping["sources"]))
        self.assertEqual(mapping["sources"][0]["codepoint"], "U+E000")

    def test_generator_derives_aa_final_position_scaffold(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            generated_mapping = Path(directory) / "mapping.csv"
            subprocess.run(
                [
                    "python3",
                    str(ROOT / "mapping/scripts/generate-default-mapping.py"),
                    "--reviewed",
                    str(Path(directory) / "missing-reviewed.csv"),
                    "--output",
                    str(generated_mapping),
                    "--targets-output",
                    str(Path(directory) / "targets.csv"),
                ],
                cwd=ROOT,
                check=True,
                text=True,
                capture_output=True,
            )
            rows = list(csv.DictReader(io.StringIO("\n".join(generated_mapping.read_text().splitlines()[1:]) + "\n")))
        entries = {row["id"]: row for row in rows}
        self.assertEqual(
            (entries["source:AA_FINA"]["sources"], entries["source:AA_FINA"]["targets"]),
            ("AA_FINA", "Aa:isol"),
        )
        self.assertEqual(
            (entries["target:Aa:fina"]["sources"], entries["target:Aa:fina"]["targets"]),
            ("", "Aa:fina"),
        )
        self.assertEqual(
            (
                entries["context:A_MEDI_AA_FINA"]["sources"],
                entries["context:A_MEDI_AA_FINA"]["targets"],
            ),
            ("A_MEDI AA_FINA", "Aa:fina"),
        )

    def test_generator_preserves_all_ten_published_chachlag_defaults(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            generated_mapping = Path(directory) / "mapping.csv"
            generated_targets = Path(directory) / "targets.csv"
            subprocess.run(
                [
                    "python3",
                    str(ROOT / "mapping/scripts/generate-default-mapping.py"),
                    "--output",
                    str(generated_mapping),
                    "--targets-output",
                    str(generated_targets),
                ],
                cwd=ROOT,
                check=True,
                text=True,
                capture_output=True,
            )
            self.assertFalse((MAPPING_DATA / "zvvnmod-utn57-main.csv").exists())
            self.assertEqual(generated_targets.read_bytes(), TARGETS_CSV.read_bytes())
        generated = self.load_mapping()
        entries = {entry["id"]: entry for entry in generated["mappings"]}
        expected = {
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
        self.assertEqual(
            {row_id: (entries[row_id]["sources"], entries[row_id]["targets"]) for row_id in expected},
            expected,
        )

    def test_targets_are_ordered_and_every_mapping_value_exists(self) -> None:
        mapping = self.load_mapping()
        source_ids = {source["id"] for source in mapping["sources"]}
        targets = mapping["targets"]
        target_ids = [target["id"] for target in targets]
        self.assertEqual(target_ids[0], "A:isol")
        self.assertEqual(len(target_ids), 97)
        self.assertEqual(
            targets[-2],
            {
                "id": "Nirugu",
                "unit": "Nirugu",
                "position": "control",
                "glyph": "᠊",
                "order": 95,
            },
        )
        self.assertEqual(
            targets[-1],
            {
                "id": "MVS",
                "unit": "MVS",
                "position": "control",
                "glyph": "᠎",
                "order": 96,
            },
        )
        self.assertEqual(len(target_ids), len(set(target_ids)))
        self.assertEqual([target["order"] for target in targets], list(range(len(targets))))
        self.assertTrue(all(value in source_ids for row in mapping["mappings"] for value in row["sources"]))
        self.assertTrue(all(value in set(target_ids) for row in mapping["mappings"] for value in row["targets"]))

    def test_current_mapping_keeps_generated_rows_and_reviewed_alignments(self) -> None:
        payload = self.load_mapping()
        entries = {entry["id"]: entry for entry in payload["mappings"]}
        sources = {source["id"]: source for source in payload["sources"]}
        self.assertEqual(entries["source:A_INIT"]["targets"], ["A:init"])
        self.assertNotIn("source:B_I_ISOL", entries)
        self.assertEqual(sources["HX_AA_FINA"]["name"], "Hx f Aa f")
        self.assertEqual(
            entries["source:HX_AA_FINA"]["targets"],
            ["Hx:fina", "MVS", "Aa:isol"],
        )
        self.assertEqual(
            entries["source:N_AA_FINA"]["targets"],
            ["N:fina", "MVS", "Aa:isol"],
        )
        self.assertEqual(entries["source:AA_FINA"]["targets"], ["Aa:isol"])
        self.assertNotIn("target:Aa:isol", entries)
        self.assertEqual(entries["source:NIRUGU"]["targets"], ["Nirugu"])
        self.assertEqual(entries["source:IR_FINA"]["targets"], [])
        reviewed = {
            "target:A:isol": ["A_INIT", "AA_FINA"],
            "target:B2:fina": ["O_MEDI", "AA_FINA"],
            "target:Cr:init": ["O_INIT", "O_MEDI"],
            "target:Dd:medi": ["O_MEDI", "A_MEDI"],
            "target:Dd:fina": ["O_MEDI", "A_FINA"],
            "target:G:fina": ["I_MEDI", "AA_FINA"],
            "target:H:medi": ["A_MEDI", "A_MEDI"],
            "target:Hx:medi": ["M_MEDI", "M_MEDI"],
            "target:K2:init": ["K_INIT"],
            "target:K2:medi": ["K_MEDI"],
            "target:K2:fina": ["K_FINA"],
        }
        self.assertEqual({row_id: entries[row_id]["sources"] for row_id in reviewed}, reviewed)
        chachlag = {
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
        self.assertEqual(
            {
                row_id: (entries[row_id]["sources"], entries[row_id]["targets"])
                for row_id in chachlag
            },
            chachlag,
        )

    def test_workbench_markup_and_controller_use_git_baseline(self) -> None:
        page = PAGE_HTML.read_text()
        controller = (ROOT / "mapping/workbench.js").read_text()
        self.assertLess(page.index('id="utn57"'), page.index('id="zvvnmod"'))
        self.assertLess(page.index('id="zvvnmod"'), page.index('id="mapping-workbench"'))
        self.assertIn('src="workbench.js?v=10"', page)
        self.assertIn('from "./csv-data.mjs?v=3"', controller)
        self.assertIn('src="particle-mappings.js?v=6"', page)
        self.assertNotIn("zvvnmod-utn57-main.csv", controller)
        self.assertIn('const MAPPING_DATA_URL = "data/zvvnmod-utn57-map.csv";', controller)
        self.assertIn("mappingMode(sourceCombinedPayload.mapping.mappings[index], entry)", controller)
        self.assertIn("const baseline = sourceCombinedPayload.mapping.mappings[index];", controller)
        self.assertIn("baseline.sources,", controller)
        self.assertIn("baseline.targets,", controller)
        self.assertIn("baseline.note,", controller)
        self.assertNotIn("defaultSources", controller)
        self.assertNotIn("defaultTargets", controller)
        self.assertIn('schema: "zvvnmod-utn57-workbench-v2"', controller)
        self.assertIn("async function gitBaselineDigest(", controller)
        self.assertIn('crypto.subtle.digest("SHA-256", bytes)', controller)
        self.assertIn("expectedBaseline: sourceCombinedPayload.baseline", controller)

    def test_controller_retains_sequence_accessibility_and_operation_guards(self) -> None:
        controller = (ROOT / "mapping/workbench.js").read_text()
        self.assertIn('select.setAttribute("aria-label", `${noun} ${position + 1}`)', controller)
        self.assertIn('addSelect.setAttribute("aria-label", `${noun} to add`)', controller)
        self.assertIn("function focusDraftTarget(", controller)
        self.assertIn("function focusEditButton(", controller)
        self.assertIn("function guardActiveDraft(", controller)
        self.assertGreaterEqual(controller.count("guardActiveDraft("), 6)
        self.assertIn("function beginOperation()", controller)
        self.assertIn("function finishOperation()", controller)
        self.assertIn("serializeRuntimeMappingCsv(combinedPayload)", controller)
        self.assertIn("runtimeMappingFromCsv(await file.text(), {", controller)

    def test_dual_sequence_styles_and_ultra_narrow_header_remain(self) -> None:
        styles = (ROOT / "mapping/styles.css").read_text()
        self.assertIn(".mapping-editor-grid", styles)
        self.assertIn(".sequence-editor-row", styles)
        self.assertIn(".source-select", styles)
        self.assertIn("@media (max-width: 420px)", styles)
        self.assertIn('.brand::before { content: "S";', styles)
        self.assertIn("select:focus-visible", styles)

    def test_chachlag_capture_exports_committed_tree_without_untracked_files(self) -> None:
        capture_path = ROOT / "mapping/scripts/capture-chachlag-observations.py"
        spec = importlib.util.spec_from_file_location("chachlag_capture_test", capture_path)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader if spec else None)
        module = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
        spec.loader.exec_module(module)  # type: ignore[union-attr]
        self.assertEqual(len(module.PATTERNS), 38)
        self.assertTrue(
            {
                "a m mvs a",
                "a m mvs e",
                "a l mvs a",
                "a l mvs e",
                "a s mvs a",
                "a s mvs e",
                "a r mvs a",
                "a r mvs e",
            }
            <= set(module.PATTERNS)
        )

        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory) / "repository"
            repository.mkdir()
            subprocess.run(["git", "init", "-q"], cwd=repository, check=True)
            subprocess.run(["git", "config", "user.name", "Test"], cwd=repository, check=True)
            subprocess.run(
                ["git", "config", "user.email", "test@example.invalid"],
                cwd=repository,
                check=True,
            )
            (repository / "tracked.txt").write_text("tracked\n")
            subprocess.run(["git", "add", "tracked.txt"], cwd=repository, check=True)
            subprocess.run(["git", "commit", "-qm", "fixture"], cwd=repository, check=True)
            (repository / "untracked.txt").write_text("untracked\n")

            with module.archived_checkout(repository) as exported:
                self.assertEqual((exported / "tracked.txt").read_text(), "tracked\n")
                self.assertFalse((exported / "untracked.txt").exists())

    def run_verifier_with_chachlag(self, payload: dict) -> subprocess.CompletedProcess[str]:
        with tempfile.NamedTemporaryFile("w", suffix=".json") as temporary:
            json.dump(payload, temporary)
            temporary.flush()
            return subprocess.run(
                [
                    "uv",
                    "run",
                    "--script",
                    str(ROOT / "mapping/scripts/verify-static-page.py"),
                    "--chachlag-json",
                    temporary.name,
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
            )

    def test_verifier_rejects_every_chachlag_observation_drift_class(self) -> None:
        base = json.loads(CHACHLAG_JSON.read_text())
        mutations = []
        changed_e = json.loads(json.dumps(base))
        changed_e["observations"][1]["rawZvvnmodCodes"] = ["U+E000"]
        mutations.append(changed_e)
        changed_nominal = json.loads(json.dumps(base))
        changed_nominal["observations"][0]["nominalCodePoints"] = ["U+180E"]
        mutations.append(changed_nominal)
        changed_pattern = json.loads(json.dumps(base))
        changed_pattern["observations"][0]["pattern"] = "mvs changed"
        mutations.append(changed_pattern)
        reordered = json.loads(json.dumps(base))
        reordered["observations"][0], reordered["observations"][1] = (
            reordered["observations"][1],
            reordered["observations"][0],
        )
        mutations.append(reordered)
        changed_description = json.loads(json.dumps(base))
        changed_description["description"] = "changed"
        mutations.append(changed_description)

        for payload in mutations:
            result = self.run_verifier_with_chachlag(payload)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("chachlag observation snapshot differs", result.stdout + result.stderr)

    def run_verifier_with(self, payload: dict) -> subprocess.CompletedProcess[str]:
        runtime_lines = RUNTIME_CSV.read_text().splitlines()
        runtime_metadata = json.loads(runtime_lines[0].removeprefix("# metadata="))
        runtime_rows = list(csv.DictReader(io.StringIO("\n".join(runtime_lines[1:]) + "\n")))
        particle_rows = [row for row in runtime_rows if row["id"].startswith("particle:")]
        main_rows = [
            {
                "id": row["id"],
                "sources": " ".join(row["sources"]),
                "targets": " ".join(row["targets"]),
                "note": row["note"],
            }
            for row in payload["mappings"]
            if row["sources"] and row["targets"]
        ]
        with tempfile.NamedTemporaryFile("w", suffix=".csv", newline="") as temporary:
            temporary.write(
                "# metadata="
                + json.dumps(runtime_metadata, ensure_ascii=False, separators=(",", ":"))
                + "\n"
            )
            writer = csv.DictWriter(
                temporary,
                fieldnames=["id", "sources", "targets", "note"],
                lineterminator="\n",
            )
            writer.writeheader()
            writer.writerows(main_rows + particle_rows)
            temporary.flush()
            return subprocess.run(
                [
                    "uv",
                    "run",
                    "--script",
                    str(ROOT / "mapping/scripts/verify-static-page.py"),
                    "--mapping-csv",
                    temporary.name,
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
            )

    def test_verifier_rejects_aa_final_positional_relation_drift(self) -> None:
        mutations = []

        missing_candidate = self.load_mapping()
        next(
            row for row in missing_candidate["mappings"] if row["id"] == "target:Aa:fina"
        )["sources"] = []
        mutations.append((missing_candidate, "reviewed AA_FINA positional candidate identities differ"))

        changed_candidate = self.load_mapping()
        next(
            row for row in changed_candidate["mappings"] if row["id"] == "target:Aa:fina"
        )["targets"] = ["Aa:isol"]
        mutations.append((changed_candidate, "reviewed AA_FINA positional candidate identities differ"))

        changed_context = self.load_mapping()
        next(
            row
            for row in changed_context["mappings"]
            if row["id"] == "context:A_MEDI_AA_FINA"
        )["targets"] = ["Aa:isol"]
        mutations.append((changed_context, "reviewed A_MEDI AA_FINA relation differs"))

        for payload, message in mutations:
            result = self.run_verifier_with(payload)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(message, result.stdout + result.stderr)

    def test_verifier_accepts_compact_unequal_length_override(self) -> None:
        payload = self.load_mapping()
        entry = next(item for item in payload["mappings"] if item["sources"] == ["N_MEDI"])
        entry["sources"] = ["N_MEDI", "A_INIT", "O_INIT"]
        entry["targets"] = ["Hx:medi"]
        entry["note"] = "Reviewed exception"
        result = self.run_verifier_with(payload)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_verifier_accepts_chachlag_current_value_override(self) -> None:
        payload = self.load_mapping()
        entry = next(
            item for item in payload["mappings"] if item["id"] == "chachlag:M_FINA_AA_FINA"
        )
        entry["sources"] = ["AA_FINA", "A_FINA", "AA_FINA"]
        entry["targets"] = ["A:fina"]
        entry["note"] = "Reviewed chachlag exception"
        result = self.run_verifier_with(payload)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_verifier_rejects_unknown_values_and_schema_fields(self) -> None:
        unknown_target = self.load_mapping()
        unknown_target["mappings"][0]["targets"] = ["Unknown:medi"]
        result = self.run_verifier_with(unknown_target)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unknown UTN57 target", result.stdout + result.stderr)

        unknown_source = self.load_mapping()
        unknown_source["mappings"][0]["sources"] = ["UNKNOWN_CONST"]
        result = self.run_verifier_with(unknown_source)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unknown ZVVNMOD source", result.stdout + result.stderr)

    def test_verifier_rejects_row_identity_changes(self) -> None:
        changed_id = self.load_mapping()
        changed_id["mappings"][0]["id"] = "source:O_INIT"
        result = self.run_verifier_with(changed_id)
        self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
