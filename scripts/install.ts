#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { copyTree } from "./lib/copy-tree";
import { fetchDistSource } from "./lib/fetch-dist";
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

export async function installHarness(options: InstallOptions): Promise<InstallResult> {
  const { agent, targetDir, force = false, repo, ref } = options;
  const destPath = join(resolve(targetDir), PROJECT_DEST[agent]);
  const localSource = options.sourceRoot
    ? join(options.sourceRoot, DIST_SOURCE[agent])
    : undefined;

  let sourcePath: string;
  let source: "local" | "remote";
  let cleanup: (() => void) | undefined;

  if (localSource && existsSync(localSource)) {
    sourcePath = localSource;
    source = "local";
  } else {
    const fetched = await fetchDistSource(agent, { repo, ref });
    sourcePath = fetched.sourcePath;
    cleanup = fetched.cleanup;
    source = "remote";
  }

  try {
    if (agent === "agents-md" && existsSync(destPath) && !force) {
      throw new Error(
        `${destPath} already exists. Re-run with --force to overwrite, or merge manually.`,
      );
    }
    copyTree(sourcePath, destPath);
    return { agent, targetDir: resolve(targetDir), destPath, source };
  } finally {
    cleanup?.();
  }
}

export function printInstallUsage(): void {
  console.log(`Usage: ai-dev-harness <agent> [targetDir] [options]

Agents:
  claude      Install to <target>/.claude/
  cursor      Install to <target>/.cursor/
  agents-md   Install to <target>/AGENTS.md

Options:
  --ref <ref>     Git ref to fetch when dist is not local (default: main)
  --repo <repo>   GitHub repo slug (default: otomatty/ai-dev-harness)
  --force         Overwrite existing AGENTS.md
  -h, --help      Show this help

Examples:
  bunx github:otomatty/ai-dev-harness claude
  bunx github:otomatty/ai-dev-harness cursor ./my-app
  bunx github:otomatty/ai-dev-harness agents-md --force
`);
}

export function parseInstallArgs(argv: string[]): InstallOptions {
  if (argv.includes("-h") || argv.includes("--help")) {
    printInstallUsage();
    process.exit(0);
  }

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

  const targetDir = positional[1] ?? process.cwd();
  const repoRoot = join(import.meta.dir, "..");

  return {
    agent: parseAgent(agentArg),
    targetDir,
    force,
    ref,
    repo,
    sourceRoot: repoRoot,
  };
}

if (import.meta.main) {
  try {
    const result = await installHarness(parseInstallArgs(process.argv.slice(2)));
    console.log(
      `✅ Installed ${result.agent} harness (${result.source}) → ${result.destPath}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}
