# AI-DLC v2 ネイティブ統合 — Iron-Law TDD（Claude harness / Python）

前回の `.claude/` 直置き版を、**v2の `core/` + `harness/` を編集して再生成する
ネイティブ形**に作り直した一式です。v2を運用したまま、TDD徹底とハーネス最適化を
両立します。

## 結論：組み込めます（既存の拡張面にほぼ1:1で乗る）

v2は「`core/`（ハーネス中立の本体）を編集し、`harness/`の薄い面と合わせて
`bun scripts/package.ts` で各ハーネスを再生成する」設計です。TDD統合はこの流儀に
そのまま乗ります。追加が必要なのは、v2が**意図的に未実装にしている1本のレール**
だけです。

### v2に元々あった空白

`core/hooks/aidlc-sensor-fire.ts` は **PostToolUse**（書き込み後）に発火し、
ヘッダに「always exit 0 / **Blocking semantics defer to the future ralph driver**」
と明記されています。つまりv2のsensorは構造的に**書き込みを止められない=advisory**。
「テストより先にコードを書かない」を強制するには、v2が使っていない
**PreToolUseブロッキング・フック**を足す必要があります。これが本統合の核心です。

## 5つの拡張面へのマッピング

| # | 何を | v2のどこに（`core/`/`harness/`） | 種別 |
|---|------|-------------------------------|------|
| 1 | **PreToolUseブロッキング・フック** `aidlc-tdd-guard.ts` | `core/hooks/` に追加＋`harness/claude/settings.json` の `hooks` に `PreToolUse` ブロック追加 | **新レール**（v2に無い） |
| 2 | **red/green状態機械** `aidlc-tdd.ts` | `core/tools/` に追加。`bun .claude/tools/aidlc-tdd.ts` で起動（既存の permission allow `Bash(bun …/.claude/tools/*)` に合致） | 既存tool規約 |
| 3 | **pytest sensor** `aidlc-pytest.md`(+`aidlc-sensor-pytest.ts`) | `core/sensors/` に manifest、`core/tools/` に dispatcher。対象ステージの frontmatter `sensors:` に `pytest` 追加 | 既存sensor規約 |
| 4 | **ステージ配線** | `core/aidlc-common/stages/construction/code-generation.md` を編集（test-first順序＋toolコール＋sensor付与）。詳細は `code-generation.integration.md` | 既存stage |
| 5 | **エージェント知識** `python-tdd.md` | `core/knowledge/aidlc-developer-agent/` に追加 | 既存knowledge |

そのあと `bun scripts/package.ts` で `dist/claude` を再生成 → プロジェクトに配布。

## 同梱ファイルと配置先

| ファイル | 配置先（core/harness基準） |
|----------|---------------------------|
| `aidlc-tdd-guard.ts` | `core/hooks/aidlc-tdd-guard.ts` |
| `aidlc-tdd.ts` | `core/tools/aidlc-tdd.ts` |
| `aidlc-pytest.md` | `core/sensors/aidlc-pytest.md` |
| `python-tdd.md` | `core/knowledge/aidlc-developer-agent/python-tdd.md` |
| `settings.PreToolUse.block.json` | `harness/claude/settings.json` の `hooks` にマージ |
| `code-generation.integration.md` | `code-generation.md` への編集手順（Option A/B） |

`aidlc-sensor-pytest.ts`（sensor dispatcher実体）は、dispatcherのstdout/exit契約
（127=tool-unavailable分岐など）がバージョン依存のため、**同梱の
`core/tools/aidlc-sensor-type-check.ts` を雛形にコピーし、`tsc` を
`python -m pytest --cov` に差し替える**のが安全です（`aidlc-pytest.md` に詳細）。

## 導入手順

1. `core/hooks/aidlc-tdd-guard.ts` と `core/tools/aidlc-tdd.ts` を追加。
2. `core/sensors/aidlc-pytest.md` を追加し、`aidlc-sensor-pytest.ts` を
   `aidlc-sensor-type-check.ts` から派生させて `core/tools/` に追加。
3. `core/knowledge/aidlc-developer-agent/python-tdd.md` を追加。
4. `code-generation.md` を `code-generation.integration.md` の手順で編集
   （frontmatter に `pytest` sensor、Step2/4 を test-first に）。
5. `harness/claude/settings.json` の `hooks` に `settings.PreToolUse.block.json`
   の `PreToolUse` ブロックをマージ。
6. `bun scripts/package.ts` で再生成。テストも回す：`tests/run-tests.sh`。
7. プロジェクト側で一度だけ：
   `bun $CLAUDE_PROJECT_DIR/.claude/tools/aidlc-tdd.ts init` →
   生成された `aidlc-docs/.tdd/config.json` で `cov_package`（例 `"src"`）と
   glob・`coverage_floor` を調整。

## ハーネス最適化のポイント（v2運用者向け）

- **bun/TSに統一**（前回のPython直置きから移行）。既存の permission allowlist
  `Bash(bun $CLAUDE_PROJECT_DIR/.claude/tools/*)` に収まり、追加の permission が
  不要。ツール/フックが全て同一ランタイムで一貫します。
- **PreToolUseは配列順評価で最初のdenyで停止**。ガードを先頭に置くと、ブロック時に
  後続の重いチェックをスキップしてセッション応答性を保てます。
- **sensorはstage-graph経由で付与**（frontmatter `sensors:` → `sensors_applicable`）。
  ハードコードせず、ステージ単位で有効/無効を制御。
- **ledgerの配置**：現状は移植性優先で `aidlc-docs/.tdd/` にフラット配置。v2のP9
  「flat aidlc-docs rootは持たない」モデルに厳密に合わせるなら、`aidlc-tdd.ts` の
  `tddDir()` を `activeSpace()`/`recordDir()`（`aidlc-lib.ts`）ベースに差し替え。
  ガードは helper 経由でパスを取るので、1箇所の変更で済みます。
- **モデル**：settings は `model: opus[1m]` / `effortLevel: xhigh`。TDDループは
  developer-agent（`modelOverride: opus`）が回すので、弱いモデルでゲートを飛ばす
  リスクは本家の注意書き通り。強制はhook側なので、モデルが弱くても
  「先にコード」は物理的に不可。

## 既知の限界（正直な注記）

- **「意味のあるテストか」は自動化しきれない。** `assert False` 的なトリビアルRED
  でゲートを開けることは原理上可能。防御は sensor＋architecture-reviewer の
  テスト品質審査（`python-tdd.md` §anti-patterns）＋人間の承認ゲート。
- **hookはハーネス外編集を見ない。** IDEで直接 `.py` を書けば通る。対象は
  「エージェントによる実装」。
- **v2はGA Preview** で破壊的変更あり。stage/sensor/hookのスキーマが動いたら
  frontmatterやdispatcher契約を追随。本番は本家推奨どおり安定版選定を。
- **`build-and-test` ステージ**は、テスト作成がConstructionへ前倒しされるため、
  検証/カバレッジレポート主体に軽量化する余地あり（Option A参照）。
```
```
