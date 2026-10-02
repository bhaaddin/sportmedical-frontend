# 20 templates, round two — the contract

The first round was rejected, and correctly. It produced twenty *moods*:
phosphor green on black, amber terminals, black on saturated yellow, blurred
glass, a pulsing waveform. They photograph well and they are hostile to a
person who sits in front of them for ten hours.

This round is judged on one thing: **could a receptionist work in this from
07:00 to 17:00 without their eyes hurting?** Everything below is checked by
`build.py` and a template that fails is not published.

---

## A. Eye-safety rules — enforced, not advised

**A1 — No pure black, no pure white.** `#000`, `#fff`, `black`, `white` are
forbidden anywhere, including in `rgb()`/`rgba()`. Maximum contrast is what
causes halation and afterimages.

- Dark ground: lightness between **12 % and 20 %** (e.g. `#171D24`).
- Light ground: lightness between **93 % and 98 %** (e.g. `#F4F6F8`).
- Body text on dark: lightness **84–92 %**. On light: **12–20 %**.
- That lands body text around **10:1**, never 21:1.

**A2 — Saturation ceiling.** Any colour covering a large area (backgrounds,
fills, borders) must be **at most 25 % saturation**. Accents may reach 70 %
but only as small marks — a 3px rail, a dot, a chip, a single button.

**A3 — One accent per template**, plus the two semantic colours (warning,
blocking). Three hues total. Not four.

**A4 — No ambient motion.** No `@keyframes`, no `animation`. Transitions are
allowed only on `:hover`/`:focus` and must be **≤ 150ms**. Nothing moves
unless a person moved it.

**A5 — Nothing blurred, nothing glowing.** No `filter`, no
`backdrop-filter`, no `text-shadow`. Shadows only as a 1px hairline offset;
no coloured or spread shadows.

**A6 — No gradient behind text.** A `linear-gradient` may only appear on a
decorative strip that carries no text.

**A7 — Type.** Base size **15px or 16px**. **Nothing below 13px anywhere.**
Headings at most **30px**. Body `line-height` at least **1.45**. Running text
at most **90 characters** per line.

**A8 — State is never colour alone.** Every status carries a word, and where
space allows a shape too. A colour-blind person and a photocopy must both work.

**A9 — Targets.** Anything clickable is at least **32px** tall.

---

## B. It has to be a real screen

The owner wants to **scroll each template and study it**. A poster that fits
in 800px is not a template.

**B1** — The template is a **full application screen**, responsive width, with
its own vertical length. It scrolls. Aim for **1400–2200px of height**.

**B2** — It must contain, in this order or another you argue for:

- a **left navigation** with the clinic's real sections:
  Přehled · Dnes · Plánování · Pacienti · Diagnostika · Dokumenty ·
  Pokladna · Fakturace · Sklad · Tým · Nastavení
- a **top bar**: where you are, the date, search, the signed-in person
- the day's **numbers** (4–6 of them)
- **at least 14 appointments** in the main region, with real times from 07:00
  to 16:40, real people, rooms, activities, states
- **below the fold**, at least two more regions of real substance — e.g.
  waiting room / free slots / staff load / blocked paperwork / insurer mix /
  shift notes. Not filler: things a clinic actually looks at.

**B3** — No horizontal scrolling at any width. Wide tables get their own
`overflow-x:auto` container.

**B4** — It must work at **1400px and at 700px**. Below 900px the navigation
collapses to a row and the columns stack.

---

## C. File shape

One file per template, `dNN.html`, containing exactly:

```html
<article class="dir" id="dNN"
         data-name="Klidný seznam"
         data-thesis="Jedna věta: co tenhle návrh tvrdí."
         data-cost="Jedna věta: co za to platí — co je schválně potlačené.">
  <style>
    #dNN { ... }
    #dNN .thing { ... }
  </style>
  <div class="shot">
    ... the screen ...
  </div>
</article>
```

**Every selector begins with `#dNN`.** No `:root`, `html`, `body`, `*`.
No `<script>`, `<link>`, `<img>`, `<iframe>`, no URLs, no emoji, no
`@font-face`. Inline `style` attributes are allowed **only** for bar/meter
geometry (`style="width:64%"`, `style="height:72%"`).

Fonts, already loaded, always with a fallback stack:
`IBM Plex Sans`, `IBM Plex Mono`, `Libre Franklin`, `DM Sans`, `Chivo`,
`Source Serif 4`, or a plain system stack. Body text must be a **sans** face.

