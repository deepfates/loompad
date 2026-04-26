#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${LYNC_SOURCE:-"$ROOT/../loomsync"}"
DEST="$ROOT/vendor/lync"

if [[ ! -d "$SOURCE/packages/core" ]]; then
  echo "Lync source repo not found at $SOURCE" >&2
  echo "Set LYNC_SOURCE=/path/to/lync-repo and rerun." >&2
  exit 1
fi

rm -rf "$DEST"
rsync -a \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  "$SOURCE/" "$DEST/"

# Textile vendors Lync as source files instead of installed packages. Keep
# package imports in the standalone repo, but rewrite them inside the vendored
# copy so Bun, Vite, and Playwright all resolve the same local source.
LYNC_VENDOR_TS_FILES=()
while IFS= read -r -d "" file; do
  LYNC_VENDOR_TS_FILES+=("$file")
done < <(
  find \
    "$DEST/packages/client/src" \
    "$DEST/packages/client/test" \
    "$DEST/packages/index/src" \
    "$DEST/packages/index/test" \
    -type f \
    -name "*.ts" \
    -print0
)

LC_ALL=C perl -pi -e '
  s#\@lync/core/automerge#../../core/src/automerge#g;
  s#\@lync/core/browser#../../core/src/browser#g;
  s#\@lync/core/memory#../../core/src/memory#g;
  s#\@lync/core/profiles/text-story#../../core/src/profiles/text-story#g;
  s#\@lync/core#../../core/src/index#g;
  s#\@lync/index/automerge#../../index/src/automerge#g;
  s#\@lync/index/memory#../../index/src/memory#g;
  s#\@lync/index#../../index/src/index#g;
' "${LYNC_VENDOR_TS_FILES[@]}"
