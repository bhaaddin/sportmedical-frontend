/* The scene of /motion-lab: every section transition of the public site on its own sample (applyFx), plus a scrubbed
   progress bar and a number driven by the scroll, so the owner sees what ScrollScene hands a scene. */
import type { SceneContext } from '../ScrollScene';
import { applyFx } from './fx';

export default function labScene(context: SceneContext): void {
  const { gsap, root } = context;
  applyFx(root, context);
  const bar = root.querySelector<HTMLElement>('[data-lab="bar"]');
  const readout = root.querySelector<HTMLElement>('[data-lab="readout"]');
  const track = root.querySelector<HTMLElement>('[data-lab="track"]');
  if (bar && track) {
    gsap.fromTo(
      bar,
      { scaleX: 0, transformOrigin: '0% 50%' },
      {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: track,
          start: 'top 80%',
          end: 'bottom 30%',
          scrub: true,
          onUpdate: (self) => {
            if (readout) readout.textContent = `${Math.round(self.progress * 100)} %`;
          },
        },
      },
    );
  }
}
