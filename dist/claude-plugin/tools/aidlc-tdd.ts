// core/tools/aidlc-tdd.ts
//
// Red/green state machine that backs the Iron-Law TDD guard. Runs as a v2 tool
// (bun $CLAUDE_PROJECT_DIR/.claude/tools/aidlc-tdd.ts <cmd>) — already covered by
// the harness permission allow `Bash(bun $CLAUDE_PROJECT_DIR/.claude/tools/*)`.
//
// Subcommands:
//   init                 create config + empty ledger
//   red   <test> [--unit N]  prove the test FAILS (feature-missing), open a RED cycle
//   green                    prove suite is all-green + coverage floor, close the cycle
//   status                   print current cycle
//
// Shells out to the target project's pytest (+ pytest-cov for the floor).
// Stdlib/bun only. The ledger path mirrors v2's record model — see LEDGER note.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolveProjectDir } from "./aidlc-lib";

// ── paths ────────────────────────────────────────────────────────────────
// NOTE: kept as a flat aidlc-docs/.tdd for portability. If you want it scoped
// to the active space/record tree (v2 P9 model), swap in activeSpace()/recordDir()
// from aidlc-lib.ts here — the guard imports these helpers, so change once.
export function tddDir(projectDir: string): string {
  return join(projectDir, "aidlc-docs", ".tdd");
}
export function ledgerRelPath(): string {
  return "aidlc-docs/.tdd/ledger.json";
}
function configPath(projectDir: string): string {
  return join(tddDir(projectDir), "config.json");
}
function ledgerPath(projectDir: string): string {
  return join(tddDir(projectDir), "ledger.json");
}

// ── config / ledger ──────────────────────────────────────────────────────
export interface TddConfig {
  prod_globs: string[];
  test_globs: string[];
  exempt_globs: string[];
  coverage_floor: number;
  cov_package: string;
  pytest_cmd: string[];
  enforced: boolean;
}
const DEFAULT_CONFIG: TddConfig = {
  prod_globs: ["src/**/*.py", "app/**/*.py", "**/*.py"],
  test_globs: [
    "tests/**/*.py",
    "**/test_*.py",
    "**/*_test.py",
    "**/conftest.py",
  ],
  exempt_globs: [
    "**/migrations/**",
    "**/__init__.py",
    "setup.py",
    "**/_generated/**",
  ],
  coverage_floor: 80,
  cov_package: "",
  pytest_cmd: ["python", "-m", "pytest"],
  enforced: true,
};

export interface Cycle {
  id: string;
  unit: string;
  test_target: string;
  state: "RED" | "GREEN";
  red_at: string;
  green_at: string | null;
  failure_tail: string;
}
export interface Ledger {
  active_cycle: string | null;
  cycles: Cycle[];
}

