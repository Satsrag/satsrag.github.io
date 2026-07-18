from __future__ import annotations

import json
import re
import runpy
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAGE_HTML = ROOT / "mapping/index.html"
PARTICLE_JSON = ROOT / "mapping/data/zvvnmod-utn57-particles.json"
OBSERVATIONS_JSON = ROOT / "mapping/data/particle-shaping-observations.json"
PARTICLE_SNAPSHOT_JSON = ROOT / "mapping/data/mongfontbuilder-particles.json"
GENERATOR = ROOT / "mapping/scripts/generate-particle-mapping.py"
CAPTURE_SCRIPT = ROOT / "mapping/scripts/capture-particle-observations.py"


class ParticleMappingTests(unittest.TestCase):
    def test_particle_mapping_section_is_below_editable_workbench(self) -> None:
        page = PAGE_HTML.read_text()
        workbench_index = page.index('id="mapping-workbench"')
        particle_index = page.index('id="particle-mappings"')

        self.assertLess(workbench_index, particle_index)
        self.assertIn('id="particle-mapping-status" role="status"', page)
        self.assertIn('id="particle-mapping-rows"', page)
        self.assertIn('class="particle-table" aria-label="Mongfontbuilder particle mappings"', page)
        self.assertIn('<caption class="visually-hidden">Nominal-context ZVVNMOD to UTN57 particle mappings</caption>', page)
        self.assertIn(
            "https://github.com/Kushim-Jiang/mongfontbuilder/blob/539b455075486f70889e6de9909eac5dea839d8a/data/particles.ts",
            page,
        )
        self.assertIn('src="particle-mappings.js?v=2"', page)
        self.assertIn('<link rel="icon" href="../favicon.png">', page)
        self.assertIn('src="workbench.js?v=4"', page)
        workbench = (ROOT / "mapping/workbench.js").read_text()
        self.assertIn('from "./combined-workbench-model.mjs?v=1"', workbench)

    def test_particle_mapping_data_has_all_mongfontbuilder_mng_patterns(self) -> None:
        payload = json.loads(PARTICLE_JSON.read_text())
        self.assertEqual(payload["schema"], "zvvnmod-utn57-particles-v2")
        self.assertEqual(len(payload["mappings"]), 47)

    def test_key_particle_mappings_preserve_particle_semantics(self) -> None:
        payload = json.loads(PARTICLE_JSON.read_text())
        rows = {row["pattern"]: row for row in payload["mappings"]}

        self.assertEqual(rows["mvs i"]["rawZvvnmodCodes"], ["U+E143", "U+E00E"])
        self.assertEqual(rows["mvs i"]["defaultZvvnmodCodes"], [None, "U+E01A"])
        self.assertEqual(rows["mvs i"]["zvvnmodCodes"], [None, "U+E01A"])
        self.assertEqual(rows["mvs i"]["utn57Shapes"], ["MVS", "I:isol"])
        self.assertEqual(rows["u u"]["rawZvvnmodCodes"], ["U+E000", "U+E008", "U+E011"])
        self.assertEqual(
            rows["u u"]["zvvnmodCodes"],
            ["U+E001", "U+E011"],
        )
        self.assertEqual(rows["u u"]["utn57Shapes"], ["O:init", "U:fina"])
        self.assertEqual(
            rows["b ue ue"]["zvvnmodCodes"],
            ["U+E029", "U+E008", "U+E011"],
        )
        self.assertEqual(
            rows["b ue ue"]["utn57Shapes"],
            ["B:init", "O:medi", "U:fina"],
        )

    def test_semantic_slots_use_current_catalogues_and_leave_unknown_matches_blank(self) -> None:
        payload = json.loads(PARTICLE_JSON.read_text())
        mapping = json.loads((ROOT / "mapping/data/zvvnmod-utn57-map.json").read_text())
        source_ids = {source["id"] for source in mapping["sources"]}
        sources_by_const = {
            source["const"]: source["id"]
            for source in mapping["sources"]
            if sum(item["const"] == source["const"] for item in mapping["sources"]) == 1
        }
        targets_by_id = {target["id"]: target for target in mapping["targets"]}
        target_ids = set(targets_by_id) | {"MVS"}

        for row in payload["mappings"]:
            with self.subTest(pattern=row["pattern"]):
                self.assertEqual(len(row["zvvnmodCodes"]), len(row["utn57Shapes"]))
                self.assertTrue(row["utn57Shapes"])
                self.assertTrue({code for code in row["zvvnmodCodes"] if code} <= source_ids)
                self.assertTrue(set(row["utn57Shapes"]) <= target_ids)
                expected_slots = []
                for shape in row["utn57Shapes"]:
                    if shape == "MVS":
                        expected_slots.append(None)
                        continue
                    target = targets_by_id[shape]
                    unit = re.sub(
                        r"(?<=[a-z0-9])(?=[A-Z])", "_", target["unit"]
                    ).upper()
                    expected_slots.append(
                        sources_by_const.get(f"{unit}_{target['position'].upper()}")
                    )
                self.assertEqual(row["zvvnmodCodes"], expected_slots)

        rows = {row["pattern"]: row for row in payload["mappings"]}
        self.assertIsNone(rows["mvs i"]["zvvnmodCodes"][0])
        self.assertIsNone(rows["mvs a ch a g a n"]["zvvnmodCodes"][4])

    def test_particle_rows_keep_nominal_context_without_claiming_raw_meco_equivalence(self) -> None:
        payload = json.loads(PARTICLE_JSON.read_text())
        rows = {row["pattern"]: row for row in payload["mappings"]}

        self.assertEqual(rows["mvs t u"]["utn57Shapes"], ["MVS", "T:init", "U:fina"])
        self.assertEqual(rows["mvs t u"]["zvvnmodCodes"], [None, "U+E042", "U+E011"])
        self.assertEqual(rows["mvs d u"]["utn57Shapes"], ["MVS", "D:init", "U:fina"])
        self.assertEqual(rows["mvs d u"]["zvvnmodCodes"], [None, "U+E045", "U+E011"])
        self.assertEqual(rows["mvs t u"]["mode"], "unmapped")
        self.assertEqual(rows["u u"]["mode"], "direct")

    def test_generator_reproduces_committed_particle_mapping(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "particles.json"
            result = subprocess.run(
                ["python3", str(GENERATOR), "--output", str(output)],
                cwd=ROOT,
                text=True,
                capture_output=True,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(output.read_bytes(), PARTICLE_JSON.read_bytes())

    def test_generator_rejects_observation_drift_and_wrong_source_pins(self) -> None:
        observations = json.loads(OBSERVATIONS_JSON.read_text())
        with tempfile.TemporaryDirectory() as directory:
            temporary = Path(directory) / "observations.json"
            output = Path(directory) / "output.json"

            observations["observations"][0]["rawZvvnmodCodes"] = ["U+E000"]
            temporary.write_text(json.dumps(observations, indent=2) + "\n")
            drift = subprocess.run(
                ["python3", str(GENERATOR), "--observations", str(temporary), "--output", str(output)],
                cwd=ROOT,
                text=True,
                capture_output=True,
            )
            self.assertNotEqual(drift.returncode, 0)
            self.assertIn("observation snapshot checksum mismatch", drift.stdout + drift.stderr)

            observations = json.loads(OBSERVATIONS_JSON.read_text())
            observations["sources"]["meco"]["commit"] = "0" * 40
            temporary.write_text(json.dumps(observations, indent=2) + "\n")
            wrong_pin = subprocess.run(
                ["python3", str(GENERATOR), "--observations", str(temporary), "--output", str(output)],
                cwd=ROOT,
                text=True,
                capture_output=True,
            )
            self.assertNotEqual(wrong_pin.returncode, 0)
            self.assertIn("source provenance mismatch", wrong_pin.stdout + wrong_pin.stderr)

    def test_capture_script_rebuilds_observations_from_exact_upstream_revisions(self) -> None:
        capture = CAPTURE_SCRIPT.read_text()
        self.assertIn("539b455075486f70889e6de9909eac5dea839d8a", capture)
        self.assertIn("7edff334d33fc367596d1d33406b33bccb8ddc60", capture)
        self.assertIn("buildFontForLocales", capture)
        self.assertIn("unlink(missing_ok=True)", capture)
        self.assertIn("loadHBFont", capture)
        self.assertIn("/meco/translate", capture)
        self.assertIn("git", capture)
        self.assertIn("rev-parse", capture)
        self.assertIn("status", capture)
        self.assertIn("--porcelain", capture)
        self.assertIn("MAVEN_IMAGE", capture)
        self.assertIn("maven@sha256:1fee93ca227db7e8b8c7c72752ada0f03da6ebab40addd6fe48ac6293424186c", capture)
        self.assertIn("mvn", capture)
        self.assertIn("-Dmaven.test.skip=true", capture)
        self.assertIn('"clean"', capture)
        self.assertIn("eclipse-temurin@sha256:9ef14875d4c4ad2f05f3eb84d3dfff084e7cabd9840eaf25978156b06785a920", capture)
        self.assertIn('["docker", "run"', capture)
        self.assertNotIn('parser.add_argument("--meco-url"', capture)
        self.assertNotIn('parser.add_argument("--meco-jar"', capture)

    def test_semantic_alignment_uses_shape_const_names_and_preserves_blank_slots(self) -> None:
        module = runpy.run_path(str(GENERATOR))
        aliases = json.loads((ROOT / "mapping/data/mongfontbuilder-aliases.json").read_text())
        mapping = json.loads((ROOT / "mapping/data/zvvnmod-utn57-map.json").read_text())
        self.assertEqual(module["nominal_code_points"]("mvs i", aliases), ["U+180E", "U+1822"])

        align = module["semantic_zvvnmod_slots"]
        self.assertEqual(align(["O:init", "U:fina"], mapping), ["U+E001", "U+E011"])
        self.assertEqual(align(["MVS", "I:isol"], mapping), [None, "U+E01A"])
        self.assertEqual(align(["MVS", "Hx:medi", "U:fina"], mapping), [None, None, "U+E011"])

    def test_particle_renderer_uses_safe_dom_apis_and_versioned_model_import(self) -> None:
        renderer = (ROOT / "mapping/particle-mappings.js").read_text()
        self.assertIn('from "./particle-model.mjs?v=2"', renderer)
        self.assertIn("normalizeParticlePayload(event.detail.payload", renderer)
        self.assertIn("updateParticleEntry", renderer)
        self.assertIn("particle-mapping-updated", renderer)
        self.assertIn("Blank — no known counterpart", renderer)
        self.assertIn("document.createElement", renderer)
        self.assertIn("textContent", renderer)
        self.assertNotIn("innerHTML", renderer)
        self.assertIn("aria-label", renderer)
        self.assertIn('shapeId === "MVS"', renderer)
        self.assertIn('tableShell.setAttribute("aria-busy", "false")', renderer)

    def test_particle_table_styles_preserve_columns_and_context_markers(self) -> None:
        styles = (ROOT / "mapping/styles.css").read_text()
        self.assertIn(".particle-table-shell", styles)
        self.assertIn("overflow-x: auto", styles)
        self.assertIn(".particle-table", styles)
        self.assertIn(".particle-sequence", styles)
        self.assertIn(".particle-chip", styles)
        self.assertIn(".structural-chip", styles)
        self.assertIn(".particle-aligned-slot", styles)
        self.assertIn(".blank-particle-chip", styles)
        self.assertIn(".particle-slot-editor-row", styles)
        self.assertIn('.site-header nav a { flex: none; padding-inline: 4px; white-space: nowrap;', styles)
        self.assertIn(".nav-full { display: none; }", styles)
        self.assertIn(".nav-compact { display: inline; }", styles)

    def test_static_verifier_accepts_particle_edits_and_rejects_wrong_mode(self) -> None:
        payload = json.loads(PARTICLE_JSON.read_text())
        payload["mappings"][0]["zvvnmodCodes"][0] = "U+E000"
        payload["mappings"][0]["mode"] = "special"
        payload["mappings"][0]["note"] = "Reviewed semantic override"

        def verify(candidate: dict) -> subprocess.CompletedProcess[str]:
            with tempfile.NamedTemporaryFile("w", suffix=".json") as temporary:
                json.dump(candidate, temporary)
                temporary.flush()
                return subprocess.run(
                    [
                        "uv",
                        "run",
                        "--script",
                        str(ROOT / "mapping/scripts/verify-static-page.py"),
                        "--particle-json",
                        temporary.name,
                    ],
                    cwd=ROOT,
                    text=True,
                    capture_output=True,
                )

        accepted = verify(payload)
        self.assertEqual(accepted.returncode, 0, accepted.stdout + accepted.stderr)

        payload["mappings"][0]["mode"] = "direct"
        rejected = verify(payload)
        self.assertNotEqual(rejected.returncode, 0)
        self.assertIn("mode must be special", rejected.stdout + rejected.stderr)

    def test_static_verifier_rejects_particle_artifact_drift(self) -> None:
        payload = json.loads(PARTICLE_JSON.read_text())
        payload["mappings"][0]["utn57Shapes"] = ["A:isol"]
        with tempfile.NamedTemporaryFile("w", suffix=".json") as temporary:
            json.dump(payload, temporary)
            temporary.flush()
            result = subprocess.run(
                [
                    "uv",
                    "run",
                    "--script",
                    str(ROOT / "mapping/scripts/verify-static-page.py"),
                    "--particle-json",
                    temporary.name,
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
            )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("changed generated field utn57Shapes", result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
