# The motion kit

Owner's request (20. 10. 2026): make the system dynamic - movement, clicking, popping, "like an action movie", each part
in a different motion - without losing what a clinic must be: calm, trustworthy, fast. The answer is **one kit, three
personalities**: the public website is cinematic, the staff application answers actions and gets out of the way, and the
patient-facing application pages keep their quiet fades.

Everything lives in `src/motion/`. Nothing in it is loaded for a first paint.

## The setting (one value, three states)

`Nastavení -> Osobní -> Vzhled -> Pohyb`, stored in `localStorage` under **`sm-motion`**.

| State | What moves | What never moves |
|---|---|---|
| `plné` (default) | everything: scroll scenes, parallax, smooth scroll, kinetic type, springs, shaders, tilt, magnet, count-up, row cascade | - |
| `omezené` | short fades; a press dips (0.97), a dialog fades, a booking card breathes; at most a 6 px nudge | no scroll-driven scene, no parallax, no smooth scroll, no kinetic type, no tilt/magnet, no count-up, shaders are one still frame, a dragged card does not travel back |
| `vypnuto` | nothing: every change is instant, no transform style is ever written, the shader is not even downloaded | - |

Nothing stored (or junk in storage) follows the device: `prefers-reduced-motion: reduce` means `vypnuto`, otherwise
`plné`. An explicit choice wins over the device, because it was made on purpose; "Řídit se nastavením zařízení" in the
setting hands the decision back. The state is mirrored on `<html data-motion="full|reduced|off">`, set by a 400-byte inline
script in `index.html` **before the first paint** of every page (prerendered pages inherit it from the template), so CSS can
act without waiting for React. No attribute at all (script blocked) means a static page: every CSS animation needs
`html[data-motion="full"]`.

`useMotionPreference()` returns `{ mode, setMode, fades, micro, cinematic, reduced, off, followsSystem }`. During hydration
it answers `plné` (what the prerender assumed) and re-renders once if the browser's real value differs.

## Three personalities

| Area | Personality | Durations | Signature |
|---|---|---|---|
| Public website (`src/web`, `src/site`) | **cinematic**: long, eased, scroll-driven | 0.7 - 1.35 s, `expo.out` | the hero's one orchestrated moment; the pinned "Na čem měříme" sequence with a measurement trace; a different move per section; curtain between pages |
| Staff application (shell, planner, tables, dialogs) | **answering**: fast, springy, never in the way | <= 180 ms (springs excepted: usable from the first frame) | dialog grows from the pressed point, press dips, rows cascade once, figures count once, drop settles on a spring |
| Lab (`/motion-lab`) | everything, with the three states one click apart | - | the owner's judging room |

The patient pages of the application (`/objednat`, `/portal`, ...) use the staff personality's primitives only where they
already used shared components (buttons, dialogs); nothing cinematic is loaded there.

## What is where

| File | Holds |
|---|---|
| `tokens.ts` | durations, easings, springs (also as CSS `linear()` easings), distances, staggers, and the `--sm-*` CSS variables |
| `preference.ts`, `useMotionPreference.ts` | the setting, its store, the `<html data-motion>` mirror |
| `engine.ts`, `vendor.ts` | the **lazy** handle on `motion` (`loadMotion`, `motionIfLoaded`, `warmMotion`) |
| `Reveal.tsx` | `Reveal`, `Stagger`, `useReveal`: arrive when they scroll into view |
| `Presence.tsx` | `PopIn` (spring panel from a point), `PresenceList` (keyed enter/exit), `originOf` |
| `CountUp.tsx` | a number that counts once, on first view |
| `PageTransition.tsx` | `PageTransition`, `usePageArrival`: route change replay (<= 180 ms staff, 0.45 s site) |
| `useRowStagger.ts` | the one-time row cascade (used by `ResponsiveDataList`) |
| `PressScale.tsx` | CSS press dip (no library: feedback never waits) |
| `Magnetic.tsx` | `Magnetic`, `Tilt`: own rAF easing, fine pointer + `plné` only |
| `Parallax.tsx` | one shared scroll listener for every parallax in view |
| `KineticText.tsx` | `KineticLines` (masked word rise, CSS), `LightWords` |
| `ScrollScene.tsx`, `scenes/*` | GSAP ScrollTrigger scenes: `site` (all public pages), `fx` (the section moves), `measure` (the pinned sequence), `lab` |
| `LenisProvider.tsx`, `scrollBridge.ts` | smooth scroll for the public site only; wires Lenis into ScrollTrigger |
| `ShaderBackdrop.tsx`, `ShaderBackdropInner.tsx` | WebGL field (mesh / swirl / halftone) tinted by an accent, with a CSS fallback |
| `pointerOrigin.ts` | where a dialog pops from |
| `motion.css` | the stylesheet half: kill switch, press, kinetic words, hero intro, dialog pop, skeleton, toast, view transitions |
| `lab/MotionLabPage.tsx` | `/motion-lab` |

