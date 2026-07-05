import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createHash } from "node:crypto";

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) out.push(...files(full));
    else out.push(full);
  }
  return out;
}

export function hashDir(dir: string): string {
  const h = createHash("sha256");
  const entries = files(dir)
    .map((f) => [relative(dir, f).split(sep).join("/"), readFileSync(f)] as const)
    .sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  for (const [rel, buf] of entries) {
    h.update(rel);
    h.update("\0");
    h.update(buf);
    h.update("\0");
  }
  return h.digest("hex");
}

export function hashPath(path: string): string {
  if (!existsSync(path)) return hashDir(path);
  if (statSync(path).isFile()) {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  }
  return hashDir(path);
}
