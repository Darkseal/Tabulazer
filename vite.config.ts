import { defineConfig } from "vite";
import { resolve } from "node:path";

// Phase C scaffolding:
// We introduce Vite+TS without switching the MV3 manifest yet.
// Output is written to dist-vite/ for experimentation.

export default defineConfig({
  build: {
    outDir: "dist-vite",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        // future entries (not yet wired into manifest.json)
        worker: resolve(__dirname, "src-ts/worker.ts"),
        content: resolve(__dirname, "src-ts/content.ts"),
        popup: resolve(__dirname, "src-ts/popup.ts"),
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});
