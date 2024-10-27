import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import fs from "fs";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-files",
      buildStart() {
        // Copy manifest.json
        this.emitFile({
          type: "asset",
          fileName: "manifest.json",
          source: fs.readFileSync("manifest.json", "utf-8"),
        });
        // Copy content.js from src directory
        this.emitFile({
          type: "asset",
          fileName: "content.js",
          source: fs.readFileSync("src/content.js", "utf-8"),
        });
        // Copy styles.css if it exists
        this.emitFile({
          type: "asset",
          fileName: "style.css",
          source: fs.readFileSync("src/style.css", "utf-8"),
        });
        this.emitFile({
          type: "asset",
          fileName: "popup.js",
          source: fs.readFileSync("popup.js", "utf-8"),
        });
      },
    },
  ],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "popup.html"),
        background: resolve(__dirname, "src/background.ts"),
        content: "src/content-script/inject.tsx",
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
  publicDir: "public",
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
