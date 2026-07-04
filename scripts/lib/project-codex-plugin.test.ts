import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanCore } from "./scan";
import { projectCodexPlugin } from "./project-codex-plugin";

let core: string, out: string;
beforeEach(() => {
  core = mkdtempSync(join(tmpdir(), "core-"));
  out = mkdtempSync(join(tmpdir(), "out-"));
  mkdirSync(join(core, "skills/foo"), { recursive: true });
  writeFileSync(join(core, "skills/foo/SKILL.md"), "---\nname: foo\ndescription: d\n---\nsee {{HARNESS_DIR}}/agents/x.md");
  mkdirSync(join(core, "agents"), { recursive: true });
  writeFileSync(join(core, "agents/bar.md"), "---\nname: bar\ndescription: e\n---\nbody");
});
afterEach(() => {
  rmSync(core, { recursive: true, force: true });
  rmSync(out, { recursive: true, force: true });
});

test("projects skills only and warns on non-skill capabilities", () => {
  const { warnings } = projectCodexPlugin(scanCore(core), core, out);
  expect(existsSync(join(out, "skills/foo/SKILL.md"))).toBe(true);
  const skill = readFileSync(join(out, "skills/foo/SKILL.md"), "utf8");
  expect(skill).toContain("./agents/x.md");
  expect(skill).not.toContain("{{HARNESS_DIR}}");
  expect(warnings.some((w) => w.includes("agent 'bar'"))).toBe(true);
});
