# CLAUDE.md

作業ルールは `AGENTS.md` に従うこと（このリポジトリの単一の作業規約）。

## Claude 固有の補足

- 生成された Claude 配布物:
  - ファイルコピー用: `dist/claude/.claude/`
  - プラグイン用: `dist/claude-plugin/`（`plugin.json` + コンポーネントをプラグインルート直下）
- 他プロジェクトへの導入:
  - **推奨（プラグイン）:** `/plugin marketplace add otomatty/ai-dev-harness` →
    `/plugin install ai-dev-harness@ai-dev-harness`
  - **CLI / ファイル:** `bunx github:otomatty/ai-dev-harness claude [dir]` または
    `dist/claude/.claude/` の手動コピー
- Codex 向けプラグインは `dist/codex-plugin/` + `.agents/plugins/marketplace.json`
  （`codex plugin marketplace add otomatty/ai-dev-harness`）
