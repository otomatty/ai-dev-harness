# ai-dev-harness

個人用の AI 開発ハーネス・モノレポ。最適化スキル / ハーネス / AI-DLC 拡張を
ハーネス中立の `core/` に単一情報源として蓄積し、`bun run build` で各エージェント
（Claude Code / Cursor / Codex / AGENTS.md）向けの `dist/<agent>/` を生成する。

## レイヤー

| ディレクトリ | 役割 |
|---|---|
| `core/` | 単一情報源（中立）。**編集はここだけ** |
| `harness/<agent>/` | 各エージェント向けの設定断片・変換規約 |
| `dist/<agent>/` | ビルド生成物（`claude`, `claude-plugin`, `codex-plugin`, `cursor`, `agents-md`） |
| `lab/` | 試作（未昇格） |
| `docs/` | 調査・設計・意思決定 |
| `scripts/` | build / check / promote |

## 他プロジェクトへの導入（クローン不要）

リポジトリを clone せず、GitHub から `dist/` だけ取得して対象プロジェクトへ展開する。

```bash
# Claude Code → ./.claude/
bunx github:otomatty/ai-dev-harness claude

# Cursor → ./.cursor/
bunx github:otomatty/ai-dev-harness cursor /path/to/project

# AGENTS.md 標準 → ./AGENTS.md（既存ファイルがある場合は --force）
bunx github:otomatty/ai-dev-harness agents-md --force
```

`bun` が無い環境では `npx --yes github:otomatty/ai-dev-harness claude` でも可。
シェル一行版:

```bash
curl -fsSL https://raw.githubusercontent.com/otomatty/ai-dev-harness/main/scripts/install.sh | bash -s -- claude
```

| エージェント | コマンド例 | 展開先 |
|---|---|---|
| Claude Code | `... claude [dir]` | `<dir>/.claude/` |
| Cursor | `... cursor [dir]` | `<dir>/.cursor/` |
| AGENTS.md | `... agents-md [dir]` | `<dir>/AGENTS.md` |

`[dir]` を省略するとカレントディレクトリ。特定バージョンは `--ref v0.1.0`（タグやブランチ名）。

## Claude Code / Codex プラグインとして導入（推奨）

マーケットプレイス経由で `/plugin install` 相当の操作ができます（clone 不要）。

### Claude Code

```text
/plugin marketplace add otomatty/ai-dev-harness
/plugin install ai-dev-harness@ai-dev-harness
```

CLI から:

```bash
claude plugin marketplace add otomatty/ai-dev-harness
claude plugin install ai-dev-harness@ai-dev-harness
```

### Codex

```bash
codex plugin marketplace add otomatty/ai-dev-harness
```

その後 Codex 内で `/plugins` を開き、`ai-dev-harness` マーケットプレイスから
プラグインをインストールします。

```text
/plugins
```

> Codex プラグインは **skills のみ** 同梱（agents / hooks は Claude 専用能力のため省略）。

## 開発（このリポジトリ内）

- ビルド: `bun run build`
- 検証（dist の鮮度・手編集検出）: `bun run check`
- テスト: `bun test`
- ローカル dist をその場へ試す: `bun run install:harness claude ..`

詳細な設計は `docs/superpowers/specs/2026-07-04-ai-dev-harness-design.md`。
