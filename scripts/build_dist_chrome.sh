#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

rm -rf dist-chrome
mkdir -p dist-chrome

# Copy the existing extension (source-based) as a baseline.
# We'll override the popup with a Vite-built one.
rsync -a --delete \
  --exclude 'dist-chrome' \
  --exclude 'dist-vite' \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'src-ts' \
  --exclude 'scripts' \
  ./ dist-chrome/

# Build the Vite popup into dist-chrome/popup
npm run build:ext

# Replace action popup to point at the Vite popup
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const manifestPath = path.join(process.cwd(), 'dist-chrome', 'manifest.json');
const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

m.action = m.action || {};
m.action.default_popup = 'popup/popup.html';

// Ensure a title + icon still exist
m.action.default_title = m.action.default_title || 'Tabulazer';

fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2) + '\n');
console.log('Wrote', manifestPath);
NODE

# Copy popup HTML template (built JS is already in dist-chrome/popup)
mkdir -p dist-chrome/popup
cp -f src-ts/popup/popup.html dist-chrome/popup/popup.html

echo "dist-chrome ready. Load unpacked from: $ROOT_DIR/dist-chrome"
