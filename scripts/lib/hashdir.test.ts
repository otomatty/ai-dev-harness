import { test, expect, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { hashDir } from "./hashdir";
import { writeFileEnsured } from "./io";

const a = mkdtempSync(join(tmpdir(), "a-"));
const b = mkdtempSync(join(tmpdir(), "b-"));
afterAll(() => { rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true }); });

test("identical trees hash equal, changed content differs", () => {
  writeFileEnsured(join(a, "x/y.txt"), "hello");
  writeFileEnsured(join(b, "x/y.txt"), "hello");
  expect(hashDir(a)).toBe(hashDir(b));
  writeFileSync(join(b, "x/y.txt"), "changed");
  expect(hashDir(a)).not.toBe(hashDir(b));
});
