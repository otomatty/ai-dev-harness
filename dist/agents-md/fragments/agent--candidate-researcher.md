## Claude-only: agent `candidate-researcher`

技術選定で1つの候補(ライブラリ/フレームワーク/サービス等)を独立コンテキストで調査するワーカー。tech-selection-research スキルから候補ごとに委譲して使う。指定された評価軸で調べ、公式ドキュメントなど信頼できる一次情報の原文を引用しながら裏取りし、本線には render.py 用のJSON断片(主張+原文引用+バッジ)と要約だけを返す。生成後レポートへの「なぜ/もっと調べて」という深掘り依頼にも、対象の論点だけを再調査して応える。本線のコンテキストを汚さないためのエージェント。

Available in the Claude distribution only.
