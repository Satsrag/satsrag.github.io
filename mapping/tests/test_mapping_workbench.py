from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MAPPING_DATA = ROOT / "mapping/data"
MAPPING_JSON = MAPPING_DATA / "zvvnmod-utn57-map.json"
CODES_JSON = MAPPING_DATA / "zvvnmod-codes.json"
PAGE_HTML = ROOT / "mapping/index.html"


class MappingDataTests(unittest.TestCase):
    def load_mapping(self) -> dict:
        return json.loads(MAPPING_JSON.read_text())

    def test_default_mapping_covers_every_zvvnmod_code_once(self) -> None:
        mapping = self.load_mapping()
        codes = json.loads(CODES_JSON.read_text())
        expected = sorted(
            code["codepoint"]
            for group in codes["groups"]
            for family in ("single", "merged")
            for entries in group[family].values()
            for code in entries
        ) + sorted(code["codepoint"] for group in codes["groups"] for code in group["special"])
        actual = [entry["source"][0] for entry in mapping["mappings"]]

        self.assertEqual(mapping["schema"], "zvvnmod-utn57-map-v1")
        self.assertEqual(len(actual), 139)
        self.assertEqual(sorted(actual), sorted(expected))
        self.assertEqual(len(actual), len(set(actual)))
        self.assertTrue(all(len(entry["source"]) == 1 for entry in mapping["mappings"]))

    def test_targets_are_ordered_and_every_mapping_target_exists(self) -> None:
        mapping = self.load_mapping()
        targets = mapping["targets"]
        target_ids = [target["id"] for target in targets]

        self.assertEqual(target_ids[0], "A:isol")
        self.assertEqual(len(target_ids), len(set(target_ids)))
        self.assertEqual([target["order"] for target in targets], list(range(len(targets))))
        self.assertTrue(
            all(target in set(target_ids) for entry in mapping["mappings"] for target in entry["targets"])
        )

    def test_mapping_workbench_is_appended_after_both_inventory_tables(self) -> None:
        page = PAGE_HTML.read_text()
        utn_index = page.index('id="utn57"')
        zvvnmod_index = page.index('id="zvvnmod"')
        workbench_index = page.index('id="mapping-workbench"')

        self.assertLess(utn_index, zvvnmod_index)
        self.assertLess(zvvnmod_index, workbench_index)
        self.assertIn('id="mapping-search" type="search"', page)
        self.assertIn('id="mapping-search" type="search" placeholder="Try A_INIT, Hx medi, U+E09D…" autocomplete="off" disabled', page)
        self.assertIn('id="mapping-mode-filter" aria-label="Filter by mapping mode" disabled', page)
        self.assertIn('<div id="mapping-shell" class="mapping-shell" aria-busy="true" inert>', page)
        self.assertIn('src="workbench.js', page)
        self.assertIn('type="module"', page)
        self.assertIn('<button id="import-mapping-trigger"', page)
        self.assertIn('<input id="import-mapping" type="file" accept="application/json,.json" hidden disabled>', page)
        self.assertIn('id="download-mapping" class="primary-action" type="button" disabled', page)
        self.assertIn('id="reset-mapping" type="button" disabled', page)

    def test_controller_guards_async_import_and_restores_editor_focus(self) -> None:
        controller = (ROOT / "mapping/workbench.js").read_text()
        self.assertIn("function focusDraftTarget(", controller)
        self.assertIn("function focusEditButton(", controller)
        self.assertIn("function setWorkbenchControlsEnabled(", controller)
        self.assertIn("searchElement.disabled = !enabled;", controller)
        self.assertIn("modeElement.disabled = !enabled;", controller)
        self.assertIn("function setDraftSensitiveControlsEnabled(", controller)
        self.assertIn("resetElement.disabled = false;", controller)
        self.assertIn("function guardActiveDraft(", controller)
        self.assertGreaterEqual(controller.count("guardActiveDraft("), 6)
        self.assertIn("Save or cancel the open mapping before", controller)
        self.assertIn("Move target ${position + 1} up", controller)
        self.assertIn("Move target ${position + 1} down", controller)
        self.assertIn("function beginOperation()", controller)
        self.assertIn("function finishOperation()", controller)
        self.assertIn("let operationInProgress = false;", controller)
        self.assertIn("importElement.disabled = !enabled;", controller)
        self.assertIn("if (!beginOperation()) return;", controller)
        self.assertIn("shellElement.inert = !enabled;", controller)
        self.assertGreaterEqual(controller.count("if (shellElement.inert) return;"), 3)
        render_body = controller.split("function render()", 1)[1].split("function focusDraftTarget", 1)[0]
        self.assertNotIn("aria-busy", render_body)
        self.assertEqual(controller.count("setWorkbenchControlsEnabled(hasSource);"), 1)
        self.assertGreaterEqual(controller.count("finishOperation();"), 2)
        self.assertEqual(controller.count('shellElement.setAttribute("aria-busy", "true");'), 1)

        verifier = (ROOT / "mapping/scripts/verify-static-page.py").read_text()
        self.assertIn("flutter_service_worker.js?v=2026071702", verifier)

    def test_ultra_narrow_header_has_explicit_containment(self) -> None:
        styles = (ROOT / "mapping/styles.css").read_text()
        self.assertIn("@media (max-width: 420px)", styles)
        self.assertIn('.brand::before { content: "S";', styles)
        self.assertIn("white-space: nowrap", styles)
        self.assertIn("select:focus-visible", styles)

    def run_verifier_with(self, payload: dict) -> subprocess.CompletedProcess[str]:
        with tempfile.NamedTemporaryFile("w", suffix=".json") as temporary:
            json.dump(payload, temporary)
            temporary.flush()
            return subprocess.run(
                [
                    "uv",
                    "run",
                    "--script",
                    str(ROOT / "mapping/scripts/verify-static-page.py"),
                    "--mapping-json",
                    temporary.name,
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
            )

    def test_verifier_accepts_a_downloaded_special_override(self) -> None:
        payload = self.load_mapping()
        entry = next(item for item in payload["mappings"] if item["sourceConst"] == "N_MEDI")
        entry["targets"] = ["Hx:medi"]
        entry["mode"] = "special"
        entry["note"] = "Reviewed exception"

        result = self.run_verifier_with(payload)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_verifier_rejects_unknown_targets_in_supplied_json(self) -> None:
        payload = self.load_mapping()
        payload["mappings"][0]["targets"] = ["Unknown:medi"]
        payload["mappings"][0]["mode"] = "special"

        result = self.run_verifier_with(payload)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unknown UTN57 target", result.stdout + result.stderr)

    def test_verifier_rejects_unknown_schema_fields_and_changed_root_metadata(self) -> None:
        mutations = []
        base = self.load_mapping()

        extra_root = json.loads(json.dumps(base))
        extra_root["extra"] = True
        mutations.append(("extra root field", extra_root))

        extra_target = json.loads(json.dumps(base))
        extra_target["targets"][0]["extra"] = True
        mutations.append(("extra target field", extra_target))

        extra_mapping = json.loads(json.dumps(base))
        extra_mapping["mappings"][0]["extra"] = True
        mutations.append(("extra mapping field", extra_mapping))

        changed_description = json.loads(json.dumps(base))
        changed_description["description"] = "tampered"
        mutations.append(("changed description", changed_description))

        for name, payload in mutations:
            with self.subTest(name=name):
                result = self.run_verifier_with(payload)
                self.assertNotEqual(result.returncode, 0)

    def test_verifier_rejects_generated_scaffold_and_mode_mutations(self) -> None:
        base = self.load_mapping()
        mutations = []

        changed_source = json.loads(json.dumps(base))
        changed_source["mappings"][0]["sourceName"] = "tampered"
        mutations.append(("generated source metadata", changed_source))

        reordered = json.loads(json.dumps(base))
        reordered["mappings"][0], reordered["mappings"][1] = reordered["mappings"][1], reordered["mappings"][0]
        mutations.append(("mapping order", reordered))

        changed_catalogue = json.loads(json.dumps(base))
        changed_catalogue["targets"][0]["glyph"] = "tampered"
        mutations.append(("target catalogue", changed_catalogue))

        wrong_mode = json.loads(json.dumps(base))
        wrong_mode["mappings"][0]["mode"] = "special"
        mutations.append(("inconsistent mode", wrong_mode))

        for name, payload in mutations:
            with self.subTest(name=name):
                result = self.run_verifier_with(payload)
                self.assertNotEqual(result.returncode, 0)

    def test_semantic_names_pre_generate_direct_target_sequences(self) -> None:
        entries = {entry["source"][0]: entry for entry in self.load_mapping()["mappings"]}

        self.assertEqual(entries["U+E000"]["defaultTargets"], ["A:init"])
        self.assertEqual(entries["U+E079"]["defaultTargets"], ["B:init", "I:fina"])
        self.assertEqual(entries["U+E09D"]["sourceName"], "Hx f Aa f")
        self.assertEqual(entries["U+E09D"]["defaultTargets"], ["Hx:fina", "Aa:fina"])
        self.assertEqual(entries["U+E0E5"]["defaultTargets"], [])
        self.assertEqual(entries["U+E0E6"]["defaultTargets"], [])

        for entry in entries.values():
            if entry["targets"] != entry["defaultTargets"]:
                expected_mode = "special"
            else:
                expected_mode = "direct" if entry["defaultTargets"] else "unmapped"
            self.assertEqual(entry["mode"], expected_mode)
            self.assertIsInstance(entry["note"], str)


if __name__ == "__main__":
    unittest.main()
