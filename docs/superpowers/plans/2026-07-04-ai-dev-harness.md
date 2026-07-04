# ai-dev-harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal monorepo that stores optimized skills, harnesses, and AI-DLC extensions in a harness-neutral `core/`, and compiles them into per-agent distributions (`dist/claude`, `dist/cursor`, `dist/agents-md`) via a `bun` build.

**Architecture:** Single source of truth in `core/` (agent-neutral Markdown/TS). Thin adapters in `harness/<agent>/` hold per-agent settings fragments and conventions. `scripts/build.ts` scans `core/`, applies per-agent projectors (with graceful degradation warnings for capabilities an agent can't express), and writes `dist/<agent>/`. `dist/` is generated-but-committed; `scripts/check.ts` rebuilds to a temp dir and diffs to detect stale/hand-edited dist.

**Tech Stack:** TypeScript, Bun (runtime + built-in test runner), `yaml` (frontmatter parsing). Python assets (e.g. `render.py`) are copied verbatim, never transformed.

## Global Constraints

- Build runtime: **Bun** (`bun run`, `bun test`). Node 24 and Python 3.14 are also present. `bun` binary confirmed available.
- Humans edit **`core/`, `harness/`, `lab/`, `docs/` only**. `dist/` is build output — never hand-edit.
- Python/HTML/JSON **assets are copied verbatim**, not transformed.
- Template variable **`{{HARNESS_DIR}}`** in any core file is substituted at build time (Claude → `.claude`).
- Capabilities with no target-agent equivalent (Claude hooks/subagents on Cursor) **degrade with an explicit warning + a manual-setup note**, never silently.
- `AGENTS.md` is first-class; `CLAUDE.md` is a thin stub referencing it.
- Frequent commits: one per task.
- Source folders to migrate (read-only sources, do not modify originals):
  - Folder 1: `C:\Users\saedg\Downloads\technical-report\tech-selection-claude-code\.claude`
  - Folder 2: `C:\Users\saedg\Downloads\python-tdd-ai-dlc`

---

### Task 1: Repo scaffold + toolchain

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `README.md`
- Create: directory skeleton with `.gitkeep` files

**Interfaces:**
- Produces: a working `bun test` and `bun run build` entrypoint (build is a stub until Task 7). `package.json` scripts `build`, `check`, `test`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ai-dev-harness",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "bun run scripts/build.ts",
    "check": "bun run scripts/check.ts",
    "test": "bun test"
  },
  "dependencies": {
    "yaml": "^2.5.0"
  }
}
```

- [ ] **Step 2: Install deps**

Run: `bun install`
Expected: creates `bun.lockb`, installs `yaml`.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun-types"],
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  }
}
```

- [ ] **Step 4: Create `.gitignore`**

```gitignore
node_modules/
*.log
.DS_Store
# dist/ is intentionally committed (generated-but-checked-in)
```

- [ ] **Step 5: Create directory skeleton**

Run:
```bash
mkdir -p core/skills core/agents core/knowledge core/hooks core/tools core/sensors \
  core/ai-dlc/common core/ai-dlc/inception core/ai-dlc/construction core/ai-dlc/operations \
  core/ai-dlc/extensions \
  harness/claude harness/cursor harness/agents-md \
  dist/claude dist/cursor dist/agents-md \
  scripts/lib lab .claude-plugin
for d in core/skills core/agents core/knowledge core/hooks core/tools core/sensors \
  core/ai-dlc/common core/ai-dlc/inception core/ai-dlc/construction core/ai-dlc/operations \
  core/ai-dlc/extensions harness/claude harness/cursor harness/agents-md lab; do
  touch "$d/.gitkeep"
done
```

- [ ] **Step 6: Create `README.md`**

```markdown
# ai-dev-harness

個人用の AI 開発ハーネス・モノレポ。最適化スキル / ハーネス / AI-DLC 拡張を
ハーネス中立の `core/` に単一情報源として蓄積し、`bun run build` で各エージェント
（Claude Code / Cursor / AGENTS.md）向けの `dist/<agent>/` を生成する。

## レイヤー

| ディレクトリ | 役割 |
|---|---|
| `core/` | 単一情報源（中立）。**編集はここだけ** |
| `harness/<agent>/` | 各エージェント向けの設定断片・変換規約 |
| `dist/<agent>/` | ビルド生成物（コミットするが手編集禁止） |
| `lab/` | 試作（未昇格） |
| `docs/` | 調査・設計・意思決定 |
| `scripts/` | build / check / promote |

## 使い方

- ビルド: `bun run build`
- 検証（dist の鮮度・手編集検出）: `bun run check`
- テスト: `bun test`

詳細な設計は `docs/superpowers/specs/2026-07-04-ai-dev-harness-design.md`。
```

- [ ] **Step 7: Verify bun test runs with no tests**

Run: `bun test`
Expected: exits 0 with "0 tests" (no test files yet).

- [ ] **Step 8: Commit**

```bash
git add package.json bun.lockb tsconfig.json .gitignore README.md core harness dist scripts lab .claude-plugin
git commit -m "chore: scaffold ai-dev-harness repo structure and bun toolchain"
```

---

### Task 2: Frontmatter parse/serialize utility

**Files:**
- Create: `scripts/lib/frontmatter.ts`
- Test: `scripts/lib/frontmatter.test.ts`

