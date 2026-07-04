import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { build } from "./build";
import { seedMinimalHarnessRoot } from "./lib/test-fixture";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "root-"));
  mkdirSync(join(root, "core/hooks"), { recursive: true });
  writeFileSync(join(root, "core/hooks/guard.ts"), "// guard");
  seedMinimalHarnessRoot(root);
  writeFileSync(join(root, "harness/claude/settings.base.json"),
    '{"hooks":{"PreToolUse":[{"matcher":"Write","hooks":[{"type":"command","command":"bun {{HARNESS_DIR}}/hooks/guard.ts"}]}]}}');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

test("build writes all three distributions and merged settings", () => {
  const { warnings } = build(root);
  expect(existsSync(join(root, "dist/claude/.claude/skills/foo/SKILL.md"))).toBe(true);
  expect(existsSync(join(root, "dist/claude/.claude/settings.json"))).toBe(true);
  expect(existsSync(join(root, "dist/cursor/.cursor/rules/foo.mdc"))).toBe(true);
  expect(existsSync(join(root, "dist/agents-md/AGENTS.md"))).toBe(true);
  expect(warnings.some((w) => w.includes("guard"))).toBe(true); // hook degraded on cursor
});

test("build writes plugin-shaped Claude and Codex distributions", () => {
  build(root);
  expect(existsSync(join(root, "dist/claude-plugin/.claude-plugin/plugin.json"))).toBe(true);
  expect(existsSync(join(root, "dist/claude-plugin/skills/foo/SKILL.md"))).toBe(true);
  expect(existsSync(join(root, "dist/claude-plugin/settings.json"))).toBe(true);
  expect(existsSync(join(root, "dist/codex-plugin/.codex-plugin/plugin.json"))).toBe(true);
  expect(existsSync(join(root, "dist/codex-plugin/skills/foo/SKILL.md"))).toBe(true);
  expect(existsSync(join(root, ".claude-plugin/marketplace.json"))).toBe(true);
  expect(existsSync(join(root, ".agents/plugins/marketplace.json"))).toBe(true);
});

test("settings PreToolUse command has HARNESS_DIR substituted", () => {
  build(root);
  const s = readFileSync(join(root, "dist/claude/.claude/settings.json"), "utf8");
  // no template left behind
  expect(s).not.toContain("{{HARNESS_DIR}}");
});
