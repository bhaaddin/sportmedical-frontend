/* ══════════════════════════════════════════════════════════════
   SCENE: "Na čem měříme" - the pinned sequence of the public home.

   The band's stage sticks to the screen (CSS position: sticky) for about three and a half screens of scrolling. Along it the measurement trace is
   drawn (stroke-dashoffset), a dot rides its tip, and the four devices take the stage one after another: each name
   tracks in from wide letter-spacing, the previous one leaves upward. Beats change where the trace reaches that
   device's node, so what is on screen is always what the line has just measured.

   Markup contract (src/web/landing/MeasureStage.tsx): inside the band
     [data-sm="beat"] x4        a device (its name in [data-sm="name"], its text in [data-sm="text"])
     [data-sm="tick"] x4        the rail of names (aria-hidden), the active one is lit
     [data-sm="trace"], [data-sm="node"] x4, [data-sm="dot"]   the signal line
   Wide and narrow screens share the timeline; CSS (keyed on the root's data-scene="ready") lays the stage out.
   ══════════════════════════════════════════════════════════════ */

import type { SceneContext } from '../ScrollScene';

const all = <T extends Element>(root: ParentNode, selector: string): T[] => Array.from(root.querySelectorAll<T>(selector));

/** Where along the trace (0..1 of its length) each node sits, found by walking the path. */
export function progressOfPoints(path: SVGGeometryElement, points: { x: number; y: number }[]): number[] {
  const total = path.getTotalLength();
  const steps = 600;
  return points.map((point) => {
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i <= steps; i += 1) {
      const at = path.getPointAtLength((total * i) / steps);
      const d = (at.x - point.x) ** 2 + (at.y - point.y) ** 2;
      if (d < bestDistance) {
        bestDistance = d;
        best = i / steps;
      }
    }
    return best;
  });
}

export default function measureScene({ gsap, ScrollTrigger, root, mm }: SceneContext): void {
  const stage = root.querySelector<HTMLElement>('[data-sm="measure"]');
  if (stage === null) return;
  const beats = all<HTMLElement>(stage, '[data-sm="beat"]');
  const ticks = all<HTMLElement>(stage, '[data-sm="tick"]');
  const trace = stage.querySelector<SVGPathElement>('[data-sm="trace"]');
  const nodes = all<SVGCircleElement>(stage, '[data-sm="node"]');
  const dot = stage.querySelector<SVGCircleElement>('[data-sm="dot"]');
  if (beats.length === 0 || trace === null) return;
  /* Switching to the pinned layout moves what lies below it. If the visitor is already at (or past) the band - a slow
     connection, a reload that restored a scroll - leave the page as it is: the readable layout is complete. */
  if (window.scrollY + window.innerHeight * 0.2 > stage.getBoundingClientRect().top + window.scrollY) {
    return;
  }

  mm.add('(min-width: 0px)', () => {
    // The staged layout (MeasureStage.tsx reads this attribute) goes on before anything is measured.
    const headerHeight = Math.round(document.querySelector('header')?.getBoundingClientRect().height ?? 72);
    stage.style.setProperty('--sm-hh', `${headerHeight}px`);
    stage.style.setProperty('--sm-beats', String(beats.length));
    stage.setAttribute('data-stage', 'pinned');
    const count = beats.length;
    const length = trace.getTotalLength();
    const nodePoints = nodes.map((node) => ({ x: Number(node.getAttribute('cx')), y: Number(node.getAttribute('cy')) }));
    const at = nodePoints.length === count ? progressOfPoints(trace, nodePoints) : beats.map((_, i) => (i + 0.5) / count);
    // The beat that is on stage between two nodes changes at the midpoint between them.
    const edges = at.slice(1).map((p, i) => (p + at[i]) / 2);
    const names = beats.map((beat) => beat.querySelector<HTMLElement>('[data-sm="name"]'));
    const texts = beats.map((beat) => beat.querySelector<HTMLElement>('[data-sm="text"]'));

    gsap.set(trace, { strokeDasharray: '1 1', strokeDashoffset: 1 });
    gsap.set(nodes, { scale: 0, transformOrigin: '50% 50%' });
    gsap.set(beats, { autoAlpha: 0 });
    gsap.set(beats[0], { autoAlpha: 1 });
    gsap.set(ticks, { opacity: 0.38 });
    gsap.set(ticks[0], { opacity: 1 });
    if (dot) gsap.set(dot, { opacity: 1 });

    const place = (progress: number) => {
      if (!dot) return;
      const point = trace.getPointAtLength(Math.min(length, Math.max(0, progress * length)));
      dot.setAttribute('cx', String(point.x));
      dot.setAttribute('cy', String(point.y));
    };
    place(0);

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        // The section is a tall track and its stage is `position: sticky` (CSS): the browser holds the stage, this only reads
        // how far the track has scrolled by - from the moment the stage sticks until the track's end reaches the screen's.
        trigger: stage,
        start: () => `top top+=${headerHeight}`,
        end: 'bottom bottom',
        scrub: 0.7,
        invalidateOnRefresh: true,
        onUpdate: (self) => place(self.progress),
        onRefresh: (self) => place(self.progress),
      },
    });
    // The trace is drawn over the whole timeline (duration 1 = progress 0..1).
    tl.to(trace, { strokeDashoffset: 0, duration: 1 }, 0);
    nodes.forEach((node, i) => tl.to(node, { scale: 1, duration: 0.04, ease: 'back.out(3)' }, Math.max(0, (at[i] ?? 0) - 0.04)));

    beats.forEach((beat, i) => {
      if (i === 0) {
        // The first beat is on stage from the start; it only has to leave.
      } else {
        const enter = edges[i - 1] ?? i / count;
        tl.fromTo(beat, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.03 }, enter);
        if (names[i]) tl.fromTo(names[i], { yPercent: 28, letterSpacing: '0.07em', opacity: 0 }, { yPercent: 0, letterSpacing: '-0.045em', opacity: 1, duration: 0.07, ease: 'power3.out' }, enter);
        if (texts[i]) tl.fromTo(texts[i], { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.06, ease: 'power2.out' }, enter + 0.02);
        if (ticks[i]) tl.to(ticks[i], { opacity: 1, duration: 0.03 }, enter);
      }
      const leave = edges[i];
      if (leave !== undefined) {
        const out = leave - 0.045;
        tl.to(beat, { autoAlpha: 0, y: -36, duration: 0.04, ease: 'power2.in' }, out);
        if (ticks[i]) tl.to(ticks[i], { opacity: 0.38, duration: 0.03 }, out);
      }
    });
    // Give the last beat a held end so the line finishes before the pin lets go.
    tl.to({}, { duration: 0.001 }, 1);

    return () => {
      stage.removeAttribute('data-stage');
      stage.style.removeProperty('--sm-hh');
      stage.style.removeProperty('--sm-beats');
      tl.scrollTrigger?.kill();
      tl.kill();
      gsap.set([trace, ...nodes, ...beats, ...ticks], { clearProps: 'all' });
      if (dot) gsap.set(dot, { clearProps: 'all' });
    };
  });

  void ScrollTrigger;
}
