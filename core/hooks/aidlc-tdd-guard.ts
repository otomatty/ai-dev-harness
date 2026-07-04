// core/hooks/aidlc-tdd-guard.ts
//
// PreToolUse hook (Write|Edit matcher). The BLOCKING rail AI-DLC v2 does not
// ship: aidlc-sensor-fire.ts is PostToolUse and "always exit 0" — its own
// header says "Blocking semantics defer to the future ralph driver." Sensors
// therefore log SENSOR_FAILED *after* the write; they cannot stop it. This hook
// is what turns TDD from advisory into enforced.
//
// Contract (Claude Code PreToolUse):
//   - read the tool-call JSON on stdin; inspect tool_input.file_path
//   - a production .py edit with NO open RED cycle -> permissionDecision:"deny"
//     (a deny blocks the tool even under --dangerously-skip-permissions)
//   - test files / non-.py / exempt paths / open-RED -> allow (silent exit 0)
//   - ALWAYS print JSON to stdout and exit 0 (exit 2 would discard the JSON)
//
// Ledger + config are shared with aidlc-tdd.ts (the red/green state machine).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveProjectDirFromHook, toPosix } from "../tools/aidlc-lib.ts";
import { loadConfig, loadLedger, activeCycle, ledgerRelPath } from "../tools/aidlc-tdd.ts";

const projectDir = resolveProjectDirFromHook(import.meta.url);

function emit(decision: "allow" | "deny" | "ask", reason: string): never {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

function allowSilent(): never {
  process.exit(0); // no output == let the normal permission flow proceed
}

function matchesAny(rel: string, globs: string[]): boolean {
  // minimal glob: ** -> .*, * -> [^/]*, escape dots
  return globs.some((g) => {
    const re = new RegExp(
      "^" +
        g
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*\*/g, "\u0000")
          .replace(/\*/g, "[^/]*")
          .replace(/\u0000/g, ".*") +
        "$",
    );
    return re.test(rel);
  });
}

function relTo(projectDirAbs: string, fp: string): string {
  const p = toPosix(fp);
  const root = toPosix(projectDirAbs).replace(/\/+$/, "") + "/";
  return p.startsWith(root) ? p.slice(root.length) : p;
}

async function main(): Promise<void> {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  let event: any = {};
  try {
    event = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    allowSilent();
  }

  const tool = event.tool_name ?? "";
  if (tool !== "Write" && tool !== "Edit" && tool !== "MultiEdit") allowSilent();

  const fp = event?.tool_input?.file_path ?? "";
  if (!fp) allowSilent();

  const cfg = loadConfig(projectDir);
  if (cfg.enforced === false) allowSilent();

  const rel = relTo(projectDir, fp);
  const isPy = rel.endsWith(".py");
  const isTest = matchesAny(rel, cfg.test_globs);
  const isExempt = matchesAny(rel, cfg.exempt_globs);
  const isProd = isPy && !isTest && !isExempt && matchesAny(rel, cfg.prod_globs);

  if (!isProd) allowSilent(); // tests, configs, docs, exempt files -> always fine

  const cyc = activeCycle(loadLedger(projectDir));
  if (cyc && cyc.state === "RED") {
    emit(
      "allow",
      `TDD: RED cycle open for \`${cyc.test_target}\` — implementing to green is allowed.`,
    );
  }

  emit(
    "deny",
    "IRON LAW — no production code without a failing test first.\n" +
      `Blocked edit to \`${rel}\`. There is no open RED cycle.\n` +
      "Do this instead:\n" +
      "  1. Write ONE failing test for the next behaviour (editing tests is always allowed).\n" +
      "  2. Run:  bun $CLAUDE_PROJECT_DIR/.claude/tools/aidlc-tdd.ts red <test path/nodeid>\n" +
      "  3. Then write the minimal production code to make it pass.\n" +
      "  4. Run:  bun $CLAUDE_PROJECT_DIR/.claude/tools/aidlc-tdd.ts green",
  );
}

void main();
