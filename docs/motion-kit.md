# The motion kit

Owner's request (20. 10. 2026): make the system dynamic - movement, clicking, popping, "like an action movie", each part
in a different motion - without losing what a clinic must be: calm, trustworthy, fast. The answer is **one kit, three
personalities**: the public website is cinematic, the staff application answers actions and gets out of the way, and the
patient-facing application pages keep their quiet fades.

Everything lives in `src/motion/`. Nothing in it is loaded for a first paint. Branch `motion/kit`, not pushed, not merged.

## The setting (one value, three states)

`Nastavení -> Osobní -> Vzhled -> Pohyb` (under the colour swatches and the light/dark switch), stored in `localStorage`
under **`sm-motion`**.

| State | What moves | What never moves |
|---|---|---|
| `plné` (default) | everything: scroll scenes, parallax, smooth scroll, kinetic type, springs, shaders, tilt, magnet, count-up, row cascade, page curtain | - |
| `omezené` | short fades; a press dips (0.97), a dialog fades, a booking card breathes; at most a 6 px nudge | no scroll-driven scene, no parallax, no smooth scroll, no kinetic type, no tilt/magnet, no count-up, no view transition, shaders are one still frame, a dragged card does not travel back |
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
| Public website (`src/web`, `src/site`) | **cinematic**: long, eased, scroll-driven | 0.7 - 1.35 s, expo-out | the hero's one orchestrated moment; the pinned "Na čem měříme" sequence with a measurement trace; a different move per section; a curtain between pages |
| Staff application (shell, planner, tables, dialogs) | **answering**: fast, springy, never in the way | <= 180 ms (springs excepted: the control is usable from the first frame) | dialog grows from the pressed point, press dips, rows cascade once, figures count once, drop settles on a spring |
| Lab (`/motion-lab`) | everything, with the three states one click apart | - | the owner's judging room |

The patient pages of the application (`/objednat`, `/portal`, ...) use the staff personality only where they already used
shared components (buttons, dialogs); nothing cinematic is loaded there.

## What is where

| File | Holds |
|---|---|
| `tokens.ts` | durations, easings, springs (as CSS `linear()` strings and as easing functions), distances, staggers, the `--sm-*` CSS variables |
| `preference.ts`, `useMotionPreference.ts` | the setting, its store, the `<html data-motion>` mirror |
| `engine.ts`, `vendor.ts`, `idle.ts` | the **lazy** handle on `motion` (`loadMotion`, `motionIfLoaded`, `warmMotion`) and the staging of the heavy libraries |
| `Reveal.tsx` | `Reveal`, `Stagger`, `useReveal`: arrive when they scroll into view |
| `Presence.tsx` | `PopIn` (spring panel from a point), `PresenceList` (keyed enter/exit), `originOf` |
| `CountUp.tsx` | a number that counts once, on first view (own rAF easing) |
| `PageTransition.tsx` | `PageTransition`, `usePageArrival`: route change replay (<= 180 ms staff, 0.45 s site) |
| `useRowStagger.ts` | the one-time row cascade (used by `ResponsiveDataList`) |
| `PressScale.tsx` | CSS press dip (no library: feedback never waits) |
| `Magnetic.tsx` | `Magnetic`, `Tilt`: own rAF easing, fine pointer + `plné` only |
| `Parallax.tsx` | one shared scroll listener for every parallax in view |
| `KineticText.tsx` | `KineticLines` (words come into focus, CSS), `LightWords` |
| `ScrollScene.tsx`, `scenes/*` | GSAP ScrollTrigger scenes: `site` (all public pages), `fx` (the section moves), `measure` (the pinned sequence), `lab` |
| `LenisProvider.tsx`, `scrollBridge.ts` | smooth scroll for the public site only; wires Lenis into ScrollTrigger |
| `ShaderBackdrop.tsx`, `ShaderBackdropInner.tsx` | WebGL field (mesh / swirl / halftone) tinted by an accent, with a CSS fallback |
| `pointerOrigin.ts` | where a dialog pops from |
| `motion.css` | the stylesheet half: kill switch, press, kinetic words, hero intro, dialog pop, banner, skeleton, toast, view transitions, Lenis rules |
| `lab/MotionLabPage.tsx` | `/motion-lab` (route registered only on localhost, `lab/labHost.ts`) |