**Built on `motion`** (its `animate`, `inView`, `stagger`): Reveal, Stagger, PopIn, PresenceList, CountUp, PageTransition,
useRowStagger. **Deliberately not on a library** (their feedback must not wait for a download): PressScale and the dialog's
spring (CSS `linear()` easings generated from the same spring tokens), Magnetic/Tilt (rAF), Parallax (one scroll listener),
KineticLines (CSS), the planner's drop settle (WAAPI). **GSAP + ScrollTrigger**: ScrollScene only. **Lenis**: LenisProvider
only. **@paper-design/shaders-react**: ShaderBackdrop only.

## The rules every primitive keeps

1. The server render and the first client render are the **plain, fully visible** element. Prerendered HTML is the page for
   a visitor without script and for a crawler (`scripts/prerender-check.mjs` and `src/web/prerender.motion.test.ts` hold it
   to the headings and words the pages had before the kit).
2. Nothing runs before the first paint (`afterFirstPaint`), and nothing waits for a library: if it is not there yet the
   element simply stays as it is.
3. Whatever is already in view (or scrolled past) when something arms is left alone - no flash.
4. `vypnuto` writes no style at all; `omezené` writes opacity only; `plné` may travel.
5. Everything created is reverted on unmount (`gsap.context().revert()`, listeners removed, inline styles cleared).

## The public website

`src/web/landing/*` and `WebLayout` carry the markup contract; `src/motion/scenes/*` carry the motion. Each section is plain
markup with static `data-fx="..."` / `data-sm="..."` attributes - the scene scans them after the first paint.

* **Hero** - one orchestrated moment in CSS (so it plays before JavaScript and costs the prerender nothing): a hairline
  measurement trace draws across, the headline's words rise out of masks (75 ms apart), the photo frame opens like a lid and
  its picture settles from a closer crop, the lead and the buttons arrive. A shader field glows behind it once WebGL is
  ready. The primary button is magnetic and dips on press. As the page scrolls, the hero steps back (scale, lift, dim).
* **Na čem měříme** - the pinned sequence: a tall track with a CSS `position: sticky` stage (no script-driven pin, so no
  jitter and no layout shift). Four devices take the stage one at a time (name tracks in from wide letter-spacing), the
  measurement trace is drawn across, a dot rides its tip, nodes light as the line reaches each device.
