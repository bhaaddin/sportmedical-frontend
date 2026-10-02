# Round six — twenty templates that are actually twenty

Five rounds rejected. The last one for the reason that matters most:

> "Nepotřebuji jednu, potřebuju 20 na výběr."

He is right, and it is my fault, not the agents'. Round five's brief
prescribed the shape: a sentence at the top, one column, one button, one
region below. Twenty agents built exactly that. One of them wrote in its own
report, "each of the four is now the same skeleton, differently expressed."
That is one template shown twenty times.

**This round prescribes no shape.** Each template is assigned a FORM that must
be recognisable from a thumbnail, and how it works inside is its own business.

Two things also matter this time:

- **Someone else will choose.** Not the owner — a person who has not followed
  any of this. The twenty must be tellable apart at a glance and each must
  explain itself.
- **"Přehlednější."** Clearer. A person should understand what they are
  looking at in about three seconds: what this screen is organised by, where
  the day is now, and what needs them.

---

## 1. Your assigned form — this is what makes it a different template

The form is the silhouette. If someone shrank your screen to a 200px
thumbnail and put it beside the other nineteen, the shape alone should say
which one it is.

| # | name | FORM — what the shape is |
|---|------|--------------------------|
| 01 | Agenda | Large time blocks stacked down the page, one per appointment, roomy — like a day planner |
| 02 | Nástěnka místností | Five vertical room lanes side by side, appointments as cards inside them |
| 03 | Sloupce podle stavu | Four kanban columns — potřebuje člověka / běží / čeká / hotovo — cards move between them |
| 04 | Seznam a detail | A list on the left, one patient open large on the right |
| 05 | Týdenní mřížka | A true calendar grid: time down, rooms across, blocks in cells |
| 06 | Pruhy lidí | One horizontal band per member of staff, their day running across it |
| 07 | Pořadník | A ticket queue — who is next, big; who is waiting, listed by how long |
| 08 | Tabulka | A dense spreadsheet. Many rows, aligned columns, no decoration |
| 09 | Tři panely | Three panels: dopoledne, odpoledne, co nesedí |
| 10 | Teď velké | One enormous card for what is happening now, everything else small beneath |
| 11 | Tiskový list | A printed day sheet — serif, rules, a document you could hang up |
| 12 | Úkoly a rozvrh | A fixed task column on the left, the schedule on the right |
| 13 | Pás času | A horizontal time ribbon with room lanes, scrolled left to right |
| 14 | Dispečink | Many small modules on one screen, control-room style |
| 15 | Kontrolní seznam | A checklist of paperwork — ticked, unticked, blocking |
| 16 | Rozbalovací | Collapsed sections that open; the closed state is the screen |
| 17 | Úzký sloupec | One narrow reading column, centred, everything in it |
| 18 | Dnes a zítra | Two days side by side, equal weight |
| 19 | Podle služeb | Grouped into the clinic's four services, each with its own block |
| 20 | Jen typografie | No panels, no fills, no borders — type and space only |

**Do not borrow another template's form.** If yours is cards, it is cards
everywhere, not a table with one card on top. If yours is a table, it is a
table, not a table under a hero band.

**Forbidden this round**, because it is what made all twenty the same:
a big sentence across the top followed by one column and one button. If that
is how your screen opens, you have built round five again.

---

## 2. Clear in three seconds

**2.1** The organising principle must be obvious without reading. Columns for
states, lanes for rooms, bands for people — the structure says it.

**2.2 Where the day is now must be visible immediately** — a marked cell, a
line, a heading, a card that is obviously the live one.

**2.3 What needs a person must be findable without hunting.** Martin Kolář's
missing consent. How you surface it is yours: a red card, a first column, a
ticked-off checklist row, a stamp.

**2.4 Label your regions in plain Czech.** Someone who has never seen this
system should be able to say what each part is for.

**2.5 Don't crowd.** Whatever the form, leave air. Rows, cards and cells want
14-18px of internal padding and real space between them.

---

## 3. Eye comfort — unchanged, non-negotiable

- No pure black, no pure white. Dark ground 12-20 % lightness, light ground
  93-98 %, body text 84-92 % on dark and 12-20 % on light.
- Nothing over 25 % saturation on a large area; 75 % absolute ceiling.
- **No motion.** No `@keyframes`, no `animation`; transitions ≤ 150 ms on
  hover and focus only.
- No blur, no glow, no gradient behind text.
- **Nothing under 13px.** Body 15-16px. Headings up to 30px.
- State never by colour alone — a word always.
- Your assigned palette from the old CONTRACT.md section F still stands.

## 4. File shape — unchanged

`dNN.html`, one `<article class="dir" id="dNN" data-name data-thesis
data-cost>`, a scoped `<style>` where every selector starts with `#dNN`, and
a `<div class="shot">`. No `<script>`, `<link>`, `<img>`, URLs, emoji,
`@font-face`. Inline `style` only for bar geometry. Fonts: IBM Plex Sans,
IBM Plex Mono, Libre Franklin, DM Sans, Chivo, Source Serif 4, system stack.

`data-thesis` is one sentence saying **who this screen is for and when it
helps** — written for the person who will choose, not for a designer.
`data-cost` is one sentence saying what it gives up.

## 5. The day — unchanged

Tuesday 23 September 2026, **09:40**, Ordinace Brno-Žabovřesky.
Martin Kolář, booked 09:15, waiting **25 minutes**: *Chybí: Souhlas se
zpracováním zdravotních údajů*.

Eighteen appointments 07:00-16:40 with the people, rooms, activities, staff
and insurers from CONTRACT.md section D. At 09:40: five finished, two
running, one blocked, ten still to come.

Finished work may be shown, summarised or hidden — your choice, and it is
part of what makes your template different from the next one.

## 6. Before you finish

Render it. Then shrink it to a thumbnail and ask: **beside nineteen others,
would anyone know which one this is?** If the answer is no, the form is not
strong enough yet. Say in your reply what the silhouette is and what someone
would call this screen after three seconds of looking at it.
