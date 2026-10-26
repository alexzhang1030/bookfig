import { expect, test } from "vite-plus/test";
import { USAGE } from "../src/cli.ts";
import { PALETTE } from "../src/palettes.ts";

test("CLI help has no palette switch", () => {
  expect(USAGE).not.toMatch(/palette|green/i);
  expect(USAGE).toContain("--case");
});

test("library exposes only the blue palette", () => {
  expect(PALETTE.line).toBe("#1F6FEB");
  expect(JSON.stringify(PALETTE)).not.toContain("00B86B");
});