function readJson<T>(p: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return fallback;
  }
}
function writeJson(p: string, data: unknown): void {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

export function loadConfig(projectDir: string): TddConfig {
  return { ...DEFAULT_CONFIG, ...readJson(configPath(projectDir), {}) };
}
export function loadLedger(projectDir: string): Ledger {
  return readJson<Ledger>(ledgerPath(projectDir), {
    active_cycle: null,
    cycles: [],
  });
}
export function activeCycle(led: Ledger): Cycle | null {
  if (!led.active_cycle) return null;
  return led.cycles.find((c) => c.id === led.active_cycle) ?? null;
}

// ── helpers ──────────────────────────────────────────────────────────────
function now(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}
function tail(s: string, n = 25): string {
  return s.trimEnd().split("\n").slice(-n).join("\n");
}
function runPytest(projectDir: string, cfg: TddConfig, extra: string[]) {
  const [cmd, ...base] = cfg.pytest_cmd;
  const r = spawnSync(cmd, [...base, ...extra], {
    cwd: projectDir,
    encoding: "utf8",
    maxBuffer: 1 << 24,
  });
  return {
    rc: r.status ?? -1,
    out: (r.stdout ?? "") + "\n" + (r.stderr ?? ""),
  };
}

// ── commands ─────────────────────────────────────────────────────────────
function cmdInit(projectDir: string): void {
  if (!existsSync(configPath(projectDir)))
    writeJson(configPath(projectDir), DEFAULT_CONFIG);
  if (!existsSync(ledgerPath(projectDir)))
    writeJson(ledgerPath(projectDir), { active_cycle: null, cycles: [] });
  console.log(
    `Initialised ${tddDir(projectDir)}. Review config.json (globs, coverage_floor, cov_package).`,
  );
}

function cmdRed(projectDir: string, argv: string[]): void {
  if (!argv[0]) {
    console.error(
      "usage: aidlc-tdd.ts red <test_path_or_nodeid> [--unit NAME]",
    );
    process.exit(2);
  }
  const target = argv[0];
  const unit = argv.includes("--unit") ? argv[argv.indexOf("--unit") + 1] : "";
  const cfg = loadConfig(projectDir);
  const { rc, out } = runPytest(projectDir, cfg, ["-q", target]);

  if (rc === 0) {
    console.error(
      "REFUSED: the test PASSED on first run. A test that passes immediately " +
        "proves nothing — it tests existing behaviour. Rewrite it to describe the " +
        "NEW behaviour, then retry.\n\n" +
        tail(out),
    );
    process.exit(1);
  }
  if (rc === 5) {
    console.error(
      "REFUSED: no tests collected at that target. Check the path/nodeid.\n\n" +
        tail(out),
    );
    process.exit(1);
  }
  // A brand-new module can only fail its first test via an import/attr error
  // (nothing to import yet) — pytest surfaces that as rc==2. Accept it as a
  // valid "feature missing" RED, but refuse test-side syntax errors.
  const FEATURE_MISSING = [
    "ModuleNotFoundError",
    "ImportError",
    "cannot import name",
    "AttributeError",
    "NameError",
  ];
  const TEST_BROKEN = ["SyntaxError", "IndentationError"];
  const featureMissing = FEATURE_MISSING.some((s) => out.includes(s));
  const testBroken = TEST_BROKEN.some((s) => out.includes(s));
  const validRed = rc === 1 || (rc === 2 && featureMissing && !testBroken);
  if (!validRed) {
    const why = testBroken
      ? "the test itself is broken"
      : "collection/config error, not a clean feature-missing failure";
    console.error(
      `REFUSED: pytest exited ${rc} (${why}). The RED must fail because the code is missing or wrong — not because the test is malformed.\n\n` +
        tail(out),
    );
    process.exit(1);
  }

  const led = loadLedger(projectDir);
  const cyc: Cycle = {
    id: Math.random().toString(16).slice(2, 10),
    unit,
    test_target: target,
    state: "RED",
    red_at: now(),
    green_at: null,
    failure_tail: tail(out, 15),
  };
  led.cycles.push(cyc);
  led.active_cycle = cyc.id;
  writeJson(ledgerPath(projectDir), led);
  console.log(
    `RED confirmed for \`${target}\` (cycle ${cyc.id}). Production edits are now ` +
      "UNLOCKED. Write the minimal code to pass, then run `green`.",
  );
}

function cmdGreen(projectDir: string): void {
  const cfg = loadConfig(projectDir);
  const led = loadLedger(projectDir);
  const cyc = activeCycle(led);
  if (!cyc) {
    console.error("REFUSED: no open RED cycle to close. Start with `red`.");
    process.exit(1);
  }
  const floor = Number(cfg.coverage_floor) || 0;
  const extra = ["-q"];
  if (floor > 0)
    extra.push(`--cov=${cfg.cov_package || "."}`, "--cov-report=term-missing");
  const { rc, out } = runPytest(projectDir, cfg, extra);

  if (rc !== 0) {
    console.error(
      "NOT GREEN: the suite is not all-passing. Fix the CODE (never the test), then retry.\n\n" +
        tail(out, 30),
    );
    process.exit(1);
  }
  if (floor > 0) {
    const m = out.match(/^TOTAL\s+.*?(\d+)%\s*$/m);
    if (!m) {
      console.error(
        "NOT GREEN: could not read coverage total. Is pytest-cov installed? Set coverage_floor=0 to disable.\n\n" +
          tail(out, 30),
      );
      process.exit(1);
    }
    const pct = Number(m[1]);
    if (pct < floor) {
      console.error(
        `NOT GREEN: coverage ${pct}% is below the ${floor}% floor. Add tests (RED first) before closing.\n\n` +
          tail(out, 30),
      );
      process.exit(1);
    }
  }
  cyc.state = "GREEN";
  cyc.green_at = now();
  led.active_cycle = null;
  writeJson(ledgerPath(projectDir), led);
  console.log(
    `GREEN confirmed (cycle ${cyc.id} closed). Refactor while staying green. Production edits are LOCKED again until the next \`red\`.`,
  );
}

function cmdStatus(projectDir: string): void {
  const led = loadLedger(projectDir);
  const cyc = activeCycle(led);
  console.log(`root: ${projectDir}`);
  console.log(`enforced: ${loadConfig(projectDir).enforced}`);
  console.log(
    cyc
      ? `ACTIVE cycle ${cyc.id} [${cyc.state}] -> ${cyc.test_target}`
      : "no active cycle — production edits are LOCKED (write a failing test next).",
  );
  console.log(`total cycles recorded: ${led.cycles.length}`);
}

function main(): void {
  const projectDir = resolveProjectDir();
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "init":
      return cmdInit(projectDir);
    case "red":
      return cmdRed(projectDir, rest);
    case "green":
      return cmdGreen(projectDir);
    case "status":
      return cmdStatus(projectDir);
    default:
      console.error("usage: aidlc-tdd.ts <init|red|green|status>");
      process.exit(2);
  }
}

// Only run as CLI; the guard imports the exported helpers without executing main.
if (import.meta.main) main();
