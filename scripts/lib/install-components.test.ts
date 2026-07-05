import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { build } from "../build";
import { seedMinimalHarnessRoot } from "./test-fixture";
import { buildCatalog } from "./catalog";
import { installComponents } from "./install-components";

let root: string;
let project: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "comp-root-"));
  project = mkdtempSync(join(tmpdir(), "comp-project-"));
  seedMinimalHarnessRoot(root);
  build(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
});

test("installComponents copies a single skill into cursor project", () => {
  const catalog = buildCatalog(root);
  const result = installComponents({
    agent: "cursor",
    targetDir: project,
    componentIds: ["foo"],
    repoRoot: root,
    catalog,
  });

  expect(result.installed).toContain("foo");
  expect(existsSync(join(project, ".cursor/rules/foo.mdc"))).toBe(true);
});

test("installComponents merges claude settings when settingsFragments configured", () => {
  mkdirSync(join(root, "harness/claude/optional"), { recursive: true });
  writeFileSync(
    join(root, "harness/claude/optional/settings.test-fragment.json"),
    '{"hooks":{"PostToolUse":[]}}',
  );

  const catalog = buildCatalog(root);
  const withFragment = {
    ...catalog,
    components: catalog.components.map((c) =>
      c.id === "foo"
        ? { ...c, settingsFragments: ["optional/settings.test-fragment.json"] }
        : c,
    ),
  };

  const result = installComponents({
    agent: "claude",
    targetDir: project,
    componentIds: ["foo"],
    repoRoot: root,
    catalog: withFragment,
  });

  expect(result.installed).toContain("foo");
  const settings = readFileSync(join(project, ".claude/settings.json"), "utf8");
  expect(settings).toContain("PostToolUse");
});

test("installComponents writes agents-md fragment block", () => {
  const catalog = buildCatalog(root);
  const result = installComponents({
    agent: "agents-md",
    targetDir: project,
    componentIds: ["foo"],
    repoRoot: root,
    catalog,
  });

  expect(result.installed).toContain("foo");
  const content = readFileSync(join(project, "AGENTS.md"), "utf8");
  expect(content).toContain("<!-- ai-dev-harness:begin -->");
  expect(content).toContain("Skill: foo");
});
