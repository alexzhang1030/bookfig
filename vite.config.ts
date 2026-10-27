import { defineConfig } from "vite-plus";

export default defineConfig({
  defaultPackage: {
    dev: "./apps/web",
    build: "./apps/web",
    preview: "./apps/web",
    pack: "./packages/bookfig",
  },
  fmt: {
    ignorePatterns: ["**/fixtures/**", "**/snapshots/**", "**/artifacts/**", "**/uploads/**"],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: [
      "**/fixtures/**",
      "**/snapshots/**",
      "**/artifacts/**",
      "**/uploads/**",
      "**/dist/**",
    ],
    overrides: [
      {
        files: ["**/cli.ts", "**/scripts/**", "**/render-artifacts.ts"],
        rules: { "no-console": "off" },
      },
    ],
  },
  run: {
    cache: true,
  },
  test: {
    testTimeout: 30_000,
    hookTimeout: 90_000,
    fileParallelism: false,
  },
});
