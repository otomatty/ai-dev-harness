import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Catalog, CatalogComponent } from "./catalog";
import { resolveComponentIds } from "./catalog";
import { copyTree } from "./copy-tree";
import { componentRelPaths, capabilityFromCatalogId, fragmentFileName } from "./component-paths";
import {
  DIST_SOURCE,
  PROJECT_DEST,
  type Agent,
} from "./install-layout";
import { scanCore, type Capability } from "./scan";
import { deepMerge } from "./settings-merge";
import { applyTemplate, writeFileEnsured } from "./io";

const AGENTS_MD_BEGIN = "<!-- ai-dev-harness:begin -->";
const AGENTS_MD_END = "<!-- ai-dev-harness:end -->";

export interface InstallComponentsOptions {
  agent: Agent;
  targetDir: string;
  componentIds: string[];
  force?: boolean;
  repoRoot: string;
  catalog: Catalog;
}

export interface InstallComponentsResult {
  agent: Agent;
  targetDir: string;
  installed: string[];
  skipped: { id: string; reason: string }[];
  warnings: string[];
}

function distHarnessRoot(repoRoot: string, agent: Agent): string {
  const rel = DIST_SOURCE[agent];
  if (agent === "agents-md") {
    return join(repoRoot, "dist/agents-md");
  }
  return join(repoRoot, rel);
}

function projectHarnessRoot(targetDir: string, agent: Agent): string {
  const rel = PROJECT_DEST[agent];
  if (agent === "agents-md") {
    return resolve(targetDir);
  }
  return join(resolve(targetDir), rel);
}

function agentSupportAllows(component: CatalogComponent, agent: Agent): boolean {
  const support = component.agents[agent];
  return support.status === "full" || support.status === "partial";
}

function skipReason(component: CatalogComponent, agent: Agent): string {
  const support = component.agents[agent];
  const missing = support.missing?.join(", ") ?? support.status;
  return `${component.type} not supported on ${agent} (${missing})`;
}

export function installComponents(options: InstallComponentsOptions): InstallComponentsResult {
  const { agent, targetDir, catalog, repoRoot, force = false } = options;
  const resolvedIds = resolveComponentIds(catalog, options.componentIds);
  const coreCaps = scanCore(join(repoRoot, "core"));
  const installed: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  const warnings: string[] = [];

  const distRoot = distHarnessRoot(repoRoot, agent);
  const destRoot = projectHarnessRoot(targetDir, agent);

  if (agent !== "agents-md" && existsSync(destRoot) === false) {
    // merge install into new harness dir is fine
  }

  const settingsFragments = new Set<string>();
  const fragmentPaths: string[] = [];

  for (const id of resolvedIds) {
    const component = catalog.components.find((c) => c.id === id);
    if (!component) continue;

    if (!agentSupportAllows(component, agent)) {
      skipped.push({ id, reason: skipReason(component, agent) });
      continue;
    }

    const cap = capabilityFromCatalogId(coreCaps, id);
    if (!cap) {
      skipped.push({ id, reason: "missing from core scan" });
      continue;
    }

    if (agent === "agents-md") {
      const frag = fragmentFileName(cap.type, cap.name);
      fragmentPaths.push(join(distRoot, "fragments", frag));
      installed.push(id);
      continue;
    }

    for (const rel of componentRelPaths(cap.type, cap.name, agent)) {
      const src = join(distRoot, rel);
      const dest = join(destRoot, rel);
      if (!existsSync(src)) {
        warnings.push(`Source missing for ${id}: ${rel}`);
        continue;
      }
  copyTree(src, dest);
    }

    for (const frag of component.settingsFragments) {
      settingsFragments.add(frag);
    }
    installed.push(id);
  }

  if (agent === "claude" && settingsFragments.size > 0) {
    mergeClaudeSettingsIntoProject(repoRoot, destRoot, [...settingsFragments]);
  }

  if (agent === "agents-md" && fragmentPaths.length > 0) {
    mergeAgentsMdFragments(destRoot, fragmentPaths, force);
  }

  return { agent, targetDir: resolve(targetDir), installed: [...new Set(installed)], skipped, warnings };
}

