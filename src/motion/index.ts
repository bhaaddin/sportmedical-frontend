/* The motion kit's public surface (docs/motion-kit.md). Everything here is light: the heavy libraries (motion, gsap,
   lenis, the shaders) are only ever reached through import() inside these modules, so importing from here never puts
   them in a first load. The scroll pieces (ScrollScene, LenisProvider, ShaderBackdrop) are deliberately NOT
   re-exported: a screen that wants them imports them by name, which keeps the staff application's import graph
   provably free of them (src/motion/staffIsolation.test.ts). */

export * from './tokens';
export * from './preference';
export { useMotionPreference } from './useMotionPreference';
export type { MotionPreferenceState } from './useMotionPreference';
export { loadMotion, warmMotion, motionIfLoaded } from './engine';
export { Reveal, Stagger, useReveal } from './Reveal';
export { PopIn, PresenceList, originOf, usePresence } from './Presence';
export { CountUp } from './CountUp';
export { PageTransition } from './PageTransition';
export { PressScale } from './PressScale';
export { Magnetic, Tilt } from './Magnetic';
export { Parallax } from './Parallax';
export { KineticLines } from './KineticText';
