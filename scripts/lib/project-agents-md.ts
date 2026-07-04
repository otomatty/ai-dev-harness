import { join } from "node:path";
import type { Capability } from "./scan";
import type { ProjectResult } from "./project-claude";
import { writeFileEnsured } from "./io";

export function projectAgentsMd(caps: Capability[], outDir: string): ProjectResult {
  const lines: string[] = ["# AGENTS.md", "", "> Generated from `core/` by `scripts/build.ts`. Do not hand-edit.", ""];

  const skills = caps.filter((c) => c.type === "skill");
  if (skills.length) {
    lines.push("## Skills", "");
    for (const s of skills) {
      lines.push(`## Skill: ${s.name}`, "", String(s.frontmatter.description ?? ""), "");
    }
  }

  const claudeOnly = caps.filter((c) => ["agent", "hook", "tool", "sensor"].includes(c.type));
  if (claudeOnly.length) {
    lines.push("## Claude-only capabilities", "",
      "These are available in the Claude distribution only:", "");
    for (const c of claudeOnly) {
      lines.push(`- **${c.type}** \`${c.name}\` — ${String(c.frontmatter.description ?? "")}`);
    }
    lines.push("");
  }

  const out = join(outDir, "AGENTS.md");
  writeFileEnsured(out, lines.join("\n"));
  return { warnings: [] };
}
