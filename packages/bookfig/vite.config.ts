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
  },
});
