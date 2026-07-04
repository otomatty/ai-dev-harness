# ai-dev-harness ディレクトリ構造 設計書

- 日付: 2026-07-04
- 対象リポジトリ: `ai-dev-harness`（個人が最適化したスキル・ハーネス・AI-DLC 拡張の格納庫）
- ステータス: 承認済み（実装計画へ移行）

## 1. 目的とスコープ

このリポジトリは、以下の3種類の資材を1か所に蓄積し、他プロジェクトへ再利用可能な形で配布するための個人用モノレポである。

1. **スキル** — 個人が最適化した Claude Code スキル群（例: 技術選定リサーチ）
2. **ハーネス（広義）** — エージェント実行環境/設定、オーケストレーションスクリプト、評価/テストハーネスを含む「エージェントを動かすためのあらゆる仕組み」
3. **AI-DLC 拡張** — AWS AI-DLC（Inception / Construction / Operations）の方法論を個人向けに拡張する素材

### 非機能要件（決定的な制約）

- **マルチエージェント汎用性**: Claude Code だけでなく Cursor など他の AI コーディングエージェントでも利用できること。
- **配布可能性**: 他プロジェクトへ導入できること（Claude Code は marketplace 経由、その他はファイルコピー）。
- **単一情報源**: 同じ能力を各エージェント向けに二重管理しない。

## 2. 採用アーキテクチャ: ビルド型（core → dist 生成）

汎用性は「**中立ソースを単一情報源として編集し、各エージェント形式へビルド生成する**」ビルドモデルで実現する。これは取り込み元の `python-tdd-ai-dlc`（AI-DLC v2）が前提とする `core/` + `harness/` + `scripts/package.ts` 設計と一致する。

3層構造:

1. **`core/`** — 能力の単一情報源。エージェント非依存の Markdown / TypeScript。**人が編集するのはここだけ。**
2. **`harness/<agent>/`** — 各エージェントの「形」を知る薄いアダプタ。frontmatter 変換規則、settings 断片、パス規約。
3. **`dist/<agent>/`** — `scripts/build.ts` が `core + harness` から生成する完成品。

データフロー: `lab/` で試作 → `core/` へ昇格 → `build.ts` → `dist/<agent>/` → 各プロジェクトへ導入。

### 検討した代替案

- **同期型（rulesync 等で copy/symlink）**: ビルド不要で軽量だが、frontmatter 変形などエージェント固有の変換力が弱い。不採用。
- **AGENTS.md 主導（ビルドなし）**: 最も簡単だが、Claude のリッチ機能（skills/subagents/hooks）が Cursor へ移植されず二重管理になる。不採用。
- **採用: ビルド型** — 取り込み素材の設計に一致し、frontmatter/パスをエージェント毎に最適化でき、正直な graceful degradation を実装できる。

## 3. ディレクトリ構造

```
ai-dev-harness/
├─ README.md                       # リポジトリの地図と使い方
├─ AGENTS.md                       # このリポジトリ自身の作業ルール（汎用標準・第一級）
├─ CLAUDE.md                       # AGENTS.md を参照する薄いスタブ + Claude 固有補足
│
├─ core/                           # 単一情報源（ハーネス中立）。編集はここだけ
│  ├─ skills/
│  │  ├─ tech-selection-research/
│  │  ├─ source-verification/
│  │  ├─ research-writeup/         # render.py, template.html, sample_data.json 同居
│  │  └─ report-revision/
│  ├─ agents/                      # サブエージェント定義（中立）
│  ├─ knowledge/                   # エージェント知識
│  ├─ hooks/                       # 実行ロジック（TypeScript）
│  ├─ tools/                       # 状態機械等（TypeScript）
│  ├─ sensors/                     # sensor manifest（Markdown）
│  └─ ai-dlc/
│     ├─ common/ inception/ construction/ operations/
│     └─ extensions/tdd/           # opt-in 拡張
│
├─ harness/                        # 各エージェント向けの薄いアダプタ
│  ├─ claude/                      # settings 断片, plugin.json テンプレ, 変換規則
│  ├─ cursor/                      # .mdc frontmatter 規約, globs マッピング
│  └─ agents-md/                   # AGENTS.md 集約規則
│
├─ dist/                           # ビルド生成物（生成だがコミット）。手編集禁止
│  ├─ claude/
│  ├─ cursor/
│  └─ agents-md/
│
├─ scripts/
│  ├─ build.ts                     # core + harness → dist/<agent> を再生成
│  ├─ check.ts                     # dist 鮮度検証 + 中立性リント（dist 手編集検出）
│  └─ promote.ts                   # lab/ → core/ 昇格の雛形補助
│
├─ lab/                            # 試作（未昇格）。core へ昇格後は削除
├─ docs/                           # 調査・設計・意思決定
│  └─ superpowers/specs/           # 設計 spec（本書）
│
└─ .claude-plugin/
   └─ marketplace.json             # dist/claude をマーケットプレイス配布（任意）
```

### 各レイヤーの責務（境界の定義）

