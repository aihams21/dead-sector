import { defineConfig } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "/",
  build: {
    outDir: "dist",
    assetsDir: "assets",
    target: "es2020",
    cssMinify: "lightningcss",
    rollupOptions: {
      input: {
        landing: resolve(root, "index.html"),
        play: resolve(root, "play/index.html"),
      },
    },
  },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