**Built on `motion`** (its `animate` from `motion/mini` = the Web Animations API, plus `inView` and `stagger`): Reveal, Stagger,
PopIn, PresenceList, PageTransition, useRowStagger. **Deliberately not on a library** (their feedback must not wait for a
download): PressScale and the dialog's spring (CSS `linear()` easings generated from the same spring tokens), Magnetic/Tilt
(rAF), Parallax (one scroll listener), KineticLines (CSS), CountUp (rAF), the offline strip, the planner's drop settle (WAAPI).
**GSAP + ScrollTrigger**: ScrollScene only. **Lenis**: LenisProvider only. **@paper-design/shaders-react**: ShaderBackdrop only.

## The rules every primitive keeps

1. The server render and the first client render are the **plain, fully visible** element. Prerendered HTML is the page for
   a visitor without script and for a crawler (`scripts/prerender-check.mjs` and `src/web/prerender.motion.test.ts` hold it
   to the headings and words the pages had before the kit).
2. Nothing runs before the first paint (`afterFirstPaint`), and nothing waits for a library: if it is not there yet the
   element simply stays as it is. The heavy libraries are staged (`idle.ts`): animation library right after the first paint,
   scenes +0.6 s, Lenis +1.2 s, shaders +1.5 s - never parsed in the same task.
3. Whatever is already in view (or scrolled past) when something arms is left alone - no flash.
4. `vypnuto` writes no style at all; `omezené` writes opacity only; `plné` may travel.
5. Everything created is reverted on unmount (`gsap.context().revert()`, listeners removed, inline styles cleared).
6. Nothing hides a large element completely at the start (a fully transparent or clipped element is not "painted" for LCP
   until it has been uncovered): headlines come into focus (blur + 0.22 opacity), the lead fades from 0.2, the photo frame
   grows from 7 % smaller.

## The public website

`src/web/landing/*` and `WebLayout` carry the markup contract; `src/motion/scenes/*` carry the motion. Each section is plain
markup with static `data-fx="..."` / `data-sm="..."` attributes - the scene scans them after the first paint.

* **Hero** - one orchestrated moment in CSS (so it plays before JavaScript and costs the prerender nothing): a hairline
  measurement trace draws across, the headline's words come into focus one after another (70 ms apart), the photo frame grows
  to size and its picture settles from a closer crop, the lead and the buttons arrive. A shader field glows behind it once
  WebGL is ready. The primary button is magnetic and dips on press. As the page scrolls, the hero steps back (scale, lift, dim).
* **Na čem měříme** - the pinned sequence: a tall track with a CSS `position: sticky` stage (no script-driven pin, so no
  jitter and no layout shift). Four devices take the stage one at a time (the name tracks in from wide letter-spacing), the
  measurement trace is drawn across, a dot rides its tip, nodes light as the line reaches each device. On a phone the stage
  stops above the pinned booking bar.
