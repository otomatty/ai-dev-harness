import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { Agent } from "./install-layout";
import { DEFAULT_REF, DEFAULT_REPO, DIST_SOURCE } from "./install-layout";

export interface FetchOptions {
  repo?: string;
  ref?: string;
}

export interface FetchedDist {
  sourcePath: string;
  cleanup: () => void;
}

export async function fetchRepoRoot(options: FetchOptions = {}): Promise<FetchedDist> {
  const repo = options.repo ?? DEFAULT_REPO;
  const ref = options.ref ?? DEFAULT_REF;
  const tarballUrl = tarballUrlFor(repo, ref);
  const tempRoot = mkdtempSync(join(tmpdir(), "ai-dev-harness-"));
  const archivePath = join(tempRoot, "archive.tar.gz");

  try {
    const response = await fetch(tarballUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download ${tarballUrl} (${response.status} ${response.statusText})`,
      );
    }
    writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()));

    const extractDir = join(tempRoot, "extract");
    mkdirSync(extractDir, { recursive: true });
    await extractTarGz(archivePath, extractDir);

    const repoDir = findRepoDir(extractDir);
    return {
      sourcePath: repoDir,
      cleanup: () => rmSync(tempRoot, { recursive: true, force: true }),
    };
  } catch (error) {
    rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

export async function fetchDistSource(
  agent: Agent,
  options: FetchOptions = {},
): Promise<FetchedDist> {
  const repo = options.repo ?? DEFAULT_REPO;
  const ref = options.ref ?? DEFAULT_REF;
  const fetched = await fetchRepoRoot(options);
  const sourcePath = join(fetched.sourcePath, DIST_SOURCE[agent]);
  if (!existsSync(sourcePath)) {
    fetched.cleanup();
    throw new Error(`Distribution missing in ${repo}@${ref}: ${DIST_SOURCE[agent]}`);
  }
  return {
    sourcePath,
    cleanup: fetched.cleanup,
  };
}

function tarballUrlFor(repo: string, ref: string): string {
  return `https://codeload.github.com/${repo}/tar.gz/${encodeURIComponent(ref)}`;
}

export function findRepoDir(extractDir: string): string {
  const entries = readdirSync(extractDir).filter((name) => name !== "." && name !== "..");
  if (entries.length !== 1) {
    throw new Error(
      `Unexpected tarball layout under ${extractDir}: expected 1 root directory, got ${entries.length}`,
    );
  }
  return join(extractDir, entries[0]!);
}

async function extractTarGz(archivePath: string, destDir: string): Promise<void> {
  const archive = tarPath(archivePath);
  const dest = tarPath(destDir);
  const proc = Bun.spawn(["tar", "-xzf", archive, "-C", dest], {
    stderr: "pipe",
    stdout: "pipe",
  });
  const code = await proc.exited;
  if (code !== 0) {
    const detail = await new Response(proc.stderr).text();
    throw new Error(`tar failed (exit ${code}): ${detail.trim() || "unknown error"}`);
  }
}

/** Git Bash tar on Windows requires MSYS paths (e.g. C:\\foo → /c/foo). */
function tarPath(path: string): string {
  if (process.platform !== "win32") return resolve(path);
  const normalized = resolve(path).replace(/\\/g, "/");
  const match = /^([A-Za-z]):\/*(.*)$/.exec(normalized);
  if (!match) return normalized;
  return `/${match[1]!.toLowerCase()}/${match[2]}`;
}
