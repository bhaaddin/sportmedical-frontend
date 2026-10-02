"""Lint the twenty templates against the eye-safety contract, then assemble.

The first round was rejected for being unusable over a long shift, so the
rules that matter are measured here rather than trusted to taste: luminance
bands, a saturation ceiling, no ambient motion, no blur, no type under 13px.
A template that fails does not reach the gallery.
"""
import colorsys
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- structure

BANNED_MARKUP = [
    ("<script", "no script in a template"),
    ("<link", "no external stylesheet"),
    ("<img", "no images"),
    ("<iframe", "no frames"),
    ("http://", "no external URLs"),
    ("https://", "no external URLs"),
    ("@font-face", "fonts come from the shell"),
]

ESCAPES = re.compile(r"(^|[,{}])\s*(:root|html|body|\*)\b")
KEYFRAMES = re.compile(r"@(-\w+-)?keyframes\s+([\w-]+)\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}", re.S)

# ---------------------------------------------------------------- colour

HEX = re.compile(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b")


def chroma_of(hexcode):
    """How colourful a value actually looks, 0-100.

    HSL saturation is useless near the ends of the lightness scale: the very
    light neutral #EFF3F7 reports 33 % and was rejected as a ground, so the
    checker read a template's dark navigation rail as its background instead.
    Max minus min channel does not have that flaw.
    """
    h = hexcode.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    vals = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    return (max(vals) - min(vals)) * 100.0 / 255.0


def hsl_of(hexcode):
    h = hexcode.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    r, g, b = (int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    hue, lig, sat = colorsys.rgb_to_hls(r, g, b)
    return hue * 360, sat * 100, lig * 100


DECLS = re.compile(r"\{([^{}]*)\}", re.S)


def declarations_of(css):
    """Only what is inside braces.

    Scanning the whole stylesheet read `#d04` in the selector `#d04 .row` as
    a colour and called it 100% saturated. Ids are not colours.
    """
    return " ; ".join(m.group(1) for m in DECLS.finditer(css))


def colour_problems(css):
    """Saturation ceiling and the pure black / pure white ban."""
    css = declarations_of(css)
    out = []
    loud = []
    for m in HEX.finditer(css):
        code = m.group(0)
        _, sat, lig = hsl_of(code)
        if lig <= 1.5:
            out.append("pure black %s - halation; use a 12-20%% ground" % code)
        elif lig >= 98.5:
            out.append("pure white %s - glare; use a 93-98%% ground" % code)
        if sat > 75 and chroma_of(code) > 30:
            out.append("%s is %d%% saturated - ceiling is 75%%, and 25%% for anything large"
                       % (code, sat))
        elif chroma_of(code) > 22:
            # Counted by chroma, not HSL saturation. A very light cream reports
            # 30-40 % saturation while being visibly neutral, so this ceiling
            # was counting a template's own quiet tints against it and forcing
            # them to be merged. The rule is meant to stop a rainbow, not to
            # punish a warm palette for having shades.
            loud.append(code.lower())
    if len(set(loud)) > 8:
        out.append("%d different saturated colours (%s...) - the contract allows one accent "
                   "plus two semantic hues" % (len(set(loud)), ", ".join(sorted(set(loud))[:5])))
    # As a VALUE only. An earlier version matched the word anywhere and so
    # banned `white-space`, which is not a colour; the templates worked around
    # it with `text-wrap:nowrap`, which fewer browsers support. The check was
    # making the work worse.
    for word in ("black", "white"):
        if re.search(r"[:\s,]\s*%s(?![-\w])" % word, css):
            out.append("colour keyword %r is banned as a value" % word)
    if re.search(r"rgba?\(\s*0\s*,\s*0\s*,\s*0\s*[,)]", css):
        out.append("rgb(0,0,0) is banned")
    if re.search(r"rgba?\(\s*255\s*,\s*255\s*,\s*255\s*[,)]", css):
        out.append("rgb(255,255,255) is banned")
    return out


# ---------------------------------------------------------------- comfort

def comfort_problems(css):
    out = []

    if re.search(r"@(-\w+-)?keyframes", css) or re.search(r"[^-]animation\s*:", css):
        out.append("ambient motion - nothing may move on its own")

    for prop in ("filter", "backdrop-filter", "text-shadow"):
        if re.search(r"[^-]%s\s*:" % prop, css):
            out.append("%s is banned - blur and glow cost legibility" % prop)

    for m in re.finditer(r"transition[^;{}]*?([\d.]+)(ms|s)\b", css):
        ms = float(m.group(1)) * (1 if m.group(2) == "ms" else 1000)
        if ms > 150:
            out.append("transition of %dms - 150ms is the ceiling" % ms)

    for m in re.finditer(r"font-size\s*:\s*([\d.]+)(px|rem|em)", css):
        size, unit = float(m.group(1)), m.group(2)
        if unit == "px" and size < 13:
            out.append("font-size %gpx - nothing may be under 13px" % size)
        if unit == "px" and size > 30:
            out.append("font-size %gpx - headings stop at 30px" % size)
        if unit in ("rem", "em") and size < 0.85:
            out.append("font-size %g%s is under 13px" % (size, unit))

    for m in re.finditer(r"box-shadow\s*:\s*([^;{}]+)", css):
        val = m.group(1)
        if "inset" in val:
            continue
        blurs = re.findall(r"(-?[\d.]+)px", val)
        if len(blurs) >= 3 and abs(float(blurs[2])) > 3:
            out.append("box-shadow blur %spx - a 1px hairline is the idiom here" % blurs[2])

    if re.search(r"linear-gradient|radial-gradient", css):
        out.append("gradient - allowed only on a decorative strip carrying no text; "
                   "remove it or justify it by deleting this check")

    return out


# ---------------------------------------------------------------- substance

NAV = ["Přehled", "Dnes", "Plánování", "Pacienti", "Diagnostika", "Dokumenty",
       "Pokladna", "Fakturace", "Sklad", "Tým", "Nastavení"]
TIMES = ["07:00", "07:20", "07:40", "08:00", "08:30", "09:00", "09:15", "09:45",
         "10:00", "10:30", "11:00", "11:30", "13:00", "13:40", "14:20", "15:00",
         "15:40", "16:40"]


def substance_problems(text):
    out = []
    times = [t for t in TIMES if t in text]
    if len(times) < 14:
        out.append("only %d of the day's times appear - the contract asks for at least "
                   "14 appointments" % len(times))
    nav = [n for n in NAV if n in text]
    if len(nav) < 8:
        out.append("left navigation is missing (%d of the 11 sections found)" % len(nav))
    if "Souhlas se zpracováním" not in text and "Chybí souhlas" not in text:
        out.append("the blocked patient (Martin Kolář, missing consent) is not on the screen")
    body = re.sub(r"<style.*?</style>", "", text, flags=re.S)
    words = len(re.findall(r"[A-Za-zÁ-ža-ž]{2,}", re.sub(r"<[^>]+>", " ", body)))
    # Round five subtracts on purpose, and a floor of 260 words started
    # forcing padding: one template grew a sentence listing insurer codes
    # that "nobody reads at 09:40", added only to clear this check. A floor
    # that makes the work worse is a bad floor. 200 still catches a poster.
    if words < 200:
        out.append("only ~%d words of content - this is a poster, not a screen" % words)
    for m in re.finditer(r'style="([^"]*)"', text):
        if not re.fullmatch(r"\s*(width|height)\s*:\s*[\d.]+%\s*;?\s*", m.group(1)):
            out.append("inline style %r - only bar/meter geometry is allowed" % m.group(1))
    return out



# ---------------------------------------------------------------- point of view

NOW_WORDS = ["Právě", "právě", "Nyní", "nyní", "Teď", "teď", "TEĎ", "PRÁVĚ", "NYNÍ"]


def voice_problems(text, css):
    """Section G - the difference between software and a wireframe.

    None of this was visible to the earlier checks. Two templates passed every
    colour, spacing and substance rule; one led with what needs a person and a
    button that fixes it, the other with five identical grey figures above five
    finished appointments. Only one of them was a design.
    """
    out = []

    if "<button" not in text:
        out.append("no button anywhere - G6 asks for one real action a person would press")

    if not any(w in text for w in NOW_WORDS):
        out.append("nothing says where the day currently is - G4 asks for a marked now")

    sizes = sorted({float(m.group(1)) for m in
                    re.finditer(r"font-size\s*:\s*([\d.]+)px", css)})
    if len(sizes) < 3:
        out.append("only %d type sizes - G7 asks for a dominant, a reading and a label step"
                   % len(sizes))
    elif sizes[-1] < 24:
        out.append("largest type is %gpx - G2 asks that one element clearly dominates"
                   % sizes[-1])

    return out

# ---------------------------------------------------------------- identity

def font_of(text):
    """The typeface the template actually reads in."""
    styles = re.findall(r"<style[^>]*>(.*?)</style>", text, flags=re.S | re.I)
    hits = re.findall(r'font-family\s*:\s*"?([A-Za-z0-9 ]+)', " ".join(styles))
    hits = [h.strip() for h in hits if h.strip().lower() not in ("var", "inherit")]
    return hits[0] if hits else None


def identity_of(text):
    """The ground and the loudest accent a template actually uses.

    Round two had twelve of twenty sharing one ground and one accent: twenty
    layouts wearing a single skin. Sameness is now a failure, so it has to be
    measured across files rather than trusted to each author in isolation.
    """
    styles = re.findall(r"<style[^>]*>(.*?)</style>", text, flags=re.S | re.I)
    joined = " ; ".join(styles)

    # The ground is read from the `.shot` rule, which the contract makes
    # responsible for the template's own background. Taking the first
    # qualifying colour in the file instead picked the dark TEXT colour on a
    # light template - d06, d11 and d17 all reported their ink as their
    # ground, so the comparison was between two different things.
    ground = None
    for block in re.finditer(r"([^{}]*)\{([^{}]*)\}", joined):
        if ".shot" not in block.group(1):
            continue
        hit = re.search(r"background(?:-color)?\s*:[^;}]*?(#[0-9a-fA-F]{3,6})", block.group(2))
        if hit:
            ground = hit.group(1).upper()
            break

    css = declarations_of(joined)
    if ground is None:                      # no explicit .shot background
        for m in HEX.finditer(css):
            code = m.group(0).upper()
            _, _, lig = hsl_of(code)
            if (lig >= 90 or lig <= 24) and chroma_of(code) <= 12:
                ground = code
                break

    # The accent is the saturated colour a template USES MOST, not the one
    # with the highest saturation.
    #
    # Picking the loudest meant picking the blocking red every time, and five
    # templates were then reported as "the same design" because their warning
    # colours agreed. They are supposed to agree: red means stop on all twenty.
    # The accent is what distinguishes them, and it is the colour that recurs -
    # rails, links, the button - while a blocking mark appears once or twice.
    # Colourfulness by chroma, not HSL saturation: a light cream ground reports
    # 33 % saturation and was being counted as the template's accent.
    counts = {}
    for m in HEX.finditer(css):
        code = m.group(0).upper()
        if chroma_of(code) > 22:
            counts[code] = counts.get(code, 0) + 1
    accent = max(counts, key=lambda c: (counts[c], hsl_of(c)[1])) if counts else None
    return ground, accent


def channel_gap(a, b):
    """Largest per-channel difference between two colours, 0-255."""
    def ch(x):
        h = x.lstrip("#")
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        return [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    return max(abs(p - q) for p, q in zip(ch(a), ch(b)))


def hue_gap(a, b):
    gap = abs(hsl_of(a)[0] - hsl_of(b)[0])
    return min(gap, 360 - gap)


def variety_problems(identities, fonts):
    """Two templates clash when a person could confuse them at a glance.

    The first version of this demanded 25 degrees of hue between every pair of
    accents. That is impossible: twenty hues on a 360-degree circle can be at
    most 18 degrees apart, so the rule could never be satisfied and the
    assigned palette in section F broke it by 0.3 degrees in one place. The
    check was wrong, not the templates.

    Confusion needs SEVERAL things to be alike, so this asks that at least two
    of three differ: the ground, the accent hue, and the typeface. A dark
    template and a light one never read as the same design whatever their
    accents do.
    """
    out = {}
    names = sorted(identities)
    for i, a in enumerate(names):
        ga, aa = identities[a]
        for b in names[i + 1:]:
            gb, ab = identities[b]

            # Judged on the colours themselves, not on hue angle. Hue is a
            # poor measure for near-neutrals - two greys a hair apart can sit
            # 90 degrees from each other - and the contract pins every light
            # ground inside a five-point lightness band, so an angle-based
            # test on those was pure noise.
            same_ground = ga and gb and channel_gap(ga, gb) <= 3
            same_accent = aa and ab and channel_gap(aa, ab) <= 12
            same_type = fonts.get(a) is not None and fonts.get(a) == fonts.get(b)

            # Ground AND accent both near-identical is the failure that
            # actually happened: twelve files shared #EEF1F4 with #2C6E63.
            #
            # A near-identical ground alone is NOT it. Twenty light neutral
            # grounds cannot be pulled seven values apart and still look like
            # clinic software - a search for that produced pink, lilac and
            # mint - so two templates may share a near-neutral and be told
            # apart by accent, typeface, density and layout, which is what a
            # person actually sees.
            if same_ground and same_accent:
                out.setdefault(a, []).append(
                    "is the same design as %s: ground %s vs %s, accent %s vs %s%s"
                    % (b, ga, gb, aa, ab, ", same typeface" if same_type else ""))
    return out


# ---------------------------------------------------------------- driver

def selectors_of(css):
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = re.sub(r"@(media|supports)[^{]*\{", "", css)
    for chunk in css.split("}"):
        sel = chunk.split("{")[0].strip()
        if sel and "{" in chunk:
            yield sel


def check(path, ident):
    text = io.open(path, encoding="utf-8").read()
    problems = []

    low = text.lower()
    for needle, why in BANNED_MARKUP:
        if needle in low:
            problems.append("%s (%s)" % (why, needle))

    for attr in ("data-name", "data-thesis", "data-cost"):
        if attr + "=" not in text:
            problems.append("missing %s" % attr)
    if 'id="%s"' % ident not in text or 'class="dir"' not in text:
        problems.append('missing <article class="dir" id="%s">' % ident)
    if 'class="shot"' not in text:
        problems.append('missing <div class="shot">')

    styles = re.findall(r"<style[^>]*>(.*?)</style>", text, flags=re.S | re.I)
    all_css = "\n".join(styles)

    for css in styles:
        stripped = KEYFRAMES.sub("", css)
        for sel in selectors_of(stripped):
            for one in sel.split(","):
                one = one.strip()
                if not one:
                    continue
                if ESCAPES.search(one):
                    problems.append("global selector escapes the template: %r" % one)
                elif ("#" + ident) not in one:
                    problems.append("selector not scoped to #%s: %r" % (ident, one))

    problems += colour_problems(all_css)
    problems += comfort_problems(all_css)
    problems += substance_problems(text)
    problems += voice_problems(text, all_css)
    return text, problems


def main():
    only = sys.argv[1:] or ["d%02d" % n for n in range(1, 21)]
    shell = io.open(os.path.join(HERE, "shell.html"), encoding="utf-8").read()
    parts, failures, missing = [], [], []

    identities, fonts, kept = {}, {}, []
    for ident in only:
        path = os.path.join(HERE, ident + ".html")
        if not os.path.exists(path):
            missing.append(ident)
            continue
        text, problems = check(path, ident)
        identities[ident] = identity_of(text)
        fonts[ident] = font_of(text)
        kept.append((ident, text, problems))

    # Sameness is only visible across the whole set, so it is judged last.
    clashes = variety_problems(identities, fonts) if len(identities) > 1 else {}
    for ident, text, problems in kept:
        problems = problems + clashes.get(ident, [])
        if problems:
            failures.append((ident, problems))
        else:
            parts.append(text.strip())

    for ident, problems in failures:
        print("FAIL %s" % ident)
        for p in sorted(set(problems)):
            print("     - %s" % p)
    if missing:
        print("MISSING: %s" % ", ".join(missing))

    if failures or missing:
        print("\n%d ok, %d failed, %d missing" % (len(parts), len(failures), len(missing)))
        return 1

    if len(parts) < 20:
        print("%d ok (partial run, gallery not written)" % len(parts))
        return 0

    out = shell.replace("<!--DIRECTIONS-->", "\n".join(parts))
    io.open(os.path.join(HERE, "gallery.html"), "w", encoding="utf-8", newline="\n").write(out)
    print("ok: %d templates -> gallery.html (%d KB)" % (len(parts), len(out) // 1024))
    return 0


if __name__ == "__main__":
    sys.exit(main())