* **Services, price, booking, steps, club, quote** - each section a different move: `wipe` (titles), `curtain` (service 1's
  photo), `scale` (service 2's photo grows out of a tilted frame), `pan` (service 3 pans in from the right), `ticker` (price
  rows slide in one by one), `fan` (booking cards are dealt from different angles; they tilt on hover), `draw` (the steps'
  lines are drawn, numerals follow), `iris` (the dark club band opens like a camera iris on wide screens; figures count up),
  `light` (the quote's words light up as it is read).
* **Between pages** - View Transitions: the old page recedes, the new one is drawn over it from the bottom; the header
  stays. (`SiteLink` starts `document.startViewTransition` itself: React Router's `viewTransition` prop is for data routers
  only and this site is a declarative `BrowserRouter`.)
* **Inner pages** (`/sluzby`, `/diagnostika`, `/cenik`, ...) - the same hero language in a lighter key (kinetic title, lead
  and buttons arrive, photo frame grows) and every section rises in when it scrolls into view.
* The entry to booking (`/objednat`) is the application bundle: the three entry buttons (hero, booking section, pinned bar)
  press and the first two lean toward the pointer; nothing cinematic is loaded in the booking itself.

The order of the home page follows the story: hero -> what we measure -> services (with their price lists) -> booking -> how
it goes -> clubs -> partners -> philosophy. (Before the kit "Vybavení" sat after the booking cards; its texts are unchanged.)

## The staff application

* **Dialog**: grows out of the pressed point on a spring (`--sm-pop-x/y` from `pointerOrigin.ts`, `sm-pop-in` in
  `motion.css`); menus and popovers already grow from their anchor (MUI `Grow`).
* **Buttons**: dip while held (`scale`, the individual transform property; `--sm-press` is 1 when off) and spring back.
* **Lists**: `ResponsiveDataList` cascades its first 14 rows, 22 ms apart, **once** - a refetch, filter or page never replays it.
* **Dashboard**: the five figures count up once.
* **Route change**: the shell's scroll region replays a 6 px / 180 ms arrival (`usePageArrival`); the planner stage is never animated.
* **Toast**: springs in from the right, leaves in 160 ms. **Skeleton**: a light band travels across. **Offline strip**: slides
  down from the top edge in CSS (it used to pull in the whole React animation library, ~120 kB, for this alone).
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
which the browser counts as a layout shift: CLS 3.5 on the first attempt, 0.01 with sticky). Add the page to
`scripts/motion-shots.mjs` and run it: it fails on horizontal overflow, console errors and CLS >= 0.1.

## Dependencies (new) and licences

