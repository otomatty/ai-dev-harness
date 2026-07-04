import { join } from "node:path";
import { scanCore } from "./lib/scan";
import { projectClaude } from "./lib/project-claude";
import { projectCursor } from "./lib/project-cursor";
import { projectAgentsMd } from "./lib/project-agents-md";
import { mergeClaudeSettings } from "./lib/settings-merge";
import { cleanDir, writeFileEnsured } from "./lib/io";

export function build(root: string): { warnings: string[] } {
  const coreDir = join(root, "core");
  const distClaude = join(root, "dist/claude");
  const distCursor = join(root, "dist/cursor");
  const distAgents = join(root, "dist/agents-md");
  for (const d of [distClaude, distCursor, distAgents]) cleanDir(d);

  const caps = scanCore(coreDir);
  const warnings: string[] = [];

  warnings.push(...projectClaude(caps, coreDir, distClaude, ".claude").warnings);
  const settings = mergeClaudeSettings(join(root, "harness/claude"));
  writeFileEnsured(join(distClaude, ".claude/settings.json"), JSON.stringify(settings, null, 2) + "\n");

  warnings.push(...projectCursor(caps, coreDir, distCursor).warnings);
  warnings.push(...projectAgentsMd(caps, distAgents).warnings);

  return { warnings };
}

if (import.meta.main) {
  const { warnings } = build(process.cwd());
  for (const w of warnings) console.warn(`⚠ ${w}`);
  console.log(`✅ build complete (${warnings.length} degradation warnings)`);
}
