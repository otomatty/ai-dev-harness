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
