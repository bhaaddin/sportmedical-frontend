# STYLES — a database of the best design systems, and how we adapt them

> "CHECK THE BEST SYSTEMS AND CREAT A DATABASE OF THE BEST STYLES AND WE WILL
> JSUT ADDAPT"

Six rounds of templates were rejected. The last rejection was about **style**,
and the instruction was to stop inventing one. So no value below is my
invention. Every hex, size and rule was read off a published design-system
page or a shipped package artifact, and each entry carries the URLs it came
from and a confidence line. Where a system publishes nothing, the field says
`unknown` — it is not filled in with a guess.

## How to use this file

Each template is assigned **one** system in `CONTRACT7.md` and takes its
palette, type ramp, spacing, radius, border philosophy and signature move from
that system's block below. You do not mix two systems in one screen.

## The one adaptation we make, and why

Round two was rejected with *"very bad for long working howers not suitebol
for eyes"*. The eye-comfort rules that came out of it are still in force:

- no pure black, no pure white;
- light ground 93–98 % lightness, dark ground 12–20 %;
- body text 12–20 % lightness on a light ground.

Most of these systems break the first rule. Tailwind, Geist, Fluent and Ant
all ground on `#ffffff`; Spectrum's primary text is `#000000`; SLDS text is
`#181818`. So every block below has an **ADAPTED** line that gives the value
to actually use, beside the real one. The real value is kept because it is the
evidence; the adapted value is what goes in the template.

**Radix is the exception** — `#fcfcfd` and `#111113`, no pure anything. It
needs no adaptation, which is a large part of why it is the base layer under
several of the twenty.

---

## 1. Radix UI Colors

- **owner** WorkOS · **confidence** high
- **made for** a colour-only foundation: 30 accessible 12-step scales where
  every step has a fixed, documented job, so a component is built against step
  numbers rather than against particular colours.

| role | value | note |
|---|---|---|
| ground light | `#fcfcfd` | slate-1, "App background" |
| ground dark | `#111113` | slate-1 dark |
| surface light | `#f0f0f3` | slate-3, "UI element background" |
| surface dark | `#212225` | slate-3 dark |
| text primary light | `#1c2024` | slate-12, "High-contrast text" |
| text secondary light | `#60646c` | slate-11, "Low-contrast text" |
| text primary dark | `#edeef0` | slate-12 dark |
| border subtle | `#d9d9e0` | slate-6 |
| border strong | `#cdced6` | slate-7 |
| danger | `#e5484d` | red-9 (identical light and dark) |
| warning | `#ffc53d` | amber-9 — **takes dark text** |
| success | `#30a46c` | green-9 |
| info | `#0090ff` | blue-9 |
| accent | none published | Radix names no default; step 9 of any of 24 hues is the solid. teal-9 `#12a594` |

**ADAPTED:** nothing. Radix already satisfies every eye-comfort rule.

**The scale contract — the single most reusable thing in this file.**
Twelve steps, each with a job:

1 App background · 2 Subtle background · 3 UI element background ·
4 Hovered UI element · 5 Active / selected UI element · 6 Subtle borders and
separators · 7 UI element border and focus rings · 8 Hovered UI element
border · 9 Solid backgrounds · 10 Hovered solid · 11 Low-contrast text ·
12 High-contrast text.

Two guarantees the docs attach: steps 11 and 12 are *"guaranteed to Lc 60 and
Lc 90 APCA contrast ratio on top of a step 2 background from the same scale"*;
step 9 has *"the highest chroma of all steps in the scale"*. Most step 9s take
white text — the documented exceptions are Sky, Mint, Lime, Yellow and Amber,
*"designed for dark foreground text"*.

- **borders** steps 6 / 7 / 8 of the **same hue as the fill** — never a neutral
  grey bolted onto a coloured component.
- **elevation** none. No shadow tokens exist.
- **type, spacing, radius** `unknown` — it is a colour package. Borrow those
  from whichever system a template pairs Radix with, or own them.
- **signature move** a component is monochrome within its hue: a `blokováno`
  chip is red-3 fill, red-6 border, red-11 text; making it `čeká` means
  changing the word `red` to `amber` and nothing else.
