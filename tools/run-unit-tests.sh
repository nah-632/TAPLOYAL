#!/bin/sh
# tools/run-unit-tests.sh
#
# Node 22.23 here cannot strip TypeScript types (`ERR_NO_TYPESCRIPT`), so the
# .ts tests are bundled with the esbuild binary that already ships as a
# transitive dependency of drizzle-kit. No new dependency is added.
set -e
cd "$(dirname "$0")/.."

ESBUILD=./node_modules/esbuild/bin/esbuild
[ -x "$ESBUILD" ] || chmod +x "$ESBUILD" 2>/dev/null || true

OUT=/tmp/taployal-unit-tests
mkdir -p "$OUT"

FILES=""
# Only the database-free unit tests. `test/integration/**` needs a live
# connection and is run by tools/run-integration-tests.sh instead.
for f in $(rg --files test -g '*.test.ts' | rg -v '^test/integration/'); do
  [ -f "$f" ] || continue
  name=$(basename "$f" .ts)
  "$ESBUILD" "$f" --bundle --platform=node --format=esm --target=node22 \
    --outfile="$OUT/$name.mjs" --log-level=error
  FILES="$FILES $OUT/$name.mjs"
done

if [ -z "$FILES" ]; then
  echo "no .ts tests found"
  exit 0
fi

# shellcheck disable=SC2086
node --test $FILES
