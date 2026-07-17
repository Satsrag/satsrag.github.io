# Mapping inventory page

Static reference and editing page for preparing the UTN57 ↔ ZVVNMOD mapping Map.

## Contents

- `data/utn57-written-units.html`: the rendered Hudum Written units table from Mongolian Font Builder.
- `data/zvvnmod-unicode-names.csv`: the authoritative ZVVNMOD name inventory snapshot.
- `data/zvvnmod-codes.json`: browser data grouped by base written-unit ID and joining position.
- `data/zvvnmod-utn57-map.json`: editable runtime alignments with ordered ZVVNMOD source and UTN57 target catalogues.
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

## Font regeneration

From a meco checkout:

```bash
./mapping/scripts/generate-zvvnmod-font.sh /path/to/meco
```

The checked-in font was generated from meco commit `7edff334d33fc367596d1d33406b33bccb8ddc60` with FontForge 20230101 in a digest-pinned Ubuntu 24.04 image. The script rejects a different meco revision or output checksum.

See [`NOTICE.md`](NOTICE.md) for sources and licenses.
