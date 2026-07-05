import { join } from "node:path";
import type { Capability } from "./scan";
import type { ProjectResult } from "./project-claude";
import { writeFileEnsured } from "./io";
import { fragmentFileName } from "./component-paths";

function fragmentForCapability(cap: Capability): string {
  const lines: string[] = [];
  if (cap.type === "skill") {
    lines.push(`## Skill: ${cap.name}`, "", String(cap.frontmatter.description ?? ""), "");
  } else if (cap.type === "aidlc-rule") {
    lines.push(`## AI-DLC rule: ${cap.name}`, "", cap.body.trim(), "");
  } else {
    lines.push(
      `## Claude-only: ${cap.type} \`${cap.name}\``,
      "",
      String(cap.frontmatter.description ?? ""),
      "",
      "Available in the Claude distribution only.",
      "",
    );
  }
  return lines.join("\n");
}

export function projectAgentsMdFragments(caps: Capability[], outDir: string): void {
  for (const cap of caps) {
    const name = fragmentFileName(cap.type, cap.name);
    writeFileEnsured(join(outDir, "fragments", name), fragmentForCapability(cap));
  }
}

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
