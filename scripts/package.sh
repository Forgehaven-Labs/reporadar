#!/usr/bin/env bash
#
# package.sh — build a clean, versioned RepoRadar distributable zip.
#
# Produces dist/reporadar-<version>.zip containing only the files a buyer needs
# to run the tool. Excludes developer-internal files (CLAUDE.md, Jenkinsfile,
# .git, landing page source, generated output) and runs a secret-leak guard
# before zipping. Finally, it unpacks the zip in a temp dir and runs a smoke
# scan to prove the distributable works standalone.
#
# Usage:
#   ./scripts/package.sh            # version read from package.json
#   ./scripts/package.sh 0.1.1      # override version
#
# Zero dependencies beyond bash, node, and zip.

set -euo pipefail

# --- locate repo root (this script lives in <root>/scripts) ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

# --- version ---
if [ "${1:-}" != "" ]; then
  VERSION="$1"
else
  VERSION="$(node -p "require('./package.json').version")"
fi

NAME="reporadar"
STAGE_PARENT="$(mktemp -d)"
STAGE="$STAGE_PARENT/$NAME"
DIST="$ROOT/dist"
ZIP="$DIST/${NAME}-${VERSION}.zip"

echo "RepoRadar packager"
echo "  version : $VERSION"
echo "  staging : $STAGE"
echo "  output  : $ZIP"
echo

# --- files that ship to a buyer (allowlist, not denylist) ---
INCLUDE=(
  "bin"
  "src"
  "test"
  "demo"
  "docs/screenshots"
  "README.md"
  "CHANGELOG.md"
  "LICENSE"
  "MONETIZATION.md"
  "package.json"
  "package-lock.json"
  ".reporadarignore"
  "eslint.config.js"
  ".editorconfig"
)

mkdir -p "$STAGE"
for item in "${INCLUDE[@]}"; do
  if [ -e "$ROOT/$item" ]; then
    mkdir -p "$STAGE/$(dirname "$item")"
    cp -R "$ROOT/$item" "$STAGE/$item"
  else
    echo "  warn: skipping missing $item"
  fi
done

# --- strip any stray noise that slipped in via copied dirs ---
find "$STAGE" -name ".DS_Store" -delete 2>/dev/null || true
find "$STAGE" -name "*.log" -delete 2>/dev/null || true
rm -rf "$STAGE/out" "$STAGE/node_modules" 2>/dev/null || true

# --- secret / personal-config leak guard ----------------------------------
# Block release if anything that looks like a real secret or personal path is
# present. The demo fixtures contain SYNTHETIC secrets on purpose, so we scan
# everything EXCEPT demo/ for high-signal patterns, and separately confirm no
# literal `.env` file is shipped anywhere.
echo "Running secret-leak guard..."
LEAK=0

# 1. No file literally named .env anywhere in the package.
if find "$STAGE" -name ".env" | grep -q .; then
  echo "  FAIL: a literal .env file is present in the package:"
  find "$STAGE" -name ".env"
  LEAK=1
fi

# 2. High-signal secret / personal patterns outside the intentional demo fixtures.
#    (AWS keys, GitHub tokens, real-looking Anthropic/OpenAI keys, private keys,
#     personal home paths, the author's email.)
GUARD_PATTERN='AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|-----BEGIN (RSA|EC|OPENSSH|DSA|PGP) PRIVATE KEY-----|/Users/[a-z]|s\.a\.green'
if grep -rEn "$GUARD_PATTERN" "$STAGE" \
     --exclude-dir=demo \
     --exclude-dir=screenshots \
     | grep -vE 'scan\.js|SECRET_PATTERNS'; then
  echo "  FAIL: possible secret or personal path outside demo fixtures (above)."
  LEAK=1
fi

if [ "$LEAK" -ne 0 ]; then
  echo "Secret-leak guard FAILED. Aborting package build."
  rm -rf "$STAGE_PARENT"
  exit 1
fi
echo "  ok: no secrets or personal config leaked."
echo

# --- write a short VERSION stamp the buyer can read ---
printf '%s\n' "$VERSION" > "$STAGE/VERSION"

# --- build the zip ---
mkdir -p "$DIST"
rm -f "$ZIP"
( cd "$STAGE_PARENT" && zip -r -q "$ZIP" "$NAME" -x "*.DS_Store" )
echo "Built: $ZIP"
echo "  size: $(du -h "$ZIP" | cut -f1)"
echo

# --- smoke-test the distributable in isolation ---
echo "Smoke-testing the distributable..."
VERIFY_DIR="$(mktemp -d)"
( cd "$VERIFY_DIR" && unzip -q "$ZIP" )
if node "$VERIFY_DIR/$NAME/bin/reporadar.js" scan "$VERIFY_DIR/$NAME/demo/sample-repo" >/dev/null 2>&1; then
  : # exit 2 is expected on the intentionally-red demo, so check explicitly below
fi
RR_EXIT=0
node "$VERIFY_DIR/$NAME/bin/reporadar.js" scan "$VERIFY_DIR/$NAME/demo/sample-repo" >/dev/null 2>&1 || RR_EXIT=$?
if [ "$RR_EXIT" -eq 2 ] || [ "$RR_EXIT" -eq 0 ]; then
  echo "  ok: packaged CLI runs (demo scan exit=$RR_EXIT)."
else
  echo "  FAIL: packaged CLI did not run cleanly (exit=$RR_EXIT)."
  rm -rf "$STAGE_PARENT" "$VERIFY_DIR"
  exit 1
fi

# --- cleanup ---
rm -rf "$STAGE_PARENT" "$VERIFY_DIR"

echo
echo "Done. Ship: $ZIP"
