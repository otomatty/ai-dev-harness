import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanCore } from "./scan";
import { projectAgentsMd } from "./project-agents-md";

let core: string, out: string;
beforeEach(() => {
  core = mkdtempSync(join(tmpdir(), "core-"));
  out = mkdtempSync(join(tmpdir(), "out-"));
  mkdirSync(join(core, "skills/foo"), { recursive: true });
  writeFileSync(join(core, "skills/foo/SKILL.md"), "---\nname: foo\ndescription: d\n---\nb");
  mkdirSync(join(core, "agents"), { recursive: true });
  writeFileSync(join(core, "agents/bar.md"), "---\nname: bar\ndescription: e\n---\nx");
});
afterEach(() => { rmSync(core, { recursive: true, force: true }); rmSync(out, { recursive: true, force: true }); });

test("AGENTS.md lists skills and claude-only capabilities", () => {
  projectAgentsMd(scanCore(core), out);
  const md = readFileSync(join(out, "AGENTS.md"), "utf8");
  expect(md).toContain("## Skill: foo");
  expect(md).toContain("d");
  expect(md).toContain("bar");
});
