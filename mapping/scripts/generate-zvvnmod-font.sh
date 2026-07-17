#!/usr/bin/env bash
set -euo pipefail

# Generate the browser font from the reviewed meco SFD revision.
# Usage: ./mapping/scripts/generate-zvvnmod-font.sh /path/to/meco
readonly MECO_COMMIT="7edff334d33fc367596d1d33406b33bccb8ddc60"
readonly FONT_SHA256="a2de07335cf46df301fedd6acf5242a5c3551e08cbf64679a4dfc5f1e96ca079"
readonly FONTFORGE_IMAGE="ubuntu:24.04@sha256:186072bba1b2f436cbb91ef2567abca677337cfc786c86e107d25b7072feef0c"

meco_root=${1:?"usage: $0 /path/to/meco"}
source_sfd="$meco_root/fonts/zvvnmod/zvvnmod.sfd"
output_dir=$(cd "$(dirname "$0")/../assets" && pwd)

test -f "$source_sfd"
test "$(git -C "$meco_root" rev-parse HEAD)" = "$MECO_COMMIT"

docker run --rm \
  -v "$(cd "$(dirname "$source_sfd")" && pwd):/input:ro" \
  -v "$output_dir:/output" \
  "$FONTFORGE_IMAGE" \
  bash -lc "apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fontforge >/dev/null && fontforge -lang=ff -c 'Open(\$1); Generate(\$2)' /input/zvvnmod.sfd /output/zvvnmod.ttf"

echo "$FONT_SHA256  $output_dir/zvvnmod.ttf" | sha256sum --check
