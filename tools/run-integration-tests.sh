#!/bin/sh
# tools/run-integration-tests.sh
#
# Runs the tests that talk to the real CranL PostgreSQL through the real
# application code. Requires .env.local (mode 600, git-ignored) produced by
# tools/provision-app-role.mjs.
#
# The credential is sourced into the environment rather than passed on the
# command line, so it never appears in `ps` output or in a log.
set -e
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "✗ .env.local is missing. Run: node tools/provision-app-role.mjs --sslmode disable"
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env.local
set +a

if [ -z "$DATABASE_URL" ]; then
  echo "✗ DATABASE_URL is empty in .env.local"
  exit 1
fi

ESBUILD=./node_modules/esbuild/bin/esbuild
[ -x "$ESBUILD" ] || chmod +x "$ESBUILD" 2>/dev/null || true

mkdir -p .test-build
# Native bindings cannot be inlined by esbuild; keep them external.
"$ESBUILD" test/integration/auth.test.ts \
  --bundle --platform=node --format=esm --target=node22 \
  --external:@node-rs/argon2 \
  --external:@node-rs/argon2-linux-arm64-musl \
  --outfile=.test-build/auth-int.mjs --log-level=error

node --test .test-build/auth-int.mjs