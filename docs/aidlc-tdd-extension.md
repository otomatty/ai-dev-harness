# AI-DLC TDD 拡張のステータス

`core/hooks/aidlc-tdd-guard.ts`, `core/tools/aidlc-tdd.ts`,
`core/sensors/aidlc-pytest.md`, `core/knowledge/aidlc-developer-agent/python-tdd.md`,
`core/ai-dlc/construction/code-generation.integration.md` は、外部の
**AI-DLC v2 基盤**（`core/` + `harness/` + `scripts/package.ts` を持つ既存リポジトリ）へ
上乗せする**統合キット**として設計されている。共有ライブラリ `aidlc-lib.ts`
（`resolveProjectDir` 等）や sensor dispatcher `aidlc-sensor-pytest.ts` はその v2 基盤側に存在し、
本リポジトリには同梱されていない。

そのため現状これらは**単独では実行できない**（standalone で `bun` 実行すると
`Cannot find module './aidlc-lib.ts'` になる）。

## 現在の扱い

素材として `core/` に保持するが、壊れた PreToolUse hook を既定の Claude settings に
**配線しない**（毎編集でのクラッシュを避けるため、settings フラグメントを
`harness/claude/optional/settings.pretooluse-tdd.json` へ退避してある）。

## 有効化する手順（将来）

1. 外部 AI-DLC v2 基盤を統合し、`aidlc-lib.ts` と `aidlc-sensor-pytest.ts` を `core/` に供給する。
2. `harness/claude/optional/settings.pretooluse-tdd.json` を `harness/claude/` に戻す。
3. `bun run build` で再生成する。