| レイヤー | 責務 | 「入れてよい」判定基準 |
|---|---|---|
| `core/` | 能力の単一情報源（中立） | エージェント非依存で表現できる能力か？ |
| `harness/` | 各エージェントへの変換規則・設定断片 | 特定エージェントの「形」に関する知識か？ |
| `dist/` | ビルド生成物（配布物） | build が生成したものか？（手編集禁止） |
| `lab/` | 試作・単体イテレーション | まだ実験中で壊れても困らないか？ |
| `docs/` | 調査・設計・意思決定の記録 | 実行されないテキストか？ |
| `scripts/` | ビルド・検証・昇格の自動化 | リポジトリ自体を保守する道具か？ |

## 4. 能力マッピング（graceful degradation）

ビルド時、各 core 能力を対象エージェントの形へ投影する。対応概念が無い能力は**警告 + 手動セットアップ注記**を出して正直に degrade する（「Cursor でも全部動く」と偽らない）。

| core の能力 | Claude (`dist/claude`) | Cursor (`dist/cursor`) | AGENTS.md |
|---|---|---|---|
| skill | `skills/<n>/SKILL.md`（frontmatter） | `.cursor/rules/<n>.mdc`（globs/alwaysApply） | セクション化 |
| subagent | `.claude/agents/<n>.md`（Task） | 非対応 → ルール + 手動注記 | 注記のみ |
| hook（PreToolUse guard 等） | `settings.json` hooks + `hooks/*.ts` | 非対応 → 手動セットアップ注記 | 注記のみ |
| tool / sensor | コピー + permission allow | コピー（手動実行） | — |
| ai-dlc フェーズルール | `rules/` or skill | `.cursor/rules/*.mdc` | セクション化 |
| assets（render.py 等） | そのままコピー | そのままコピー | そのままコピー |

## 5. 取り込み素材の配置先（初期移行）

### フォルダ1: `technical-report/tech-selection-claude-code/.claude`（Claude 特化スキル束）

| 元 | 配置先 |
|---|---|
| `skills/tech-selection-research/SKILL.md` | `core/skills/tech-selection-research/` |
| `skills/source-verification/SKILL.md` | `core/skills/source-verification/` |
| `skills/research-writeup/`（SKILL.md + assets/render.py, template.html, sample_data.json） | `core/skills/research-writeup/` |
| `skills/report-revision/SKILL.md` | `core/skills/report-revision/` |
| `agents/{candidate-researcher,report-copyeditor,report-reviser}.md` | `core/agents/` |
| `CLAUDE.md`（スキル群を束ねるオーケストレーション規則） | tech-selection スキルのオーケストレーション節へ統合、または `core/skills/tech-selection-research/` 内の束ね説明として保持。ビルド時に生成 `CLAUDE.md`/`AGENTS.md` のプロジェクト規則にも反映 |

### フォルダ2: `python-tdd-ai-dlc`（AI-DLC / TDD 拡張素材）

| 元 | 配置先 |
|---|---|
| `aidlc-tdd-guard.ts` | `core/hooks/aidlc-tdd-guard.ts` |
| `aidlc-tdd.ts` | `core/tools/aidlc-tdd.ts` |
| `aidlc-pytest.md` | `core/sensors/aidlc-pytest.md` |
| `python-tdd.md` | `core/knowledge/aidlc-developer-agent/python-tdd.md` |
| `code-generation.integration.md` | `core/ai-dlc/construction/`（統合手順） |
| `settings.PreToolUse.block.json` | `harness/claude/`（settings 断片） |
| `00-README-v2-native.md` | `docs/`（統合の背景説明） |

注: フォルダ2 が参照する外部「v2」構造（`core/` + `harness/` + `scripts/package.ts`）に、このリポジトリ自体が一致する。したがってフォルダ2 は最も自然な形で吸収される。

## 6. 技術決定

- **ビルドツール**: TypeScript + bun（フォルダ2 の `.ts` / `package.ts` 規約に一致）。`render.py` 等の Python assets は変換せずコピーする。
- **`dist/` はコミットする**（generated-but-checked-in）。理由: marketplace はリポジトリ内の実ファイルを要求し、他プロジェクトが build 不要で直接コピー/install できるため。`scripts/check.ts` を pre-commit / CI に入れて鮮度と「dist 手編集」を検出する。
- **`AGENTS.md` を第一級**に置き、`CLAUDE.md` はそれを参照するスタブとする（2026 のクロスエージェント標準に準拠。AGENTS.md は Cursor / Codex / Copilot / Windsurf / Claude Code 等が読む）。

## 7. lab → core 昇格フロー

1. `lab/<name>/` で単体イテレーション（壊れてよい）。
2. 能力が安定したら `scripts/promote.ts` で `core/` の適切なレイヤーへ雛形移動。
3. `harness/` に必要なら変換規則を追加。
4. `scripts/build.ts` で `dist/` を再生成し、`scripts/check.ts` で検証。
5. `lab/<name>/` を削除。

## 8. 参考（裏取り済み事実）

- Claude Code プラグイン規約: ルートに `.claude-plugin/marketplace.json`、各プラグインは自己完結し、コンポーネントフォルダ（skills/commands/agents/hooks）はプラグインルート直下。`.claude-plugin/` には `plugin.json` のみ。
- AI-DLC（awslabs/aidlc-workflows）: `aidlc-rules/.../{common,inception,construction,operations}/*.md` にフェーズ別ルール、`extensions/<domain>/<variant>/*.md` + `*.opt-in.md` でオプトイン拡張。
- AGENTS.md: 2026 年のクロスエージェント標準（Linux Foundation / Agentic AI Foundation）。
