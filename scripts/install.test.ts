import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { build } from "./build";
import { parseInstallArgs, installHarness, installHarnessComponents } from "./install";
import { parseAgent } from "./lib/install-layout";
import { seedMinimalHarnessRoot } from "./lib/test-fixture";

let root: string;
let project: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "harness-root-"));
  project = mkdtempSync(join(tmpdir(), "harness-project-"));
  seedMinimalHarnessRoot(root);
  build(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
});

test("parseAgent accepts known agents", () => {
  expect(parseAgent("claude")).toBe("claude");
  expect(parseAgent("cursor")).toBe("cursor");
  expect(parseAgent("agents-md")).toBe("agents-md");
  expect(() => parseAgent("unknown")).toThrow(/Unknown agent/);
});

test("installHarness copies claude dist locally", async () => {
  const result = await installHarness({
    agent: "claude",
    targetDir: project,
    sourceRoot: root,
  });
  expect(result.source).toBe("local");
  expect(existsSync(join(project, ".claude/skills/foo/SKILL.md"))).toBe(true);
  expect(existsSync(join(project, ".claude/settings.json"))).toBe(true);
});

test("installHarness copies cursor dist locally", async () => {
  await installHarness({
    agent: "cursor",
    targetDir: project,
    sourceRoot: root,
  });
  expect(existsSync(join(project, ".cursor/rules/foo.mdc"))).toBe(true);
});

test("installHarness refuses to overwrite AGENTS.md without force", async () => {
  writeFileSync(join(project, "AGENTS.md"), "# existing\n");
  await expect(
    installHarness({ agent: "agents-md", targetDir: project, sourceRoot: root }),
  ).rejects.toThrow(/already exists/);
  expect(readFileSync(join(project, "AGENTS.md"), "utf8")).toBe("# existing\n");
});

test("installHarness overwrites AGENTS.md with force", async () => {
  writeFileSync(join(project, "AGENTS.md"), "# existing\n");
  await installHarness({
    agent: "agents-md",
    targetDir: project,
    sourceRoot: root,
    force: true,
  });
  const content = readFileSync(join(project, "AGENTS.md"), "utf8");
  expect(content).toContain("Generated from `core/`");
});

test("installHarness refuses to overwrite .claude without force", async () => {
  mkdirSync(join(project, ".claude"), { recursive: true });
  writeFileSync(join(project, ".claude/settings.json"), '{"custom":true}\n');
  await expect(
    installHarness({ agent: "claude", targetDir: project, sourceRoot: root }),
  ).rejects.toThrow(/already exists/);
  expect(readFileSync(join(project, ".claude/settings.json"), "utf8")).toContain("custom");
});

test("installHarness replaces .claude directory with force", async () => {
  mkdirSync(join(project, ".claude/legacy"), { recursive: true });
  writeFileSync(join(project, ".claude/legacy/old.txt"), "keep-me-not");
  await installHarness({
    agent: "claude",
    targetDir: project,
    sourceRoot: root,
    force: true,
  });
  expect(existsSync(join(project, ".claude/skills/foo/SKILL.md"))).toBe(true);
  expect(existsSync(join(project, ".claude/legacy/old.txt"))).toBe(false);
});

test("installHarness uses remote fetch when --ref is provided", async () => {
  const result = await installHarness({
    agent: "claude",
    targetDir: project,
    sourceRoot: root,
    ref: "main",
  });
  expect(result.source).toBe("remote");
});

test("parseInstallArgs routes list subcommand", () => {
  const parsed = parseInstallArgs(["list"]);
  expect(parsed.mode).toBe("list");
  expect(parsed.subcommand).toBe("list");
});

test("parseInstallArgs routes bootstrap with agent", () => {
  const parsed = parseInstallArgs(["bootstrap", "cursor", project]);
  expect(parsed.subcommand).toBe("bootstrap");
  expect(parsed.agent).toBe("cursor");
  expect(parsed.components).toEqual(["install-ai-dev-harness"]);
  expect(parsed.targetDir).toBe(project);
});

test("installHarnessComponents installs single component locally", async () => {
  const result = await installHarnessComponents({
    agent: "cursor",
    targetDir: project,
    components: ["foo"],
    sourceRoot: root,
  });
  expect(result.installed).toContain("foo");
  expect(existsSync(join(project, ".cursor/rules/foo.mdc"))).toBe(true);
});
