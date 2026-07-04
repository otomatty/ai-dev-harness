import { mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";

export function applyTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (m, key) =>
    key in vars ? vars[key] : m,
  );
}

export function writeFileEnsured(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

export function copyFileEnsured(src: string, dest: string): void {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

export function cleanDir(path: string): void {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}
