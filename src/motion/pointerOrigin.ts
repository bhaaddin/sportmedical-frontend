/* ══════════════════════════════════════════════════════════════
   WHERE A DIALOG POPS FROM - the point of the last press (or the focused button after Enter / Space).

   Written as --sm-pop-x / --sm-pop-y on <html>, in viewport pixels; src/motion/motion.css scales a dialog's container
   about that point while it opens, so a dialog grows out of the button that was pressed. The point is forgotten after a
   moment (a dialog opened by something other than a press pops from the middle of the screen).
   One listener pair for the whole application, passive, doing nothing but two style writes.
   ══════════════════════════════════════════════════════════════ */

let installed = false;
let forget = 0;

function remember(x: number, y: number): void {
  const root = document.documentElement;
  root.style.setProperty('--sm-pop-x', `${Math.round(x)}px`);
  root.style.setProperty('--sm-pop-y', `${Math.round(y)}px`);
  window.clearTimeout(forget);
  forget = window.setTimeout(() => {
    root.style.removeProperty('--sm-pop-x');
    root.style.removeProperty('--sm-pop-y');
  }, 1500);
}

export function trackPointerOrigin(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('pointerdown', (event) => remember(event.clientX, event.clientY), { capture: true, passive: true });
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = document.activeElement;
      if (target instanceof HTMLElement && target !== document.body) {
        const r = target.getBoundingClientRect();
        remember(r.left + r.width / 2, r.top + r.height / 2);
      }
    },
    { capture: true, passive: true },
  );
}
