import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { build } from "../build";
import { seedMinimalHarnessRoot } from "./test-fixture";
import {
  buildCatalog,
  findComponent,
  resolveComponentIds,
  loadCatalogFromFile,
  catalogPath,
} from "./catalog";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "catalog-root-"));
  seedMinimalHarnessRoot(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

test("buildCatalog includes scanned components and bundles", () => {
  const catalog = buildCatalog(root);
  expect(catalog.components.some((c) => c.id === "foo")).toBe(true);
  expect(catalog.bundles.some((b) => b.id === "full")).toBe(true);
});

test("resolveComponentIds expands dependsOn", () => {
  const catalog = buildCatalog(root);
  const withOverride = {
    ...catalog,
    components: [
      ...catalog.components,
      {
        id: "parent",
        type: "skill" as const,
        description: "p",
        keywords: [],
        dependsOn: ["foo"],
        settingsFragments: [],
        agents: {
          claude: { status: "full" as const },
          cursor: { status: "full" as const },
          codex: { status: "full" as const },
          "agents-md": { status: "partial" as const },
        },
      },
    ],
  };
  const ids = resolveComponentIds(withOverride, ["parent"]);
  expect(ids).toContain("foo");
  expect(ids).toContain("parent");
});

test("build writes catalog.json", () => {
  build(root);
  const catalog = loadCatalogFromFile(catalogPath(root));
  expect(findComponent(catalog, "foo")).toBeDefined();
});
