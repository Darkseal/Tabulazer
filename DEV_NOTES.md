# Tabulazer - DEV NOTES (Phase 0 baseline)

## Load unpacked in Chrome
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the repo folder: `.../Tabulazer` (this directory contains `manifest.json`)

## Vite/TypeScript (Phase C scaffold)
This repo now includes a Vite+TypeScript scaffold used to prepare the future refactor.
It is **not wired into `manifest.json` yet**.

Commands:
- `npm install`
- `npm run build` → outputs to `dist-vite/`

## Quick manual regression checklist
Open any file in `test-pages/` in Chrome, then right-click inside the table and run:
`Tabulazer - Table Filter and Sorter`

Files:
- `test-pages/simple.html`
- `test-pages/no-th.html`
- `test-pages/empty-headers.html`
- `test-pages/big.html` (800 rows)
- `test-pages/multi.html`

Checks:
- Sorting works
- Header filters appear (currently always-on)
- Paging works when enabled in popup
- Copy (CTRL+C) behavior is acceptable

## Repo pointers
- Manifest: `manifest.json`
- Service worker: `src/worker/worker.js`
- Content script: `src/content/js/content.js`
- Core: `src/common/common.js`
- Popup: `src/browser_action/browser_action.html` + `.js`
