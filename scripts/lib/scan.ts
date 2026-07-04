import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { parseFrontmatter } from "./frontmatter";

export type CapabilityType =
  | "skill" | "agent" | "hook" | "tool" | "sensor" | "aidlc-rule";

export interface Capability {
  type: CapabilityType;
  name: string;
  sourcePath: string;
  relPath: string;
  frontmatter: Record<string, unknown>;
  body: string;
  rawText: string;
  assets: string[];
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === ".gitkeep") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function load(type: CapabilityType, coreDir: string, file: string, name: string, assets: string[] = []): Capability {
  const rawText = readFileSync(file, "utf8");
  const { data, body } = parseFrontmatter(rawText);
  return {
    type, name, sourcePath: file,
    relPath: relative(coreDir, file).split(sep).join("/"),
    frontmatter: data, body, rawText, assets,
  };
}

export function scanCore(coreDir: string): Capability[] {
  const caps: Capability[] = [];

  // skills: core/skills/<name>/SKILL.md (+ sibling assets)
  const skillsDir = join(coreDir, "skills");
  if (existsSync(skillsDir)) {
    for (const name of readdirSync(skillsDir)) {
      const sdir = join(skillsDir, name);
      if (!statSync(sdir).isDirectory()) continue;
      const skillFile = join(sdir, "SKILL.md");
      if (!existsSync(skillFile)) continue;
      const assets = walk(sdir)
        .filter((f) => f !== skillFile)
        .map((f) => relative(sdir, f).split(sep).join("/"));
      caps.push(load("skill", coreDir, skillFile, name, assets));
    }
  }

  // flat single-file capability dirs
  const flat: [string, CapabilityType, (f: string) => boolean][] = [
    ["agents", "agent", (f) => f.endsWith(".md")],
    ["hooks", "hook", (f) => f.endsWith(".ts")],
    ["tools", "tool", (f) => f.endsWith(".ts")],
    ["sensors", "sensor", (f) => f.endsWith(".md")],
  ];
  for (const [sub, type, match] of flat) {
    for (const f of walk(join(coreDir, sub))) {
      if (!match(f)) continue;
      const base = f.split(sep).pop()!.replace(/\.(md|ts)$/, "");
      caps.push(load(type, coreDir, f, base));
    }
  }

  // ai-dlc rules: any .md under core/ai-dlc, name = path under ai-dlc/ w/o ext
  const aidlcDir = join(coreDir, "ai-dlc");
  for (const f of walk(aidlcDir)) {
    if (!f.endsWith(".md")) continue;
    const rel = relative(aidlcDir, f).split(sep).join("/");
    caps.push(load("aidlc-rule", coreDir, f, rel.replace(/\.md$/, "")));
  }

  return caps;
}
