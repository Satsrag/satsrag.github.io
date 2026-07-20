#!/usr/bin/env python3
"""Capture chachlag shaping observations from exact upstream revisions.

Run this script inside mongfontbuilder's development environment so its test-font
compiler, ufo2ft, FontTools, and uharfbuzz dependencies are available.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import subprocess
import sys
import tarfile
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Any

OBSERVATION_SCHEMA = "zvvnmod-utn57-chachlag-observations-v1"
ONSETS = ("n", "j", "w", "h", "g")
VOWELS = ("a", "e")
PATTERNS = (
    *(f"mvs {vowel}" for vowel in VOWELS),
    *(f"{onset} mvs {vowel}" for onset in ONSETS for vowel in VOWELS),
    *(f"a {onset} mvs {vowel}" for onset in ONSETS for vowel in VOWELS),
)


@contextmanager
def archived_checkout(repository: Path):
    """Export committed HEAD into a temporary tree that excludes worktree files."""
    with tempfile.TemporaryDirectory(prefix="chachlag-capture-") as directory:
        temporary = Path(directory)
        archive_path = temporary / "checkout.tar"
        exported = temporary / "checkout"
        exported.mkdir()
        subprocess.run(
            ["git", "archive", "--format=tar", "--output", str(archive_path), "HEAD"],
            cwd=repository,
            check=True,
        )
        with tarfile.open(archive_path) as archive:
            for member in archive.getmembers():
                relative = Path(member.name)
                if (
                    relative.is_absolute()
                    or ".." in relative.parts
                    or member.issym()
                    or member.islnk()
                ):
                    raise ValueError(f"unsafe path in git archive: {member.name}")
            archive.extractall(exported)
        yield exported


def build_pinned_meco(meco: Path, support: Any) -> Path:
    """Build the pinned meco export without creating root-owned host files."""
    jar = meco / "target/meco-0.0.1-SNAPSHOT.jar"
    subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "--user",
            f"{os.getuid()}:{os.getgid()}",
            "--entrypoint",
            "mvn",
            "-e",
            "HOME=/tmp",
            "-v",
            f"{meco.resolve()}:/workspace",
            "-w",
            "/workspace",
            support.MAVEN_IMAGE,
            "-q",
            "-Dmaven.test.skip=true",
            "clean",
            "package",
        ],
        check=True,
    )
    if not jar.is_file():
        raise RuntimeError("pinned meco build did not produce the expected JAR")
    return jar


def load_capture_support(script_dir: Path) -> Any:
    path = script_dir / "capture-particle-observations.py"
    spec = importlib.util.spec_from_file_location("particle_capture_support", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load capture support from {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def capture(
    mongfontbuilder: Path,
    meco: Path,
    port: int,
    aliases_snapshot: Path,
    support: Any,
) -> dict[str, Any]:
    upstream_aliases = mongfontbuilder / "lib/mongfontbuilder/data/aliases.json"
    if upstream_aliases.read_bytes() != aliases_snapshot.read_bytes():
        raise ValueError("checked-in aliases snapshot differs from pinned mongfontbuilder")

    sys.path[:0] = [str(mongfontbuilder / "tests"), str(mongfontbuilder / "lib")]
    from fixtures import buildFontForLocales  # type: ignore[import-not-found]
    from uharfbuzz import Buffer, shape  # type: ignore[import-not-found]
    from utils import glyphNameMapping, loadHBFont, parseLetter  # type: ignore[import-not-found]

    cached_font = mongfontbuilder / "temp/hudum.otf"
    cached_font.unlink(missing_ok=True)
    font_path = buildFontForLocales(["MNG"])
    hb_font = loadHBFont(font_path)
    meco_jar = build_pinned_meco(meco, support)
    observations: list[dict[str, Any]] = []

    with support.pinned_meco_service(meco, meco_jar, port) as endpoint:
        for pattern in PATTERNS:
            nominal = parseLetter(pattern, "hud")
            buffer = Buffer()
            buffer.add_str(nominal)
            buffer.guess_segment_properties()
            shape(hb_font, buffer)
            glyph_names = [
                support.normalize_harfbuzz_name(
                    hb_font.glyph_to_string(info.codepoint),
                    glyphNameMapping,
                )
                for info in buffer.glyph_infos
            ]
            observations.append(
                {
                    "pattern": pattern,
                    "nominalCodePoints": [f"U+{ord(character):04X}" for character in nominal],
                    "rawZvvnmodCodes": support.post_meco(endpoint, nominal),
                    "utn57GlyphNames": glyph_names,
                }
            )

    return {
        "schema": OBSERVATION_SCHEMA,
        "description": "Pinned Delehi-to-ZVVNMOD and UTN57 chachlag shaping observations.",
        "sources": {
            "mongfontbuilder": {
                "repository": "https://github.com/Kushim-Jiang/mongfontbuilder",
                "commit": support.MONGFONTBUILDER_COMMIT,
                "rulesPath": "lib/mongfontbuilder/otl/iii.py",
                "aliasesPath": "lib/mongfontbuilder/data/aliases.json",
            },
            "meco": {
                "repository": "https://github.com/Satsrag/meco",
                "commit": support.MECO_COMMIT,
            },
        },
        "observations": observations,
    }


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    mapping_dir = script_dir.parent
    parser = argparse.ArgumentParser()
    parser.add_argument("--mongfontbuilder", type=Path, required=True)
    parser.add_argument("--meco", type=Path, required=True)
    parser.add_argument("--port", type=int, default=20207)
    parser.add_argument(
        "--aliases-snapshot",
        type=Path,
        default=mapping_dir / "data/mongfontbuilder-aliases.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=mapping_dir / "data/chachlag-shaping-observations.json",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="compare regenerated observations with --output instead of overwriting it",
    )
    args = parser.parse_args()
    support = load_capture_support(script_dir)
    mongfontbuilder = args.mongfontbuilder.resolve()
    meco = args.meco.resolve()
    support.require_revision(
        mongfontbuilder,
        support.MONGFONTBUILDER_COMMIT,
        "mongfontbuilder",
    )
    support.require_revision(meco, support.MECO_COMMIT, "meco")
    with archived_checkout(mongfontbuilder) as exported_mongfontbuilder:
        with archived_checkout(meco) as exported_meco:
            payload = capture(
                exported_mongfontbuilder,
                exported_meco,
                args.port,
                args.aliases_snapshot.resolve(),
                support,
            )
    encoded = (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode()
    if args.check:
        if args.output.read_bytes() != encoded:
            raise ValueError("regenerated chachlag observations differ from checked-in snapshot")
        print(f"verified {len(PATTERNS)} chachlag observations against {args.output}")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        temporary_name: str | None = None
        try:
            with tempfile.NamedTemporaryFile(dir=args.output.parent, delete=False) as temporary:
                temporary_name = temporary.name
                temporary.write(encoded)
                temporary.flush()
                os.fsync(temporary.fileno())
            os.replace(temporary_name, args.output)
        finally:
            if temporary_name is not None:
                Path(temporary_name).unlink(missing_ok=True)
        print(f"captured {len(PATTERNS)} chachlag observations -> {args.output}")


if __name__ == "__main__":
    main()
