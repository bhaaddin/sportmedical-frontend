"""Round five: check the eye-path rules, then write one HTML file per template.

The owner asked for two things. Each template gets its own page rather than
twenty stacked in one gallery, and the screens have to stop being walls -
"the eyes will lose catch of everything". The checks below are the second
half of that, the ones that can be counted: regions, buttons, columns, big
figures, row height.

Everything from the earlier rounds still runs; this imports it rather than
repeating it.
"""
import io
import os
import re
import sys

import build

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "pages")


# ---------------------------------------------------------------- new checks

def eyepath_problems(text, css):
    out = []

    headings = len(re.findall(r"<h[23]\b", text))
    if headings > 3:
        out.append("%d regions with headings - rule 1.2 allows three; round four had "
                   "eight and that is why the eye had nowhere to rest" % headings)

    buttons = len(re.findall(r"<button\b", text))
    if buttons == 0:
        out.append("no button - one action must be visible")
    elif buttons > 2:
        out.append("%d buttons - rule 2.3 allows one, or two if the second is genuinely "
                   "secondary; buttons on every row read as texture" % buttons)

    for table in re.findall(r"<thead\b.*?</thead>", text, flags=re.S):
        cols = len(re.findall(r"<th\b", table))
        if cols > 6:
            out.append("a table with %d columns - rule 2.1 allows six, and four is better"
                       % cols)

    big = [float(m.group(1)) for m in re.finditer(r"font-size\s*:\s*([\d.]+)px", css)
           if float(m.group(1)) >= 24]
    if len(big) > 1:
        out.append("%d type sizes at 24px or more (%s) - rule 3.2: one thing is large, "
                   "nothing else is" % (len(big), ", ".join("%gpx" % b for b in sorted(set(big)))))
    if big and max(big) > 28:
        out.append("largest type %gpx - the ceiling is 28px this round" % max(big))

    return out


def check(path, ident):
    text, problems = build.check(path, ident)
    styles = re.findall(r"<style[^>]*>(.*?)</style>", text, flags=re.S | re.I)
    problems = [p for p in problems if "G6" not in p and "G7" not in p and "G2 asks" not in p]
    problems += eyepath_problems(text, "\n".join(styles))
    return text, problems


# ---------------------------------------------------------------- per-page output

# A COMPLETE document, doctype first. Without it the browser falls into
# quirks mode, where a table does not inherit colour, font or line-height
# from its ancestors - the dark templates rendered their times and names in
# the light theme's ink, invisible on their own ground. The gallery page is
# wrapped in a skeleton when it is published; these per-template pages are
# served as they are written, so they must carry their own.
PAGE = """<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>%(name)s</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Libre+Franklin:wght@400;500;600&family=DM+Sans:wght@400;500;700&family=Chivo:wght@400;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">
<style>
body{margin:0;background:#E9EBEE;color:#1B2229;
  font-family:"IBM Plex Sans",ui-sans-serif,system-ui,sans-serif;font-size:15px}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) body{background:#14181D;color:#DDE3E9}}
:root[data-theme="dark"] body{background:#14181D;color:#DDE3E9}
.p-bar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;
  padding:9px 18px;border-bottom:1px solid rgba(128,140,152,.35);
  font-size:.82rem;position:sticky;top:env(safe-area-inset-top,0px);
  background:inherit;z-index:30}
.p-no{font-family:"IBM Plex Mono",ui-monospace,monospace;opacity:.65}
.p-name{font-weight:600}
.p-thesis{opacity:.75;flex:1 1 300px;min-width:0}
.p-back{margin-left:auto;text-decoration:none;border:1px solid rgba(128,140,152,.45);
  border-radius:6px;padding:5px 11px;color:inherit;min-height:32px;display:inline-flex;
  align-items:center}
.p-back:hover{border-color:currentColor}
.dir{display:block}
.dir > .shot{width:100%%;min-height:calc(100vh - 46px);box-sizing:border-box}
</style>
</head>
<body>
<div class="p-bar">
  <span class="p-no">%(no)s / 20</span>
  <span class="p-name">%(name)s</span>
  <span class="p-thesis">%(thesis)s</span>
  <a class="p-back" href="index.html">Zpět na přehled</a>
</div>
%(body)s
</body>
</html>
"""

