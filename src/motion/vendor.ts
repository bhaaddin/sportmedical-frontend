/* The few functions of `motion` the kit uses, in one module: the kit imports it with import(), so the library lands in
   one lazy chunk ('motion', vite.config.ts) and never in a first load (scripts/bundle-budget.mjs enforces that).
   `animate` is the MINI one (Web Animations API only, ~3 kB brotli; the hybrid one is ~47 kB): every move in the kit is an
   opacity / transform / clip-path / height keyframe, which the browser runs on its own thread. That is why keyframes here
   say `transform: ['translateY(28px)', 'translateY(0px)']` and not `y: [28, 0]`, and why springs are our own CSS
   `linear()` easings (tokens.ts), not motion's spring generator. */
export { animate } from 'motion/mini';
export { inView, stagger } from 'motion';
