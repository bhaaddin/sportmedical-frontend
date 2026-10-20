/* The few functions of `motion` the kit uses, in one module: the kit imports it with import(), so the library lands in
   one lazy chunk ('motion', vite.config.ts) and never in a first load (scripts/bundle-budget.mjs enforces that). */
export { animate, inView, stagger } from 'motion';
