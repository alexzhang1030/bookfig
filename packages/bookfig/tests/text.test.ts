import { expect, test } from "vite-plus/test";
import { isWide, textWidth, wrap } from "../src/text.ts";

test("latin is half-em, CJK is full-em", () => {
  expect(isWide("A")).toBe(false);
  expect(isWide("中")).toBe(true);
  expect(textWidth("AA", 10, 0)).toBe(10);
  expect(textWidth("中", 10, 0)).toBe(10);
  expect(textWidth("A中", 10, 2)).toBe(15 + 2);
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
