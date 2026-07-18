#!/usr/bin/env python3
"""Rebuild particle shaping observations from exact upstream revisions.

Run this script inside mongfontbuilder's development environment so its test-font
compiler, ufo2ft, FontTools, and uharfbuzz dependencies are available.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
from contextlib import contextmanager
from pathlib import Path
from typing import Any

MONGFONTBUILDER_COMMIT = "539b455075486f70889e6de9909eac5dea839d8a"
MECO_COMMIT = "7edff334d33fc367596d1d33406b33bccb8ddc60"
MAVEN_IMAGE = "maven@sha256:1fee93ca227db7e8b8c7c72752ada0f03da6ebab40addd6fe48ac6293424186c"
JRE_IMAGE = "eclipse-temurin@sha256:9ef14875d4c4ad2f05f3eb84d3dfff084e7cabd9840eaf25978156b06785a920"
OBSERVATION_SCHEMA = "zvvnmod-utn57-particle-observations-v1"


def git_output(repository: Path, *arguments: str) -> str:
    result = subprocess.run(
        ["git", *arguments],
        cwd=repository,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def require_revision(repository: Path, expected: str, label: str) -> None:
    actual = git_output(repository, "rev-parse", "HEAD")
    if actual != expected:
        raise ValueError(f"{label} revision mismatch: expected {expected}, got {actual}")
    status = git_output(repository, "status", "--porcelain", "--untracked-files=no")
    if status:
        raise ValueError(f"{label} checkout has tracked modifications")


def post_meco(endpoint: str, nominal: str) -> list[str]:
    payload = json.dumps(
        {"from": "delehi", "to": "zvvnmod", "content": nominal},
        ensure_ascii=False,
    ).encode()
    request = urllib.request.Request(
        endpoint,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        result = json.loads(response.read())
    if not isinstance(result, dict) or result.get("ret") is not True or not isinstance(result.get("data"), str):
        raise ValueError(f"meco conversion failed: {result!r}")
    return [f"U+{ord(character):04X}" for character in result["data"]]


def build_pinned_meco(meco: Path) -> Path:
    jar = meco / "target/meco-0.0.1-SNAPSHOT.jar"
    subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "-v",
            f"{meco.resolve()}:/workspace",
            "-w",
            "/workspace",
            MAVEN_IMAGE,
            "mvn",
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


@contextmanager
def pinned_meco_service(meco: Path, jar: Path, port: int):
    expected_jar = (meco / "target/meco-0.0.1-SNAPSHOT.jar").resolve()
    if jar.resolve() != expected_jar:
        raise ValueError(f"meco JAR must be the pinned checkout artifact: {expected_jar}")
    if not 1024 <= port <= 65535:
        raise ValueError("capture port must be between 1024 and 65535")

    container_name = f"satsrag-particle-capture-{os.getpid()}"
    endpoint = f"http://127.0.0.1:{port}/meco/translate"
    command = ["docker", "run", "--rm", "--name", container_name]
    command.extend(
        [
            "-p",
            f"127.0.0.1:{port}:20207",
            "-v",
            f"{jar.resolve()}:/app/meco.jar:ro",
            JRE_IMAGE,
            "java",
            "-jar",
            "/app/meco.jar",
        ]
    )
    process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for attempt in range(40):
            if process.poll() is not None:
                raise RuntimeError("pinned meco container exited before becoming ready")
            try:
                post_meco(endpoint, "\u1820")
                break
            except Exception:
                if attempt == 39:
                    raise RuntimeError("pinned meco container did not become ready")
                time.sleep(0.5)
        yield endpoint
    finally:
        subprocess.run(
            ["docker", "stop", container_name],
            check=False,
            capture_output=True,
            text=True,
        )
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            process.kill()


def normalize_harfbuzz_name(name: str, mapping: dict[str, str | None]) -> str:
    mapped = mapping.get(name) or name
    if ".Widespace." in mapped and mapped.startswith("uni180E"):
        return "mvs.wide"
    return mapped


def capture(
    mongfontbuilder: Path,
    meco: Path,
    port: int,
    particle_snapshot: Path,
    aliases_snapshot: Path,
) -> dict[str, Any]:
    require_revision(mongfontbuilder, MONGFONTBUILDER_COMMIT, "mongfontbuilder")
    require_revision(meco, MECO_COMMIT, "meco")
    meco_jar = build_pinned_meco(meco)

    upstream_particles = mongfontbuilder / "lib/mongfontbuilder/data/particles.json"
    upstream_aliases = mongfontbuilder / "lib/mongfontbuilder/data/aliases.json"
    if upstream_particles.read_bytes() != particle_snapshot.read_bytes():
        raise ValueError("checked-in particle snapshot differs from the pinned mongfontbuilder checkout")
    if upstream_aliases.read_bytes() != aliases_snapshot.read_bytes():
        raise ValueError("checked-in aliases snapshot differs from the pinned mongfontbuilder checkout")
    particles = json.loads(upstream_particles.read_text())
    mng_particles = particles.get("MNG")
    if not isinstance(mng_particles, dict) or len(mng_particles) != 47:
        raise ValueError("pinned mongfontbuilder checkout must contain exactly 47 MNG particle patterns")

    sys.path[:0] = [str(mongfontbuilder / "tests"), str(mongfontbuilder / "lib")]
    from fixtures import buildFontForLocales  # type: ignore[import-not-found]
    from uharfbuzz import Buffer, shape  # type: ignore[import-not-found]
    from utils import glyphNameMapping, loadHBFont, parseLetter  # type: ignore[import-not-found]

    cached_font = mongfontbuilder / "temp/hudum.otf"
    cached_font.unlink(missing_ok=True)
    font_path = buildFontForLocales(["MNG"])
    hb_font = loadHBFont(font_path)
    observations: list[dict[str, Any]] = []

    with pinned_meco_service(meco, meco_jar, port) as endpoint:
        for pattern, particle_indices in mng_particles.items():
            nominal = parseLetter(pattern, "hud")
            buffer = Buffer()
            buffer.add_str(nominal)
            buffer.guess_segment_properties()
            shape(hb_font, buffer)
            glyph_names = [
                normalize_harfbuzz_name(hb_font.glyph_to_string(info.codepoint), glyphNameMapping)
                for info in buffer.glyph_infos
            ]
            observations.append(
                {
                    "pattern": pattern,
                    "particleIndices": particle_indices,
                    "nominalCodePoints": [f"U+{ord(character):04X}" for character in nominal],
                    "rawZvvnmodCodes": post_meco(endpoint, nominal),
                    "utn57GlyphNames": glyph_names,
                }
            )

    return {
        "schema": OBSERVATION_SCHEMA,
        "sources": {
            "mongfontbuilder": {
                "repository": "https://github.com/Kushim-Jiang/mongfontbuilder",
                "commit": MONGFONTBUILDER_COMMIT,
                "particlesPath": "lib/mongfontbuilder/data/particles.json",
                "aliasesPath": "lib/mongfontbuilder/data/aliases.json",
            },
            "meco": {
                "repository": "https://github.com/Satsrag/meco",
                "commit": MECO_COMMIT,
            },
        },
        "observations": observations,
    }


def main() -> None:
    mapping_dir = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser()
    parser.add_argument("--mongfontbuilder", type=Path, required=True)
    parser.add_argument("--meco", type=Path, required=True)
    parser.add_argument("--port", type=int, default=20207)
    parser.add_argument(
        "--particle-snapshot",
        type=Path,
        default=mapping_dir / "data/mongfontbuilder-particles.json",
    )
    parser.add_argument(
        "--aliases-snapshot",
        type=Path,
        default=mapping_dir / "data/mongfontbuilder-aliases.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=mapping_dir / "data/particle-shaping-observations.json",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="compare regenerated observations with --output instead of overwriting it",
    )
    args = parser.parse_args()

    meco = args.meco.resolve()
    payload = capture(
        args.mongfontbuilder.resolve(),
        meco,
        args.port,
        args.particle_snapshot.resolve(),
        args.aliases_snapshot.resolve(),
    )
    encoded = (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode()
    if args.check:
        if args.output.read_bytes() != encoded:
            raise ValueError("regenerated particle observations differ from the checked-in snapshot")
        print(f"verified 47 particle observations against {args.output}")
    else:
        args.output.write_bytes(encoded)
        print(f"captured 47 particle observations -> {args.output}")


if __name__ == "__main__":
    main()
