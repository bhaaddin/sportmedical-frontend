# SportMedical Constitution

The working rules of the SportMedical clinic platform. They come from the owner's own instructions and from mistakes already made. Every spec, plan and task is checked against them. This file covers the frontend (React 19, Vite, MUI); the backend repository carries the same principles with its own technical section.

## Core Principles

### I. Everything is set in the admin, nothing is hard-coded
Prices, discounts, opening hours, breaks, texts, colours, limits and company data live in Nastavení or in seed data files, never in code. A value the clinic could want to change is a setting. A test fails if a price, the clinic's phone, IČO or an address appears in the source.

### II. The desk is manual first
The desk decides; the system informs and never decides silently. No automatic suggestions, no hidden trimming or filling. What the manager marks in the calendar is booked exactly as marked. A one-tap shortcut is allowed only when its effect is shown before and after, and it takes only what is still needed, leaving the rest of the day free for normal patients. If a feature is something the desk would not use once, it does not ship.

### III. One order is one thing
A club order is one object everywhere: calendar, club page, order detail, club portal, invoice. Several dates are windows of the same order, never several orders. Adding a different service is an addendum linked to the same order and invoice. Changing players or dates is done from the order, in one call. Nothing is deleted when it can be archived; permanent delete only when nothing references the item.

### IV. What is booked must be visible
Every booking, club window and pending request is drawn on its day on phone, tablet and desktop, in day, week and month views. A day that is held reads as held, never as "no reservations". Everything the desk changes is visible to the club in its portal.

### V. Privacy and security by default
Birth numbers and insurance numbers never reach a log line or an error message. Public links are random, long, stored as hashes, rate limited, never indexed and never logged. A player's phone, e-mail, parent and birth data never appear on a club's page. Every change to identifying data carries an author and a reason.

### VI. Czech, short, on three layouts
All interface text is Czech, written for the person using it, and editable where it is wording the clinic owns. Every screen works on a phone (up to 767 px), a tablet (768 to 1279 px) and a desktop (from 1280 px), with touch targets of at least 44 px and no horizontal scroll. Tests run each layout.

### VII. Verified before it is called done
A change is done when typecheck is clean, the tests pass, and the behaviour was seen in the real browser on the dev stack. Say plainly what was not verified. Never leave a mock in the shared browser. A failing test is fixed or explained, never skipped.

## Constraints

- Stack: React 19, Vite, MUI v9, react-query, zod, vitest. Commands: `npm run typecheck` (never `tsc -p tsconfig.json`), `NODE_OPTIONS=--max-old-space-size=4096 npx vitest run`.
- The public site is served at the root; staff screens sit behind the sign-in. A staff path and a public path never collide.
- GitHub work happens only under `bhaaddin` (`sportmedical-frontend`, `sportmedical-api`). Verify owner, remote and branch before every push.
- Production deployment, production secrets and the Render plan belong to the owner. Prepare and test them; do not decide them.

## Development Workflow

- Specify, plan, tasks, implement, converge for features; assess, fix, test for bugs, with a recorded verdict.
- Decide routine choices and record each decision with its reason. Ask only for a decision that is truly the owner's, and ask once, with a recommended default.
- Work continuously and report once at the end: what was delivered, what was verified, what is blocked and what exact input is needed.
- Keep context small: search before reading, read files in ranges, send long output to a log.
- Commit in logical steps. Never rewrite shared history. Never skip hooks.

## Governance

This constitution outranks other practices. A change to it needs the owner's word and a version bump. Plans that conflict with a principle must state which and why, and the owner decides.

**Version**: 1.0.0 | **Ratified**: 2026-10-06 | **Last Amended**: 2026-10-06
