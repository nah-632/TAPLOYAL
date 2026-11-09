#!/bin/sh
# tools/sync-workspace.sh
#
# The runnable project lives in /root/taployal (see ADR-011): the /var/minis
# bridge mount supports neither symlinks nor fs.realpathSync.native, which
# breaks npm install and Next.js startup. This mirrors the SOURCE (never
# node_modules / .next) into the shared workspace so it can be browsed from
# chat and from Files.
set -e

SRC=/root/taployal
DST=/var/minis/workspace/taployal

mkdir -p "$DST"
cd "$SRC"

tar cf - \
  --exclude='./node_modules' \
  --exclude='./.next' \
  --exclude='./.env.local' \
  --exclude='./.env' \
  --exclude='./.env.*.local' \
  --exclude='./.test-build' \
  --exclude='./package-lock.json' \
  --exclude='./next-env.d.ts' \
  --exclude='./tsconfig.tsbuildinfo' \
  . | (cd "$DST" && tar xf -)

echo "✓ synced $SRC → $DST"
echo "  files: $(find "$DST" -type f | wc -l)  size: $(du -sh "$DST" | cut -f1)"
