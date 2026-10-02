"""Put all twenty templates on the same Tuesday, at the same minute.

Twenty screens of one day are only comparable if it IS one day. Each agent
picked its own present moment, so the set said 09:22, 09:38 and 09:40 at once,
in 2025 and in 2026, at two different addresses - and the waiting times derived
from those moments disagreed too: Martin Kolář was described as waiting 22, 25,
31 and 35 minutes for the same 09:15 appointment.

Canonical: Tuesday 23 September 2026, 09:40, Ordinace Brno-Žabovřesky.
09:40 rather than a later minute because the 09:45 appointment must still read
as the next one up, not as overdue. Kolář booked 09:15, so he has waited 25
minutes, and every figure derived from that follows.
"""
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

NOW = "09:40"
WAIT = 25

# Moments other than NOW that templates used as "right now". None of these is
# in the contract's appointment list, so they can only ever be a now-marker.
# 09:30 and 09:35 were in this list and should never have been: several
# templates offer a free slot at 09:30, so replacing it would have rewritten
# real content as a clock reading. Only minutes that no appointment or slot
# uses belong here.
OTHER_NOW = ["09:22", "09:38", "09:46"]

# Waiting figures derived from the old moments, in the shapes they appear in.
WAITS = [
    (r"\b(31|35|22|23|7|sedm)\s*(minut|minuty|minutu)\b", None),
    (r"dvacet dvě minuty", "dvacet pět minut"),
    (r"třicet jedna minut", "dvacet pět minut"),
]


def fix(text):
    changed = []

    before = text
    text = re.sub(r"(23\. z[áa]ř[íi]\s*)2025", r"\g<1>2026", text)
    if text != before:
        changed.append("rok 2025 -> 2026")

    for t in OTHER_NOW:
        if t in text:
            text = text.replace(t, NOW)
            changed.append("%s -> %s" % (t, NOW))

    for pattern, replacement in WAITS:
        if replacement is None:
            def one(m):
                return "%d %s" % (WAIT, "minut")
            new = re.sub(pattern, one, text)
        else:
            new = text.replace(pattern, replacement) if pattern in text else re.sub(
                pattern, replacement, text)
        if new != text:
            changed.append("cekaci doba -> %d minut" % WAIT)
            text = new

    return text, changed


def main():
    dry = "--apply" not in sys.argv
    for n in range(1, 21):
        name = "d%02d.html" % n
        path = os.path.join(HERE, name)
        if not os.path.exists(path):
            continue
        text = io.open(path, encoding="utf-8").read()
        new, changed = fix(text)
        if changed:
            print("%s  %s" % (name, "; ".join(sorted(set(changed)))))
            if not dry:
                io.open(path, "w", encoding="utf-8", newline="\n").write(new)
    print("\n%s" % ("nic nezapsano - spustte s --apply" if dry else "zapsano"))


if __name__ == "__main__":
    main()