`#dNN .shot` sets its own background and colour and inherits nothing.

---

## D. Content — real, Czech, and enough of it

**People:** Jana Kratochvílová, Petr Doležal, Tomáš Řehák, Marie Nováková,
Ondřej Veselý, Lucie Bartošová, Martin Kolář, Eva Procházková, Filip Urban,
Kateřina Šimková, Jakub Horák, Veronika Málková, Adam Beneš, Nikola Tichá,
Radek Pospíšil, Simona Vrbová.

**Times:** 07:00 07:20 07:40 08:00 08:30 09:00 09:15 09:45 10:00 10:30 11:00
11:30 13:00 13:40 14:20 15:00 15:40 16:40.

**Activities:** Vstupní vyšetření · Kontrola po úrazu · Spiroergometrie ·
Izokinetika kolene · Fyzioterapie · Posudek pro klub · Rázová vlna ·
Analýza chůze · Odběr krve · Kontrola po operaci.

**Rooms:** Ordinace 1 · Ordinace 2 · Laboratoř · Tělocvična · Rehabilitace.

**Staff:** MUDr. Havelka · MUDr. Sýkorová · Bc. Dvořák · Mgr. Pilařová ·
recepce: Hana Veselá.

**States:** čeká · probíhá · hotovo · nedorazil · zrušeno.

**Insurers:** 111 · 201 · 205 · 207 · 211 · 213.

**One blocked patient:** Martin Kolář — *Chybí: Souhlas se zpracováním
zdravotních údajů*. He must be findable on the screen without hunting.

Never lorem. Never English UI words. Never "Item 1".

---

## E. What "better" means here

- **Boring is the goal.** A person should be able to look at this for eight
  hours and not notice it. If a choice is interesting to look at, it is
  probably wrong.
- **Hierarchy through spacing and weight**, not through colour and boxes.
- **Alignment is the whole game.** One column rhythm, one baseline, numbers
  right-aligned and tabular (`font-variant-numeric: tabular-nums`).
- Density that a professional wants: **tight rows, generous margins.** A row
  in a table is 34–40px, not 60.
- Don't decorate. No card around everything. Borders only where two things
  genuinely need separating.
- The twenty differ in **how the day is organised** — list, timeline, by room,
  by person, by state, split-view. They must **also** be told apart at a
  glance; section F assigns each one its own palette and type, and that is
  checked. An earlier version of this line said twenty similar-looking
  templates were fine. They were not.

---

## F. Each template has its OWN look — this is now enforced

Round two produced twenty layouts wearing one skin: twelve of them shared the
ground `#EEF1F4`, twelve shared the accent `#2C6E63`, nineteen used the same
typeface. That is one template with the furniture moved, and it was rejected.

**Your palette is assigned below. Use it. Do not borrow another template's.**
`build.py` compares all twenty and fails any pair whose grounds match or whose
accent hues sit within 25 degrees of each other.

Every palette below already satisfies section A - the grounds sit in the safe
luminance bands, the accents are under the saturation ceiling. Four of the
twenty are DARK grounds: calm dark at 12-20 % lightness, which is the opposite
of the black-with-neon that was rejected.

