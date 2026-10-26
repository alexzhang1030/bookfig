import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false },
  telemetry: false,
  css: ["~/assets/css/main.css"],
  devServer: {
    host: "127.0.0.1",
    port: 43173,
  },
  alias: {
    bookfig: fileURLToPath(new URL("../../packages/bookfig/src/index.ts", import.meta.url)),
    "bookfig/node": fileURLToPath(new URL("../../packages/bookfig/src/node.ts", import.meta.url)),
  },
  vite: {
    optimizeDeps: {
      exclude: ["@hpcc-js/wasm-graphviz"],
    },
  },
  nitro: {
    experimental: {
      wasm: true,
    },
    externals: {
      inline: ["bookfig"],
    },
  },
});
