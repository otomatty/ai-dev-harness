// scripts/lib/project-claude.ts
import { join, dirname } from "node:path";
import type { Capability } from "./scan";
import { applyTemplate, writeFileEnsured, copyFileEnsured } from "./io";

export interface ProjectResult { warnings: string[]; }

const SUBDIR: Record<Capability["type"], string> = {
  skill: "skills", agent: "agents", hook: "hooks",
  tool: "tools", sensor: "sensors", "aidlc-rule": "aidlc-rules",
};

export function projectClaude(
  caps: Capability[], coreDir: string, outDir: string, harnessDir: string,
): ProjectResult {
  const base = join(outDir, ".claude");
  const vars = { HARNESS_DIR: harnessDir };

  for (const cap of caps) {
    if (cap.type === "skill") {
      const dest = join(base, "skills", cap.name, "SKILL.md");
      writeFileEnsured(dest, applyTemplate(cap.rawText, vars));
      const srcDir = dirname(cap.sourcePath);
      for (const asset of cap.assets) {
        copyFileEnsured(join(srcDir, asset), join(base, "skills", cap.name, asset));
      }
    } else if (cap.type === "aidlc-rule") {
      // preserve path under ai-dlc/: name already holds "<sub>/<file>"
      const dest = join(base, "aidlc-rules", `${cap.name}.md`);
      writeFileEnsured(dest, applyTemplate(cap.rawText, vars));
    } else {
      const ext = cap.type === "hook" || cap.type === "tool" ? "ts" : "md";
      const dest = join(base, SUBDIR[cap.type], `${cap.name}.${ext}`);
      writeFileEnsured(dest, applyTemplate(cap.rawText, vars));
    }
  }
  return { warnings: [] };
}
