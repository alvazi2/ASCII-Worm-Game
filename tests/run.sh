#!/bin/sh
# Runs the acceptance checks in tests/acceptance.js against the game logic in index.html.
#
# The game is a single self-contained HTML file, so the script block is extracted to a
# temporary file and evaluated in a headless JS engine alongside tests/browser-stubs.js.
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)

jsc=${JSC:-/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc}
if [ ! -x "$jsc" ]; then
  if command -v node >/dev/null 2>&1; then
    jsc=$(command -v node)
  else
    echo "No JS engine found. Set JSC=/path/to/jsc (macOS ships one in JavaScriptCore.framework) or install node." >&2
    exit 1
  fi
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

awk '/<script>/{flag=1;next} /<\/script>/{flag=0} flag' "$root/index.html" > "$tmp/game.js"

if [ ! -s "$tmp/game.js" ]; then
  echo "Could not extract the script block from index.html." >&2
  exit 1
fi

case "$jsc" in
  *node) # node has no global print(); alias it, and evaluate the three files as one program
         { echo 'globalThis.print = console.log;'
           cat "$root/tests/browser-stubs.js" "$tmp/game.js" "$root/tests/acceptance.js"
         } > "$tmp/all.js"
         "$jsc" "$tmp/all.js" ;;
  *)     "$jsc" "$root/tests/browser-stubs.js" "$tmp/game.js" "$root/tests/acceptance.js" ;;
esac
