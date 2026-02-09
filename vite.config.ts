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
    react({
      jsxRuntime: "automatic",
      babel: {
        plugins: [],
      },
    }),
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
  // @tanstack/react-router'ın jsx import sorununu çözmek için
  optimizeDeps: {
    include: [
      "bcryptjs",
      "react",
      "react-dom",
      "react/jsx-runtime",
      "@tanstack/react-router",
    ],
    exclude: ["electron"],
    esbuildOptions: {
      jsx: "automatic",
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  base: "./", // Electron production (file://) için relative path
  build: {
    outDir: "dist",
    emptyOutDir: true,
    commonjsOptions: {
      // CRITICAL FIX: Tüm CommonJS modüllerini transform et
      // "module is not defined" hatasını önlemek için
      // node_modules içindeki tüm CommonJS modüllerini transform et
      include: [/node_modules/],
      transformMixedEsModules: true,
      // CommonJS require'ları ES module import'a çevir
      requireReturnsDefault: "auto",
      // Dynamic require'ları da transform et
      dynamicRequireTargets: [],
      // Strict mode'u kapat (bazı modüller için gerekli)
      strictRequires: false,
    },
    rollupOptions: {
      output: {
        format: "es",
        preserveModules: false,
        // Global değişkenler tanımla (CommonJS için)
        globals: {},
      },
      // Tüm bağımlılıkları bundle'a dahil et
      // @tanstack/react-router'ın jsx import sorununu çözmek için
      external: [],
    },
  },
  // Define global değişkenler (CommonJS için)
  // NOT: Bu güvenli değil, bu yüzden commonjsOptions ile çözüyoruz
  // define: {
  //   "module": "undefined",
  // },
});
