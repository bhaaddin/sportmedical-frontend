/*
 * Bone silhouettes in "unit bone space": u runs along the bone from its proximal (0) to its distal (1) end, v across it, BOTH as a
 * fraction of the bone's length - so a template scales with the segment it is placed on and keeps its proportions.
 * Proportions follow standard anatomical atlases (epiphyses wide, shaft slim and slightly bowed, condyles as two lobes, a
 * head on a neck at the hip); the outlines are procedural (width profiles and ellipses), not traced from any asset.
 * A template is a list of closed polygons: they are outlined together first and filled on top, so overlapping parts read as one bone.
 */
export type Poly = [number, number][];
export interface BoneTemplate {
  parts: Poly[];
  /** A short polyline along the bone drawn as a soft highlight. */
  highlight: Poly;
}

/** An ellipse as a polygon. */
export function ellipse(cu: number, cv: number, ru: number, rv: number, n = 14, rot = 0): Poly {
  const out: Poly = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * ru;
    const y = Math.sin(a) * rv;
    out.push([cu + x * c - y * s, cv + x * s + y * c]);
  }
  return out;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Interpolates a [u, halfWidth, bow?] table (smooth between rows). */
function sample(table: readonly (readonly [number, number, number?])[], u: number): { w: number; bow: number } {
  if (u <= table[0][0]) return { w: table[0][1], bow: table[0][2] ?? 0 };
  const last = table[table.length - 1];
  if (u >= last[0]) return { w: last[1], bow: last[2] ?? 0 };
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i];
    const b = table[i + 1];
    if (u >= a[0] && u <= b[0]) {
      const t = smooth((u - a[0]) / (b[0] - a[0]));
      return { w: a[1] + (b[1] - a[1]) * t, bow: (a[2] ?? 0) + ((b[2] ?? 0) - (a[2] ?? 0)) * t };
    }
  }
  return { w: last[1], bow: last[2] ?? 0 };
}

/** A closed outline around a width profile (the shaft with its flared ends). */
export function outline(table: readonly (readonly [number, number, number?])[], steps = 22): Poly {
  const u0 = table[0][0];
  const u1 = table[table.length - 1][0];
  const top: Poly = [];
  const bottom: Poly = [];
  for (let i = 0; i <= steps; i++) {
    const u = u0 + ((u1 - u0) * i) / steps;
    const { w, bow } = sample(table, u);
    top.push([u, bow + w]);
    bottom.push([u, bow - w]);
  }
  return [...top, ...bottom.reverse()];
}

/** A highlight line along the bone: at fraction `across` of the half width, from u0 to u1. */
function highlightLine(table: readonly (readonly [number, number, number?])[], u0: number, u1: number, across: number): Poly {
  const pts: Poly = [];
  for (let i = 0; i <= 6; i++) {
    const u = u0 + ((u1 - u0) * i) / 6;
    const { w, bow } = sample(table, u);
    pts.push([u, bow + w * across]);
  }
  return pts;
}

const FEMUR_SHAFT = [[0.12, 0.036, 0.004], [0.28, 0.034, 0.010], [0.5, 0.030, 0.014], [0.74, 0.034, 0.010], [0.87, 0.050, 0.004], [0.95, 0.074, 0]] as const;
const TIBIA_SHAFT = [[0.0, 0.076, 0], [0.05, 0.072, 0], [0.13, 0.048, 0], [0.4, 0.034, 0.002], [0.8, 0.030, 0], [0.94, 0.042, 0], [1.0, 0.050, 0]] as const;
const FIBULA_SHAFT = [[0.06, 0.018, 0], [0.12, 0.013, 0], [0.5, 0.011, 0], [0.88, 0.016, 0], [1.04, 0.020, 0]] as const;
const HUMERUS_SHAFT = [[0.07, 0.046, 0], [0.22, 0.038, 0.004], [0.6, 0.034, 0.003], [0.86, 0.040, 0], [0.97, 0.062, 0]] as const;
const ULNA_SHAFT = [[0.0, 0.052, 0], [0.09, 0.038, 0], [0.24, 0.027, 0.002], [0.7, 0.019, 0], [0.97, 0.016, 0]] as const;
const RADIUS_SHAFT = [[0.04, 0.020, 0], [0.12, 0.016, 0], [0.4, 0.021, 0.004], [0.8, 0.028, 0], [1.0, 0.042, 0]] as const;
const PHALANX = [[0.0, 0.2, 0], [0.16, 0.13, 0], [0.5, 0.10, 0], [0.84, 0.13, 0], [1.0, 0.19, 0]] as const;
const METATARSAL = [[0.0, 0.14, 0], [0.12, 0.09, 0], [0.5, 0.07, 0], [0.9, 0.095, 0], [1.0, 0.135, 0]] as const;

