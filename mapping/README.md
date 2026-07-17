# Mapping inventory page

Static reference page for preparing the UTN57 ↔ ZVVNMOD mapping Map.

## Contents

- `data/utn57-written-units.html`: the rendered Hudum Written units table from Mongolian Font Builder.
- `data/zvvnmod-unicode-names.csv`: the authoritative ZVVNMOD name inventory snapshot.
- `data/zvvnmod-codes.json`: browser data grouped by base written-unit ID and joining position.
- `assets/writtenunits-Regular.ttf`: UTN57 written-unit display font from Mongolian Font Builder.
- `assets/zvvnmod.ttf`: generated from meco's formal `zvvnmod.sfd`.

The page is inventory-only. It does not define mapping relationships yet.

## Font regeneration

From a meco checkout:

```bash
./mapping/scripts/generate-zvvnmod-font.sh /path/to/meco
```

The checked-in font was generated from meco commit `7edff334d33fc367596d1d33406b33bccb8ddc60` with FontForge 20230101 in a digest-pinned Ubuntu 24.04 image. The script rejects a different meco revision or output checksum.

See [`NOTICE.md`](NOTICE.md) for sources and licenses.
