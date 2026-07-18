from __future__ import annotations

import json
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
        self.assertIn('src="particle-mappings.js?v=1"', page)
        self.assertIn('<link rel="icon" href="../favicon.png">', page)
        self.assertIn('src="workbench.js?v=3"', page)
        workbench = (ROOT / "mapping/workbench.js").read_text()
        self.assertIn('from "./workbench-model.mjs?v=3"', workbench)

    def test_particle_mapping_data_has_all_mongfontbuilder_mng_patterns(self) -> None:
        payload = json.loads(PARTICLE_JSON.read_text())
        self.assertEqual(payload["schema"], "zvvnmod-utn57-particles-v1")
        self.assertEqual(len(payload["mappings"]), 47)

    def test_key_particle_mappings_preserve_particle_semantics(self) -> None:
        payload = json.loads(PARTICLE_JSON.read_text())
        rows = {row["pattern"]: row for row in payload["mappings"]}

        self.assertEqual(rows["mvs i"]["rawZvvnmodCodes"], ["U+E143", "U+E00E"])
        self.assertEqual(rows["mvs i"]["zvvnmodCodes"], ["U+E00E"])
        self.assertEqual(rows["mvs i"]["utn57Shapes"], ["MVS", "I:isol"])
        self.assertEqual(
            rows["u u"]["zvvnmodCodes"],
            ["U+E000", "U+E008", "U+E011"],
        )
        self.assertEqual(rows["u u"]["utn57Shapes"], ["O:init", "U:fina"])
        self.assertEqual(
            rows["b ue ue"]["zvvnmodCodes"],
            ["U+E029", "U+E008", "U+E006", "U+E011"],
        )
        self.assertEqual(
            rows["b ue ue"]["utn57Shapes"],
            ["B:init", "O:medi", "U:fina"],
        )

    def test_canonical_sequences_use_current_catalogues_and_drop_legacy_controls(self) -> None:
        payload = json.loads(PARTICLE_JSON.read_text())
        mapping = json.loads((ROOT / "mapping/data/zvvnmod-utn57-map.json").read_text())
        source_ids = {source["id"] for source in mapping["sources"]}
        target_ids = {target["id"] for target in mapping["targets"]} | {"MVS"}

        for row in payload["mappings"]:
            with self.subTest(pattern=row["pattern"]):
                self.assertTrue(row["zvvnmodCodes"])
                self.assertTrue(row["utn57Shapes"])
                self.assertTrue(set(row["zvvnmodCodes"]) <= source_ids)
                self.assertTrue(set(row["utn57Shapes"]) <= target_ids)
                self.assertFalse(
                    any(0xE140 <= int(code[2:], 16) <= 0xE143 for code in row["zvvnmodCodes"])
                )

    def test_ambiguous_zvvnmod_sequences_keep_nominal_particle_context(self) -> None:
        payload = json.loads(PARTICLE_JSON.read_text())
        rows = {row["pattern"]: row for row in payload["mappings"]}

        self.assertEqual(rows["mvs t u"]["zvvnmodCodes"], rows["mvs d u"]["zvvnmodCodes"])
        self.assertEqual(rows["mvs t u"]["utn57Shapes"], ["MVS", "T:init", "U:fina"])
        self.assertEqual(rows["mvs d u"]["utn57Shapes"], ["MVS", "D:init", "U:fina"])
        self.assertTrue(rows["mvs t u"]["ambiguous"])
        self.assertTrue(rows["mvs d u"]["ambiguous"])
        self.assertTrue(any(not row["ambiguous"] for row in payload["mappings"]))

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

    def test_nominal_validation_and_merged_exceptions_are_explicit(self) -> None:
        module = runpy.run_path(str(GENERATOR))
        aliases = json.loads((ROOT / "mapping/data/mongfontbuilder-aliases.json").read_text())
        self.assertEqual(module["nominal_code_points"]("mvs i", aliases), ["U+180E", "U+1822"])
        self.assertEqual(module["RETAINED_MERGED_IDS"], {"U+E077", "U+E09D"})

        code_by_id = {
            "U+E09D": {"name": "Hx f Aa f"},
            "U+E099": {"name": "G m I f"},
            "U+E028": {"name": "G m"},
            "U+E00E": {"name": "I f"},
        }
        single_by_name = {
            "G m": [{"codepoint": "U+E028"}],
            "I f": [{"codepoint": "U+E00E"}],
        }
        canonicalize = module["canonical_zvvnmod_sequence"]
        self.assertEqual(
            canonicalize(
                ["U+E09D"], code_by_id, {"U+E09D", "U+E099", "U+E028", "U+E00E"}, single_by_name, {"U+E09D", "U+E099"}
            ),
            ["U+E09D"],
        )
        self.assertEqual(
            canonicalize(
                ["U+E099"], code_by_id, {"U+E09D", "U+E099", "U+E028", "U+E00E"}, single_by_name, {"U+E09D", "U+E099"}
            ),
            ["U+E028", "U+E00E"],
        )

    def test_particle_renderer_uses_safe_dom_apis_and_versioned_model_import(self) -> None:
        renderer = (ROOT / "mapping/particle-mappings.js").read_text()
        self.assertIn('from "./particle-model.mjs?v=1"', renderer)
        self.assertIn('from "./workbench-model.mjs?v=3"', renderer)
        self.assertIn("normalizeMappingPayload(mappingPayload)", renderer)
        self.assertIn('fetch("./data/zvvnmod-utn57-particles.json?v=1"', renderer)
        self.assertIn('fetch("./data/zvvnmod-utn57-map.json?v=2"', renderer)
        self.assertIn("document.createElement", renderer)
        self.assertIn("textContent", renderer)
        self.assertNotIn("innerHTML", renderer)
        self.assertIn("Nominal context required", renderer)
        self.assertIn("This canonical ZVVNMOD sequence has multiple UTN57 outcomes", renderer)
        self.assertIn("aria-label", renderer)
        self.assertNotIn("badge.title", renderer)
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
        self.assertIn(".ambiguity-badge", styles)
        self.assertIn(".ambiguous-particle-row", styles)
        self.assertIn('.site-header nav a { flex: none; padding-inline: 4px; white-space: nowrap;', styles)
        self.assertIn(".nav-full { display: none; }", styles)
        self.assertIn(".nav-compact { display: inline; }", styles)

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
        self.assertIn("particle mapping differs from generated artifact", result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
