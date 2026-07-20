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
- `data/chachlag-shaping-observations.json`: pinned paired observations for basic, standalone-onset, and connected chachlag sequences.
- `data/zvvnmod-utn57-particles.json`: generated nominal-context particle alignments shown below the workbench.
- `assets/writtenunits-Regular.ttf`: UTN57 written-unit display font from Mongolian Font Builder.
- `assets/zvvnmod.ttf`: generated from meco's formal `zvvnmod.sfd`.

The two inventory tables remain unchanged above an aligned three-column mapping workbench. Its ZVVNMOD source catalogue contains the 77 single codes, the special `NIRUGU` code, and the two retained chachlag forms `N_AA_FINA` and `HX_AA_FINA`; other merged codes are already represented by decomposed sequences and are omitted. Generated direct mappings are review drafts, not authoritative linguistic rules. Unmatched codes remain as rows with the opposite side blank.

## Mapping JSON workflow

Generate the initial name-matched rows from both checked-in inventories:

```bash
python3 mapping/scripts/generate-default-mapping.py
```

ZVVNMOD catalogue IDs and mapping values use the Rust constant names; PUA code points remain catalogue metadata. Every row stores only its current ordered sequences and note:

```json
{
  "id": "source:A_INIT",
  "sources": ["A_INIT"],
  "targets": ["A:init"],
  "note": ""
}
```

Either `sources` or `targets` may be empty for an unmatched inventory item, but both cannot be empty in the same row. Their lengths are independent. The browser can add, remove, reorder, or replace values on either side. The checked-in Git rows are the Restore baseline, and `direct`, `unmapped`, and `special` are runtime display states derived by comparing the current row with that baseline; they are not serialized.

The UTN57 target inventory combines positional written units from `utn57-written-units.html` with format controls from `utn57-format-controls.json`. Both `Nirugu` (U+180A) and `MVS` (U+180E) are non-positional targets with `position: "control"`. Nirugu maps directly from the ZVVNMOD `NIRUGU` code; MVS is emitted structurally before chachlag `Aa:isol` rather than being read from a legacy ZVVNMOD control code.

Main and particle edits download together as `zvvnmod-utn57-workbench-v2`. The combined root contains one `sha256:…` digest of the exact Git-loaded mapping and particle payloads. Import rejects a file made against a different baseline while avoiding duplicated per-row default arrays. To publish reviewed values, replace the corresponding checked-in JSON payload; Git provides history.

## Chachlag mapping observations

The checked-in probes pair pinned Mongfontbuilder shaping with pinned meco observations. Mongfontbuilder confirms that a chachlag uses narrow MVS followed by `Aa:isol`. A standalone nominal probe is not automatically a mapping rule: only positions explicitly accepted by the shape flow are published. In particular, `j.isol` is an explicit `chachlag_onset`, while initial-looking standalone N/W/H/G probes are diagnostic only.

The published chachlag onset-plus-suffix shape mappings are:

```text
N_AA_FINA                         → N:fina  + MVS + Aa:isol
I_ISOL + AA_FINA                 → I:isol  + MVS + Aa:isol
I_FINA + AA_FINA                 → I:fina  + MVS + Aa:isol
U_FINA + AA_FINA                 → U:fina  + MVS + Aa:isol
H_FINA + AA_FINA                 → H:fina  + MVS + Aa:isol
HX_AA_FINA                        → Hx:fina + MVS + Aa:isol
AA_FINA + AA_FINA                → Aa:fina + MVS + Aa:isol
A_FINA + AA_FINA                 → A:fina  + MVS + Aa:isol
I_MEDI + AA_FINA + AA_FINA       → G:fina  + MVS + Aa:isol
```

The first seven onset shapes exhaust Mongfontbuilder's `chachlag_onset` and `chachlag_onset_gb` condition table, including the explicit isolated-J case and final Hudum Ali Gali A. The final two rows project FVS-selected A and G onset shapes after legacy controls are consumed. `I_MEDI + AA_FINA` is the existing reviewed decomposition of the single `G:fina` shape, so its chachlag form appends one more `AA_FINA`.

The sequence rows use actual UTN written-unit shapes, not nominal-letter labels or implementation-specific meco raw codes such as `J_MEDI`. `N_AA_FINA` and `HX_AA_FINA` remain direct rows because the authoritative ZVVNMOD inventory has no standalone `N_FINA` or `HX_FINA` constants. Gender propagation and dotless G contexts reuse these same written shapes and do not add another mapping.

A complete standalone `AA_FINA` remains `Aa:isol`; it does not by itself prove an omitted MVS. Raw Delehi/meco output is retained as implementation-specific evidence and is not promoted into rows such as `N_INIT + AA_FINA` or `J_MEDI + AA_FINA` merely from a nominal probe.

Rebuild the 33 observations with Docker and the pinned Mongfontbuilder development environment:

```bash
uv run --group dev python /path/to/satsrag.github.io/mapping/scripts/capture-chachlag-observations.py \
  --mongfontbuilder /path/to/mongfontbuilder \
  --meco /path/to/meco \
  --output /path/to/satsrag.github.io/mapping/data/chachlag-shaping-observations.json \
  --check
```

The chachlag capture validates both pinned revisions and tracked cleanliness, then builds the font and meco JAR only from temporary `git archive HEAD` exports. Untracked worktree files cannot enter either build. Successful writes use an atomic same-directory replacement; `--check` never rewrites the snapshot.

## Particle mapping generation

The page appends 47 MNG particle patterns from Mongfontbuilder below the editable workbench. The recorded observations were produced by:

1. building Mongfontbuilder's Hudum test font with its own `MongFeaComposer` and `ufo2ft` pipeline;
2. shaping every MNG particle nominal sequence with HarfBuzz to obtain UTN57 glyph/written-unit shapes;
3. converting the same nominal sequence through meco's `delehi → zvvnmod` path;
4. retaining those meco outputs as implementation-specific, checksum-locked provenance rather than treating them as the editable mapping;
5. deriving the initial editable ZVVNMOD sequence from UTN57 shape semantics and omitting shapes without a unique ZVVNMOD counterpart;
6. removing leading particle context (`MVS` in the UTN model and `NNBSP` in a 2010/vendor-side model) from the compact mapping body.

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

Regenerate the initial compact particle rows from the reviewed snapshots and observations:

```bash
python3 mapping/scripts/generate-particle-mapping.py
```

Particle rows use the same compact current-value model:

```json
{
  "id": "particle:07",
  "pattern": "i y a r",
  "particleIndices": [0, 1],
  "sources": ["I_INIT", "I_MEDI", "A_MEDI", "R_FINA"],
  "targets": ["I:init", "I:medi", "A:medi", "R:fina"],
  "note": ""
}
```

The two ordered sequences are independently editable and may have different lengths. The generated scaffold contains 47 rows; reviewed Git current values may diverge from the generator's initial sequence suggestions.

## Font regeneration

From a meco checkout:

```bash
./mapping/scripts/generate-zvvnmod-font.sh /path/to/meco
```

The checked-in font was generated from meco commit `7edff334d33fc367596d1d33406b33bccb8ddc60` with FontForge 20230101 in a digest-pinned Ubuntu 24.04 image. The script rejects a different meco revision or output checksum.

See [`NOTICE.md`](NOTICE.md) for sources and licenses.
