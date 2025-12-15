import path from "path";
import { readFileSync } from "fs";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";

// Read package.json to get dependencies
const packageJson = JSON.parse(
  readFileSync(path.resolve(__dirname, "./package.json"), "utf-8")
);
const dependencies = Object.keys(packageJson.dependencies || {});

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    electron([
      {
        entry: "electron/main.ts",
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            sourcemap: true,
            minify: process.env.NODE_ENV === "production",
            outDir: "dist-electron",
            rollupOptions: {
              external: dependencies,
              output: {
                format: "cjs",
                entryFileNames: "main.js",
              },
            },
          },
        },
      },
      {
        entry: "electron/preload.ts",
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            sourcemap: "inline",
            minify: process.env.NODE_ENV === "production",
            outDir: "dist-electron",
            rollupOptions: {
              external: dependencies,
              output: {
                format: "cjs",
                entryFileNames: "preload.js",
              },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
    conditions: ["development", "browser", "module", "import", "default"],
    mainFields: ["module", "jsnext:main", "jsnext", "main"],
  },
  optimizeDeps: {
    include: ["bcryptjs"],
    exclude: ["electron"],
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  base: "./", // Use relative paths for Electron
  build: {
    outDir: "dist",
    emptyOutDir: true,
    commonjsOptions: {
      include: [/bcryptjs/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        format: "es",
      },
    },
  },
});
