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
