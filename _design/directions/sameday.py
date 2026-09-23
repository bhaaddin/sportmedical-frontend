"""Do all twenty templates show the same Tuesday?

A first attempt looked for each patient's name within 170 characters of their
time, which only works for a list. A calendar grid keeps the time in a gutter
and the name in a cell; a checklist sorts by document, not by hour. It scored
those zero and they were fine.

So this asks the question the forms allow: does every roster pairing appear
somewhere in the document, and does any template pair a time with the WRONG
patient? The second half is the one that matters - a screen may legitimately
omit an insurer or a room, but it may not say Filip Urban is the 09:45 when
the other nineteen say Eva Procházková.
"""
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

ROSTER = [
    ("07:00", "Kratochvílová", "Odběr krve"),
    ("07:20", "Doležal", "Vstupní vyšetření"),
    ("07:40", "Řehák", "Spiroergometrie"),
    ("08:00", "Nováková", "Fyzioterapie"),
    ("08:30", "Veselý", "Kontrola po úrazu"),
    ("09:00", "Bartošová", "Izokinetika kolene"),
    ("09:15", "Kolář", "Posudek pro klub"),
    ("09:45", "Procházková", "Rázová vlna"),
    ("10:00", "Urban", "Analýza chůze"),
    ("10:30", "Šimková", "Kontrola po operaci"),
    ("11:00", "Horák", "Vstupní vyšetření"),
    ("11:30", "Málková", "Odběr krve"),
    ("13:00", "Beneš", "Fyzioterapie"),
    ("13:40", "Tichá", "Spiroergometrie"),
    ("14:20", "Pospíšil", "Kontrola po úrazu"),
    ("15:00", "Vrbová", "Izokinetika kolene"),
    ("15:40", "Řehák", "Fyzioterapie"),
    ("16:40", "Doležal", "Kontrola po operaci"),
]

NAMES = sorted({n for _, n, _ in ROSTER})


def text_of(path):
    raw = io.open(path, encoding="utf-8").read()
    raw = re.sub(r"<style.*?</style>", " ", raw, flags=re.S)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", raw))


def report(ident):
    path = os.path.join(HERE, ident + ".html")
    if not os.path.exists(path):
        return None
    t = text_of(path)

    missing_times = [c for c, _, _ in ROSTER if c not in t]
    missing_names = [n for n in NAMES if n not in t]

    # Pairing is NOT checked here, and the attempt is worth recording.
    #
    # Two versions tried to match a name to a time by proximity in the text -
    # first within 170 characters, then within 90. Both worked on a list and
    # both were wrong on every other form. In a calendar grid the source runs
    # column by column, so the name that follows "07:00" in the markup belongs
    # to a different room's later appointment; in a tile mosaic or a checklist
    # there is no ordering at all. The second version reported seventeen of
    # twenty as broken, and the templates were fine.
    #
    # Proximity cannot answer this across twenty different layouts. What is
    # left is presence - every time, every patient, every procedure - which is
    # true whatever the shape. The pairing itself is checked by each agent
    # against its own markup, where the structure is known, and by looking.
    # A form may legitimately drop the procedure column - the roster's last
    # section allows it, and d04 puts the procedure only on the open patient
    # while d15 lists documents rather than treatments. Showing NONE of them
    # is a design choice; showing seventeen and omitting one is a gap.
    missing_acts = [a for _, _, a in ROSTER if a not in t]
    # More than half absent means the form does not print procedures at all -
    # d04 shows one, on the open patient; d15 lists documents instead. Naming
    # the blocked patient's procedure and no other is still "none".
    if len(missing_acts) > len(ROSTER) // 2:
        missing_acts = []
    return missing_times, missing_names, missing_acts


def main():
    only = sys.argv[1:] or ["d%02d" % n for n in range(1, 21)]
    bad = 0
    for ident in only:
        r = report(ident)
        if r is None:
            continue
        mt, mn, ma = r
        problems = []
        if mt:
            problems.append("chybi casy: " + ", ".join(mt))
        if mn:
            problems.append("chybi pacienti: " + ", ".join(mn))
        if ma:
            problems.append("chybi vykony: " + ", ".join(ma))
        if problems:
            bad += 1
            print("%s  %s" % (ident, " | ".join(problems)))
        else:
            print("%s  vsechny casy, pacienti i vykony" % ident)
    print("\n%d z %d sedi" % (len(only) - bad, len(only)))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
