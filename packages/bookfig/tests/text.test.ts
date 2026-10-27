import { expect, test } from "vite-plus/test";
import { ensureBookFont, latinAdvanceEm } from "../src/book-font.ts";
import { isWide, textWidth, wrap } from "../src/text.ts";

test("latin uses the bundled mono advance, CJK is full-em", async () => {
  await ensureBookFont();
  const em = latinAdvanceEm();
  expect(em).toBeCloseTo(0.6, 5);
  expect(isWide("A")).toBe(false);
  expect(isWide("中")).toBe(true);
  expect(textWidth("AA", 10, 0)).toBeCloseTo(20 * em, 5);
  expect(textWidth("中", 10, 0)).toBe(10);
  expect(textWidth("A中", 10, 2)).toBeCloseTo(10 * em + 10 + 2, 5);
});

test("wrap breaks on spaces and between CJK", () => {
  expect(wrap("hello world", 30, 10, 0)).toEqual(["hello", "world"]);
  const lines = wrap("中文标签测试", 20, 10, 0);
  expect(lines.length).toBeGreaterThan(1);
  expect(lines.join("")).toBe("中文标签测试");
});

test("explicit newline forces a break", () => {
  expect(wrap("AA\nBB", 1000, 10, 0)).toEqual(["AA", "BB"]);
});

test("wrap keeps spaces next to words so math gaps survive", () => {
  expect(wrap("area ", 1000, 10, 0)).toEqual(["area "]);
  expect(wrap(" more", 1000, 10, 0)).toEqual([" more"]);
});
