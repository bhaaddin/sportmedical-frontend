/* ══════════════════════════════════════════════════════════════
   MOTION TOKENS — the one place for durations, easings, springs and distances.

   Nothing in src/ writes a millisecond or a cubic-bezier of its own for movement: the kit, the public site's scenes,
   the staff app's dialogs and the planner's drop all read these. A number changes here and everywhere follows.

   Three personalities (docs/motion-kit.md):
     - 'site'   cinematic, long, eased; the public website only;
     - 'staff'  restrained, fast, purposeful; answers an action and is gone within 180 ms (springs excepted: a spring
                settles visibly but never delays the next action - the control is usable from the first frame);
     - 'lab'    anything, for /motion-lab.
   ══════════════════════════════════════════════════════════════ */

/** Durations in seconds (what `motion` takes). `ms()` below gives the CSS flavour. */
export const DUR = {
  /** Colour/opacity flicker of a hover or a press. */
  instant: 0.08,
  /** Staff: a menu, a tab, a row (the ceiling for "answers an action"). */
  quick: 0.14,
  /** Staff: the longest transition the staff app may use for a page or a panel. */
  staffMax: 0.18,
  /** Site and staff: a small reveal. */
  base: 0.32,
  /** Site: a section element arriving. */
  slow: 0.7,
  /** Site: a headline line, a curtain. */
  cinematic: 1.1,
} as const;

/** Cubic-bezier easings as [x1, y1, x2, y2] (motion) - `css()` gives the string. */
export const EASE = {
  /** Things arriving: fast out of the blocks, long landing. */
  out: [0.16, 1, 0.3, 1],
  /** Things leaving. */
  in: [0.7, 0, 0.84, 0],
  /** A move between two resting places. */
  inOut: [0.65, 0, 0.35, 1],
  /** The headline mask: even heavier landing than `out`. */
  expo: [0.19, 1, 0.22, 1],
  /** Gentle overshoot for a press release. */
  back: [0.34, 1.56, 0.64, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** Spring definitions in motion's vocabulary (`type: 'spring'`). */
export const SPRING = {
  /** Dialog / popover arriving: quick, a hint of overshoot. */
  pop: { type: 'spring', stiffness: 520, damping: 34, mass: 0.9 },
  /** Press release and small controls. */
  press: { type: 'spring', stiffness: 700, damping: 30 },
  /** The planner's drop settling into its slot. */
  settle: { type: 'spring', stiffness: 420, damping: 28, mass: 0.8 },
  /** Cards that tilt / lift on hover, magnetic buttons. */
  soft: { type: 'spring', stiffness: 180, damping: 22, mass: 0.7 },
} as const;

/** Distances in px (translate) and unitless factors (scale). */
export const DIST = {
  /** Staff: a row or panel arriving. */
  nudge: 6,
  /** A reveal on the public site. */
  rise: 28,
  /** A big element (a photo, a card) sliding in. */
  slide: 72,
  /** Parallax: the fraction of the scroll an image lags behind. */
  parallax: 0.12,
  /** Press feedback. */
  press: 0.97,
  /** The dialog's starting scale. */
  popFrom: 0.94,
  /** Hover lift of a card, px. */
  lift: 6,
  /** Tilt, degrees at the card's edge. */
  tilt: 5,
  /** Magnetic pull: the fraction of the pointer's offset the button follows. */
  magnet: 0.28,
} as const;

/** Delay between siblings, seconds. */
export const STAGGER = {
  /** Staff rows on a first load. */
  rows: 0.022,
  /** Site cards / list items. */
  items: 0.08,
  /** Words of a headline. */
  words: 0.075,
} as const;

export type Easing = keyof typeof EASE;

/** `EASE.out` -> `cubic-bezier(0.16, 1, 0.3, 1)` for CSS. */
export function cssEase(name: Easing): string {
  const [a, b, c, d] = EASE[name];
  return `cubic-bezier(${a}, ${b}, ${c}, ${d})`;
}

/** Seconds -> `140ms`. */
export const ms = (seconds: number): string => `${Math.round(seconds * 1000)}ms`;

/**
 * A critically-ish damped spring as a CSS `linear()` easing, so plain CSS transitions (MUI's Grow, a button's :active)
 * get a spring without any library. Sampled from the closed-form solution of an under-damped oscillator; the result
 * is a string of ~28 points, computed once.
 */
export function springEasing(stiffness: number, damping: number, mass = 1, steps = 28): string {
  const omega = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const wd = omega * Math.sqrt(Math.max(1e-6, 1 - zeta * zeta));
  const at = (t: number) =>
    zeta >= 1
      ? 1 - (1 + omega * t) * Math.exp(-omega * t)
      : 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t));
  // Settle time: when the envelope drops under 0.2 %.
  const settle = zeta >= 1 ? 7 / omega : Math.log(500) / (zeta * omega);
  const points: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    points.push(at((settle * i) / steps).toFixed(3).replace(/\.?0+$/, '') || '0');
  }
  points[points.length - 1] = '1';
  return `linear(${points.join(', ')})`;
}

/** Spring easing and its natural duration for the dialog pop (CSS). */
export const POP_EASING = springEasing(SPRING.pop.stiffness, SPRING.pop.damping, SPRING.pop.mass);
export const SETTLE_EASING = springEasing(SPRING.settle.stiffness, SPRING.settle.damping, SPRING.settle.mass);

/** The tokens as CSS custom properties, written once on the root (src/motion/motion.css reads them). */
export function cssVariables(): Record<string, string> {
  return {
    '--sm-dur-instant': ms(DUR.instant),
    '--sm-dur-quick': ms(DUR.quick),
    '--sm-dur-base': ms(DUR.base),
    '--sm-dur-slow': ms(DUR.slow),
    '--sm-dur-cinematic': ms(DUR.cinematic),
    '--sm-ease-out': cssEase('out'),
    '--sm-ease-in': cssEase('in'),
    '--sm-ease-inout': cssEase('inOut'),
    '--sm-ease-expo': cssEase('expo'),
    '--sm-ease-back': cssEase('back'),
    '--sm-ease-pop': POP_EASING,
    '--sm-ease-settle': SETTLE_EASING,
  };
}
