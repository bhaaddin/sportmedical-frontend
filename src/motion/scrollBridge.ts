/* The two scroll libraries load independently (Lenis from LenisProvider, GSAP from a ScrollScene), in either order.
   Whichever arrives second wires Lenis' scroll event into ScrollTrigger.update, once, so pins and scrubs follow the
   smooth scroll instead of lagging a frame behind it. */

interface LenisLike {
  on: (event: 'scroll', callback: () => void) => () => void;
}
interface ScrollTriggerLike {
  update: () => void;
}

let lenis: LenisLike | null = null;
let trigger: ScrollTriggerLike | null = null;
let unsubscribe: (() => void) | null = null;

function wire(): void {
  unsubscribe?.();
  unsubscribe = null;
  if (lenis !== null && trigger !== null) {
    const update = trigger.update;
    unsubscribe = lenis.on('scroll', () => update());
  }
}

export function bridgeLenis(next: LenisLike | null): void {
  lenis = next;
  wire();
}

export function bridgeScrollTrigger(next: ScrollTriggerLike): void {
  trigger = next;
  wire();
}

/** Is smooth scroll running right now (scenes may want to know, e.g. to skip native snap). */
export function lenisActive(): boolean {
  return lenis !== null;
}