| # | name | ground | text | accent | headings | body |
|---|------|--------|------|--------|----------|------|
| 01 | Klidný seznam | `#F6F4F1` | `#22201D` | `#3A5E8C` | Libre Franklin | Libre Franklin |
| 02 | Podle místností | `#F1F3F5` | `#1B2229` | `#1F6F66` | IBM Plex Sans | IBM Plex Sans |
| 03 | Podle stavu | `#1A1F26` | `#DDE3E9` | `#C9A227` | Chivo | IBM Plex Sans |
| 04 | Rozdělená plocha | `#F2F5F1` | `#1E2620` | `#2F6B3F` | DM Sans | DM Sans |
| 05 | Časová mřížka | `#EEF2F6` | `#19212B` | `#3C4E9B` | IBM Plex Sans | IBM Plex Sans |
| 06 | Podle lékaře | `#F5F2EA` | `#24211B` | `#9C5430` | Chivo | Libre Franklin |
| 07 | Fronta | `#171C21` | `#DCE4E9` | `#4E93A8` | DM Sans | IBM Plex Sans |
| 08 | Kompaktní tabulka | `#F7F7F8` | `#1C1F23` | `#35506E` | IBM Plex Sans | IBM Plex Sans |
| 09 | Tři sloupce | `#F3F2EF` | `#232024` | `#75466B` | DM Sans | DM Sans |
| 10 | Teď a potom | `#181D24` | `#DFE5EB` | `#4E8C6A` | Chivo | DM Sans |
| 11 | Karta dne | `#F7F4EC` | `#221F19` | `#2B3A55` | Source Serif 4 | Libre Franklin |
| 12 | Dvousloupcový přehled | `#EFF2F4` | `#1A2026` | `#5F6B2A` | IBM Plex Sans | IBM Plex Sans |
| 13 | Vodorovná osa | `#161A20` | `#DBE2E8` | `#C07A3E` | IBM Plex Sans | IBM Plex Sans |
| 14 | Hustý provoz | `#F2F3F4` | `#1B1F24` | `#44637E` | IBM Plex Sans | IBM Plex Sans |
| 15 | Sledování dokladů | `#F4F3F1` | `#221F20` | `#8A3A4A` | Libre Franklin | Libre Franklin |
| 16 | Postupné odhalení | `#EFF3F7` | `#18202A` | `#2E4A7A` | DM Sans | IBM Plex Sans |
| 17 | Úzký sloupec | `#F8F6F2` | `#232019` | `#6B4B2F` | Source Serif 4 | Source Serif 4 |
| 18 | Dva dny vedle sebe | `#F0F2F5` | `#1C1F2B` | `#5A5A8C` | Chivo | IBM Plex Sans |
| 19 | Podle služby | `#F1F4F2` | `#1A2220` | `#226057` | DM Sans | DM Sans |
| 20 | Tichá typografie | `#F7F6F3` | `#1E2328` | `#23303F` | Libre Franklin | Libre Franklin |

**The accent is still a scarce resource** - a rail, a dot, a chip, one button.
A distinct palette is not permission to paint with it.

Derive your panel, border and muted tones from your own ground rather than
copying another template's: a panel is the ground lifted or dropped 2-4 %, a
hairline is the ground moved 10-14 %, muted text is the text colour lifted
30-40 % toward the ground.

**Warning and blocking hues are yours to pick too**, in the same family as
your accent rather than the same brown and red for all twenty - but they must
stay distinguishable from your accent and from each other.

Beyond colour, make the template feel like its own product: row height, corner
radius, whether you use borders or whitespace to separate, how the numbers
strip is shaped, whether headings are uppercase. Two templates should not be
confusable at a glance from across the room.

---

## G. The quality bar — round four

Rounds two and three produced screens that were correct and dull. Looking at
them side by side, the difference between the good ones and the weak ones was
never colour or spacing: it was whether the screen had **a point of view**.

Template 03 opens with "3 vyžaduje zásah" in a large figure, a section headed
CO POTŘEBUJE ČLOVĚKA, the blocked patient with the reason spelled out and a
real button that fixes it. Template 01 opened with five identical grey figures
and eighteen identical grey rows, five of which were already finished.

Both obey every rule in this document. One is software; the other is a
wireframe. Every template must now clear these:

**G1 — Answer "what do I do now" in the first 400 pixels.** Not the date, not
the totals, not the navigation. The thing that needs a person.

**G2 — One element dominates.** Exactly one thing on the screen is the
biggest, and it is the most important thing, not the page title. If everything
is 15px grey, nothing is.

**G3 — Demote what is finished.** Completed appointments are history. Shrink
them, quieten them, collapse them or move them down. They must not occupy the
top of the screen simply because they happened first.

**G4 — Mark now.** The current moment is visible: a rule, a label, a marked
row, a heading. A day screen that does not say where you are in the day is a
list, not a day.

**G5 — The accent must do visible work.** At minimum: the primary action and
the live row. A template whose accent appears nowhere has a palette, not a
design.

**G6 — At least one real action.** A `<button>` a person would press —
"Vytisknout souhlas", "Přijmout pacienta", "Zavolat" — placed where the
problem is, not in a toolbar.

**G7 — Three clear steps in the type ramp.** A dominant figure or heading, a
reading size, and a quiet label size. Weight and colour count as steps only if
the size ramp is there too.

**G8 — Look at it.** Render your template and look at the result before you
say it is done. Every one of these failures was invisible to a linter and
obvious in a screenshot.

None of this licenses decoration. Bigger, quieter and better ordered - not
louder. The eye rules in section A and the identity in section F still hold
exactly as written.