export const TEMPLATES = {
  /** Head at u=0 on a neck, greater trochanter, bowed shaft, two condyles at the distal end. */
  femur: {
    parts: [
      ellipse(0, -0.008, 0.058, 0.056, 16),
      [[-0.02, -0.035], [0.06, -0.018], [0.13, 0.0], [0.15, 0.07], [0.10, 0.092], [0.05, 0.06], [-0.01, 0.034]],
      outline(FEMUR_SHAFT),
      ellipse(0.955, 0.04, 0.052, 0.046, 12),
      ellipse(0.955, -0.042, 0.052, 0.046, 12),
    ],
    highlight: highlightLine(FEMUR_SHAFT, 0.15, 0.85, -0.45),
  },
  /** A broad flat plateau, tibial tuberosity, slim shaft, medial malleolus at the end. */
  tibia: {
    parts: [outline(TIBIA_SHAFT), ellipse(0.075, 0, 0.03, 0.02, 8), ellipse(1.0, -0.034, 0.042, 0.032, 10)],
    highlight: highlightLine(TIBIA_SHAFT, 0.15, 0.9, -0.4),
  },
  /** Slim, head below the knee, lateral malleolus reaching lower than the tibia. */
  fibula: {
    parts: [outline(FIBULA_SHAFT), ellipse(0.07, 0, 0.032, 0.022, 10), ellipse(1.04, 0, 0.038, 0.024, 10)],
    highlight: highlightLine(FIBULA_SHAFT, 0.2, 0.85, -0.3),
  },
  humerus: {
    parts: [ellipse(0.0, -0.02, 0.085, 0.078, 16), outline(HUMERUS_SHAFT), ellipse(0.985, 0.042, 0.046, 0.04, 10), ellipse(0.985, -0.042, 0.046, 0.04, 10)],
    highlight: highlightLine(HUMERUS_SHAFT, 0.15, 0.85, -0.45),
  },
  ulna: {
    parts: [outline(ULNA_SHAFT), ellipse(0.02, -0.018, 0.05, 0.05, 10), ellipse(0.99, 0.0, 0.03, 0.02, 8)],
    highlight: highlightLine(ULNA_SHAFT, 0.2, 0.85, -0.3),
  },
  radius: {
    parts: [outline(RADIUS_SHAFT), ellipse(0.04, 0, 0.034, 0.028, 10), ellipse(0.995, 0.0, 0.05, 0.044, 10)],
    highlight: highlightLine(RADIUS_SHAFT, 0.2, 0.85, -0.3),
  },
  phalanx: { parts: [outline(PHALANX, 10)], highlight: [] },
  metatarsal: { parts: [outline(METATARSAL, 10)], highlight: highlightLine(METATARSAL, 0.2, 0.8, -0.3) },
  /** The heel bone: from the heel point (u=0) to the cuboid (u=1). */
  calcaneus: {
    parts: [[[0.0, 0.0], [0.04, 0.32], [0.3, 0.42], [0.62, 0.34], [1.0, 0.2], [1.0, -0.2], [0.62, -0.3], [0.28, -0.36], [0.04, -0.3]]],
    highlight: [[0.1, 0.18], [0.45, 0.2], [0.8, 0.12]],
  },
  /** The talus under the tibia. */
  talus: { parts: [ellipse(0.5, 0, 0.5, 0.36, 12)], highlight: [] },
  /** A small rounded carpal / tarsal block. */
  block: { parts: [ellipse(0.5, 0, 0.5, 0.4, 8)], highlight: [] },
  /** One vertebral body in side view: u along the spine. */
  vertebra: { parts: [[[0.05, -0.5], [0.95, -0.5], [1.0, -0.38], [1.0, 0.38], [0.95, 0.5], [0.05, 0.5], [0, 0.38], [0, -0.38]]], highlight: [] },
} as const satisfies Record<string, BoneTemplate>;

export type TemplateId = keyof typeof TEMPLATES;

/** Foot-bone widths relative to the fan (see `footFan`). */
export const FOOT_BONE_WIDTH = 1;