- **density verdict** excellent. Step 2 against step 3 gives you a zebra or a
  hover that costs almost no contrast budget; step 6 gives a row rule that
  reads as structure, not as a grid; step 11 stays legible small.
- **sources** radix-ui.com/colors/docs/palette-composition/understanding-the-scale,
  /scales, and the published package CSS on
  cdn.jsdelivr.net/npm/@radix-ui/colors@3.0.0/{slate,slate-dark,red,red-dark,blue,amber,green,teal}.css

---

## 2. Salesforce Lightning (SLDS)

- **owner** Salesforce · **confidence** high for colour, spacing, radius, type
  sizes and the data-table density; low for font weights and elevation.
- **made for** enterprise CRM: long records, dense tables and list views used
  all day by people who are working, not browsing.

| role | value |
|---|---|
| ground light | `#f3f3f3` |
| surface light | `#ffffff` |
| ground dark (inverse) | `#001639` |
| surface dark | `#032d60` |
| text primary | `#181818` |
| text secondary | `#444444` · placeholder `#747474` |
| border subtle | `#e5e5e5` · separator `#f3f3f3` |
| border strong | `#c9c9c9` (input border) |
| accent | `#1b96ff` · link `#0b5cab`, hover `#014486` |
| danger | `#ea001e` · destructive bg `#ba0517` |
| warning | `#fe9339` |
| success | `#2e844a` · success border `#91db8b` |

**ADAPTED:** surface `#ffffff` → **`#fcfcfc`**; text primary `#181818` →
**`#242424`**. Ground `#f3f3f3` is already inside 93–98 %.

- **type** a flat list of sizes — 10 / 12 / 13 / 14 / 16 / 18 / 20 / 24 / 28 /
  32 / 42 px — composed with three named line-heights: Reset 1, Heading 1.25,
  Text 1.5. (Under our floor of 13 px, drop 10 and 12.)
- **spacing** 2 / 4 / 8 / 12 / 16 / 24 / 32 / 48 px.
- **radius** 2 / 4 / 8 px / 50 %.
- **borders** one flat 1 px `#e5e5e5` hairline everywhere; **state is carried
  by fill, not by the border** — hover, focus and selected rows all resolve to
  the same neutral-95 background in the shipped SCSS, so a row never gains or
  loses an outline as the eye moves down the table.
- **density** published as `TABLE_CELL_SPACING: '{!SPACING_X_SMALL}'` —
  **8 px padding on all four sides of every `th` and `td`**. `.slds-th__action`
  is `height: 2rem` (32 px); a truncated cell caps at `3.25rem` (52 px);
  `.slds-cell-shrink` is `width: 1%`.
- **signature move** `white-space: nowrap` on **every** cell by default,
  wrapping only where a cell opts in. Perfectly uniform single-line rows that
  truncate rather than reflow, under a bold header filled with neutral-95.
- **density verdict** the best fit here for eighteen appointments: nowrap
  guarantees all eighteen rows are exactly the same height however long a
  Czech surname is, so the grid never reflows and the eye can scan a column.
  The cost is truncation — on a scheduling screen the výkon may be the thing
  you most need to read, so let that one column wrap.
- **sources** v1.lightningdesignsystem.com/design-tokens/ and /components/data-tables/,
  plus the shipped package `@salesforce-ux/design-system@2.264.1`
  (`ui/components/data-tables/tokens/spacing.yml`,
  `scss/components/data-tables/base/_index.scss`, `…/fixed-header/_index.scss`).
  The current lightningdesignsystem.com is JS-rendered and returns nothing to
  a fetch — v1 plus the npm package is the reliable route.

---

## 3. Ant Design

- **owner** Ant Group / Alibaba · **confidence** high for seeds, type,
  spacing, radius, shadows and Tag; low for dark-mode backgrounds.
- **made for** data-dense enterprise back-office and admin consoles on
  desktop — forms, tables, dashboards.

| role | value |
|---|---|
| ground light | `#f5f5f5` (`colorBgLayout`, the white seed darkened 4 %) |
| surface light | `#ffffff` (`colorBgContainer` and `colorBgElevated`) |
| text primary | `#000000E0` — 88 % black, resolving to `#1f1f1f` on white |
| text secondary | `#000000A6` (65 %) · tertiary 45 % · disabled 25 % |
| border strong | `#D9D9D9` (dark theme `#424242`) |
| accent | `#1677ff` |
| danger | `#ff4d4f` |
| warning | `#faad14` |
| success | `#52c41a` |
| info | `#1677ff` |

