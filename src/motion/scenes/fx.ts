/* ══════════════════════════════════════════════════════════════
   FX - the public site's section transitions, one move each ("diverse changes, each in a different motion").

   A page marks an element `data-fx="<name>"` (and, where an effect needs parts, `data-fx-item` / `data-fx-line` /
   `data-fx-inner` children). The scene scans the page once and gives each marked element its own move:

     recede   the hero's content steps back (scale, lift, dim) while the page rises over it     - scrubbed
     wipe     a title is uncovered left to right by a clip                                       - once
     curtain  a photo is revealed top to bottom while its picture settles from a closer crop     - once
     scale    a photo grows out of a smaller, tilted frame                                       - once
     pan      a whole block pans in from the right while the page scrolls                        - scrubbed
     ticker   rows slide in one after another from the left                                      - once
     fan      cards are dealt from below, each from a different angle                            - once
     draw     lines are drawn left to right, their numerals follow                               - once
     iris     a dark band opens like a camera iris                                               - scrubbed, wide screens only
     light    the words of a quote light up as it is read                                        - scrubbed

   Every effect writes the page's own properties only through GSAP, so `context.revert()` puts the markup back exactly
   as the server rendered it. Touch-sized screens get the lighter variants (no clip-path scrubbing: it repaints).
   ══════════════════════════════════════════════════════════════ */

import type { SceneContext } from '../ScrollScene';

type Ctx = Pick<SceneContext, 'gsap' | 'ScrollTrigger' | 'mm'>;
type Effect = (el: HTMLElement, c: Ctx) => void;

const items = (el: HTMLElement): HTMLElement[] => Array.from(el.querySelectorAll<HTMLElement>('[data-fx-item]'));
const inner = (el: HTMLElement): HTMLElement | null => el.querySelector<HTMLElement>('[data-fx-inner]');
const once = (el: HTMLElement, start = 'top 84%') => ({ trigger: el, start, once: true });

export const EFFECTS: Record<string, Effect> = {
  recede(el, { gsap }) {
    const band = el.closest('section') ?? el;
    gsap.to(el, {
      scale: 0.93,
      yPercent: -5,
      opacity: 0.2,
      transformOrigin: '50% 100%',
      ease: 'none',
      scrollTrigger: { trigger: band, start: 'top top', end: 'bottom top', scrub: true },
    });
  },

  wipe(el, { gsap }) {
    gsap.fromTo(
      el,
      { clipPath: 'inset(0 100% 0 0)', x: -28 },
      { clipPath: 'inset(0 0% 0 0)', x: 0, duration: 1.15, ease: 'expo.out', scrollTrigger: once(el, 'top 88%') },
    );
  },

  curtain(el, { gsap }) {
    gsap.fromTo(el, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 1.35, ease: 'expo.inOut', scrollTrigger: once(el, 'top 82%') });
    const picture = inner(el);
    if (picture) gsap.fromTo(picture, { scale: 1.4 }, { scale: 1, duration: 1.9, ease: 'expo.out', scrollTrigger: once(el, 'top 82%') });
  },

  scale(el, { gsap }) {
    gsap.fromTo(
      el,
      { scale: 0.8, rotate: -2.5, opacity: 0, transformOrigin: '50% 60%' },
      { scale: 1, rotate: 0, opacity: 1, duration: 1.2, ease: 'expo.out', scrollTrigger: once(el, 'top 85%') },
    );
  },

  pan(el, { gsap }) {
    gsap.fromTo(
      el,
      { xPercent: 12, opacity: 0.0 },
      { xPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 96%', end: 'top 40%', scrub: 0.6 } },
    );
  },

  ticker(el, { gsap }) {
    const rows = items(el);
    if (rows.length === 0) return;
    gsap.fromTo(rows, { x: -34, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: 'power4.out', stagger: 0.09, scrollTrigger: once(el, 'top 88%') });
  },

  fan(el, { gsap }) {
    const cards = items(el);
    if (cards.length === 0) return;
    gsap.fromTo(
      cards,
      { y: 90, rotate: (i: number) => (i - (cards.length - 1) / 2) * -6, opacity: 0, transformOrigin: '50% 100%' },
      { y: 0, rotate: 0, opacity: 1, duration: 1.05, ease: 'back.out(1.25)', stagger: 0.13, scrollTrigger: once(el, 'top 86%') },
    );
  },

  draw(el, { gsap }) {
    const lines = Array.from(el.querySelectorAll<HTMLElement>('[data-fx-line]'));
    const rest = items(el);
    const trigger = once(el, 'top 84%');
    if (lines.length > 0) gsap.fromTo(lines, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 1, ease: 'expo.out', stagger: 0.18, scrollTrigger: trigger });
    if (rest.length > 0) gsap.fromTo(rest, { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.18, delay: 0.15, scrollTrigger: trigger });
  },

  iris(el, { gsap, mm }) {
    mm.add('(min-width: 768px)', () => {
      gsap.fromTo(
        el,
        { clipPath: 'circle(9% at 50% 55%)' },
        { clipPath: 'circle(125% at 50% 55%)', ease: 'none', scrollTrigger: { trigger: el, start: 'top 92%', end: 'top 12%', scrub: 0.5 } },
      );
    });
    mm.add('(max-width: 767px)', () => {
      gsap.fromTo(el, { opacity: 0.0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: once(el, 'top 90%') });
    });
  },

  light(el, { gsap }) {
    const words = Array.from(el.querySelectorAll<HTMLElement>('.sm-lw'));
    if (words.length === 0) return;
    gsap.fromTo(words, { opacity: 0.14 }, { opacity: 1, ease: 'none', stagger: 0.12, scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 48%', scrub: 0.4 } });
  },
};

/** Gives every `[data-fx]` under `root` its effect. Unknown names are ignored (a typo must not break the page). */
export function applyFx(root: HTMLElement, ctx: Ctx): void {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-fx]'))) {
    const effect = EFFECTS[el.dataset.fx ?? ''];
    if (effect) effect(el, ctx);
  }
}
