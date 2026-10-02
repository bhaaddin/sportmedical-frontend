# Round five — screens the eye can hold

Four rounds have been rejected. The last one for a reason worth reading twice:

> "they are not for work environment — the eyes will lose catch of everything"

That is not about colour. Round four passed every colour rule. It is about
**the eye having nothing to hold on to**: eight regions competing at the same
weight, a lead band bolted on top of an already busy screen, panels beside
panels beside panels, and no single path through any of it.

Round four's instinct was to ADD — a lead, a button, a marker, a rule. This
round subtracts. **A screen someone works in for ten hours is mostly empty.**

---

## 1. The scan path — the whole job

**1.1 One column carries the screen.** There is a single primary column the
eye travels down, top to bottom, and it holds the work. Everything else is
subordinate: narrower, quieter, and to one side. Not two equal columns. Not a
grid of tiles. One path.

**1.2 At most three regions.** Counting everything with a heading. Round four
had eight. If you need a fourth, you are describing a different screen.

**1.3 Anchor the left edge.** Every row in the main column starts with the
same thing in the same place — the time. The eye rides that edge down the
page. Nothing may interrupt that column: no icons, no chips, no indentation.

**1.4 A landmark every five or six rows.** A quiet hour band, a hairline, a
time heading. The eye needs somewhere to rest and somewhere to return to after
it looks away. Without landmarks a list of eighteen rows is a wall.

**1.5 Rows breathe.** 44–52px per row, not 34. Density is not information;
it is the reason people lose their place. Line-height in a row is at least
1.5, and there is real space between a name and the detail under it.

---

## 2. Subtract

**2.1 Six columns maximum** in any table, and four is better. Round four's
table had nine. Rodné číslo, pojišťovna and personál are not what a person
reads while running a day — put them in the row's second line or leave them
out.

**2.2 No numbers strip.** The row of four to six big figures at the top of
every round-four screen is the single worst offender: it is the first thing
the eye meets, it says nothing actionable, and it pushes the work below the
fold. At most **two** figures, and only if they change what somebody does.

**2.3 One action visible at a time.** One primary button on the screen, on
the thing that needs doing. Round four put three to five everywhere. Buttons
on every row are noise; the eye reads them as texture.

**2.4 Below the fold, one region. Not three.**

**2.5 Borders are a last resort.** Space separates. A border is for when two
things would otherwise touch. Round four drew a box around everything.

---

## 3. What the eye lands on

**3.1 The first thing read is a sentence, not a figure.** "Martin Kolář čeká
25 minut na souhlas" tells somebody what to do. A large "4" does not.

**3.2 One thing is large. Nothing else is.** One element between 24 and 28px.
Everything else sits at 15–17px body and 13px labels. Two large things are
zero large things.

**3.3 Colour appears three times at most.** The thing that is wrong, the
thing that is running, the one button. A fourth use and the eye stops
believing any of them.

**3.4 Finished work is one line.** Not a demoted table, not a collapsed panel
with a count and a chevron — one grey line: "Odbaveno 07:00–08:30 · pět
pacientů". It is over.

---

## 4. Everything from the old contract that still holds

- **No pure black, no pure white.** Dark ground 12–20 % lightness, light
  ground 93–98 %, body text at 84–92 % on dark and 12–20 % on light.
- **Saturation ceiling**: 25 % for anything large, 75 % absolute.
- **No motion.** No `@keyframes`, no `animation`, transitions ≤ 150 ms on
  hover and focus only.
- **No blur, no glow, no gradient behind text.**
- **Nothing under 13px. Nothing over 28px.** Base 15 or 16.
- **State is never colour alone** — a word always, a shape where it fits.
- Every selector scoped to `#dNN`. No `<script>`, `<link>`, `<img>`, URLs,
  emoji, `@font-face`. Inline `style` only for bar geometry.
- Fonts: IBM Plex Sans, IBM Plex Mono, Libre Franklin, DM Sans, Chivo,
  Source Serif 4, or a system stack. Body in a sans face.
- Each template keeps its assigned palette from the old section F — grounds
  and accents stay distinct across the twenty.

## 5. The day, unchanged

Tuesday 23 September 2026, **09:40**. Ordinace Brno-Žabovřesky.
Martin Kolář, booked 09:15, has waited **25 minutes**: *Chybí: Souhlas se
zpracováním zdravotních údajů*.

Eighteen appointments 07:00–16:40, the people, rooms, activities, staff and
insurers from the old contract's section D. At 09:40, five are finished, two
are running, one is blocked, and the rest are still to come.

## 6. Before you say it is done

Render it. Then answer these, honestly, in your reply:

- Where does the eye land first, and is that the most important thing?
- Can you follow the day down one column without your eye jumping sideways?
- Count the regions with headings. Is it three or fewer?
- Count the buttons. Is it one, or two if the second is genuinely secondary?
- Is there anything on this screen a person running a clinic would not look
  at today? Delete it.
