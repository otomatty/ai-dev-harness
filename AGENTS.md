# AGENTS.md — ai-dev-harness の作業ルール

このリポジトリで作業する AI エージェント向けの規約。

## 絶対ルール

- 能力（スキル/エージェント/フック等）を編集してよいのは `core/`, `harness/`, `lab/`, `docs/` のみ。
- ビルド・変換ツール（`scripts/`）はメンテナンス目的で編集してよい。変更時は `bun test` と `bun run check` を通すこと。
- `dist/` は `bun run build` の生成物。**手編集禁止**。
- 能力を1つ追加/変更したら `bun run build` → `bun run check` を実行してからコミット。
- Python/HTML/JSON アセットは変換せずコピーする。
- テンプレート変数 `{{HARNESS_DIR}}` はビルド時置換（Claude → `.claude`）。

## レイヤー

- `core/` — 単一情報源（中立）
- `harness/<agent>/` — 各エージェント向けアダプタ
- `scripts/` — ビルド・チェック・インストールのツール（メンテナンス時のみ編集）
- `dist/<agent>/` — 生成物（コミットするが手編集禁止）

## コマンド

- `bun run build` — `core` + `harness` → `dist/<agent>`
- `bun run check` — dist 鮮度・手編集検出
- `bun test` — ユニットテスト
