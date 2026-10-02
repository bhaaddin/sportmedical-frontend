# PICK — feedback & sharpened brief (from Matko, 2026-10-01)

**This supersedes any earlier design proposal that was rejected.** Relayed via the
Booking 2 session because the live cross-session message to Frontend 2 expired
before approval. Frontend 2 (or whoever drives the design): start here.

## What was wrong with the last proposal
Matko rejected it. In his words it "looks like trash." The reason: it read as a
plan about **colours**. That is not the task.

> "I talked about the layout, not the colours."

## Hard constraint — colours do NOT change
Keep the existing system colours **exactly** — `src/theme.ts` accents + the
`src/utils/calendarPalette.ts` chips. Do **not** restyle, re-tint, recolour, or
propose a palette. If a proposal changes any colour, it is out of scope. (This is
the same rule as PICK.md §2; it was not followed.)

## The actual task — LAYOUT and FUNCTION
How each screen is **arranged**: hierarchy, density, what sits where, what gets
promoted, what gets removed, and how the functions inside each section are laid
out. Purposeful motion is allowed (must explain a state change, never decorate;
`prefers-reduced-motion` must still work).

## Deliverable Matko asked for, concretely
1. From the 20 directions (`d01.html`–`d20.html`; `ROSTER.md` is the fixed sample
   day; `STYLES.md` has the structure rules), **pick the best ~5 layouts**.
2. Build **~5 standalone, viewable HTML files** — "different waves of the web" —
   so he can open them side by side and choose. Colours stay the system's.
3. Do it **per section** (calendar/day grid, patient file, settings, booking,
   etc.) — show how each section should be arranged inside, not just one screen.

Keep it a design deliverable (HTML previews). Don't touch `src/` until a direction
is chosen.