function mergeClaudeSettingsIntoProject(
  repoRoot: string,
  claudeDir: string,
  fragmentNames: string[],
): void {
  const harnessDir = join(repoRoot, "harness/claude");
  const settingsPath = join(claudeDir, "settings.json");
  let existing: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    existing = JSON.parse(readFileSync(settingsPath, "utf8")) as Record<string, unknown>;
  }

  let merged = existing;
  for (const name of fragmentNames) {
    const fragPath = join(harnessDir, name);
    if (!existsSync(fragPath)) continue;
    const raw = readFileSync(fragPath, "utf8");
    const templated = applyTemplate(raw, { HARNESS_DIR: ".claude" });
    const frag = JSON.parse(templated) as Record<string, unknown>;
    merged = deepMerge(merged, frag);
  }

  writeFileEnsured(settingsPath, JSON.stringify(merged, null, 2) + "\n");
}

function mergeAgentsMdFragments(
  projectRoot: string,
  fragmentPaths: string[],
  force: boolean,
): void {
  const destFile = join(projectRoot, "AGENTS.md");
  const blocks: string[] = [];
  for (const fp of fragmentPaths) {
    if (!existsSync(fp)) continue;
    blocks.push(readFileSync(fp, "utf8").trim());
  }
  const generated = [
    AGENTS_MD_BEGIN,
    "",
    "> Generated sections from ai-dev-harness components.",
    "",
    ...blocks,
    "",
    AGENTS_MD_END,
  ].join("\n");

  if (!existsSync(destFile)) {
    writeFileEnsured(destFile, `# AGENTS.md\n\n${generated}\n`);
    return;
  }

  const existing = readFileSync(destFile, "utf8");
  if (existing.includes(AGENTS_MD_BEGIN) && existing.includes(AGENTS_MD_END)) {
    const before = existing.slice(0, existing.indexOf(AGENTS_MD_BEGIN));
    const after = existing.slice(existing.indexOf(AGENTS_MD_END) + AGENTS_MD_END.length);
    writeFileEnsured(destFile, `${before}${generated}${after}`.replace(/\n{3,}/g, "\n\n"));
    return;
  }

  if (!force && existing.trim().length > 0) {
    throw new Error(
      `${destFile} exists without ai-dev-harness markers. Re-run with --force to append, or merge manually.`,
    );
  }

  writeFileEnsured(destFile, `${existing.trimEnd()}\n\n${generated}\n`);
}

export function formatComponentSummary(catalog: Catalog, id: string): string {
  const component = catalog.components.find((c) => c.id === id);
  if (!component) return `Unknown component: ${id}`;

  const lines = [
    `${component.id} (${component.type})`,
    component.description,
    "",
  ];

  if (component.keywords.length) {
    lines.push(`Keywords: ${component.keywords.join(", ")}`);
  }
  if (component.dependsOn.length) {
    lines.push(`Depends on: ${component.dependsOn.join(", ")}`);
  }

  lines.push("", "Agent support:");
  for (const [agent, support] of Object.entries(component.agents)) {
    const note = support.missing?.length ? ` (missing: ${support.missing.join(", ")})` : "";
    lines.push(`  ${agent}: ${support.status}${note}`);
  }

  return lines.join("\n");
}

export function formatCatalogList(catalog: Catalog): string {
  const lines = [`ai-dev-harness catalog v${catalog.version}`, ""];
  for (const c of catalog.components) {
    lines.push(`  ${c.id} [${c.type}] — ${c.description.slice(0, 72)}${c.description.length > 72 ? "…" : ""}`);
  }
  if (catalog.bundles.length) {
    lines.push("", "Bundles:");
    for (const b of catalog.bundles) {
      if (b.id === "full") continue;
      lines.push(`  ${b.id} — ${b.label} (${b.components.length} components)`);
    }
  }
  return lines.join("\n");
}
