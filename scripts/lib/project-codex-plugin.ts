import { dirname, join } from "node:path";
import type { Capability } from "./scan";
import type { ProjectResult } from "./project-claude";
import { applyTemplate, copyFileEnsured, writeFileEnsured } from "./io";

const SKIPPED_TYPES = new Set(["agent", "hook", "tool", "sensor", "aidlc-rule"]);

/** Skills whose workflow references subagents omitted from the Codex plugin. */
export function skillDependsOnAgents(cap: Capability): boolean {
  const text = `${cap.rawText}\n${cap.body}`;
  return /\/agents\//.test(text)
    || /\bcandidate-researcher\b/.test(text)
    || /\breport-copyeditor\b/.test(text)
    || /\breport-reviser\b/.test(text);
}

export function projectCodexPlugin(
  caps: Capability[], coreDir: string, outDir: string,
): ProjectResult {
  const warnings: string[] = [];
  const base = join(outDir, "skills");
  const vars = { HARNESS_DIR: "." };

  for (const cap of caps) {
    if (cap.type !== "skill") {
      if (SKIPPED_TYPES.has(cap.type)) {
        warnings.push(`codex plugin: skipped ${cap.type} '${cap.name}' (Codex plugin supports skills only)`);
      }
      continue;
    }
    if (skillDependsOnAgents(cap)) {
      warnings.push(
        `codex plugin: skipped skill '${cap.name}' (depends on Claude-only subagents)`,
      );
      continue;
    }
    const dest = join(base, cap.name, "SKILL.md");
    writeFileEnsured(dest, applyTemplate(cap.rawText, vars));
    const srcDir = dirname(cap.sourcePath);
    for (const asset of cap.assets) {
      copyFileEnsured(join(srcDir, asset), join(base, cap.name, asset));
    }
  }

  return { warnings };
}
