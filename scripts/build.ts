import { join } from "node:path";
import { scanCore } from "./lib/scan";
import { projectClaude } from "./lib/project-claude";
import { projectCodexPlugin } from "./lib/project-codex-plugin";
import { projectCursor } from "./lib/project-cursor";
import { projectAgentsMd } from "./lib/project-agents-md";
import { mergeClaudeSettings } from "./lib/settings-merge";
import { cleanDir, writeFileEnsured, applyTemplate, copyFileEnsured } from "./lib/io";

const DIST_TARGETS = ["claude", "claude-plugin", "cursor", "codex-plugin", "agents-md"] as const;

export function build(root: string): { warnings: string[] } {
  const coreDir = join(root, "core");
  const distClaude = join(root, "dist/claude");
  const distClaudePlugin = join(root, "dist/claude-plugin");
  const distCursor = join(root, "dist/cursor");
  const distCodexPlugin = join(root, "dist/codex-plugin");
  const distAgents = join(root, "dist/agents-md");
  for (const d of [distClaude, distClaudePlugin, distCursor, distCodexPlugin, distAgents]) {
    cleanDir(d);
  }

  const caps = scanCore(coreDir);
  const warnings: string[] = [];
  const settings = mergeClaudeSettings(join(root, "harness/claude"));

  warnings.push(...projectClaude(caps, coreDir, distClaude, ".claude").warnings);
  writeFileEnsured(
    join(distClaude, ".claude/settings.json"),
    applyTemplate(JSON.stringify(settings, null, 2) + "\n", { HARNESS_DIR: ".claude" }),
  );

  warnings.push(...projectClaude(caps, coreDir, distClaudePlugin, ".").warnings);
  writeFileEnsured(
    join(distClaudePlugin, "settings.json"),
    applyTemplate(JSON.stringify(settings, null, 2) + "\n", { HARNESS_DIR: "." }),
  );
  copyFileEnsured(
    join(root, "harness/claude/plugin.manifest.json"),
    join(distClaudePlugin, ".claude-plugin/plugin.json"),
  );

  warnings.push(...projectCursor(caps, coreDir, distCursor).warnings);
  warnings.push(...projectAgentsMd(caps, distAgents).warnings);

  warnings.push(...projectCodexPlugin(caps, coreDir, distCodexPlugin).warnings);
  copyFileEnsured(
    join(root, "harness/codex/plugin.manifest.json"),
    join(distCodexPlugin, ".codex-plugin/plugin.json"),
  );

  copyFileEnsured(
    join(root, "harness/claude/marketplace.json"),
    join(root, ".claude-plugin/marketplace.json"),
  );
  copyFileEnsured(
    join(root, "harness/codex/marketplace.json"),
    join(root, ".agents/plugins/marketplace.json"),
  );

  return { warnings };
}

export { DIST_TARGETS };

if (import.meta.main) {
  const { warnings } = build(process.cwd());
  for (const w of warnings) console.warn(`⚠ ${w}`);
  console.log(`✅ build complete (${warnings.length} degradation warnings)`);
}
