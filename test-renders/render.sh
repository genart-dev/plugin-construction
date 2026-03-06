#!/usr/bin/env bash
# Render construction plugin test images using the genart CLI.
# Usage: bash test-renders/render.sh
#
# Prerequisites:
#   cd ~/genart-dev/cli && npm link   (makes `genart` available globally)
#   — or use: npx --prefix ~/genart-dev/cli genart ...

set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

GENART="${GENART_CLI:-genart}"

echo "Rendering construction-guides..."
"$GENART" render "$DIR/construction-guides.genart" -o "$DIR/construction-guides.png"

echo "Done. Output in $DIR/"
