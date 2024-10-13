import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import fs from "fs";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-manifest",
      buildStart() {
        this.emitFile({
          type: "asset",
          fileName: "manifest.json",
          source: fs.readFileSync("manifest.json", "utf-8")
        });
      }
    }
  ],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html")
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]"
      }
    }
  },
  publicDir: "public"
});