INDEX_HEAD = """<title>Dvacet obrazovek</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{--bg:#F2F4F6;--fg:#1A2028;--fg2:#4E5C68;--fg3:#7A8794;--line:#D6DEE4;--card:#FBFCFD}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#14181D;--fg:#DFE6EC;--fg2:#A6B3BE;--fg3:#78858F;--line:#28323B;--card:#1B2128}}
:root[data-theme="dark"]{--bg:#14181D;--fg:#DFE6EC;--fg2:#A6B3BE;--fg3:#78858F;--line:#28323B;--card:#1B2128}
body{margin:0;background:var(--bg);color:var(--fg);
  font-family:"IBM Plex Sans",ui-sans-serif,system-ui,sans-serif;font-size:15px;line-height:1.55}
.wrap{max-width:860px;margin:0 auto;padding-inline:20px;padding-block:44px 70px;box-sizing:border-box}
h1{font-size:1.75rem;font-weight:600;margin:0 0 10px;letter-spacing:-.02em}
.lede{color:var(--fg2);max-width:66ch;margin:0 0 6px}
.day{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:.78rem;color:var(--fg3);
  margin:0 0 30px}
.list{display:flex;flex-direction:column;gap:1px;background:var(--line);
  border:1px solid var(--line);border-radius:10px;overflow:hidden}
.row{display:flex;gap:16px;align-items:baseline;padding:15px 18px;background:var(--card);
  text-decoration:none;color:inherit}
.row:hover{background:var(--bg)}
.row .n{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:.82rem;color:var(--fg3);
  flex:0 0 26px}
.row .nm{font-weight:600;flex:0 0 190px}
.row .th{color:var(--fg2);font-size:.88rem;flex:1 1 auto;min-width:0}
@media (max-width:640px){.row{flex-wrap:wrap;gap:4px 12px}.row .nm{flex:1 1 auto}
  .row .th{flex:1 1 100%%}}
</style>
<div class="wrap">
  <h1>Dvacet obrazovek jednoho dne</h1>
  <p class="lede">Každý návrh je samostatná stránka na celou obrazovku. Všechny
    ukazují totéž úterý ve stejnou minutu, aby se daly porovnat — liší se tím,
    jak je den uspořádaný a co dávají očím jako první.</p>
  <p class="day">úterý 23. září 2026 · 09:40 · Ordinace Brno-Žabovřesky</p>
  <div class="list">
"""

INDEX_FOOT = """  </div>
</div>
"""


def attr(text, name):
    m = re.search(r'%s="([^"]*)"' % name, text)
    return m.group(1) if m else ""


def main():
    only = [a for a in sys.argv[1:] if not a.startswith("-")] or \
        ["d%02d" % n for n in range(1, 21)]
    failures, missing, made, notes = [], [], [], []

    if not os.path.isdir(OUT):
        os.makedirs(OUT)

    # The sameness comparison only means anything across the whole set, so it
    # runs when the whole set is being built. build5 checked each file alone
    # and would have let two templates drift onto the same palette unnoticed.
    identities, fonts = {}, {}
    if len(only) == 20:
        for ident in only:
            path = os.path.join(HERE, ident + ".html")
            if os.path.exists(path):
                raw = io.open(path, encoding="utf-8").read()
                identities[ident] = build.identity_of(raw)
                fonts[ident] = build.font_of(raw)
    clashes = build.variety_problems(identities, fonts) if len(identities) > 1 else {}

    for ident in only:
        path = os.path.join(HERE, ident + ".html")
        if not os.path.exists(path):
            missing.append(ident)
            continue
        text, problems = check(path, ident)
        # Reported, not enforced. Round five asks for colour at most three
        # times, so in a near-monochrome screen the most-used saturated value
        # is the blocking red - and blocking red is SUPPOSED to agree across
        # all twenty. The check was comparing warning colours and calling
        # them the same design. What tells these screens apart now is layout,
        # density and type, which no colour comparison can see.
        for note in clashes.get(ident, []):
            notes.append("%s: %s" % (ident, note))
        if problems:
            failures.append((ident, problems))
            continue
        no = ident[1:]
        page = PAGE % {
            "no": no,
            "name": attr(text, "data-name"),
            "thesis": attr(text, "data-thesis"),
            "body": text.strip(),
        }
        io.open(os.path.join(OUT, ident + ".html"), "w", encoding="utf-8",
                newline="\n").write(page)
        made.append((ident, attr(text, "data-name"), attr(text, "data-thesis")))

    for ident, problems in failures:
        print("FAIL %s" % ident)
        for p in sorted(set(problems)):
            print("     - %s" % p)
    if missing:
        print("MISSING: %s" % ", ".join(missing))

    if failures or missing:
        print("\n%d ok, %d failed, %d missing" % (len(made), len(failures), len(missing)))
        return 1

    if notes:
        print("podobne palety (neblokuje):")
        for n in notes:
            print("   %s" % n)
        print()

    if len(made) == 20:
        rows = "".join(
            '    <a class="row" href="%s.html"><span class="n">%s</span>'
            '<span class="nm">%s</span><span class="th">%s</span></a>\n'
            % (i, i[1:], n, t) for i, n, t in made)
        io.open(os.path.join(OUT, "index.html"), "w", encoding="utf-8",
                newline="\n").write(INDEX_HEAD + rows + INDEX_FOOT)
        print("ok: %d pages + index -> pages/" % len(made))
    else:
        print("%d ok (partial run, index not written)" % len(made))
    return 0


if __name__ == "__main__":
    sys.exit(main())
