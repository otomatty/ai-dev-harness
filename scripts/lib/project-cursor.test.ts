import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanCore } from "./scan";
import { projectCursor } from "./project-cursor";

let core: string, out: string;
beforeEach(() => {
  core = mkdtempSync(join(tmpdir(), "core-"));
  out = mkdtempSync(join(tmpdir(), "out-"));
  mkdirSync(join(core, "skills/foo"), { recursive: true });
  writeFileSync(join(core, "skills/foo/SKILL.md"), "---\nname: foo\ndescription: d\n---\nBODY");
  mkdirSync(join(core, "hooks"), { recursive: true });
  writeFileSync(join(core, "hooks/guard.ts"), "// guard");
});
afterEach(() => { rmSync(core, { recursive: true, force: true }); rmSync(out, { recursive: true, force: true }); });

test("skill becomes a .mdc rule with cursor frontmatter", () => {
  projectCursor(scanCore(core), core, out);
  const mdc = readFileSync(join(out, ".cursor/rules/foo.mdc"), "utf8");
  expect(mdc).toContain("alwaysApply: false");
  expect(mdc).toContain("description: d");
  expect(mdc).toContain("BODY");
});

test("hook degrades with a warning and an _unsupported note", () => {
  const res = projectCursor(scanCore(core), core, out);
  expect(res.warnings.some((w) => w.includes("guard"))).toBe(true);
  expect(existsSync(join(out, ".cursor/rules/_unsupported/hook-guard.md"))).toBe(true);
});