**Interfaces:**
- Produces:
  - `parseFrontmatter(text: string): { data: Record<string, unknown>; body: string }` — splits a leading `---\n…\n---\n` YAML block from the body. If absent, `data = {}` and `body = text`.
  - `serializeFrontmatter(data: Record<string, unknown>, body: string): string` — emits `---\n<yaml>---\n<body>`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/lib/frontmatter.test.ts
import { test, expect } from "bun:test";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter";

test("parses name and description from frontmatter", () => {
  const text = "---\nname: foo\ndescription: a skill\n---\n# Body\ntext";
  const { data, body } = parseFrontmatter(text);
  expect(data.name).toBe("foo");
  expect(data.description).toBe("a skill");
  expect(body).toBe("# Body\ntext");
});

test("returns empty data when no frontmatter", () => {
  const { data, body } = parseFrontmatter("just body");
  expect(data).toEqual({});
  expect(body).toBe("just body");
});

test("parses nested yaml frontmatter", () => {
  const text = "---\nid: pytest\ninput_schema:\n  file_path: string\n---\nbody";
  const { data } = parseFrontmatter(text);
  expect((data.input_schema as Record<string, unknown>).file_path).toBe("string");
});

test("serialize then parse round-trips top-level scalars", () => {
  const out = serializeFrontmatter({ name: "x", description: "y" }, "body");
  const { data, body } = parseFrontmatter(out);
  expect(data.name).toBe("x");
  expect(body).toBe("body");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test scripts/lib/frontmatter.test.ts`
Expected: FAIL — module `./frontmatter` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/lib/frontmatter.ts
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(text: string): {
  data: Record<string, unknown>;
  body: string;
} {
  const m = text.match(FM_RE);
  if (!m) return { data: {}, body: text };
  const data = (parseYaml(m[1]) ?? {}) as Record<string, unknown>;
  const body = text.slice(m[0].length);
  return { data, body };
}

export function serializeFrontmatter(
  data: Record<string, unknown>,
  body: string,
): string {
  const yaml = stringifyYaml(data);
  return `---\n${yaml}---\n${body}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test scripts/lib/frontmatter.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/frontmatter.ts scripts/lib/frontmatter.test.ts
git commit -m "feat: add frontmatter parse/serialize utility"
```

---

### Task 3: Core scanner

**Files:**
- Create: `scripts/lib/scan.ts`
- Test: `scripts/lib/scan.test.ts`

**Interfaces:**
- Consumes: `parseFrontmatter` from Task 2.
- Produces:
  - `type CapabilityType = "skill" | "agent" | "hook" | "tool" | "sensor" | "aidlc-rule";`
  - `interface Capability { type: CapabilityType; name: string; sourcePath: string; relPath: string; frontmatter: Record<string, unknown>; body: string; rawText: string; assets: string[]; }`
    - `name`: skill/agent/hook/tool/sensor basename; for `aidlc-rule`, the path under `core/ai-dlc/` without extension.
    - `relPath`: path relative to `core/` (e.g. `skills/foo/SKILL.md`).
    - `assets`: for skills, sibling file paths (relative to the skill dir) other than `SKILL.md`.
  - `scanCore(coreDir: string): Capability[]`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/lib/scan.test.ts
import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanCore } from "./scan";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "core-"));
  mkdirSync(join(dir, "skills/foo"), { recursive: true });
  writeFileSync(join(dir, "skills/foo/SKILL.md"), "---\nname: foo\ndescription: d\n---\nbody");
  writeFileSync(join(dir, "skills/foo/render.py"), "print(1)");
  mkdirSync(join(dir, "agents"), { recursive: true });
  writeFileSync(join(dir, "agents/bar.md"), "---\nname: bar\ndescription: e\n---\nb");
  mkdirSync(join(dir, "hooks"), { recursive: true });
  writeFileSync(join(dir, "hooks/guard.ts"), "// guard");
  mkdirSync(join(dir, "ai-dlc/construction"), { recursive: true });
  writeFileSync(join(dir, "ai-dlc/construction/code-gen.md"), "rule");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

test("scans skills with assets", () => {
  const caps = scanCore(dir);
  const skill = caps.find((c) => c.type === "skill" && c.name === "foo")!;
  expect(skill.frontmatter.description).toBe("d");
  expect(skill.assets).toContain("render.py");
  expect(skill.relPath).toBe("skills/foo/SKILL.md");
});

test("scans agents, hooks, and aidlc rules", () => {
  const caps = scanCore(dir);
  expect(caps.find((c) => c.type === "agent" && c.name === "bar")).toBeTruthy();
  expect(caps.find((c) => c.type === "hook" && c.name === "guard")).toBeTruthy();
  const rule = caps.find((c) => c.type === "aidlc-rule")!;
  expect(rule.name).toBe("construction/code-gen");
  expect(rule.relPath).toBe("ai-dlc/construction/code-gen.md");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test scripts/lib/scan.test.ts`
Expected: FAIL — `./scan` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/lib/scan.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test scripts/lib/scan.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/scan.ts scripts/lib/scan.test.ts
git commit -m "feat: add core capability scanner"
```

---

### Task 4: Shared write helpers + template substitution

**Files:**
- Create: `scripts/lib/io.ts`
- Test: `scripts/lib/io.test.ts`

**Interfaces:**
- Produces:
  - `applyTemplate(text: string, vars: Record<string, string>): string` — replaces `{{KEY}}` with `vars.KEY`. Unknown `{{...}}` left untouched.
  - `writeFileEnsured(path: string, content: string): void` — mkdir -p then write.
  - `copyFileEnsured(src: string, dest: string): void` — mkdir -p then copy verbatim (binary-safe).
  - `cleanDir(path: string): void` — remove dir recursively then recreate empty.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/lib/io.test.ts
import { test, expect, afterAll } from "bun:test";
import { mkdtempSync, readFileSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyTemplate, writeFileEnsured, copyFileEnsured, cleanDir } from "./io";

const dir = mkdtempSync(join(tmpdir(), "io-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("applyTemplate substitutes known vars, keeps unknown", () => {
  expect(applyTemplate("bun {{HARNESS_DIR}}/x {{OTHER}}", { HARNESS_DIR: ".claude" }))
    .toBe("bun .claude/x {{OTHER}}");
});

test("writeFileEnsured creates parent dirs", () => {
  const p = join(dir, "a/b/c.txt");
  writeFileEnsured(p, "hi");
  expect(readFileSync(p, "utf8")).toBe("hi");
});

test("copyFileEnsured copies verbatim", () => {
  const src = join(dir, "src.py");
  writeFileSync(src, "print(1)");
  const dest = join(dir, "nested/out.py");
  copyFileEnsured(src, dest);
  expect(readFileSync(dest, "utf8")).toBe("print(1)");
});

test("cleanDir empties an existing dir", () => {
  const d = join(dir, "clean");
  writeFileEnsured(join(d, "old.txt"), "x");
  cleanDir(d);
  expect(existsSync(join(d, "old.txt"))).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test scripts/lib/io.test.ts`
Expected: FAIL — `./io` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/lib/io.ts
import { mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";

export function applyTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (m, key) =>
    key in vars ? vars[key] : m,
  );
}

export function writeFileEnsured(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

export function copyFileEnsured(src: string, dest: string): void {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

export function cleanDir(path: string): void {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test scripts/lib/io.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/io.ts scripts/lib/io.test.ts
git commit -m "feat: add io + template substitution helpers"
```

---

### Task 5: Claude projector

**Files:**
- Create: `scripts/lib/project-claude.ts`
- Test: `scripts/lib/project-claude.test.ts`

**Interfaces:**
- Consumes: `Capability` (Task 3), `applyTemplate`/`writeFileEnsured`/`copyFileEnsured`/`cleanDir` (Task 4).
- Produces:
  - `interface ProjectResult { warnings: string[]; }`
  - `projectClaude(caps: Capability[], coreDir: string, outDir: string, harnessDir: string): ProjectResult`
    - Writes under `<outDir>/.claude/`: `skills/<name>/SKILL.md` (+ assets copied), `agents/<name>.md`, `hooks/<name>.ts`, `tools/<name>.ts`, `sensors/<name>.md`, `aidlc-rules/<relPathUnderAiDlc>`.
    - Substitutes `{{HARNESS_DIR}}` → `harnessDir` (`.claude`) in text (`.md`/`.ts`) outputs.
    - Merges every `<harnessDir source>/settings.*.json` fragment (passed separately in Task 7) — here projector only writes capability files; settings merge lives in build.ts.
    - Claude expresses all capability types, so `warnings` is empty.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/lib/project-claude.test.ts
import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanCore } from "./scan";
import { projectClaude } from "./project-claude";

let core: string, out: string;
beforeEach(() => {
  core = mkdtempSync(join(tmpdir(), "core-"));
  out = mkdtempSync(join(tmpdir(), "out-"));
  mkdirSync(join(core, "skills/foo"), { recursive: true });
  writeFileSync(join(core, "skills/foo/SKILL.md"), "---\nname: foo\ndescription: d\n---\nbody");
  writeFileSync(join(core, "skills/foo/render.py"), "print(1)");
  mkdirSync(join(core, "sensors"), { recursive: true });
  writeFileSync(join(core, "sensors/pytest.md"), "---\nid: pytest\ncommand: bun {{HARNESS_DIR}}/tools/x.ts\n---\ns");
});
afterEach(() => { rmSync(core, { recursive: true, force: true }); rmSync(out, { recursive: true, force: true }); });

test("copies skill + assets and substitutes HARNESS_DIR", () => {
  const res = projectClaude(scanCore(core), core, out, ".claude");
  expect(existsSync(join(out, ".claude/skills/foo/SKILL.md"))).toBe(true);
  expect(readFileSync(join(out, ".claude/skills/foo/render.py"), "utf8")).toBe("print(1)");
  const sensor = readFileSync(join(out, ".claude/sensors/pytest.md"), "utf8");
  expect(sensor).toContain("bun .claude/tools/x.ts");
  expect(res.warnings).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test scripts/lib/project-claude.test.ts`
Expected: FAIL — `./project-claude` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test scripts/lib/project-claude.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/project-claude.ts scripts/lib/project-claude.test.ts
git commit -m "feat: add Claude projector"
```

---

### Task 6: Cursor + AGENTS.md projectors (with graceful degradation)

**Files:**
- Create: `scripts/lib/project-cursor.ts`
- Create: `scripts/lib/project-agents-md.ts`
- Test: `scripts/lib/project-cursor.test.ts`
- Test: `scripts/lib/project-agents-md.test.ts`

**Interfaces:**
- Consumes: `Capability` (Task 3), `ProjectResult` (Task 5), io helpers (Task 4).
- Produces:
  - `projectCursor(caps, coreDir, outDir): ProjectResult` — skills → `<outDir>/.cursor/rules/<name>.mdc` with frontmatter `{ description, alwaysApply: false }` and original body; aidlc-rules → `<outDir>/.cursor/rules/aidlc/<name>.mdc`. For `agent`/`hook`/`tool`/`sensor`, emit a warning string `"<type> '<name>': no Cursor equivalent — kept Claude-only"` and write a `.cursor/rules/_unsupported/<type>-<name>.md` note. Returns collected warnings.
  - `projectAgentsMd(caps, outDir): ProjectResult` — writes a single `<outDir>/AGENTS.md` with one section per skill (`## Skill: <name>` + description) and a "Claude-only capabilities" section listing agents/hooks/tools/sensors by name.

- [ ] **Step 1: Write the failing tests**

```ts
// scripts/lib/project-cursor.test.ts
import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanCore } from "./scan";
import { projectCursor } from "./project-cursor";

let core: string, out: string;
beforeEach(() => {
  core = mkdtempSync(join(tmpdir(), "core-"));
  out = mkdtempSync(join(tmpdir(), "out-"));
  mkdirSync(join(core, "skills/foo"), { recursive: true });
  writeFileSync(join(core, "skills/foo/SKILL.md"), "---\nname: foo\ndescription: d\n---\nBODY");
  mkdirSync(join(core, "hooks"), { recursive: true });
  writeFileSync(join(core, "hooks/guard.ts"), "// guard");
});
afterEach(() => { rmSync(core, { recursive: true, force: true }); rmSync(out, { recursive: true, force: true }); });

test("skill becomes a .mdc rule with cursor frontmatter", () => {
  projectCursor(scanCore(core), core, out);
  const mdc = readFileSync(join(out, ".cursor/rules/foo.mdc"), "utf8");
  expect(mdc).toContain("alwaysApply: false");
  expect(mdc).toContain("description: d");
  expect(mdc).toContain("BODY");
});

test("hook degrades with a warning and an _unsupported note", () => {
  const res = projectCursor(scanCore(core), core, out);
  expect(res.warnings.some((w) => w.includes("guard"))).toBe(true);
  expect(existsSync(join(out, ".cursor/rules/_unsupported/hook-guard.md"))).toBe(true);
});
```

```ts
// scripts/lib/project-agents-md.test.ts
import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanCore } from "./scan";
import { projectAgentsMd } from "./project-agents-md";

let core: string, out: string;
beforeEach(() => {
  core = mkdtempSync(join(tmpdir(), "core-"));
  out = mkdtempSync(join(tmpdir(), "out-"));
  mkdirSync(join(core, "skills/foo"), { recursive: true });
  writeFileSync(join(core, "skills/foo/SKILL.md"), "---\nname: foo\ndescription: d\n---\nb");
  mkdirSync(join(core, "agents"), { recursive: true });
  writeFileSync(join(core, "agents/bar.md"), "---\nname: bar\ndescription: e\n---\nx");
});
afterEach(() => { rmSync(core, { recursive: true, force: true }); rmSync(out, { recursive: true, force: true }); });

test("AGENTS.md lists skills and claude-only capabilities", () => {
  projectAgentsMd(scanCore(core), out);
  const md = readFileSync(join(out, "AGENTS.md"), "utf8");
  expect(md).toContain("## Skill: foo");
  expect(md).toContain("d");
  expect(md).toContain("bar");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test scripts/lib/project-cursor.test.ts scripts/lib/project-agents-md.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write minimal implementations**

```ts
// scripts/lib/project-cursor.ts
import { join } from "node:path";
import type { Capability } from "./scan";
import type { ProjectResult } from "./project-claude";
import { serializeFrontmatter } from "./frontmatter";
import { writeFileEnsured } from "./io";

export function projectCursor(
  caps: Capability[], _coreDir: string, outDir: string,
): ProjectResult {
  const rules = join(outDir, ".cursor/rules");
  const warnings: string[] = [];

  for (const cap of caps) {
    if (cap.type === "skill" || cap.type === "aidlc-rule") {
      const desc = String(cap.frontmatter.description ?? cap.name);
      const mdc = serializeFrontmatter({ description: desc, alwaysApply: false }, cap.body);
      const sub = cap.type === "aidlc-rule" ? join("aidlc", `${cap.name}.mdc`) : `${cap.name}.mdc`;
      writeFileEnsured(join(rules, sub), mdc);
    } else {
      warnings.push(`${cap.type} '${cap.name}': no Cursor equivalent — kept Claude-only`);
      const note = `# ${cap.type} '${cap.name}' (Claude-only)\n\n`
        + `This capability has no native Cursor equivalent and was not projected.\n`
        + `Use the Claude distribution (\`dist/claude\`) to run it.\n`;
      writeFileEnsured(join(rules, "_unsupported", `${cap.type}-${cap.name}.md`), note);
    }
  }
  return { warnings };
}
```

```ts
// scripts/lib/project-agents-md.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test scripts/lib/project-cursor.test.ts scripts/lib/project-agents-md.test.ts`
Expected: PASS (3 tests total).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/project-cursor.ts scripts/lib/project-agents-md.ts scripts/lib/project-cursor.test.ts scripts/lib/project-agents-md.test.ts
git commit -m "feat: add Cursor and AGENTS.md projectors with graceful degradation"
```

---

### Task 7: build.ts orchestrator + Claude settings merge

**Files:**
- Create: `scripts/lib/settings-merge.ts`
- Create: `scripts/build.ts`
- Test: `scripts/lib/settings-merge.test.ts`
- Test: `scripts/build.test.ts`

**Interfaces:**
- Consumes: `scanCore`, all projectors, `cleanDir`.
- Produces:
  - `deepMerge(base, override): Record<string, unknown>` — recursive object merge; arrays concatenated; keys starting with `//` dropped.
  - `mergeClaudeSettings(harnessClaudeDir: string): Record<string, unknown>` — reads every `settings*.json` in `harness/claude/`, deep-merges in filename order onto `{}`.
  - `build(root: string): { warnings: string[] }` — cleans `dist/`, scans `core/`, runs all three projectors into `dist/claude|cursor|agents-md`, writes merged `dist/claude/.claude/settings.json`, prints warnings. When run as the entry module, calls `build(process.cwd())`.

- [ ] **Step 1: Write the failing test (settings merge)**

```ts
// scripts/lib/settings-merge.test.ts
import { test, expect } from "bun:test";
import { deepMerge } from "./settings-merge";

test("deepMerge concatenates arrays and drops // keys", () => {
  const out = deepMerge(
    { hooks: { PreToolUse: [1] } },
    { "// note": "x", hooks: { PreToolUse: [2], PostToolUse: [3] } },
  );
  expect(out).toEqual({ hooks: { PreToolUse: [1, 2], PostToolUse: [3] } });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test scripts/lib/settings-merge.test.ts`
Expected: FAIL — `./settings-merge` not found.

- [ ] **Step 3: Implement settings-merge**

```ts
// scripts/lib/settings-merge.ts
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function deepMerge(base: Obj, override: Obj): Obj {
  const out: Obj = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (k.startsWith("//")) continue;
    const cur = out[k];
    if (Array.isArray(cur) && Array.isArray(v)) out[k] = [...cur, ...v];
    else if (isObj(cur) && isObj(v)) out[k] = deepMerge(cur, v);
    else out[k] = v;
  }
  return out;
}

export function mergeClaudeSettings(harnessClaudeDir: string): Obj {
  if (!existsSync(harnessClaudeDir)) return {};
  const files = readdirSync(harnessClaudeDir)
    .filter((f) => f.startsWith("settings") && f.endsWith(".json"))
    .sort();
  let acc: Obj = {};
  for (const f of files) {
    const frag = JSON.parse(readFileSync(join(harnessClaudeDir, f), "utf8")) as Obj;
    acc = deepMerge(acc, frag);
  }
  return acc;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `bun test scripts/lib/settings-merge.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Write the failing test (build integration)**

```ts
// scripts/build.test.ts
import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { build } from "./build";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "root-"));
  mkdirSync(join(root, "core/skills/foo"), { recursive: true });
  writeFileSync(join(root, "core/skills/foo/SKILL.md"), "---\nname: foo\ndescription: d\n---\nb");
  mkdirSync(join(root, "core/hooks"), { recursive: true });
  writeFileSync(join(root, "core/hooks/guard.ts"), "// guard");
  mkdirSync(join(root, "harness/claude"), { recursive: true });
  writeFileSync(join(root, "harness/claude/settings.base.json"), '{"hooks":{"PreToolUse":[]}}');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

test("build writes all three distributions and merged settings", () => {
  const { warnings } = build(root);
  expect(existsSync(join(root, "dist/claude/.claude/skills/foo/SKILL.md"))).toBe(true);
  expect(existsSync(join(root, "dist/claude/.claude/settings.json"))).toBe(true);
  expect(existsSync(join(root, "dist/cursor/.cursor/rules/foo.mdc"))).toBe(true);
  expect(existsSync(join(root, "dist/agents-md/AGENTS.md"))).toBe(true);
  expect(warnings.some((w) => w.includes("guard"))).toBe(true); // hook degraded on cursor
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `bun test scripts/build.test.ts`
Expected: FAIL — `./build` not found.

- [ ] **Step 7: Implement build.ts**

```ts
// scripts/build.ts
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
```

- [ ] **Step 8: Run it to verify it passes**

Run: `bun test scripts/build.test.ts`
Expected: PASS (1 test).

- [ ] **Step 9: Commit**

```bash
git add scripts/lib/settings-merge.ts scripts/lib/settings-merge.test.ts scripts/build.ts scripts/build.test.ts
git commit -m "feat: add build orchestrator and Claude settings merge"
```

---

### Task 8: check.ts — dist freshness + hand-edit detection

**Files:**
- Create: `scripts/lib/hashdir.ts`
- Create: `scripts/check.ts`
- Test: `scripts/lib/hashdir.test.ts`

**Interfaces:**
- Consumes: `build` (Task 7).
- Produces:
  - `hashDir(dir: string): string` — deterministic hash of all file paths+contents under `dir` (sorted).
  - `check(root: string): { ok: boolean; message: string }` — builds into a temp dir, hashes each `dist/<agent>` against a fresh build of the same, reports first mismatch. When run as entry module, exits 1 on failure.
- Note: `check` rebuilds `dist/` in place then compares to a git-clean baseline is overkill; instead it snapshots current `dist/` hashes, re-runs `build(root)`, and compares. If they differ, the committed dist was stale or hand-edited.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/lib/hashdir.test.ts
import { test, expect, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { hashDir } from "./hashdir";
import { writeFileEnsured } from "./io";

const a = mkdtempSync(join(tmpdir(), "a-"));
const b = mkdtempSync(join(tmpdir(), "b-"));
afterAll(() => { rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true }); });

test("identical trees hash equal, changed content differs", () => {
  writeFileEnsured(join(a, "x/y.txt"), "hello");
  writeFileEnsured(join(b, "x/y.txt"), "hello");
  expect(hashDir(a)).toBe(hashDir(b));
  writeFileSync(join(b, "x/y.txt"), "changed");
  expect(hashDir(a)).not.toBe(hashDir(b));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test scripts/lib/hashdir.test.ts`
Expected: FAIL — `./hashdir` not found.

- [ ] **Step 3: Implement hashdir + check**

```ts
// scripts/lib/hashdir.ts
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createHash } from "node:crypto";

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) out.push(...files(full));
    else out.push(full);
  }
  return out;
}

export function hashDir(dir: string): string {
  const h = createHash("sha256");
  const entries = files(dir)
    .map((f) => [relative(dir, f).split(sep).join("/"), readFileSync(f)] as const)
    .sort((x, y) => x[0].localeCompare(y[0]));
  for (const [rel, buf] of entries) {
    h.update(rel);
    h.update("\0");
    h.update(buf);
    h.update("\0");
  }
  return h.digest("hex");
}
```

```ts
// scripts/check.ts
import { join } from "node:path";
import { hashDir } from "./lib/hashdir";
import { build } from "./build";

export function check(root: string): { ok: boolean; message: string } {
  const agents = ["claude", "cursor", "agents-md"];
  const before = agents.map((a) => hashDir(join(root, "dist", a)));
  build(root);
  const after = agents.map((a) => hashDir(join(root, "dist", a)));
  for (let i = 0; i < agents.length; i++) {
    if (before[i] !== after[i]) {
      return {
        ok: false,
        message: `dist/${agents[i]} is stale or hand-edited — run \`bun run build\` and commit.`,
      };
    }
  }
  return { ok: true, message: "dist is up to date." };
}

