import { test, expect, afterAll } from "bun:test";
import { mkdtempSync, readFileSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyTemplate, writeFileEnsured, copyFileEnsured, cleanDir } from "./io";

const dir = mkdtempSync(join(tmpdir(), "io-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("applyTemplate substitutes known vars, keeps unknown", () => {
  expect(applyTemplate("bun {{HARNESS_DIR}}/x {{OTHER}}", { HARNESS_DIR: ".claude" }))
    .toBe("bun .claude/x {{OTHER}}");
});

test("writeFileEnsured creates parent dirs", () => {
  const p = join(dir, "a/b/c.txt");
  writeFileEnsured(p, "hi");
  expect(readFileSync(p, "utf8")).toBe("hi");
});

test("copyFileEnsured copies verbatim", () => {
  const src = join(dir, "src.py");
  writeFileSync(src, "print(1)");
  const dest = join(dir, "nested/out.py");
  copyFileEnsured(src, dest);
  expect(readFileSync(dest, "utf8")).toBe("print(1)");
});

test("cleanDir empties an existing dir", () => {
  const d = join(dir, "clean");
  writeFileEnsured(join(d, "old.txt"), "x");
  cleanDir(d);
  expect(existsSync(join(d, "old.txt"))).toBe(false);
});
