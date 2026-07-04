// scripts/check.test.ts
import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { build } from "./build";
import { check } from "./check";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "checkroot-"));
  mkdirSync(join(root, "core/skills/foo"), { recursive: true });
  writeFileSync(join(root, "core/skills/foo/SKILL.md"), "---\nname: foo\ndescription: d\n---\nbody");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

test("check returns ok when dist matches a fresh build", () => {
  build(root);
  const res = check(root);
  expect(res.ok).toBe(true);
});

test("check detects a hand-edited dist file and names the agent", () => {
  build(root);
  appendFileSync(join(root, "dist/claude/.claude/skills/foo/SKILL.md"), "\nTAMPERED");
  const res = check(root);
  expect(res.ok).toBe(false);
  expect(res.message).toContain("dist/claude");
});
