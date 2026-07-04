import { cpSync, existsSync, statSync } from "node:fs";

export function copyTree(src: string, dest: string): void {
  if (!existsSync(src)) {
    throw new Error(`Source not found: ${src}`);
  }
  cpSync(src, dest, {
    recursive: statSync(src).isDirectory(),
    force: true,
  });
}
