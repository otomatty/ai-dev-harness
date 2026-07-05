import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanCore } from "./scan";
import { projectCodexPlugin, skillDependsOnAgents } from "./project-codex-plugin";

let core: string, out: string;
beforeEach(() => {
  core = mkdtempSync(join(tmpdir(), "core-"));
  out = mkdtempSync(join(tmpdir(), "out-"));
  mkdirSync(join(core, "skills/foo"), { recursive: true });
  writeFileSync(join(core, "skills/foo/SKILL.md"), "---\nname: foo\ndescription: d\n---\nsee {{HARNESS_DIR}}/agents/x.md");
  mkdirSync(join(core, "skills/standalone"), { recursive: true });
  writeFileSync(join(core, "skills/standalone/SKILL.md"), "---\nname: standalone\ndescription: d\n---\nbody");
  mkdirSync(join(core, "agents"), { recursive: true });
  writeFileSync(join(core, "agents/bar.md"), "---\nname: bar\ndescription: e\n---\nbody");
});
afterEach(() => {
  rmSync(core, { recursive: true, force: true });
  rmSync(out, { recursive: true, force: true });
});

test("skillDependsOnAgents detects agent references", () => {
  const caps = scanCore(core);
  const foo = caps.find((c) => c.name === "foo");
  const standalone = caps.find((c) => c.name === "standalone");
  expect(foo && skillDependsOnAgents(foo)).toBe(true);
  expect(standalone && skillDependsOnAgents(standalone)).toBe(false);
});

test("projects standalone skills and skips agent-dependent ones", () => {
  const { warnings } = projectCodexPlugin(scanCore(core), core, out);
  expect(warnings.some((w) => w.includes("skipped skill 'foo'"))).toBe(true);
  expect(warnings.some((w) => w.includes("agent 'bar'"))).toBe(true);
});
