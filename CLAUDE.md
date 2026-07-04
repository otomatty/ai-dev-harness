# CLAUDE.md

作業ルールは `AGENTS.md` に従うこと（このリポジトリの単一の作業規約）。

## Claude 固有の補足

- 生成された Claude 配布物は `dist/claude/.claude/` にある。
- 他プロジェクトへは `dist/claude/.claude/` を対象プロジェクトの `.claude/` へ
  コピーして導入する（現状の正式手順）。
- marketplace 経由の `/plugin install` は未対応（`dist/claude` は `.claude/` サブツリー形で、
  `plugin.json` を持つプラグインルート形状ではないため）。将来 plugin 形状ビルドを追加予定。
