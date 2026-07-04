// core/tools/aidlc-lib.ts
//
// Shared path helpers for AI-DLC harness tools and hooks. A full AI-DLC v2 base
// may extend this with activeSpace()/recordDir(); this repo ships the portable
// subset needed for standalone type-checking and runtime.

import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function toPosix(path: string): string {
  return path.replace(/\\/g, "/");
}

function resolveFromHarnessModule(moduleUrl: string): string {
  const fromEnv = process.env.CLAUDE_PROJECT_DIR?.trim();
  if (fromEnv) return resolve(fromEnv);

  let dir = dirname(fileURLToPath(moduleUrl));
  while (dir !== dirname(dir)) {
    if (basename(dir) === ".claude") return resolve(dirname(dir));
    dir = dirname(dir);
  }
  return resolve(process.cwd());
}

export function resolveProjectDir(): string {
  return resolveFromHarnessModule(import.meta.url);
}

export function resolveProjectDirFromHook(moduleUrl: string): string {
  return resolveFromHarnessModule(moduleUrl);
}
