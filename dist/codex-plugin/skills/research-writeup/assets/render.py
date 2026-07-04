#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""research-writeup レポート生成器(v2)。
使い方:  python render.py <data.json> <out.html>

方針:
- レーダーチャートは廃止。
- 解説文で出典を引用したら、そのすぐ後に「原文 + 日本語訳(非日本語のみ) + リンク」を置く。
- 末尾に出典を一括せず、引用箇所ごとにインラインで示す。
- 事実と解釈を視覚分離する。
スキーマは assets/sample_data.json を参照。スタイルは下部 CSS が単一情報源。
"""
import json, math, sys, html

# ============================ スタイル(ここを編集) ============================
CSS = """
  :root{
    --ink:#14232b; --muted:#5a6b73; --line:#dbe3e6; --panel:#f7f9fa;
    --accent:#0e7c86; --accent-bg:#e7f2f3;
    --ok:#2f7d4f; --warn:#b6791f; --na:#8a9499;
    --mono:ui-monospace,"SF Mono","Cascadia Code",Consolas,monospace;
  }
  *{box-sizing:border-box;}
  body{font-family:system-ui,-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;
       color:var(--ink);line-height:1.75;max-width:820px;margin:0 auto;padding:2.4rem 1.3rem 4rem;}
  .eyebrow{font-family:var(--mono);font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;
       color:var(--accent);margin:2.6rem 0 .1rem;}
  h1{font-size:1.9rem;line-height:1.25;margin:.2rem 0 .6rem;letter-spacing:-.01em;}
  h2{font-size:1.2rem;margin:.1rem 0 .8rem;}
  h3{font-size:1rem;font-family:var(--mono);margin:1.4rem 0 .3rem;color:var(--ink);}
  .specstrip{font-family:var(--mono);font-size:.78rem;color:var(--muted);border-top:1px solid var(--line);
       border-bottom:1px solid var(--line);padding:.5rem 0;display:flex;gap:1.4rem;flex-wrap:wrap;margin:.4rem 0 0;}
  .specstrip b{color:var(--ink);font-weight:600;}
  ul{padding-left:1.1rem;} li{margin:.2rem 0;}
  .req b{font-family:var(--mono);font-size:.75rem;color:var(--accent);}
  figure{margin:1rem 0;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:1rem .6rem .6rem;max-width:520px;}
  figcaption{font-family:var(--mono);font-size:.74rem;color:var(--muted);text-align:center;margin-top:.3rem;}
  table{border-collapse:collapse;width:100%;margin:.6rem 0;font-size:.92rem;}
  th,td{border:1px solid var(--line);padding:.55rem .7rem;text-align:left;vertical-align:top;}
  th{background:var(--panel);font-family:var(--mono);font-size:.78rem;font-weight:600;letter-spacing:.03em;}
  td.axis{font-family:var(--mono);font-size:.82rem;white-space:nowrap;}
  .badge{font-family:var(--mono);font-size:.68rem;padding:.05rem .45rem;border-radius:3px;color:#fff;white-space:nowrap;}
  .b-ok{background:var(--ok);} .b-warn{background:var(--warn);} .b-na{background:var(--na);}
  /* 事実の主張 + インライン出典 */
  .claim{margin:.7rem 0 .2rem;}
  .cite{font-family:var(--mono);font-size:.72rem;color:var(--accent);text-decoration:none;
        border-bottom:1px dotted var(--accent);white-space:nowrap;}
  .cite::after{content:" \\2197";}
  /* 引用ブロック:原文 + 訳 + リンク */
  blockquote.quote{margin:.35rem 0 1rem;border-left:3px solid var(--line);background:var(--panel);
        padding:.55rem .85rem;border-radius:0 6px 6px 0;}
  .quote .orig,.quote .ja{margin:.15rem 0;font-size:.9rem;}
  .quote .orig{color:var(--ink);} .quote .ja{color:var(--muted);}
  .quote .lbl{font-family:var(--mono);font-size:.66rem;letter-spacing:.08em;color:var(--muted);
        margin-right:.4rem;text-transform:uppercase;}
  .quote .src-link{display:inline-block;margin-top:.2rem;font-family:var(--mono);font-size:.74rem;color:var(--accent);}
  /* 解釈・判断ブロック(事実と視覚分離) */
  .interpretation{border-left:4px solid var(--accent);background:var(--accent-bg);padding:.9rem 1.1rem;
       margin:1rem 0;border-radius:0 8px 8px 0;}
  .interpretation::before{content:"解釈・判断";font-family:var(--mono);font-size:.7rem;letter-spacing:.1em;
       font-weight:700;color:var(--accent);display:block;margin-bottom:.35rem;text-transform:uppercase;}
  .fact-note{font-size:.82rem;color:var(--muted);}
  .sample-tag{font-family:var(--mono);font-size:.7rem;color:var(--warn);border:1px dashed var(--warn);
       border-radius:4px;padding:.15rem .5rem;display:inline-block;}
"""
BADGE = {"ok": ("b-ok", "確認済"), "warn": ("b-warn", "要確認"), "na": ("b-na", "不明")}
DEFAULT_COLORS = ["#0e7c86", "#3b4d9e", "#a45b3a", "#5c7a29", "#8a3b6b"]

def esc(s): return html.escape(str(s))

# ============================ 引用ブロック ============================
def citation_block(c):
    """c: {quote, lang, translation?, source, url, accessed, version}"""
    if not c:
        return ""
    parts = ['<blockquote class="quote">']
    parts.append(f'<p class="orig"><span class="lbl">原文</span>{esc(c["quote"])}</p>')
    lang = (c.get("lang") or "").lower()
    if lang not in ("ja", "jp", "") and c.get("translation"):
        parts.append(f'<p class="ja"><span class="lbl">訳</span>{esc(c["translation"])}</p>')
    label = c.get("source") or c.get("url", "")
    meta = " / ".join(x for x in [c.get("accessed"), c.get("version")] if x)
    tail = f' — {esc(meta)}' if meta else ""
    parts.append(f'<a class="src-link" href="{esc(c.get("url","#"))}">{esc(label)}{tail}</a>')
    parts.append('</blockquote>')
    return "\n".join(parts)

def inline_cite(url):
    return f' <a class="cite" href="{esc(url)}">出典</a>' if url else ""

# ============================ SVG:ポジショニング(任意) ============================
def positioning_svg(candidates, xaxis, yaxis, maxv=5):
    W, H, pad = 420, 340, 52
    x0, y0, x1, y1 = pad, H-pad, W-24, 28
    sx = lambda v: x0 + (v-1)/(maxv-1)*(x1-x0)
    sy = lambda v: y0 - (v-1)/(maxv-1)*(y0-y1)
    s = ['<svg viewBox="0 0 420 340" role="img" aria-label="ポジショニングマップ" font-family="ui-monospace,Consolas,monospace">']
    for g in range(1, maxv+1):
        s.append(f'<line x1="{sx(g):.1f}" y1="{y0}" x2="{sx(g):.1f}" y2="{y1}" stroke="#eef2f3"/>')
        s.append(f'<line x1="{x0}" y1="{sy(g):.1f}" x2="{x1}" y2="{sy(g):.1f}" stroke="#eef2f3"/>')
    s.append(f'<line x1="{x0}" y1="{y0}" x2="{x1}" y2="{y0}" stroke="#9aa7ad" stroke-width="1.5"/>')
    s.append(f'<line x1="{x0}" y1="{y0}" x2="{x0}" y2="{y1}" stroke="#9aa7ad" stroke-width="1.5"/>')
    s.append(f'<text x="{(x0+x1)/2:.0f}" y="{H-14}" font-size="11" fill="#5a6b73" text-anchor="middle">{esc(xaxis)} →</text>')
    s.append(f'<text x="16" y="{(y0+y1)/2:.0f}" font-size="11" fill="#5a6b73" text-anchor="middle" '
             f'transform="rotate(-90 16 {(y0+y1)/2:.0f})">{esc(yaxis)} →</text>')
    for c in candidates:
        sc = c.get("scores") or {}
        if xaxis not in sc or yaxis not in sc:
            continue
        x, y = sx(sc[xaxis]), sy(sc[yaxis])
        s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="7" fill="{c["color"]}" fill-opacity="0.85"/>')
        s.append(f'<text x="{x+11:.1f}" y="{y+4:.1f}" font-size="12" fill="#14232b" font-weight="600">{esc(c["name"])}</text>')
    s.append('</svg>')
    return "\n".join(s)

# ============================ SVG:意思決定フロー(任意) ============================
def flow_svg(flow):
    q, yes, no = esc(flow["question"]), esc(flow["yes"]), esc(flow["no"])
    return f'''<svg viewBox="0 0 520 150" role="img" aria-label="意思決定フロー" font-family="ui-monospace,Consolas,monospace">
      <rect x="10" y="55" width="150" height="40" rx="6" fill="#fff" stroke="#9aa7ad"/>
      <text x="85" y="80" font-size="12" text-anchor="middle" fill="#14232b">{q}</text>
      <line x1="160" y1="75" x2="215" y2="40" stroke="#9aa7ad"/>
      <line x1="160" y1="75" x2="215" y2="110" stroke="#9aa7ad"/>
      <text x="180" y="48" font-size="10" fill="#5a6b73">Yes</text>
      <text x="180" y="108" font-size="10" fill="#5a6b73">No</text>
      <rect x="215" y="20" width="200" height="40" rx="6" fill="#e7f2f3" stroke="#0e7c86"/>
      <text x="315" y="45" font-size="12" text-anchor="middle" fill="#0e7c86">{yes}</text>
      <rect x="215" y="90" width="200" height="40" rx="6" fill="#fff" stroke="#9aa7ad"/>
      <text x="315" y="115" font-size="12" text-anchor="middle" fill="#14232b">{no}</text>
    </svg>'''

# ============================ 組み立て ============================
def build(data):
    cands = data.get("candidates", [])
    for i, c in enumerate(cands):
        c.setdefault("color", DEFAULT_COLORS[i % len(DEFAULT_COLORS)])
    req = data.get("requirements", {})
    musts = "".join(f"<li>{esc(x)}</li>" for x in req.get("must", []))
    wants = "".join(f"<li>{esc(x)}</li>" for x in req.get("want", []))

    # 任意:ポジショニング図
    pos_html = ""
    pos = data.get("positioning")
    if pos and any((c.get("scores") or {}).get(pos["x"]) is not None for c in cands):
        pos_html = (f'<p class="eyebrow">図解</p><h2>ポジショニング</h2>'
                    f'<figure>{positioning_svg(cands, pos["x"], pos["y"])}'
                    f'<figcaption>{esc(pos["x"])} × {esc(pos["y"])}</figcaption></figure>')

    # 任意:比較表(コンパクト)
    comp_html = ""
    comp = data.get("comparison")
    if comp and comp.get("rows"):
        head = "".join(f"<th>{esc(n)}</th>" for n in comp.get("headers", [c["name"] for c in cands]))
        rows = ""
        for row in comp["rows"]:
            cells = ""
            for cell in row["cells"]:
                cls, label = BADGE.get(cell.get("badge", ""), ("", ""))
                badge = f' <span class="badge {cls}">{label}</span>' if cls else ""
                cells += f'<td>{esc(cell["text"])}{badge}{inline_cite(cell.get("url"))}</td>'
            rows += f'<tr><td class="axis">{esc(row["axis"])}</td>{cells}</tr>'
        comp_html = (f'<p class="eyebrow">比較表</p><h2>評価軸ごとの比較(要点)</h2>'
                     f'<table><tr><th>評価軸(重み)</th>{head}</tr>{rows}</table>'
                     f'<p class="fact-note">※ 各セルは出典に基づく事実の要約。詳細な根拠と原文は下記「根拠」を参照。</p>')

    # 根拠(原文引用つき)
    findings_html = ""
    if data.get("findings"):
        blocks = []
        for grp in data["findings"]:
            blocks.append(f'<h3>{esc(grp.get("candidate",""))}</h3>')
            for it in grp.get("items", []):
                cls, label = BADGE.get(it.get("badge", ""), ("", ""))
                badge = f' <span class="badge {cls}">{label}</span>' if cls else ""
                url = (it.get("citation") or {}).get("url")
                blocks.append(f'<div class="claim">{esc(it["claim"])}{badge}{inline_cite(url)}</div>')
                blocks.append(citation_block(it.get("citation")))
        findings_html = ('<p class="eyebrow">根拠</p><h2>各候補の根拠(原文引用)</h2>' + "\n".join(blocks))

    # 推奨
    rec = data.get("recommendation", {})
    flow_html = f'<figure>{flow_svg(rec["flow"])}<figcaption>条件付き推奨の分岐</figcaption></figure>' if rec.get("flow") else ""
    rec_cites = "\n".join(citation_block(c) for c in rec.get("citations", []))

    sample = '<span class="sample-tag">SAMPLE — スタイル確認用</span>' if data.get("sample") else ""

    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(data.get("title","技術選定レポート"))}</title>
<style>{CSS}</style>
</head>
<body>
  <p class="eyebrow">Technical Selection Report</p>
  <h1>{esc(data.get("title","技術選定レポート"))}</h1>
  <div class="specstrip">
    <span>作成日 <b>{esc(data.get("date","YYYY-MM-DD"))}</b></span>
    <span>候補 <b>{esc(data.get("candidates_label", " / ".join(c["name"] for c in cands)))}</b></span>
    <span>裏取り <b>{esc(data.get("verification_note","要一次情報確認"))}</b></span>
    {sample}
  </div>

  <p class="eyebrow">前提・要件</p>
  <h2>何のための選定か</h2>
  <ul class="req">
    <li><b>目的</b> {esc(req.get("purpose","(未設定)"))}</li>
    <li><b>must</b><ul>{musts}</ul></li>
    <li><b>want</b><ul>{wants}</ul></li>
  </ul>

  {pos_html}
  {comp_html}
  {findings_html}

  <p class="eyebrow">推奨</p>
  <h2>意思決定(ADR)</h2>
  <p>{esc(rec.get("options_note",""))}</p>
  {flow_html}
  <div class="interpretation">{esc(rec.get("interpretation","(推奨と根拠を記載)"))}</div>
  {rec_cites}
</body>
</html>
"""

def main():
    if len(sys.argv) != 3:
        print("usage: python render.py <data.json> <out.html>"); sys.exit(1)
    with open(sys.argv[1], encoding="utf-8") as f:
        data = json.load(f)
    with open(sys.argv[2], "w", encoding="utf-8") as f:
        f.write(build(data))
    print("wrote", sys.argv[2])

if __name__ == "__main__":
    main()
