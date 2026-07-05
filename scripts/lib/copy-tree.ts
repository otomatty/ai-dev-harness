import { cpSync, existsSync, rmSync, statSync } from "node:fs";

export interface CopyTreeOptions {
  /** Remove an existing destination directory before copying. */
  replace?: boolean;
}

export function copyTree(src: string, dest: string, options: CopyTreeOptions = {}): void {
  if (!existsSync(src)) {
    throw new Error(`Source not found: ${src}`);
  }

  if (options.replace && existsSync(dest)) {
    rmSync(dest, { recursive: true, force: true });
  }

  cpSync(src, dest, {
    recursive: statSync(src).isDirectory(),
    force: true,
  });
}
