// scripts/lib/project-claude.ts
import { join, dirname } from "node:path";
import type { Capability } from "./scan";
import { scanSupportModules } from "./scan";
import { applyTemplate, writeFileEnsured, copyFileEnsured } from "./io";

export interface ProjectResult { warnings: string[]; }

const SUBDIR: Record<Capability["type"], string> = {
  skill: "skills", agent: "agents", hook: "hooks",
  tool: "tools", sensor: "sensors", "aidlc-rule": "aidlc-rules",
};

export function projectClaudeComponents(
  caps: Capability[], coreDir: string, baseDir: string, harnessDir: string,
): ProjectResult {
  const vars = { HARNESS_DIR: harnessDir };

  for (const cap of caps) {
    if (cap.type === "skill") {
      const dest = join(baseDir, "skills", cap.name, "SKILL.md");
      writeFileEnsured(dest, applyTemplate(cap.rawText, vars));
      const srcDir = dirname(cap.sourcePath);
      for (const asset of cap.assets) {
        copyFileEnsured(join(srcDir, asset), join(baseDir, "skills", cap.name, asset));
      }
    } else if (cap.type === "aidlc-rule") {
      const dest = join(baseDir, "aidlc-rules", `${cap.name}.md`);
      writeFileEnsured(dest, applyTemplate(cap.rawText, vars));
    } else {
      const ext = cap.type === "hook" || cap.type === "tool" ? "ts" : "md";
      const dest = join(baseDir, SUBDIR[cap.type], `${cap.name}.${ext}`);
      writeFileEnsured(dest, applyTemplate(cap.rawText, vars));
    }
  }

  // Shared libraries (e.g. tools/aidlc-lib.ts) are copied verbatim so the
  // tool/hook imports that reference them resolve at runtime.
  for (const mod of scanSupportModules(coreDir)) {
    const dest = join(baseDir, mod.subdir, mod.fileName);
    writeFileEnsured(dest, applyTemplate(mod.rawText, vars));
  }

  return { warnings: [] };
}

export function projectClaude(
  caps: Capability[], coreDir: string, outDir: string, harnessDir: string,
): ProjectResult {
  const base = harnessDir === "." ? outDir : join(outDir, harnessDir);
  return projectClaudeComponents(caps, coreDir, base, harnessDir);
}