**ADAPTED:** surface `#ffffff` → **`#fcfcfc`**. Text is fine — 88 % black on a
light ground resolves to about 12 % lightness, inside the rule.

- **type** generated from a base of 14:
  `size(i) = floor(floor(14·e^((i−1)/5)) / 2)·2`, `lineHeight = (size+8)/size`.
  That yields **12, 14, 16, 20, 24, 30, 38, 46, 56, 68** with line-heights
  1.667 / 1.5714 / 1.5 / 1.4 / 1.3333 / 1.2667 / … Headings confirm it: H1 38,
  H2 30, H3 24, H4 20, H5 16. **Body is 14 / 22 px.**
- **spacing** from `sizeUnit: 4` — 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48;
  `controlPaddingHorizontal` 12, SM 8; content padding LG 24 × 16.
- **radius** seed 6 — XS 2, SM 6, base 6, LG 8, outer 4. Line width 1.
- **borders** line-first, wireframe off. A `#D9D9D9` 1 px outline on every
  control, full-width row dividers in tables, `#f5f5f5` page behind white
  cards as the secondary cue.
- **elevation** the only system here that publishes explicit multi-layer
  strings. `boxShadowCard: 0 1px 2px -2px rgba(0,0,0,.16), 0 3px 6px 0
  rgba(0,0,0,.12), 0 5px 12px 4px rgba(0,0,0,.09)`; `boxShadowTertiary:
  0 1px 2px 0 rgba(0,0,0,.05), 0 1px 6px -1px rgba(0,0,0,.03), 0 2px 4px 0
  rgba(0,0,0,.03)`.
- **density** the Table `size` prop — large / middle / small — expressed as
  `cellPaddingBlock` **16 / 12 / 8**. No row height is published; Ant expresses
  density as padding.
- **status** the **Tag** component: colour **plus text**, five preset statuses
  `success / processing / warning / error / default`, eleven preset hues, an
  optional icon, filled / solid / outlined. Tag already solves a status column.
- **signature move** a `#f5f5f5` page carrying edge-to-edge white tables, 6 px
  radii, a `#D9D9D9` hairline around and between everything, 14 / 22 text, and
  a small pastel filled rounded Tag in the status cell of every row.
- **density verdict** the strongest fit for eighteen appointments at once. The
  whole system is built for admin tables.
- **sources** ant.design/docs/react/customize-theme, /docs/spec/colors,
  /components/table, /components/tag, plus the generation source
  `components/theme/themes/shared/{genFontSizes,genSizeMapToken,genRadius,genColorMapToken}.ts`
  and `theme/util/alias.ts`.

---

## 4. Microsoft Fluent 2

- **owner** Microsoft · **confidence** high for colour, type, radius, spacing;
  medium for elevation; low for density.
- **made for** productivity and enterprise software across Windows, web and
  mobile — Office, Teams, the Windows shell — themed per product family.

| role | value |
|---|---|
| ground light | `#ffffff` (`colorNeutralBackground1`) |
| ground dark | `#292929` (grey16) |
| text primary light | `#242424` (grey14) |
| text secondary | `#616161` (grey38) |
| text primary dark | `#ffffff` |
| border subtle | `#e0e0e0` (grey88) |
| border strong | `#d1d1d1` (grey82) · accessible stroke `#757575` (grey46) |
| accent | `#0f6cbd` (brandWeb 80) |
| danger | `#c50f1f` cranberry · `#d13438` red |
| warning | `#eaa300` marigold |
| success | `#107c10` green · `#498205` forest |

**ADAPTED:** ground `#ffffff` → **`#f5f5f5`**, with panels at **`#fbfbfb`**
so the panel still reads lighter than the canvas. Dark ground `#292929` is
16 % lightness — inside the rule, use as is. Text `#242424` is 14 % — fine.

