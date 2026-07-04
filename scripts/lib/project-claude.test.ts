// scripts/lib/project-claude.test.ts
import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanCore } from "./scan";
import { projectClaude } from "./project-claude";

let core: string, out: string;
beforeEach(() => {
  core = mkdtempSync(join(tmpdir(), "core-"));
  out = mkdtempSync(join(tmpdir(), "out-"));
  mkdirSync(join(core, "skills/foo"), { recursive: true });
  writeFileSync(join(core, "skills/foo/SKILL.md"), "---\nname: foo\ndescription: d\n---\nbody");
  writeFileSync(join(core, "skills/foo/render.py"), "print(1)");
  mkdirSync(join(core, "sensors"), { recursive: true });
  writeFileSync(join(core, "sensors/pytest.md"), "---\nid: pytest\ncommand: bun {{HARNESS_DIR}}/tools/x.ts\n---\ns");
});
afterEach(() => { rmSync(core, { recursive: true, force: true }); rmSync(out, { recursive: true, force: true }); });

test("copies skill + assets and substitutes HARNESS_DIR", () => {
  const res = projectClaude(scanCore(core), core, out, ".claude");
  expect(existsSync(join(out, ".claude/skills/foo/SKILL.md"))).toBe(true);
  expect(readFileSync(join(out, ".claude/skills/foo/render.py"), "utf8")).toBe("print(1)");
  const sensor = readFileSync(join(out, ".claude/sensors/pytest.md"), "utf8");
  expect(sensor).toContain("bun .claude/tools/x.ts");
  expect(res.warnings).toEqual([]);
});

test("projects agent (.md), hook (.ts), and aidlc-rule with nested path preserved; assets stay verbatim", () => {
  // agent -> .md
  mkdirSync(join(core, "agents"), { recursive: true });
  writeFileSync(join(core, "agents/bar.md"), "---\nname: bar\ndescription: e\n---\nbody");
  // hook -> .ts, with a template var to prove substitution in text outputs
  mkdirSync(join(core, "hooks"), { recursive: true });
  writeFileSync(join(core, "hooks/guard.ts"), "// bun {{HARNESS_DIR}}/x");
  // aidlc-rule -> nested subdir must be preserved, not flattened
  mkdirSync(join(core, "ai-dlc/construction"), { recursive: true });
  writeFileSync(join(core, "ai-dlc/construction/code-gen.md"), "rule");
  // asset containing a template token must NOT be substituted (verbatim copy)
  writeFileSync(join(core, "skills/foo/keep.txt"), "literal {{HARNESS_DIR}} token");

  projectClaude(scanCore(core), core, out, ".claude");

  expect(existsSync(join(out, ".claude/agents/bar.md"))).toBe(true);
  expect(existsSync(join(out, ".claude/hooks/guard.ts"))).toBe(true);
  expect(readFileSync(join(out, ".claude/hooks/guard.ts"), "utf8")).toBe("// bun .claude/x");
  // nested aidlc-rule path preserved
  expect(existsSync(join(out, ".claude/aidlc-rules/construction/code-gen.md"))).toBe(true);
  // asset copied verbatim — template token left intact
  expect(readFileSync(join(out, ".claude/skills/foo/keep.txt"), "utf8")).toBe("literal {{HARNESS_DIR}} token");
});
