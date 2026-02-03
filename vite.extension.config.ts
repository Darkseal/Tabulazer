import { defineConfig } from "vite";
import { resolve } from "node:path";

// Builds a LOAD-UNPACKED-ready extension bundle into dist-chrome/.
// This is an incremental migration: only the popup is Vite-bundled for now.
// The rest of the extension files are copied by scripts/build_dist_chrome.sh.

export default defineConfig({
  build: {
    outDir: "dist-chrome/popup",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src-ts/popup/popup.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        format: "iife",
      },
    },
  },
});
