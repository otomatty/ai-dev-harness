# AI-DLC TDD 拡張のステータス

`core/hooks/aidlc-tdd-guard.ts`, `core/tools/aidlc-tdd.ts`,
`core/tools/aidlc-lib.ts`, `core/sensors/aidlc-pytest.md`,
`core/knowledge/aidlc-developer-agent/python-tdd.md`,
`core/ai-dlc/construction/code-generation.integration.md` は、外部の
**AI-DLC v2 基盤**（`core/` + `harness/` + `scripts/package.ts` を持つ既存リポジトリ）へ
上乗せする**統合キット**として設計されている。

## 現在の扱い（TDD ガードは有効・opt-in）

共有ライブラリ `aidlc-lib.ts`（`resolveProjectDir` / `resolveProjectDirFromHook` /
`toPosix`）は本リポジトリに同梱済みで、ガード（PreToolUse フック）と状態機械
`aidlc-tdd.ts` は **standalone で動作する**。

- **共有ライブラリの扱い:** `aidlc-lib.ts` は「projected capability」ではなく
  **サポートモジュール**として扱う。`scanCore()` は tool 走査から除外し
  （`isSupportModule()` = `*-lib.ts`）、代わりにビルド／granular install で
  tool・hook と同じ `tools/` 配下へ**そのままコピー**する。よって catalog・
  plugin manifest・degradation warning には現れないが、import は実行時に解決する。
- **配線は opt-in:** 既定の Claude settings（`harness/claude/settings.base.json`）は
  `hooks: {}` のままにし、ガードを既定では発火させない。ガードは全本番 `.py`
  書き込みを「開いた RED サイクルが無い限り deny」するため、非 Python／非 TDD
  プロジェクトに一律で効かせないための判断。
  - PreToolUse フラグメントは `harness/claude/optional/settings.pretooluse-tdd.json`
    に置き、catalog コンポーネント `aidlc-tdd-guard` の `settingsFragments` として
    参照する。`aidlc-tdd-guard` を明示インストールした時だけ、対象プロジェクトの
    `.claude/settings.json` にマージされて配線される（matcher は
    `Write|Edit|MultiEdit`）。

## sensor（`aidlc-sensor-pytest.ts`）は未同梱

advisory な pytest sensor の dispatcher `aidlc-sensor-pytest.ts` と、その発火レール
`aidlc-sensor-fire.ts`（PostToolUse）は v2 基盤側にあり本リポには無い。sensor は
構造的に書き込みをブロックできない advisory レイヤであり、v2 の PostToolUse レール
無しには単体で発火経路が無いため、**今回は見送り**とする。`core/sensors/aidlc-pytest.md`
は将来 v2 統合時の実装手順ドキュメントとして保持する。

## v2 基盤と統合する場合（将来）

1. 外部 AI-DLC v2 基盤を統合し、`aidlc-sensor-pytest.ts` と `aidlc-sensor-fire.ts` を
   `core/` に供給する（sensor を発火させたい場合）。
2. ガードを既定 ON にしたい場合は、`optional/settings.pretooluse-tdd.json` を
   `harness/claude/` 直下へ移す（base settings に取り込まれ全 Claude 導入で発火）。
3. `bun run build` → `bun run check` で再生成・検証する。
