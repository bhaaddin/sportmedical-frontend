"""A contact sheet: all twenty templates side by side as thumbnails.

The owner's complaint five rounds running has been that the twenty look like
one. That is a question about silhouettes, and it cannot be answered by
reading files or by looking at one screen at a time - which is exactly how I
kept missing it. This renders all twenty at thumbnail size on one page so the
question can be looked at directly.
"""
import io
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))

HEAD = """<title>Dvacet obrazovek</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Libre+Franklin:wght@400;500;600&family=DM+Sans:wght@400;500;700&family=Chivo:wght@400;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">
<style>
body{margin:0;background:#E7EAED;color:#1A2028;
  font-family:"IBM Plex Sans",ui-sans-serif,system-ui,sans-serif;font-size:13px}
.intro{max-width:70ch;padding:26px 18px 6px}
.intro h1{font-size:1.6rem;font-weight:600;margin:0 0 8px;letter-spacing:-.02em}
.intro p{margin:0 0 6px;color:#4E5C68;line-height:1.55}
.intro .den{font-family:"IBM Plex Mono",monospace;font-size:.76rem;color:#7A8794}
.sheet{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:14px;
  align-items:start}
@media (max-width:1100px){.sheet{grid-template-columns:repeat(2,1fr)}}
@media (max-width:640px){.sheet{grid-template-columns:1fr}}
/* The cell is NOT a link. Wrapping it in <a> looked obvious and broke the
   page: the templates contain their own navigation anchors, and an <a> inside
   an <a> is invalid, so the parser closed the outer one early and each cell
   fell apart into three separate grid items. The caption carries the link. */
.cap a{color:inherit;text-decoration:none}
.cap a:hover{text-decoration:underline}
.cell:hover{border-color:#8A97A3}
.open{display:inline-block;margin-top:4px;font-weight:500;color:#2C6E63;
  text-decoration:none}
.open:hover{text-decoration:underline}
.thesis{padding:7px 9px;font-size:11.5px;color:#55606B;line-height:1.45;
  border-top:1px solid #E3E8ED}
.cell{background:#FBFCFD;border:1px solid #C9D2DA;border-radius:6px;overflow:hidden;
  display:flex;flex-direction:column}
.cap{display:flex;gap:7px;align-items:baseline;padding:6px 8px;border-bottom:1px solid #E3E8ED}
.cap b{font-size:12px}
.cap span{font-family:"IBM Plex Mono",monospace;font-size:11px;color:#7A8794}
.win{position:relative;overflow:hidden;height:280px}
.stage{transform-origin:top left;width:1400px;height:1120px;pointer-events:none}
.dir{display:block}
.dir > .shot{width:1400px;min-height:1120px;box-sizing:border-box}
</style>
<div class="intro">
  <h1>Dvacet obrazovek jednoho dne</h1>
  <p>Dvacet návrhů, jak by mohl vypadat pohled na jeden den v ordinaci.
    Všechny ukazují <b>totéž úterý ve stejnou minutu</b> — stejné pacienty,
    stejné časy, stejný chybějící souhlas — aby se daly porovnat. Liší se tím,
    jak je den uspořádaný a co dávají očím jako první.</p>
  <p>Klikněte na kterýkoliv a otevře se přes celou obrazovku.</p>
  <p class="den">úterý 23. září 2026 · 09:40 · Ordinace Brno-Žabovřesky</p>
</div>
<div class="sheet">
"""

FOOT = """</div>
<script>
document.querySelectorAll('.win').forEach(function(w){
  var s=w.querySelector('.stage');
  var k=w.clientWidth/1400;
  s.style.transform='scale('+k+')';
  w.style.height=Math.round(1120*k)+'px';
});
</script>
"""


def main():
    cells = []
    for n in range(1, 21):
        path = os.path.join(HERE, "d%02d.html" % n)
        if not os.path.exists(path):
            continue
        text = io.open(path, encoding="utf-8").read()
        name = re.search(r'data-name="([^"]*)"', text)
        thesis = re.search(r'data-thesis="([^"]*)"', text)
        cells.append(
            '<div class="cell"><div class="cap"><span>%02d</span>'
            '<b><a href="d%02d.html">%s</a></b></div>'
            '<div class="win"><div class="stage">%s</div></div>'
            '<div class="thesis">%s<br>'
            '<a class="open" href="d%02d.html">Otevřít na celou obrazovku</a>'
            '</div></div>'
            % (n, n, name.group(1) if name else "", text.strip(),
               thesis.group(1) if thesis else "", n))
    out = HEAD + "\n".join(cells) + FOOT
    io.open(os.path.join(HERE, "pages", "index.html"), "w", encoding="utf-8",
            newline="\n").write(out)
    print("rozcestnik s nahladmi: %d -> pages/index.html (%d KB)"
          % (len(cells), len(out) // 1024))


if __name__ == "__main__":
    main()
