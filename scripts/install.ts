#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { copyTree } from "./lib/copy-tree";
import { fetchDistSource, fetchRepoRoot } from "./lib/fetch-dist";
import {
  buildCatalog,
  catalogPath,
  loadCatalogFromFile,
  type Catalog,
} from "./lib/catalog";
import {
  formatCatalogList,
  formatComponentSummary,
  installComponents,
} from "./lib/install-components";
import {
  DIST_SOURCE,
  PROJECT_DEST,
  parseAgent,
  type Agent,
} from "./lib/install-layout";

export interface InstallOptions {
  agent: Agent;
  targetDir: string;
  force?: boolean;
  repo?: string;
  ref?: string;
  sourceRoot?: string;
}

export interface InstallResult {
  agent: Agent;
  targetDir: string;
  destPath: string;
  source: "local" | "remote";
}

export interface ComponentInstallOptions {
  agent: Agent;
  targetDir: string;
  components: string[];
  force?: boolean;
  repo?: string;
  ref?: string;
  sourceRoot?: string;
}

const SUBCOMMANDS = ["list", "describe", "install", "bootstrap"] as const;
type Subcommand = (typeof SUBCOMMANDS)[number];

function isSubcommand(value: string): value is Subcommand {
  return (SUBCOMMANDS as readonly string[]).includes(value);
}

async function loadCatalog(options: {
  sourceRoot?: string;
  repo?: string;
  ref?: string;
}): Promise<{ catalog: Catalog; cleanup?: () => void }> {
  const localPath = options.sourceRoot
    ? catalogPath(options.sourceRoot)
    : undefined;

  if (localPath && existsSync(localPath) && !options.repo && !options.ref) {
    return { catalog: loadCatalogFromFile(localPath) };
  }

  const fetched = await fetchRepoRoot({ repo: options.repo, ref: options.ref });
  const remoteCatalog = join(fetched.sourcePath, "dist/catalog.json");
  if (!existsSync(remoteCatalog)) {
    fetched.cleanup();
    throw new Error("catalog.json missing in remote distribution — use a newer ai-dev-harness ref");
  }
  return {
    catalog: loadCatalogFromFile(remoteCatalog),
    cleanup: fetched.cleanup,
  };
}

async function resolveRepoRoot(options: {
  sourceRoot?: string;
  repo?: string;
  ref?: string;
}): Promise<{ repoRoot: string; cleanup?: () => void }> {
  if (!options.repo && !options.ref && options.sourceRoot) {
    return { repoRoot: options.sourceRoot };
  }
  const fetched = await fetchRepoRoot({ repo: options.repo, ref: options.ref });
  return { repoRoot: fetched.sourcePath, cleanup: fetched.cleanup };
}

export async function installHarness(options: InstallOptions): Promise<InstallResult> {
  const { agent, targetDir, force = false, repo, ref } = options;
  const destPath = join(resolve(targetDir), PROJECT_DEST[agent]);
  const localSource = options.sourceRoot
    ? join(options.sourceRoot, DIST_SOURCE[agent])
    : undefined;
  const useRemote = repo !== undefined || ref !== undefined;

  let sourcePath: string;
  let source: "local" | "remote";
  let cleanup: (() => void) | undefined;

  if (!useRemote && localSource && existsSync(localSource)) {
    sourcePath = localSource;
    source = "local";
  } else {
    const fetched = await fetchDistSource(agent, { repo, ref });
    sourcePath = fetched.sourcePath;
    cleanup = fetched.cleanup;
    source = "remote";
  }

  try {
    if (existsSync(destPath) && !force) {
      throw new Error(
        `${destPath} already exists. Re-run with --force to overwrite, or merge manually.`,
      );
    }
    const replace = force;
    copyTree(sourcePath, destPath, { replace });
    return { agent, targetDir: resolve(targetDir), destPath, source };
  } finally {
    cleanup?.();
  }
}

