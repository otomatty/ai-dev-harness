// scripts/lib/scan.test.ts
import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanCore } from "./scan";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "core-"));
  mkdirSync(join(dir, "skills/foo"), { recursive: true });
  writeFileSync(join(dir, "skills/foo/SKILL.md"), "---\nname: foo\ndescription: d\n---\nbody");
  writeFileSync(join(dir, "skills/foo/render.py"), "print(1)");
  mkdirSync(join(dir, "agents"), { recursive: true });
  writeFileSync(join(dir, "agents/bar.md"), "---\nname: bar\ndescription: e\n---\nb");
  mkdirSync(join(dir, "hooks"), { recursive: true });
  writeFileSync(join(dir, "hooks/guard.ts"), "// guard");
  mkdirSync(join(dir, "ai-dlc/construction"), { recursive: true });
  writeFileSync(join(dir, "ai-dlc/construction/code-gen.md"), "rule");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

test("scans skills with assets", () => {
  const caps = scanCore(dir);
  const skill = caps.find((c) => c.type === "skill" && c.name === "foo")!;
  expect(skill.frontmatter.description).toBe("d");
  expect(skill.assets).toContain("render.py");
  expect(skill.relPath).toBe("skills/foo/SKILL.md");
});

test("scans agents, hooks, and aidlc rules", () => {
  const caps = scanCore(dir);
  expect(caps.find((c) => c.type === "agent" && c.name === "bar")).toBeTruthy();
  expect(caps.find((c) => c.type === "hook" && c.name === "guard")).toBeTruthy();
  const rule = caps.find((c) => c.type === "aidlc-rule")!;
  expect(rule.name).toBe("construction/code-gen");
  expect(rule.relPath).toBe("ai-dlc/construction/code-gen.md");
});

test("orders skills deterministically by name regardless of insertion order", () => {
  mkdirSync(join(dir, "skills/alpha"), { recursive: true });
  writeFileSync(join(dir, "skills/alpha/SKILL.md"), "---\nname: alpha\ndescription: a\n---\nb");
  mkdirSync(join(dir, "skills/zeta"), { recursive: true });
  writeFileSync(join(dir, "skills/zeta/SKILL.md"), "---\nname: zeta\ndescription: z\n---\nb");
  const names = scanCore(dir).filter((c) => c.type === "skill").map((c) => c.name);
  expect(names).toEqual(["alpha", "foo", "zeta"]);
});