| Package | Licence | Where it loads (brotli) |
|---|---|---|
| `motion` 14 (replaces the direct `framer-motion` 13: the same engine, one copy; only `motion/mini`, `inView`, `stagger` are used) | MIT | lazy chunk `motion` 3.9 kB, after the first paint |
| `gsap` 3.15 (+ ScrollTrigger) | GSAP standard "no charge" licence (https://gsap.com/standard-license) | lazy chunk `gsap` 42.4 kB, public pages, 0.6 s after the first paint |
| `lenis` 1.3 | MIT | lazy chunk `lenis` 5.2 kB, public site, mouse + `plné` only |
| `@paper-design/shaders-react` 0.0.81 | Apache-2.0 | lazy chunk `shaders` 11.0 kB, WebGL only, when a band is nearly in view |

None is in any first load: `scripts/bundle-budget.mjs` forbids all four chunks in the application entry, the sign-in page,
the staff portal, the planner and the public entry; `src/motion/staffIsolation.test.ts` fails at the source if the staff
application can reach ScrollScene, Lenis, GSAP or a shader. Total lazy download of the full cinematic home: 62 kB brotli
(104 kB before `motion/mini` and the CSS offline strip).

## Measured

Own headless Chromium (`scripts/motion-perf.mjs`, `scripts/motion-staff-check.mjs`), `vite preview` of `PRERENDER_API_URL=off`
builds, before = `claude/clean` b7e4405, after = `motion/kit`. Raw numbers: `design/motion/*.json`.

**Public site, cold load, mobile (390x844, DPR 2, Slow-4G 1.6 Mbit / 150 ms RTT, CPU x4), median of 7**

| Page | FCP before -> after | LCP before -> after | CLS | TBT before -> after | JS fetched within 2.5 s after load |
|---|---|---|---|---|---|
| `/` | 808 -> 804 ms | 808 -> 804 ms | 0 -> 0 | 113 -> 176 ms | 347 -> 364 kB |
| `/sluzby` | 736 -> 716 ms | 736 -> 716 ms | 0 -> 0 | 123 -> 131 ms | 347 -> 364 kB |
| `/diagnostika` | 828 -> 824 ms | 828 -> 824 ms | 0 -> 0 | 158 -> 223 ms | 347 -> 364 kB |
| `/cenik` | 736 -> 720 ms | 736 -> 720 ms | 0 -> 0 | 103 -> 146 ms | 347 -> 364 kB |

Desktop (1440x900, unthrottled) `/`: FCP and LCP 96 -> 96 ms, CLS 0, TBT 0 -> 123 ms. LCP is unchanged because the kit never hides
the largest content (rule 6). **TBT rises by 8 - 65 ms on mobile**: the lazy chunks are parsed after the first paint (staged so no single
task is long); it is the price of the cinematic layer and the one number that got worse.

How LCP was kept (three measured mistakes on the way): a clipped headline reveal moved LCP 0.8 -> 3.3 s (a clipped element is
painted only as far as it is uncovered); a lead paragraph fading from opacity 0 moved it 0.8 -> 1.2 s (the fade lives on the
compositor, so the main thread paints it as transparent until the end); both now start visible (blur / 0.2 opacity).

**CLS while scrolling the home page like a visitor** (wheel notches through the whole page, `scripts/motion-shots.mjs`):
0.0008 at 390x844, 0.0099 at 1440x900 (limit 0.1). The first pinned-section attempt (`pin: true`) measured 3.5.

**Bundle budget** (brotli, `npm run build:check`): public entry 307.6 -> 317.6 kB (the kit's light parts: tokens, preference,
Reveal, Magnetic, KineticText, SiteLink's transition, the scene host), staff portal 61.6 -> 64.2, dashboard 42.0 -> 43.4, login
5.4 -> 5.6, application entry 257.1 -> 257.8, planner 234.0 -> 234.3. Baselines for public entry, staff portal and dashboard
were raised in `scripts/bundle-budget.json` for this intended growth; the others pass on the old numbers.

**Prerendered HTML**: the home page is 99.9 -> 121.3 kB (the headline's word spans, the `data-fx` markup, the extra emotion styles); `npm run build` (prerender of 20 pages + app-shell-preload) passes and `check:prerender` confirms every heading and word of the old pages is still there.

**Planner** (`/planovani`, Ctrl + wheel zoom 1x -> 6x, 40 wheel scrolls down and 40 up, CPU x4, median of 7): wall time, mean frame and
p95 frame are identical to the display's 60 Hz cadence; main-thread work as the browser accounts it:

| | total | mean frame | p95 frame | frames > 50 ms | main-thread tasks | script | style recalculation | layout |
|---|---|---|---|---|---|---|---|---|
| before | 6592 ms | 17.75 ms | 18.1 ms | 0 | 1534 ms | 72 ms | 426 ms | 0 |
| after | 6562 ms | 17.73 ms | 18.1 ms | 0 | 1541 ms | 69 ms | 424 ms | 0 |

(Four alternating before/after pairs differed by -3 % .. +4 % in both directions: noise.) Three layouts (390x844, 820x1180, 1440x900)
on `/prehled`, `/patients`, `/planovani`, `/settings`: the document never scrolls, no horizontal overflow, no console error,
the three motion buttons are 44 px; the dialog pops about the pressed point under `plné`, fades under `omezené`, nothing under `vypnuto`.

## Tests

* `src/motion/tokens.test.ts`, `preference.test.tsx` (OS reduce, stored value, junk value, storage events, private mode, and
  the inline boot script run against `resolveMotion`), `primitives.test.tsx` (each primitive under all three states: no
  transform under `vypnuto`, opacity only under `omezené`), `scroll.test.tsx` (ScrollScene/Lenis start only in `plné`, never on
  touch, revert on unmount), `shader.test.tsx`, `staff.test.tsx` (the setting in Nastavení, count-up once, rows once, the CSS
  contract), `staffIsolation.test.ts` (the staff app's import graph), `src/web/prerender.motion.test.ts` (prerender structure),
  `src/web/siteLinkTransition.test.tsx`, `src/components/NetworkBannerSlide.test.tsx`, and the planner's `moveDrag.test.ts`.
* `npm run check:prerender` (`scripts/prerender-check.mjs`) - the same structure check on the real `dist/`.
* `npm run motion:shots` (`scripts/motion-shots.mjs`) - scrolls the public home at 390x844 and 1440x900, photographs it
  (`design/motion/home-*.png`, 8 positions each), checks horizontal overflow, console errors and CLS, records a frame strip
  and a video of the hero (`home-*-strip.png`, `video/*.webm`) and the page curtain (`home-1440x900-nav-mid.png`).
* `scripts/motion-lab-check.mjs` - `/motion-lab` in a real browser under each state: reveals animate / fade / do nothing, the spring
  is on the keyframes, the list and figures work, Lenis and the scene run only in `plné`.
* `npm run motion:perf`, `scripts/motion-staff-check.mjs` - the numbers above.

## Lessons (so nobody pays for them twice)

* `motion/mini` silently ignores a `linear()` easing **string** (it only maps its own names); pass an easing **function**.
* A clipped or fully transparent element is not painted for LCP until it is uncovered / has faded in; start visible.
* `pin: true` switches to `position: fixed`, which Chrome scores as a layout shift; use a sticky stage in a tall track.
* React Router's `viewTransition` works only with data routers; with `BrowserRouter` call `document.startViewTransition` yourself.
* `vite preview` does not proxy `/api` (the dev server does) and answers unknown paths with the SPA shell (HTTP 200): forward it
  yourself (the staff check does) or a test will "succeed" against HTML.
* A transition declaration replaces the whole list: restyling `.MuiButton-root`'s `transition` must repeat MUI's colour transitions.
* rAF timestamps and `performance.now()` can be different clocks in a test environment: time a rAF loop from its own first frame.

## Open risks

* **Verified in headless Chromium only** (own Playwright, software WebGL). Not run in Safari, Firefox or on a real phone/GPU:
  View Transitions, `overflow: clip`, `svh`, WebGL blur/filter cost, Lenis and ScrollTrigger on those engines are expected to
  degrade to the plain page (every effect is optional) but are untested.
* **TBT +8 .. +65 ms** on mobile for the cinematic layer (above); the public pages are not blocked for input but a very weak phone
  will spend the 0.6 - 1.5 s after load parsing 62 kB of lazy script. `omezené` / `vypnuto` / OS reduce do not load it.
* **Placeholders, not photos**: the clinic has uploaded no photos yet (slots show captions), so parallax, curtain and the hero frame
  were judged on grey frames. A real hero photo is an LCP candidate: its frame grows from 7 % smaller (never from nothing),
  but a heavy photo needs `Cloudinary` widths as the slot already does - measure again when the first photo lands.
* **Page order**: "Na čem měříme" moved above the services (the story the brief asked for). Texts are unchanged; the owner may prefer
  the old order (move `<MeasureStage />` in `src/web/pages/LandingPage.tsx`).
* **Pinned stage on a visitor who arrives deep** (reload with a restored scroll, a very slow connection): the scene checks where
  the visitor already is and leaves the readable layout alone rather than move the page under them.
* **Three WebGL contexts on the home** (hero, stage, club): each starts only when its band is near and pauses off-screen, but a very
  old phone may still refuse one; the CSS fallback gradient stays underneath.
* The planner's board itself is untouched (the prototype's CSS is generated and must not be edited by hand): its only change is the
  spring on the drop/glide, which follows the setting.
* Dev dependency audit warnings (`npm audit`) existed before and were not touched.