if (import.meta.main) {
  const { ok, message } = check(process.cwd());
  console.log(ok ? `✅ ${message}` : `❌ ${message}`);
  if (!ok) process.exit(1);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `bun test scripts/lib/hashdir.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/hashdir.ts scripts/lib/hashdir.test.ts scripts/check.ts
git commit -m "feat: add dist freshness + hand-edit check"
```

---

### Task 9: Migrate Folder 1 (tech-selection) into core/

**Files:**
- Create: `core/skills/tech-selection-research/SKILL.md`
- Create: `core/skills/source-verification/SKILL.md`
- Create: `core/skills/research-writeup/SKILL.md`
- Create: `core/skills/research-writeup/assets/render.py`
- Create: `core/skills/research-writeup/assets/template.html`
- Create: `core/skills/research-writeup/assets/sample_data.json`
- Create: `core/skills/report-revision/SKILL.md`
- Create: `core/agents/candidate-researcher.md`
- Create: `core/agents/report-copyeditor.md`
- Create: `core/agents/report-reviser.md`
- Create: `docs/imports/tech-selection-orchestration.md` (from Folder 1 `CLAUDE.md`)

**Interfaces:**
- Consumes: build pipeline (Tasks 3–8).
- Produces: 4 skills + 3 agents in `core/` that `scanCore` picks up.

- [ ] **Step 1: Copy skills (verbatim, preserving assets)**

```bash
SRC="/c/Users/saedg/Downloads/technical-report/tech-selection-claude-code/.claude"
cp "$SRC/skills/tech-selection-research/SKILL.md" core/skills/tech-selection-research/SKILL.md
cp "$SRC/skills/source-verification/SKILL.md"     core/skills/source-verification/SKILL.md
cp "$SRC/skills/report-revision/SKILL.md"         core/skills/report-revision/SKILL.md
mkdir -p core/skills/research-writeup/assets
cp "$SRC/skills/research-writeup/SKILL.md"                 core/skills/research-writeup/SKILL.md
cp "$SRC/skills/research-writeup/assets/render.py"         core/skills/research-writeup/assets/render.py
cp "$SRC/skills/research-writeup/assets/template.html"     core/skills/research-writeup/assets/template.html
cp "$SRC/skills/research-writeup/assets/sample_data.json"  core/skills/research-writeup/assets/sample_data.json
```

(Directories `core/skills/tech-selection-research/`, `source-verification/`, `report-revision/` are created by `cp` only if they exist; run `mkdir -p` for each first:)

```bash
for s in tech-selection-research source-verification report-revision; do mkdir -p "core/skills/$s"; done
```
(Re-run the three top `cp` lines after the mkdir if they failed.)

- [ ] **Step 2: Copy agents**

```bash
cp "$SRC/agents/candidate-researcher.md" core/agents/candidate-researcher.md
cp "$SRC/agents/report-copyeditor.md"    core/agents/report-copyeditor.md
cp "$SRC/agents/report-reviser.md"       core/agents/report-reviser.md
```

- [ ] **Step 3: Preserve the orchestration CLAUDE.md as a doc**

The Folder 1 `CLAUDE.md` describes how the tech-selection skills/agents work together (delegation, HTML output, follow-up routing). It is project-orchestration prose, not a single skill. Preserve it for reference:

```bash
mkdir -p docs/imports
cp "$SRC/CLAUDE.md" docs/imports/tech-selection-orchestration.md
```

- [ ] **Step 4: Fix cross-references from `.claude/` to portable paths**

The migrated skills reference `.claude/skills/...` and `.claude/agents/...` paths (Claude-specific). Update them to the build-time template so they resolve per harness. In each migrated skill/agent file, replace literal `.claude/` path prefixes that point at siblings with `{{HARNESS_DIR}}/`.

Run (review the diff after):
```bash
grep -rl '\.claude/' core/skills core/agents || echo "no matches"
```
For each match, edit the file and replace `.claude/skills/` → `{{HARNESS_DIR}}/skills/`, `.claude/agents/` → `{{HARNESS_DIR}}/agents/`. (Assets like `assets/render.py` are already relative — leave them.)

- [ ] **Step 5: Build and verify the migration flows through**

Run: `bun run build`
Expected: `dist/claude/.claude/skills/tech-selection-research/SKILL.md` exists; `dist/cursor/.cursor/rules/tech-selection-research.mdc` exists; warnings list the 3 agents as Claude-only.

Run:
```bash
test -f dist/claude/.claude/skills/research-writeup/assets/render.py && echo "asset OK"
test -f dist/cursor/.cursor/rules/_unsupported/agent-candidate-researcher.md && echo "degrade OK"
```
Expected: both print OK.

- [ ] **Step 6: Verify check passes**

Run: `bun run check`
Expected: `✅ dist is up to date.`

- [ ] **Step 7: Commit**

```bash
git add core/skills core/agents docs/imports dist
git commit -m "feat: migrate tech-selection skills and agents into core"
```

---

### Task 10: Migrate Folder 2 (python-tdd / AI-DLC) into core/ + harness/claude

**Files:**
- Create: `core/hooks/aidlc-tdd-guard.ts`
- Create: `core/tools/aidlc-tdd.ts`
- Create: `core/sensors/aidlc-pytest.md`
- Create: `core/knowledge/aidlc-developer-agent/python-tdd.md`
- Create: `core/ai-dlc/construction/code-generation.integration.md`
- Create: `harness/claude/settings.pretooluse-tdd.json`
- Create: `docs/imports/aidlc-v2-native-README.md`

**Interfaces:**
- Consumes: build pipeline; `mergeClaudeSettings` (Task 7) merges the new settings fragment.
- Produces: TDD guard hook/tool/sensor in `core/`, and a Claude `PreToolUse` settings fragment.

- [ ] **Step 1: Copy neutral capability files into core/**

```bash
SRC2="/c/Users/saedg/Downloads/python-tdd-ai-dlc"
cp "$SRC2/aidlc-tdd-guard.ts" core/hooks/aidlc-tdd-guard.ts
cp "$SRC2/aidlc-tdd.ts"       core/tools/aidlc-tdd.ts
cp "$SRC2/aidlc-pytest.md"    core/sensors/aidlc-pytest.md
mkdir -p core/knowledge/aidlc-developer-agent
cp "$SRC2/python-tdd.md"      core/knowledge/aidlc-developer-agent/python-tdd.md
cp "$SRC2/code-generation.integration.md" core/ai-dlc/construction/code-generation.integration.md
cp "$SRC2/00-README-v2-native.md" docs/imports/aidlc-v2-native-README.md
```

- [ ] **Step 2: Convert the settings block into a harness/claude fragment**

The source `settings.PreToolUse.block.json` contains `//`-prefixed comment keys and a `PreToolUse` array. Save it as a harness fragment (comment keys are dropped by `deepMerge`). Create `harness/claude/settings.pretooluse-tdd.json`:

```json
{
  "// source": "Imported from python-tdd-ai-dlc/settings.PreToolUse.block.json",
  "// why-first": "PreToolUse hooks evaluate in array order and stop at the first deny; keep the guard first.",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bun {{HARNESS_DIR}}/hooks/aidlc-tdd-guard.ts"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 3: Add a base settings fragment so merge has a stable root**

Create `harness/claude/settings.base.json`:

```json
{
  "hooks": {}
}
```

- [ ] **Step 4: Note on `{{HARNESS_DIR}}` in settings**

`mergeClaudeSettings` reads settings JSON without template substitution, so the `{{HARNESS_DIR}}` in the command string is written literally into `dist/claude/.claude/settings.json`. Substitute it during build for settings too. Modify `build.ts` Step: after computing `settings`, stringify, apply template, then write.

Edit `scripts/build.ts` — replace the settings write line:
```ts
  const settings = mergeClaudeSettings(join(root, "harness/claude"));
  writeFileEnsured(join(distClaude, ".claude/settings.json"), JSON.stringify(settings, null, 2) + "\n");
```
with:
```ts
  const settings = mergeClaudeSettings(join(root, "harness/claude"));
  const settingsText = applyTemplate(JSON.stringify(settings, null, 2) + "\n", { HARNESS_DIR: ".claude" });
  writeFileEnsured(join(distClaude, ".claude/settings.json"), settingsText);
```
and add `applyTemplate` to the io import at the top of `build.ts`:
```ts
import { cleanDir, writeFileEnsured, applyTemplate } from "./lib/io";
```

- [ ] **Step 5: Extend build test to lock in settings substitution**

Add to `scripts/build.test.ts` (new test):
```ts
test("settings PreToolUse command has HARNESS_DIR substituted", () => {
  build(root);
  const s = readFileSync(join(root, "dist/claude/.claude/settings.json"), "utf8");
  // no template left behind
  expect(s).not.toContain("{{HARNESS_DIR}}");
});
```
Update the `beforeEach` in `build.test.ts` to include a PreToolUse command fragment:
```ts
  writeFileSync(join(root, "harness/claude/settings.base.json"),
    '{"hooks":{"PreToolUse":[{"matcher":"Write","hooks":[{"type":"command","command":"bun {{HARNESS_DIR}}/hooks/guard.ts"}]}]}}');
```

- [ ] **Step 6: Run build tests**

Run: `bun test scripts/build.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Full build + verify TDD guard wiring**

Run: `bun run build`
Then:
```bash
test -f dist/claude/.claude/hooks/aidlc-tdd-guard.ts && echo "hook OK"
grep -q 'aidlc-tdd-guard.ts' dist/claude/.claude/settings.json && echo "settings wired"
grep -q '{{HARNESS_DIR}}' dist/claude/.claude/settings.json && echo "TEMPLATE LEFTOVER (bad)" || echo "template substituted"
```
Expected: `hook OK`, `settings wired`, `template substituted`.

- [ ] **Step 8: Verify check passes, commit**

Run: `bun run check`
Expected: `✅ dist is up to date.`

```bash
git add core harness docs/imports dist scripts/build.ts scripts/build.test.ts
git commit -m "feat: migrate AI-DLC TDD guard (hook/tool/sensor/settings) into core"
```

---

### Task 11: Top-level AGENTS.md, CLAUDE.md, marketplace.json + final verification

**Files:**
- Create: `AGENTS.md` (repo working rules — hand-authored, distinct from generated `dist/agents-md/AGENTS.md`)
- Create: `CLAUDE.md`
- Create: `.claude-plugin/marketplace.json`
- Modify: `README.md` (add build/agent matrix if needed)

**Interfaces:**
- Consumes: everything.
- Produces: repo-level entrypoints and an optional Claude marketplace manifest pointing at `dist/claude`.

- [ ] **Step 1: Create repo working-rules `AGENTS.md`**

```markdown
# AGENTS.md — ai-dev-harness の作業ルール

このリポジトリで作業する AI エージェント向けの規約。

## 絶対ルール

- 編集してよいのは `core/`, `harness/`, `lab/`, `docs/` のみ。
- `dist/` は `bun run build` の生成物。**手編集禁止**。
- 能力を1つ追加/変更したら `bun run build` → `bun run check` を実行してからコミット。
- Python/HTML/JSON アセットは変換せずコピーする。
- テンプレート変数 `{{HARNESS_DIR}}` はビルド時置換（Claude → `.claude`）。

## レイヤー

- `core/` — 単一情報源（中立）
- `harness/<agent>/` — 各エージェント向けアダプタ
- `dist/<agent>/` — 生成物（コミットするが手編集禁止）

## コマンド

- `bun run build` — `core` + `harness` → `dist/<agent>`
- `bun run check` — dist 鮮度・手編集検出
- `bun test` — ユニットテスト
```

- [ ] **Step 2: Create `CLAUDE.md` stub**

```markdown
# CLAUDE.md

作業ルールは `AGENTS.md` に従うこと（このリポジトリの単一の作業規約）。

## Claude 固有の補足

- 生成された Claude 配布物は `dist/claude/.claude/` にある。
- 他プロジェクトへは marketplace（`.claude-plugin/marketplace.json`）または
  `dist/claude/.claude/` の直接コピーで導入する。
```

- [ ] **Step 3: Create `.claude-plugin/marketplace.json`**

```json
{
  "name": "ai-dev-harness",
  "owner": {
    "name": "otomatty"
  },
  "plugins": [
    {
      "name": "ai-dev-harness",
      "source": "./dist/claude",
      "description": "個人最適化スキル・ハーネス・AI-DLC 拡張の Claude 配布物"
    }
  ]
}
```

- [ ] **Step 4: Validate marketplace.json is well-formed**

Run: `bun -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8')); console.log('valid')"`
Expected: `valid`.

- [ ] **Step 5: Full pipeline verification**

Run:
```bash
bun test && bun run build && bun run check
```
Expected: all tests pass; build prints degradation warnings for Claude-only agents/hooks/tools/sensors; `bun run check` prints `✅ dist is up to date.`

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md CLAUDE.md .claude-plugin/marketplace.json README.md dist
git commit -m "feat: add repo AGENTS.md/CLAUDE.md and Claude marketplace manifest"
```

---

## Self-Review Notes

- **Spec coverage:** core/harness/dist 3層 (Tasks 1,5–8) ✓; skills/agents/knowledge/hooks/tools/sensors/ai-dlc レイヤー (Task 1 skeleton, 9–10 migration) ✓; ビルド型 core→dist (Tasks 5–7) ✓; graceful degradation with warnings (Task 6) ✓; `{{HARNESS_DIR}}` substitution (Tasks 4,10) ✓; dist committed + freshness check (Task 8) ✓; AGENTS.md first-class + CLAUDE.md stub (Task 11) ✓; marketplace.json (Task 11) ✓; Folder 1 & 2 migration (Tasks 9,10) ✓; lab/ + promote.ts — `lab/` dir created (Task 1); `scripts/promote.ts` intentionally deferred (YAGNI: promotion is a manual `git mv` until a second lab item exists; noted here rather than built speculatively).
- **Type consistency:** `Capability`/`ProjectResult` defined once (Tasks 3,5) and imported by all projectors; `build(root)`/`check(root)` signatures consistent across Tasks 7,8,10.
- **Placeholder scan:** no TBD/TODO; every code step shows full code.
