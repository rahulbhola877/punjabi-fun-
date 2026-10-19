import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  // Havok ships its own WASM loader; keep it out of dependency pre-bundling
  // so the ?url import of the .wasm file resolves to the bundled local asset.
  optimizeDeps: { exclude: ["@babylonjs/havok"] },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 6000,
    assetsInlineLimit: 0,
  },
  server: { port: 5173, strictPort: false },
  preview: { port: 4173 },
});