export async function installHarnessComponents(
  options: ComponentInstallOptions,
): Promise<ReturnType<typeof installComponents>> {
  const { catalog, cleanup: catalogCleanup } = await loadCatalog(options);
  const { repoRoot, cleanup: repoCleanup } = await resolveRepoRoot(options);

  try {
    return installComponents({
      agent: options.agent,
      targetDir: options.targetDir,
      componentIds: options.components,
      force: options.force,
      repoRoot,
      catalog,
    });
  } finally {
    catalogCleanup?.();
    repoCleanup?.();
  }
}

export function printInstallUsage(): void {
  console.log(`Usage: ai-dev-harness <command> [options]

Full harness install (legacy):
  ai-dev-harness <agent> [targetDir] [--ref REF] [--repo REPO] [--force]

  Agents: claude, cursor, agents-md

Catalog commands:
  ai-dev-harness list [--json]
  ai-dev-harness describe <component-or-bundle>
  ai-dev-harness install --agent <agent> --components <ids...> [targetDir] [options]
  ai-dev-harness bootstrap <agent> [targetDir] [options]

Options:
  --agent <agent>       Target agent (claude, cursor, agents-md)
  --components <ids...> Component or bundle ids (repeat flag or comma-separated)
  --ref <ref>           Git ref when fetching remote (default: main)
  --repo <repo>         GitHub repo slug (default: otomatty/ai-dev-harness)
  --force               Overwrite / merge aggressively
  --json                JSON output (list/describe/install)
  -h, --help            Show this help

Examples:
  bunx github:otomatty/ai-dev-harness list
  bunx github:otomatty/ai-dev-harness describe tech-selection
  bunx github:otomatty/ai-dev-harness install --agent cursor --components source-verification
  bunx github:otomatty/ai-dev-harness install --agent claude --components tech-selection ./my-app
  bunx github:otomatty/ai-dev-harness bootstrap cursor
  bunx github:otomatty/ai-dev-harness claude
`);
}

interface ParsedCli {
  mode: "legacy" | Subcommand;
  legacy?: InstallOptions;
  subcommand?: Subcommand;
  targetDir?: string;
  agent?: Agent;
  components?: string[];
  describeId?: string;
  force?: boolean;
  ref?: string;
  repo?: string;
  json?: boolean;
  sourceRoot?: string;
}

export function parseInstallArgs(argv: string[]): ParsedCli {
  if (argv.includes("-h") || argv.includes("--help")) {
    printInstallUsage();
    process.exit(0);
  }

  const repoRoot = join(import.meta.dir, "..");
  const first = argv[0];

  if (first && isSubcommand(first)) {
    return parseSubcommandArgs(first, argv.slice(1), repoRoot);
  }

  return { mode: "legacy", legacy: parseLegacyArgs(argv, repoRoot) };
}

function parseLegacyArgs(argv: string[], sourceRoot: string): InstallOptions {
  const positional: string[] = [];
  let force = false;
  let ref: string | undefined;
  let repo: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg === "--ref") {
      ref = argv[++i];
      if (!ref) throw new Error("Missing value for --ref");
      continue;
    }
    if (arg === "--repo") {
      repo = argv[++i];
      if (!repo) throw new Error("Missing value for --repo");
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    positional.push(arg);
  }

  const agentArg = positional[0];
  if (!agentArg) {
    printInstallUsage();
    process.exit(1);
  }

  return {
    agent: parseAgent(agentArg),
    targetDir: positional[1] ?? process.cwd(),
    force,
    ref,
    repo,
    sourceRoot,
  };
}

