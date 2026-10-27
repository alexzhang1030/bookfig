import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { USAGE } from "../src/cli.ts";
import { PALETTE } from "../src/palettes.ts";

const here = dirname(fileURLToPath(import.meta.url));
const HAN = /[\u4e00-\u9fff]/;

test("CLI help has no palette switch", () => {
  expect(USAGE).not.toMatch(/palette|green/i);
  expect(USAGE).toContain("--case");
});

test("library exposes only the blue palette", () => {
  expect(PALETTE.line).toBe("#1F6FEB");
  expect(JSON.stringify(PALETTE)).not.toContain("00B86B");
});

test("repo README and Nuxt chrome are English", () => {
  const root = join(here, "../../..");
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const page = readFileSync(join(root, "apps/web/app/pages/index.vue"), "utf8");
  const examples = readFileSync(join(root, "apps/web/app/examples.ts"), "utf8");
  expect(readme).not.toMatch(HAN);
  expect(page).not.toMatch(HAN);
  expect(examples).not.toMatch(HAN);
  expect(page).not.toMatch(/palette|green theme/i);
  expect(examples).toContain("$x^2$");
});
