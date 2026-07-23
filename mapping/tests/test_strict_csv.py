from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from importlib import import_module
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "mapping/scripts"
sys.path.insert(0, str(SCRIPTS))

parse_table = import_module("strict_csv").parse_table

RUNTIME = ROOT / "mapping/data/zvvnmod-utn57-map.csv"
PARTICLES = ROOT / "mapping/data/zvvnmod-utn57-particles.csv"
VERIFIER = SCRIPTS / "verify-static-page.py"


class StrictCsvTests(unittest.TestCase):
    def test_parser_rejects_malformed_quote_transitions_and_widths(self) -> None:
        header = ["id", "sources", "targets", "note"]
        malformed = (
            'id,sources,targets,note\nrow,foo"bar,A:init,\n',
            'id,sources,targets,note\nrow,"foo"bar,A:init,\n',
            'id,sources,targets,note\nrow,"foo,A:init,\n',
            "id,sources,targets,note\nrow,A_INIT,A:init,note,extra\n",
        )
        for candidate in malformed:
            with self.subTest(candidate=candidate):
                with self.assertRaises(ValueError):
                    parse_table(candidate, header)

    def test_parser_preserves_valid_quoted_multiline_fields(self) -> None:
        rows = parse_table(
            'id,sources,targets,note\nrow,A_INIT,A:init,"line one\nline two"\n',
            ["id", "sources", "targets", "note"],
        )
        self.assertEqual(rows[0]["note"], "line one\nline two")

    def run_verifier(self, mapping_text: str, particle_text: str | None = None) -> subprocess.CompletedProcess[str]:
        with tempfile.TemporaryDirectory() as directory:
            mapping_path = Path(directory) / "map.csv"
            particle_path = Path(directory) / "particles.csv"
            mapping_path.write_text(mapping_text)
            particle_path.write_text(particle_text if particle_text is not None else PARTICLES.read_text())
            return subprocess.run(
                [
                    "uv",
                    "run",
                    "--script",
                    str(VERIFIER),
                    "--mapping-csv",
                    str(mapping_path),
                    "--particle-csv",
                    str(particle_path),
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
            )

    def test_verifier_rejects_strict_csv_and_sequence_drift(self) -> None:
        runtime = RUNTIME.read_text()
        mutations = (
            runtime.replace("source:O_INIT,O_INIT,", 'source:O_INIT,O_INIT",', 1),
            runtime.replace("source:O_INIT,O_INIT,", 'source:O_INIT,"O_INIT"x,', 1),
            runtime.replace("source:O_INIT,O_INIT,", 'source:O_INIT,"O_INIT,', 1),
            runtime.replace("source:O_INIT,O_INIT,O:init,", "source:O_INIT,O_INIT,O:init,,", 1),
            runtime.replace("M_FINA AA_FINA", "M_FINA  AA_FINA", 1),
        )
        for candidate in mutations:
            with self.subTest(candidate=candidate[:180]):
                self.assertNotEqual(self.run_verifier(candidate).returncode, 0)

        for spelling in ("1x", "00", "01", "+0", "-0"):
            with self.subTest(particle_index=spelling):
                particle = PARTICLES.read_text().replace(",0 1\n", f",0 {spelling}\n", 1)
                self.assertNotEqual(self.run_verifier(runtime, particle).returncode, 0)

    def test_generators_reject_malformed_reviewed_runtime_csv(self) -> None:
        malformed = RUNTIME.read_text().replace(
            "source:O_INIT,O_INIT,", 'source:O_INIT,O_INIT",', 1
        )
        with tempfile.TemporaryDirectory() as directory:
            reviewed = Path(directory) / "map.csv"
            reviewed.write_text(malformed)
            for script in ("generate-default-mapping.py", "generate-particle-mapping.py"):
                with self.subTest(script=script):
                    result = subprocess.run(
                        [sys.executable, str(SCRIPTS / script), "--reviewed", str(reviewed)],
                        cwd=ROOT,
                        text=True,
                        capture_output=True,
                    )
                    self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