function parseSubcommandArgs(
  subcommand: Subcommand,
  argv: string[],
  sourceRoot: string,
): ParsedCli {
  const positional: string[] = [];
  let force = false;
  let ref: string | undefined;
  let repo: string | undefined;
  let agent: Agent | undefined;
  let json = false;
  const components: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--ref") {
      ref = argv[++i];
      if (!ref) throw new Error("Missing value for --ref");
      continue;
    }
    if (arg === "--repo") {
      repo = argv[++i];
      if (!repo) throw new Error("Missing value for --repo");
      continue;
    }
    if (arg === "--agent") {
      agent = parseAgent(argv[++i] ?? "");
      continue;
    }
    if (arg === "--components") {
      let j = i + 1;
      while (j < argv.length && !argv[j]!.startsWith("-")) {
        for (const part of argv[j]!.split(",")) {
          const trimmed = part.trim();
          if (trimmed) components.push(trimmed);
        }
        j++;
      }
      i = j - 1;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    positional.push(arg);
  }

  const base = {
    mode: subcommand,
    subcommand,
    force,
    ref,
    repo,
    json,
    sourceRoot,
  } as const;

  switch (subcommand) {
    case "list":
      return base;
    case "describe":
      if (!positional[0]) throw new Error("describe requires a component or bundle id");
      return { ...base, describeId: positional[0] };
    case "install":
      if (!agent) throw new Error("install requires --agent");
      if (components.length === 0) throw new Error("install requires --components");
      return {
        ...base,
        agent,
        components,
        targetDir: positional[0] ?? process.cwd(),
      };
    case "bootstrap":
      if (!positional[0]) throw new Error("bootstrap requires an agent");
      return {
        ...base,
        agent: parseAgent(positional[0]),
        components: ["install-ai-dev-harness"],
        targetDir: positional[1] ?? process.cwd(),
      };
    default: {
      const _exhaustive: never = subcommand;
      throw new Error(`Unhandled subcommand: ${_exhaustive}`);
    }
  }
}

async function runCli(parsed: ParsedCli): Promise<void> {
  if (parsed.mode === "legacy" && parsed.legacy) {
    const result = await installHarness(parsed.legacy);
    console.log(
      `✅ Installed ${result.agent} harness (${result.source}) → ${result.destPath}`,
    );
    return;
  }

  const catalogOpts = {
    sourceRoot: parsed.sourceRoot,
    repo: parsed.repo,
    ref: parsed.ref,
  };

  switch (parsed.subcommand) {
    case "list": {
      const { catalog, cleanup } = await loadCatalog(catalogOpts);
      try {
        if (parsed.json) {
          console.log(JSON.stringify(catalog, null, 2));
        } else {
          console.log(formatCatalogList(catalog));
        }
      } finally {
        cleanup?.();
      }
      return;
    }
    case "describe": {
      const { catalog, cleanup } = await loadCatalog(catalogOpts);
      try {
        const id = parsed.describeId!;
        const bundle = catalog.bundles.find((b) => b.id === id);
        if (parsed.json) {
          const component = catalog.components.find((c) => c.id === id);
          console.log(JSON.stringify(component ?? bundle ?? null, null, 2));
          return;
        }
        if (bundle) {
          console.log(`${bundle.id} — ${bundle.label}`);
          console.log(`Components: ${bundle.components.join(", ")}`);
          return;
        }
        console.log(formatComponentSummary(catalog, id));
      } finally {
        cleanup?.();
      }
      return;
    }
    case "install":
    case "bootstrap": {
      const result = await installHarnessComponents({
        agent: parsed.agent!,
        targetDir: parsed.targetDir!,
        components: parsed.components!,
        force: parsed.force,
        repo: parsed.repo,
        ref: parsed.ref,
        sourceRoot: parsed.sourceRoot,
      });
      if (parsed.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(`✅ Installed ${result.installed.length} component(s) for ${result.agent}`);
      for (const id of result.installed) console.log(`  + ${id}`);
      for (const s of result.skipped) console.log(`  ⊘ ${s.id}: ${s.reason}`);
      for (const w of result.warnings) console.warn(`  ⚠ ${w}`);
      return;
    }
    default: {
      const _exhaustive: never = parsed.subcommand;
      throw new Error(`Unhandled subcommand: ${_exhaustive}`);
    }
  }
}

if (import.meta.main) {
  try {
    await runCli(parseInstallArgs(process.argv.slice(2)));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

export { buildCatalog, catalogPath };
