import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      index: "src/index.ts",
      node: "src/node.ts",
      cli: "src/cli.ts",
    },
    dts: {
      generator: "tsgo",
    },
    exports: true,
  },
  test: {
    testTimeout: 30_000,
    hookTimeout: 90_000,
    // Layout files share one Nuxt on :43173. Parallel afterAll would kill it
    // under the other file and produce ERR_CONNECTION_REFUSED.
    fileParallelism: false,
  },
});
