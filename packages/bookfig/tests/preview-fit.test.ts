import { expect, test } from "vite-plus/test";
import { clampFitAvail, FIT_MIN_HEIGHT_PX, FIT_MIN_HEIGHT_VH } from "../../../apps/web/app/preview-fit.ts";

test("Fit avail height never collapses below 200px or 35dvh", () => {
  const crushed = clampFitAvail({ w: 358, h: 13 }, 844);
  expect(crushed.w).toBe(358);
  expect(crushed.h).toBeGreaterThanOrEqual(FIT_MIN_HEIGHT_PX);
  expect(crushed.h).toBeGreaterThanOrEqual(844 * FIT_MIN_HEIGHT_VH);
  expect(crushed.h).toBeGreaterThanOrEqual(200);
});

test("width-limited Fit keeps the real width and only raises height", () => {
  const roomy = clampFitAvail({ w: 800, h: 700 }, 900);
  expect(roomy.w).toBe(800);
  expect(roomy.h).toBe(700);
});