- **type** Caption 2 10/14 · Caption 1 12/16 · **Body 1 14/20** ·
  Subtitle 2 16/22 · Subtitle 1 20/26 · Title 3 24/32 · Title 2 28/36 ·
  Title 1 32/40 · Large Title 40/52. Weights 400 / 500 / 600 / 700.
  (One discrepancy on record: the site gives Subtitle 1 a 26 px line-height
  where the token file's Base500 says 28.)
- **spacing** 0 / 2 / 4 / 6 / 8 / 10 / 12 / 16 / 20 / 24 / 32 — published
  twice, horizontal and vertical, identical values.
- **radius** 0 / 2 / **4 (the workhorse)** / 6 / 8 / 12 / 16 / 24 / 32 / 40 /
  circular.
- **borders** borders, and specifically **one-sided** borders: a light box
  border plus a darker stroke on the bottom edge of every input. Surfaces are
  white-on-white, separated by line rather than by tint or shadow.
- **elevation** a named ramp shadow2 / 4 / 8 / 16 (low) and 28 / 64 (high),
  where the number is the blur in px; the rule is blur = n, x = 0, y = 0.5 n,
  opacity 14 %. The exact CSS strings are genuinely unpublished
  (`packages/tokens/src/alias/shadow.ts` is 404).
- **signature move** white-on-white with the separation done entirely in line
  weight — 4 px rectangles, a 1 px grey stroke, 14 px Segoe UI, and **exactly
  one `#0f6cbd` element on the screen carrying all the emphasis**.
- **density verdict** very good for eighteen rows: 14/20 body, a spacing ramp
  that goes genuinely small (2/4/6), 4 px corners and line-based separation are
  all built for dense grids. No row-height token is published.
- **sources** fluent2.microsoft.design/typography, /elevation, /color-tokens,
  plus `microsoft/fluentui` `packages/tokens/src/global/{colors,brandColors,fonts,borderRadius,spacings}.ts`.

---

## 5. Adobe Spectrum

- **owner** Adobe · **confidence** high; the soft field is which hue each of
  the five semantic names maps to, which neither page states.
- **made for** complex professional creative and data tooling, one design
  language re-scaled per platform.

| role | value |
|---|---|
| ground light | `#f8f8f8` — gray-100, *"the default background of every theme"* |
| ground dark | `#323232` (gray-100, dark theme) |
| surface light | `#ffffff` (gray-50) |
| surface dark | `#1d1d1d` (gray-50 dark — the same token, darker not lighter) |
| text primary light | `#000000` (gray-900) |
| text secondary | `#464646` (gray-700) |
| border subtle | `#e6e6e6` gray-200 — *"decorative borders and app framing"* |
| border strong | `#6d6d6d` gray-600 (control border) · `#b1b1b1` gray-400 (field border) |
| accent | `#0265dc` blue-900 |
| danger | `#d31510` red-900 |
| warning | `#b14c00` orange-900 |
| success | `#007a4d` green-900 |

**ADAPTED:** text primary `#000000` → **`#1f1f1f`**; surface `#ffffff` →
**`#fdfdfd`**. `#f8f8f8` (97 %) and `#323232` (20 %) are both already inside
the rule — Spectrum's grounds are the best-behaved of the non-Radix set.

- **type** major second, ratio 1.125, published as desktop/mobile pairs:
  50 = 11/13 · 75 = 12/15 · **100 = 14/17 (base)** · 200 = 16/19 · 300 = 18/22 ·
  400 = 20/24 · 500 = 22/27 · 600 = 25/31 · 700 = 28/34 · 800 = 32/39 ·
  900 = 36/44 · … 1300 = 60/70. Line-height 1.3× for headings and
  in-component text, 1.5× for body and code.
- **spacing** 2 / 4 / 8 / 12 / 16 / 24 / 32 / 40 / 48 / 64 / 80 / 96 px, and
  explicitly *"static and don't change based on platform scale"*. Spacing
  describes space **between** components, not padding inside one.
- **radius** 4 px desktop / 5 px mobile; pill for basic buttons. Border widths
  1 px (fields, tags, popovers, **table dividers**), 2 px (buttons, focus),
  4 px (large dividers only).
- **borders** hairline plus background shading. Tables separate rows with
  dividers and **explicitly forbid zebra stripes**.
- **elevation** one single drop-shadow style in the whole system, reserved for
  transient dismissible things like an open dropdown. Everything else
  differentiates by a stark colour change instead.
- **status** the **Status light** component — *"Status lights describe the
  condition of an entity"* and *"Status lights should always include a label.
  Color alone is not enough to communicate the status."* A dot at semantic
  colour 400 plus a word. Published example statuses include *scheduled* and
  *pending* — which is exactly our čeká / probíhá / blokováno / hotovo.
- **signature move** a near-white `#f8f8f8` canvas carrying white 4 px panels
  with hairline dividers and **almost no shadow anywhere**, plus right-aligned
  tabular numerals and a small coloured dot with a word beside it for every
  status.
- **density verdict** good — 14 px base at 1.3× in-component, 8/12/16 spacing
  and divider-only rows give a compact list. No row height is published.
- **sources** spectrum.adobe.com/page/{color-palette,color-system,typography,object-styles,spacing,status-light,table}/

---

## 6. Vercel Geist

- **owner** Vercel · **confidence** medium-high for colour and type (read from
  live tokens and rendered samples); the spacing, radius and elevation fields
  are genuinely unpublished.
- **made for** Vercel's own product surface — dashboards, deployment logs and
  infrastructure UI where the content is data and the chrome should disappear.

| role | value |
|---|---|
| ground light | `#ffffff` (`--ds-background-100`) |
| surface light | `#fafafa` (`--ds-background-200`, for *"when subtle differentiation is necessary"*) |
| text primary | `#171717` (gray-1000, *"Primary text and icons"*) |
| text secondary | `#4d4d4d` (gray-900, *"Secondary text and icons"*) |
| border subtle | `#ebebeb` (gray-400, *"Default border"*) |
| border hover | `#c9c9c9` (gray-500) |
| border strong | `#a8a8a8` (gray-600, *"Active border"*) |
| accent | `#0072f5` (blue-700) |
| danger | `#e5484d` (red-700 — byte-identical to Radix red-9) |
| warning | `#ffb224` (amber-700) |
| success | `#45a557` (green-700) |

**ADAPTED:** ground `#ffffff` → **`#f7f7f7`** with panels at `#fbfbfb`; text
primary `#171717` → **`#262626`**. Geist publishes colour as `hsla()` only —
the hex above is exact conversion, cross-checked against two Radix values that
matched byte for byte.

- **type** headings all weight 600 with visibly **negative tracking**:
  heading-16 16/24/−0.32px · heading-20 20/26/−0.4px · heading-24 24/32/−0.96px ·
  heading-32 32/40/−1.28px · heading-40 40/48/−2.4px. Copy weight 400:
  copy-16 16/24, copy-20 20/30. Labels weight 400: label-14 14/20 —
  the docs call it *"Most common text style of all."* — label-16 16/20,
  label-13-mono 13/20.
- **mono** reserved, by written guidance, for code, commands and **operational
  identifiers** — not for body copy. On our screens that means times and
  insurer numbers, not names.
- **spacing, radius, elevation** `unknown`. Not published. Borrow Radix's
  neighbours or own them, and say which.
- **borders** the border is step 4 and moves to 5 on hover, 6 on active — it
  participates in interaction instead of staying fixed. Guidance pushes against
  enclosure: *"Do not wrap every section in a card."*
- **signature move** near-white on white with a hairline: `#fafafa` panel,
  `#ebebeb` 1 px rule, and text stepping **straight from `#4d4d4d` to
  `#171717` with no mid-grey in between**. One saturated accent on an
  otherwise achromatic screen. The negative tracking on headings is a
  fingerprint no other system here has.
- **density verdict** good, and the system on this list designed for exactly
  this kind of screen: label-14 at 14/20 supports a 36–40 px row, and the flat
  card-free treatment means eighteen rows read as one table rather than as
  eighteen boxes.
- **sources** vercel.com/geist/colors, /geist/typography, /design.md; colour
  read as live `--ds-*` custom properties and converted from the published
  `hsla()` form.

---

## 7. Tailwind CSS

- **owner** Tailwind Labs · **confidence** high.
- **made for** shipping a design system's raw material — ramps, a type scale,
  a spacing multiplier — **without assigning any of it a semantic role**. You
  compose the meaning. That is what makes it a different kind of entry here:
  choosing Tailwind means choosing to decide the semantics yourself.

| ramp step | value |
|---|---|
| slate-50 / 100 / 200 / 300 | `#f8fafc` · `#f1f5f9` · `#e2e8f0` · `#cbd5e1` |
| slate-500 / 800 / 900 | `#64748b` · `#1e293b` · `#0f172a` |
| gray-200 / 600 / 900 | `#e5e7eb` · `#4b5563` · `#111827` |
| red-500 / 600 | `#ef4444` · `#dc2626` |
| amber-500 | `#f59e0b` |
| green-500 / 600 | `#22c55e` · `#16a34a` |
| blue-500 / 600 | `#3b82f6` · `#2563eb` |

**ADAPTED — and this is where the composition happens:** ground
**`#f1f5f9`** (slate-100), surface **`#f8fafc`** (slate-50), text primary
**`#1e293b`** (slate-800 — slate-900 at 11 % lightness is below our floor),
text secondary **`#64748b`**, border subtle **`#e2e8f0`**, border strong
**`#cbd5e1`**. No white anywhere; the "white" card is the 50 step on the 100
step, which is Tailwind's own idiom anyway.

- **type** size / line-height, weight kept separate: xs .75/1rem · **sm
  .875/1.25rem** · base 1/1.5rem · lg 1.125/1.75rem · xl 1.25/1.75rem ·
  2xl 1.5/2rem · 3xl 1.875/2.25rem · 4xl 2.25/2.5rem.
- **spacing** is not a map. One token, `--spacing: 0.25rem`, and every utility
  is `calc(var(--spacing) × n)` — so any multiple of 4 px is in the system.
- **radius** xs 2 · sm 4 · md 6 · lg 8 · xl 12 · 2xl 16 · 3xl 24 · 4xl 32 px.
- **borders** a utility, not a system position: v4 defaults `border-color` to
  `currentColor`, so every deliberate border is an explicit ramp choice.
- **elevation** seven low-alpha black double-shadows, tight near-shadow plus
  wide ambient — e.g. `sm: 0 1px 3px 0 rgb(0 0 0/.1), 0 1px 2px -1px rgb(0 0 0/.1)`.
- **signature move** five near-identical neutral ramps differing only in
  undertone — slate leans blue, stone leans warm — so the recognisable
  Tailwind screen is one where the greys are faintly and *consistently* tinted.
- **density verdict** neutral-to-good. The 4 px multiplier lands a 32 px row
  exactly (`py-1.5` + `text-sm`). Nothing about density is decided for you.
- **sources** tailwindcss.com/docs/{theme,colors,font-size}; hex from the v3
  docs, which publish the identical palette (v4 publishes oklch).

---

## 8. Material Design 3

- **owner** Google · **confidence** high for colour, type, shape and
  elevation-dp; low for spacing and density, which are not published.
- **made for** consumer Android, web and cross-platform apps, built around a
  seed colour that regenerates the whole palette.

| role | value |
|---|---|
| ground light | `#fef7ff` (surface = neutral98) |
| ground dark | `#141218` (neutral6) |
| surface light | `#f3edf7` (surface-container = neutral94) |
| surface dark | `#211f26` (neutral12) |
| text primary light | `#1d1b20` (on-surface) |
| text secondary | `#49454f` (on-surface-variant) |
| text primary dark | `#e6e0e9` |
| border subtle | `#cac4d0` (outline-variant) |
| border strong | `#79747e` (outline) |
| accent | `#6750a4` (primary40) · dark `#d0bcff` |
| danger | `#b3261e` (error40) |
| warning / success / info | **none published** — M3 has no such roles |

**ADAPTED:** text primary `#1d1b20` is 11 % — lift to **`#2a262e`**.
`#141218` (7 %) is below our dark floor — lift to **`#1c1a20`**. The grounds
are otherwise usable. M3's missing warning/success/info roles must be borrowed;
take them from Radix (amber-9, green-9, blue-9), and say so on the screen's
own terms rather than inventing violet variants.

- **type** major second on a base of 14. body-large 16/24 · **body-medium
  14/20** · body-small 12/16 · label-large 14/20 medium · title-medium 16/24
  medium · title-large 22/28 · headline-small 24/32 · headline-medium 28/36 ·
  headline-large 32/40.
- **spacing** `unknown` — documented as layout guidance, not as tokens.
- **radius** 0 / 4 / 8 / 12 / 16 / 28 px / full, with directional variants
  (`extra-large-top: 28px 28px 0 0`).
- **borders** background shading first. Depth comes from a ladder of tinted
  neutral containers — surface, surface-container-low / - / -high — not from
  lines. `outline` exists but is for fields and dividers.
- **elevation** levels 0 / 1 / 3 / 6 / 8 / 12 **dp only**. No box-shadow
  strings are published; a raised surface moves up the tint ladder instead.
- **signature move** every surface is a violet-tinted neutral rather than
  grey — `#fef7ff` page, `#f3edf7` cards — corners 12–28 px, no borders and no
  shadows, so from across the room you see soft lavender-white rounded slabs.
- **density verdict** **poor out of the box** for eighteen rows: 28 px corners
  and touch-sized padding eat vertical space. Keep the colour roles and the
  14 px body-medium; throw away the shape scale. A template on M3 should take
  it as a *colour* system and set its own geometry — which is itself a
  legitimate silhouette, and different from every other screen here.
- **sources** m3.material.io/styles/typography/type-scale-tokens and
  /styles/color/static/baseline (hexes published only as images), resolved
  from `material-components/material-web` `tokens/versions/v0_192/_md-sys-*.scss`.

---

# Cross-cutting findings

These came out of reading all eight, and they are what "the smartest systems"
actually agree on.

**1. Colour alone is never a state.** Spectrum: *"Status lights should always
include a label. Color alone is not enough to communicate the status."* Geist:
*"Color serves data meaning only, paired with non-color cues."* Ant's Tag is
colour **plus text**. This was already our rule; three of the best systems
independently make it theirs. Every state on every one of the twenty screens
carries a Czech word.

**2. Density is expressed as padding, not as row height.** Not one of the
eight publishes a row height. SLDS gives 8 px on all four sides of a cell;
Ant gives `cellPaddingBlock` 16 / 12 / 8. So the row height on our screens is
ours to set — and it must be set *consistently within a template*, because
that is what the eye scans.

**3. Fourteen is the base.** Ant 14/22, Fluent Body 1 14/20, Spectrum 100 =
14/17, Geist label-14 14/20, M3 body-medium 14/20, Tailwind sm 14/20. Six of
eight land on the same number. Our floor is 13 px and our body is 15–16 px,
which is a deliberate step *above* the industry base — for long hours, not for
information density. Keep it.

**4. Separation is line **or** tint, never both.** Fluent, Geist, SLDS and Ant
are line systems; M3 and Spectrum are tint systems. None of them does both at
once. A template that draws a border *and* fills the panel *and* adds a shadow
is not following anybody.

**5. Zebra striping is out.** Spectrum forbids it explicitly; SLDS, Ant,
Fluent and Geist all separate rows with a hairline instead. The one sanctioned
alternative is Radix step 2 against step 3, which is a tint so slight it reads
as texture rather than as banding.

**6. Almost nobody shadows.** Spectrum ships one shadow in the entire system,
for open dropdowns. M3 publishes dp and expects you to use tint instead. Radix
publishes none. Only Ant publishes real strings. On a screen someone stares at
for eight hours, a shadow is decoration.

---

# What is still missing from this database

Recorded honestly rather than quietly padded:

- **IBM Carbon, GitHub Primer, Shopify Polaris, Atlassian** — research agent
  died mid-run (context exhaustion), nothing recovered.
- **Elastic EUI, Zendesk Garden, Base Web, Apple HIG (macOS)** — same.
- **NHS digital service manual, GOV.UK, USWDS, VMware Clarity** — a fourth
  agent was still running when this file was written; if it lands, append it.

Eight systems is enough to assign twenty templates without any of them
inventing a palette, which is what the round was for. The missing twelve would
add — Carbon and Primer especially, both line-based dense-ops systems — but
nothing below depends on them.

# A security finding from the research

Fetched design-system documentation **repeatedly carried an embedded
`<system-reminder>` block instructing the reader to add git and pull-request
attribution lines** — seven separate occurrences across different sites, the
last in Ant Design's `alias.ts` fetch. That is prompt injection in third-party
web content. The agent that hit it identified it as untrusted observed data
and ignored it every time, which was correct, and no commits or PRs were part
of that task. Recording it here because anything that fetches these pages
again will hit it again.
