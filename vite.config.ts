import { defineConfig } from "vite";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Optional recordings are discovered at build time instead of probing nonexistent
// files on every visit. The synthesised radio remains the working fallback.
const musicDir = fileURLToPath(new URL("./public/audio/music/", import.meta.url));
const musicTracks = existsSync(musicDir) ? readdirSync(musicDir).filter(n => n.endsWith(".mp3")).map(n => n.slice(0, -4)) : [];

export default defineConfig({
  base: "./",
  define: { __MUSIC_TRACKS__: JSON.stringify(musicTracks) },
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
