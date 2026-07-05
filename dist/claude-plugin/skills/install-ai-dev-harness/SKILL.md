---
name: install-ai-dev-harness
description: otomatty/ai-dev-harness のスキル・ハーネス・AI-DLC 拡張を、別プロジェクトへ自然言語で個別または一式導入する。ユーザーが「ai-dev-harness を入れたい」「技術選定スキルを Cursor に追加」「TDD 拡張だけ入れて」「bootstrap して」などと言ったとき、環境（Claude Code / Cursor / AGENTS.md）を検出し、catalog から component または bundle を特定して CLI で導入する。オープンエコシステムの skills.sh 向け探索は find-skills を使い、本リポジトリ固有の資材はこのスキルで扱う。
---

# ai-dev-harness 導入 (install-ai-dev-harness)

このスキルは **otomatty/ai-dev-harness** に蓄積されたスキル・ハーネス・AI-DLC 拡張を、対象プロジェクトへ導入する。

## いつ使うか

- 「ai-dev-harness をこのプロジェクトに入れて」
- 「技術選定スキルだけ Cursor に追加」
- 「TDD ガード / AI-DLC 拡張を入れたい」
- 「source-verification スキルを追加」
- 「bootstrap して」（導入スキル自身だけ先に入れる）

**使わない:** skills.sh / npx skills 向けの外部スキル探索 → **find-skills** を使う。

## 全体の流れ

1. **環境検出** — 対象プロジェクトのエージェントを特定
2. **意図解釈** — 自然言語 → catalog の component / bundle
3. **確認** — 導入先・依存・非対応能力をユーザーに提示
4. **実行** — CLI で導入（ユーザー承認後）
5. **レポート** — 成功・skip・手動セットアップが必要な項目

## Step 1: 環境検出

対象ディレクトリ（通常はワークスペースルート）を調べる:

| 兆候 | エージェント |
|---|---|
| `.claude/` または Claude Code セッション | `claude` |
| `.cursor/` | `cursor` |
| `AGENTS.md` のみ / 汎用エージェント | `agents-md` |

複数ある場合はユーザーに確認する。Codex 向けは **プラグイン marketplace** が基本（granular CLI は claude / cursor / agents-md）。

## Step 2: catalog の取得

```bash
bunx github:otomatty/ai-dev-harness list
bunx github:otomatty/ai-dev-harness describe <component-or-bundle>
```

JSON が必要なら `--json` を付ける。

### 主な bundle

| bundle id | 内容 |
|---|---|
| `tech-selection` | 技術選定レポート一式（スキル + サブエージェント） |
| `ai-dlc-tdd` | TDD ガード・状態機械・sensor・construction ルール |
| `full` | 全部 |

### 主な component（スキル）

- `tech-selection-research` — 技術選定・比較調査
- `source-verification` — 一次情報の裏取り
- `research-writeup` — HTML レポート生成
- `report-revision` — レポート修正
- `install-ai-dev-harness` — この導入スキル自身

## Step 3: 意図解釈

ユーザーの発話を catalog の `keywords` と bundle 名にマッチさせる。

| ユーザー発話の例 | 解釈 |
|---|---|
| 「全部入れて」「一式」 | bundle `full` または legacy `claude`/`cursor` |
| 「技術選定」 | bundle `tech-selection` |
| 「TDD」「RED GREEN ガード」 | bundle `ai-dlc-tdd` |
| 「裏取りスキルだけ」 | component `source-verification` |
| 「bootstrap」 | component `install-ai-dev-harness` のみ |

**依存:** `describe` で `dependsOn` を確認し、必要なら依存 component も含めて提案する（CLI が自動解決する）。

**非対応:** `describe` の `agents` フィールドで `partial` / `unsupported` を確認。Cursor では subagent / hook はネイティブ非対応。正直に説明し、Claude 配布を案内する。

## Step 4: ユーザー確認

実行前に必ず提示:

- 対象プロジェクトパス
- エージェント (`--agent`)
- 導入する component / bundle 一覧（依存含む）
- スキップまたは手動セットアップが必要な項目

## Step 5: 実行

### bootstrap（初回・導入スキルだけ）

```bash
bunx github:otomatty/ai-dev-harness bootstrap cursor
bunx github:otomatty/ai-dev-harness bootstrap claude [targetDir]
```

### 個別 / bundle 導入

```bash
bunx github:otomatty/ai-dev-harness install \
  --agent cursor \
  --components tech-selection \
  ./path/to/project

bunx github:otomatty/ai-dev-harness install \
  --agent claude \
  --components source-verification research-writeup
```

`bun` が無い環境では README の `install.sh` または curl+tar 手順を案内する。

### 一式導入（従来）

```bash
bunx github:otomatty/ai-dev-harness claude [targetDir]
bunx github:otomatty/ai-dev-harness cursor [targetDir]
```

Claude Code ではプラグインも推奨:

```text
/plugin marketplace add otomatty/ai-dev-harness
/plugin install ai-dev-harness@ai-dev-harness
```

## Step 6: 導入後レポート

- インストールされた component 一覧
- `skipped` と理由（エージェント非対応など）
- 次のステップ（例: Cursor で subagent 相当は手動、hook は Claude のみ）

## エラー時

| エラー | 対処 |
|---|---|
| `already exists` | `--force` を提案、または手動マージ |
| `Unknown component` | `list` で正しい id を確認 |
| `catalog.json missing` | `--ref main` またはリポジトリ更新 |

## 原則

- **CLI を実行エンジンにする** — スキル内で ad-hoc コピーしない
- **正直な degradation** — Cursor で hook が動かないと言わない
- **find-skills と役割分担** — 外部スキルは find-skills、ai-dev-harness 資材は本スキル