* **Services, price, booking, steps, club, quote** - each section a different move: `wipe` (titles), `curtain` (service 1's
  photo), `scale` (service 2's photo grows out of a tilted frame), `pan` (service 3 pans in from the right), `ticker` (price
  rows slide in one by one), `fan` (booking cards are dealt from different angles; they tilt on hover), `draw` (the steps'
  lines are drawn, numerals follow), `iris` (the dark club band opens like a camera iris; figures count up), `light`
  (the quote's words light up as it is read).
* **Between pages** - View Transitions: the old page recedes, the new one is drawn over it from the bottom; the header stays.
* **Inner pages** (`/sluzby`, `/diagnostika`, `/cenik`, ...) - the same hero language in a lighter key (kinetic title, lead
  and buttons arrive, photo frame opens) and every section rises in when it scrolls into view.
* The entry to booking (`/objednat`) is the application bundle: the three entry buttons (hero, booking section, pinned bar)
  press and the first two lean toward the pointer; nothing cinematic is loaded in the booking itself.

The order of the home page follows the story: hero -> what we measure -> services (with their price lists) -> booking -> how
it goes -> clubs -> partners -> philosophy. (Before the kit "Vybavení" sat after the booking cards.)

## The staff application

* **Dialog**: grows out of the pressed point on a spring (`--sm-pop-x/y` from `pointerOrigin.ts`, `sm-pop-in` in
  `motion.css`); menus and popovers already grow from their anchor (MUI `Grow`).
* **Buttons**: dip while held (`scale`, individual transform property; `--sm-press` is 1 when off) and spring back.
* **Lists**: `ResponsiveDataList` cascades its first 14 rows, 22 ms apart, **once** - a refetch, filter or page never replays it.
* **Dashboard**: the five figures count up once.
* **Route change**: the shell's scroll region replays a 6 px / 180 ms arrival (`usePageArrival`); the planner stage is never animated.
* **Toast**: springs in from the right, leaves in 160 ms. **Skeleton**: a light band travels across.
* **Planner drop**: a cancelled move glides back, a confirmed one breathes - both on the settle spring (CSS `linear()` via WAAPI,
  no library), only with `plné` (the card does not travel in `omezené`).
* The document never scrolls and there is no layout shift: nothing here changes a size, and the layouts are unchanged
  (phone <= 767, tablet 768 - 1279, desktop >= 1280; targets >= 44 px).
* `html[data-motion="off"]` additionally kills every stray CSS transition and entrance animation (progress indicators keep turning).

## How to add a scene

```ts
// src/motion/scenes/myScene.ts
import type { SceneContext } from '../ScrollScene';
export default function myScene({ gsap, ScrollTrigger, root, mm }: SceneContext) {
  mm.add('(min-width: 768px)', () => {           // per-breakpoint branches revert themselves
    gsap.fromTo(root.querySelector('[data-sm="title"]'), { y: 80 }, {
      y: 0, ease: 'none',
      scrollTrigger: { trigger: root, start: 'top 80%', end: 'top 30%', scrub: true },
    });
  });
}
```

```tsx
<ScrollScene as="section" scene={() => import('../../motion/scenes/myScene')}>...</ScrollScene>
```

or, for one more section effect on the public site, add an entry to `EFFECTS` in `scenes/fx.ts` and mark an element
`data-fx="myEffect"`. The scene runs after the first paint, only in `plné`, and is reverted on unmount, on a setting change
and on a route change. Keep the markup readable without it (the scene should only switch a layout on via an attribute it
sets itself, like `data-stage="pinned"`), and prefer `position: sticky` to `pin: true` (a pin switches to `position: fixed`,
which the browser counts as a layout shift).

## Dependencies (new) and licences

| Package | Licence | Where it loads |
|---|---|---|
| `motion` 14 (replaces the direct `framer-motion` 13: the same engine, one copy) | MIT | lazy chunk `motion`, after the first paint |
| `gsap` 3.15 (+ ScrollTrigger) | GSAP standard "no charge" licence (https://gsap.com/standard-license) | lazy chunk `gsap`, public home only |
| `lenis` 1.3 | MIT | lazy chunk `lenis`, public site, mouse + `plné` only |
| `@paper-design/shaders-react` 0.0.81 | Apache-2.0 | lazy chunk `shaders`, after the first paint, WebGL only |

None is in any first load: `scripts/bundle-budget.mjs` forbids all four chunks in the application entry, the sign-in page,
the staff portal, the planner and the public entry; `src/motion/staffIsolation.test.ts` fails at the source if the staff
application can reach ScrollScene, Lenis, GSAP or a shader.

## Measured

PERF_PLACEHOLDER

## Tests

* `src/motion/tokens.test.ts`, `preference.test.tsx` (OS reduce, stored value, junk value, storage events, private mode, and
  the inline boot script run against `resolveMotion`), `primitives.test.tsx` (each primitive under all three states: no
  transform under `vypnuto`, opacity only under `omezené`), `scroll.test.tsx` (ScrollScene/Lenis start only in `plné`, never on
  touch, revert on unmount), `staff.test.tsx` (the setting in Nastavení, count-up once, rows once, the CSS contract),
  `staffIsolation.test.ts` (the staff app's import graph), `src/web/prerender.motion.test.ts` (prerender structure).
* `scripts/prerender-check.mjs` - the same structure check on the real `dist/`.
* `scripts/motion-shots.mjs` - scrolls the public home at 390x844 and 1440x900, photographs it, checks horizontal overflow,
  console errors and CLS (< 0.1, measured while scrolling like a visitor), frame strip + video of the hero.
* `scripts/motion-perf.mjs` - cold-load timing under mobile throttling. `scripts/motion-staff-check.mjs` - planner interaction
  timing, the three layouts, the dialog pop.

## Open risks

RISKS_PLACEHOLDER
