# Mapping inventory page

Static reference and editing page for preparing the UTN57 ↔ ZVVNMOD mapping Map.

## Contents

- `data/utn57-written-units.html`: the rendered Hudum Written units table from Mongolian Font Builder.
- `data/zvvnmod-unicode-names.csv`: the authoritative ZVVNMOD name inventory snapshot.
- `data/zvvnmod-codes.json`: browser data grouped by base written-unit ID and joining position.
- `data/zvvnmod-utn57-map.json`: editable runtime alignments with ordered ZVVNMOD source and UTN57 target catalogues.
- `data/mongfontbuilder-particles.json`: exact Mongfontbuilder particle dictionary snapshot used by the particle generator.
- `data/mongfontbuilder-aliases.json`: exact Mongfontbuilder alias dictionary used to derive nominal Unicode code points.
- `data/particle-shaping-observations.json`: recorded Mongfontbuilder HarfBuzz glyph output and meco raw ZVVNMOD output for each MNG particle pattern.
- `data/zvvnmod-utn57-particles.json`: generated nominal-context particle alignments shown below the workbench.
- `assets/writtenunits-Regular.ttf`: UTN57 written-unit display font from Mongolian Font Builder.
- `assets/zvvnmod.ttf`: generated from meco's formal `zvvnmod.sfd`.

The two inventory tables remain unchanged above an aligned three-column mapping workbench. Its ZVVNMOD source catalogue contains the 77 single codes, the special `NIRUGU` code, and the two retained chachlag forms `N_AA_FINA` and `HX_AA_FINA`; other merged codes are already represented by decomposed sequences and are omitted. Generated direct mappings are review drafts, not authoritative linguistic rules. Unmatched codes remain as rows with the opposite side blank.

## Mapping JSON workflow

Generate the default name-matched draft from both checked-in inventories:

```bash
python3 mapping/scripts/generate-default-mapping.py
```

Every alignment uses ordered sequence arrays on both sides:

```json
{
  "id": "source:U+E000",
  "defaultSources": ["U+E000"],
  "sources": ["U+E000"],
  "defaultTargets": ["A:init"],
  "targets": ["A:init"],
  "mode": "direct",
  "note": ""
}
```

Either `sources` or `targets` may be empty for an unmatched inventory item, but both cannot be empty in the same row. The browser can add, remove, reorder, or replace multiple codes on either side; restore both generated defaults; import a complete v2 JSON file; or download the current alignments. To publish an edited mapping, replace `mapping/data/zvvnmod-utn57-map.json` with the downloaded file. The next page load uses that file directly.

Modes are recomputed from both current sequences when JSON is loaded:

- `direct`: both current sequences equal their generated defaults and both sides are non-empty.
- `unmapped`: both current sequences equal their generated defaults and one side is empty.
- `special`: either current sequence differs from its generated default.

## Particle mapping generation

The page appends 47 MNG particle patterns from Mongfontbuilder below the editable workbench. The recorded observations were produced by:

1. building Mongfontbuilder's Hudum test font with its own `MongFeaComposer` and `ufo2ft` pipeline;
2. shaping every MNG particle nominal sequence with HarfBuzz to obtain UTN57 glyph/written-unit shapes;
3. converting the same nominal sequence through meco's `delehi → zvvnmod` path;
4. discarding meco's legacy `E140–E143` controls and decomposing merged ZVVNMOD codes into the current editable source catalogue;
5. preserving the nominal particle pattern because one canonical ZVVNMOD sequence can have multiple UTN57 outcomes.

The observations can be independently rebuilt. With Docker available, run the capture script inside the pinned Mongfontbuilder development environment:

```bash
cd /path/to/mongfontbuilder
uv run --group dev python /path/to/satsrag.github.io/mapping/scripts/capture-particle-observations.py \
  --mongfontbuilder /path/to/mongfontbuilder \
  --meco /path/to/meco \
  --output /path/to/satsrag.github.io/mapping/data/particle-shaping-observations.json \
  --check
```

The capture script rejects dirty checkouts or either checkout unless `HEAD` is exactly Mongfontbuilder `539b455075486f70889e6de9909eac5dea839d8a` and meco `7edff334d33fc367596d1d33406b33bccb8ddc60`. It requires the checked-in particle and alias snapshots to be byte-identical to the pinned Mongfontbuilder files, forces a fresh Hudum font build, builds meco itself in a digest-pinned Maven/JDK container, and immediately launches that artifact in a digest-pinned JRE container. It does not accept an external meco service URL or JAR. The downstream generator locks SHA-256 digests for all input snapshots and derives nominal Unicode code points from the alias snapshot, so changing raw nominal code points, HarfBuzz glyph output, meco output, source objects, or paths fails verification until the reviewed locks are intentionally updated.

Regenerate the checked-in particle alignment from the reviewed snapshot and recorded observations:

```bash
python3 mapping/scripts/generate-particle-mapping.py
```

The generator currently emits 47 rows. Ten rows are marked context-dependent because their canonical ZVVNMOD sequence is shared with a different UTN57 shape sequence. These rows are not presented as a context-free conversion function.

## Font regeneration

From a meco checkout:

```bash
./mapping/scripts/generate-zvvnmod-font.sh /path/to/meco
```

The checked-in font was generated from meco commit `7edff334d33fc367596d1d33406b33bccb8ddc60` with FontForge 20230101 in a digest-pinned Ubuntu 24.04 image. The script rejects a different meco revision or output checksum.

See [`NOTICE.md`](NOTICE.md) for sources and licenses.
