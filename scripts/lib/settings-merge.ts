import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function deepMerge(base: Obj, override: Obj): Obj {
  const out: Obj = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (k.startsWith("//")) continue;
    const cur = out[k];
    if (Array.isArray(cur) && Array.isArray(v)) out[k] = [...cur, ...v];
    else if (isObj(cur) && isObj(v)) out[k] = deepMerge(cur, v);
    else out[k] = v;
  }
  return out;
}

export function mergeClaudeSettings(harnessClaudeDir: string): Obj {
  if (!existsSync(harnessClaudeDir)) return {};
  const files = readdirSync(harnessClaudeDir)
    .filter((f) => f.startsWith("settings") && f.endsWith(".json"))
    .sort();
  let acc: Obj = {};
  for (const f of files) {
    const frag = JSON.parse(readFileSync(join(harnessClaudeDir, f), "utf8")) as Obj;
    acc = deepMerge(acc, frag);
  }
  return acc;
}
