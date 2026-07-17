# Mapping inventory page

Static reference and editing page for preparing the UTN57 ↔ ZVVNMOD mapping Map.

## Contents

- `data/utn57-written-units.html`: the rendered Hudum Written units table from Mongolian Font Builder.
- `data/zvvnmod-unicode-names.csv`: the authoritative ZVVNMOD name inventory snapshot.
- `data/zvvnmod-codes.json`: browser data grouped by base written-unit ID and joining position.
- `data/zvvnmod-utn57-map.json`: editable runtime mapping and ordered UTN57 target catalogue.
- `assets/writtenunits-Regular.ttf`: UTN57 written-unit display font from Mongolian Font Builder.
- `assets/zvvnmod.ttf`: generated from meco's formal `zvvnmod.sfd`.

The two inventory tables remain unchanged above an aligned three-column mapping workbench. Generated direct mappings are review drafts, not authoritative linguistic rules.

## Mapping JSON workflow

Generate the default name-matched draft from both checked-in inventories:

```bash
python3 mapping/scripts/generate-default-mapping.py
```

Every mapping uses sequence arrays:

```json
{
  "source": ["U+E000"],
  "defaultTargets": ["A:init"],
  "targets": ["A:init"],
  "mode": "direct",
  "note": ""
}
```

The browser can edit an ordered target sequence, restore its generated default, import a complete JSON file, or download the current mapping. To publish an edited mapping, replace `mapping/data/zvvnmod-utn57-map.json` with the downloaded file. The next page load uses that file directly.

Modes are recomputed when JSON is loaded:

- `direct`: current targets equal a non-empty generated default.
- `unmapped`: current targets and generated default are both empty.
- `special`: current targets differ from the generated default.

## Font regeneration

From a meco checkout:

```bash
./mapping/scripts/generate-zvvnmod-font.sh /path/to/meco
```

The checked-in font was generated from meco commit `7edff334d33fc367596d1d33406b33bccb8ddc60` with FontForge 20230101 in a digest-pinned Ubuntu 24.04 image. The script rejects a different meco revision or output checksum.

See [`NOTICE.md`](NOTICE.md) for sources and licenses.
