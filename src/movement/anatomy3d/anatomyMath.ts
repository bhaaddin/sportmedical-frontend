/*
 * Pure math of the 3D anatomy viewer: posing a body, the muscle paths in world space, the tube profile of a muscle, which group a
 * muscle belongs to and what it is called, the orthographic camera that lays the 3D scene exactly over the video picture, and the
 * hit test for hovering a muscle. No rendering library is touched here, so it is all unit-tested.
 */
import type { Anatomy } from './anatomyData';

export interface Vec3 { x: number; y: number; z: number }

/** v' = R(q) * v + p, the reference formula of the contract (quaternion w, x, y, z). */
export function poseVector(poses: Float32Array, nBodies: number, frame: number, body: number, local: readonly [number, number, number], out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const o = (frame * nBodies + body) * 7;
  const px = poses[o], py = poses[o + 1], pz = poses[o + 2];
  const w = poses[o + 3], x = poses[o + 4], y = poses[o + 5], z = poses[o + 6];
  const [vx, vy, vz] = local;
  /* t = 2 * (q.xyz x v); v' = v + w * t + q.xyz x t */
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  out.x = vx + w * tx + (y * tz - z * ty) + px;
  out.y = vy + w * ty + (z * tx - x * tz) + py;
  out.z = vz + w * tz + (x * ty - y * tx) + pz;
  return out;
}

/** The world-space points of one muscle path on one frame, written into `out` (3 numbers per via point). */
export function musclePathWorld(a: Pick<Anatomy, 'poses' | 'bodies' | 'muscles'>, frame: number, muscle: number, out: Float32Array = new Float32Array(a.muscles[muscle].path.length * 3)): Float32Array {
  const tmp: Vec3 = { x: 0, y: 0, z: 0 };
  const path = a.muscles[muscle].path;
  for (let i = 0; i < path.length; i++) {
    poseVector(a.poses, a.bodies.length, frame, path[i][0], path[i][1], tmp);
    out[i * 3] = tmp.x;
    out[i * 3 + 1] = tmp.y;
    out[i * 3 + 2] = tmp.z;
  }
  return out;
}

export function polylineLength(points: ArrayLike<number>, n = points.length / 3): number {
  let L = 0;
  for (let i = 1; i < n; i++) L += Math.hypot(points[i * 3] - points[i * 3 - 3], points[i * 3 + 1] - points[i * 3 - 2], points[i * 3 + 2] - points[i * 3 - 1]);
  return L;
}

/* ───────── the tube of a muscle ───────── */

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Where along a muscle (0..1) the tendon is: thin whitish ends, a fusiform belly between them. 0 = all muscle, 1 = all tendon. */
export function tendonness(t: number): number {
  return 1 - smooth(0.05, 0.2, t) * (1 - smooth(0.8, 0.95, t));
}

/** Radius along the muscle as a fraction of the belly radius: ~0.25 at the tendon ends, 1 in the middle. */
export function radiusProfile(t: number): number {
  const belly = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0.55);
  return 0.24 + 0.76 * belly * (1 - tendonness(t) * 0.55);
}

/** The belly radius (metres) of a muscle whose path is `length` long: a muscle is about as thick as a twentieth of its length. */
export function bellyRadius(length: number): number {
  return Math.min(0.034, Math.max(0.0038, 0.056 * length));
}

/** Swelling with the relative length: thicker when shortened, thinner when stretched, and a little more under contraction. */
export function swell(relativeLength: number, contraction: number): number {
  const byLength = Math.min(1.5, Math.max(0.75, 1 + 1.0 * (1 - relativeLength)));
  return byLength * (1 + 0.3 * Math.min(1, Math.max(0, contraction)));
}

/** Muted rose at rest to bright red under contraction; `rgb` in 0..1. */
export function muscleRgb(contraction: number): [number, number, number] {
  const c = Math.min(1, Math.max(0, contraction));
  return [0.6 + 0.34 * c, 0.2 - 0.09 * c, 0.22 - 0.1 * c];
}
export const TENDON_RGB: [number, number, number] = [0.93, 0.9, 0.82];

/* ───────── what a muscle is ───────── */

export type MuscleGroup = 'thigh' | 'calf' | 'glutes' | 'trunk' | 'arm';
export const MUSCLE_GROUPS: readonly MuscleGroup[] = ['thigh', 'calf', 'glutes', 'trunk', 'arm'];

const GLUTES = /^(glmax|glmed|glmin|piri)/i;
const THIGH = /^(recfem|vas|bflh|bfsh|semi|sart|grac|tfl|add|psoas|iliacus|pect_f)/i;
const CALF = /^(gas|soleus|tibant|tibpost|per|edl|ehl|fdl|fhl|plant)/i;
const TRUNK = /^(Ps_|rect_abd|IL_|LTp|QL|MF|EO|IO|ES|SP|Sem)/;

/** The group of a MyoSim muscle by its name; everything that is not leg or trunk belongs to the arm and shoulder. */
export function muscleGroup(name: string): MuscleGroup {
  if (GLUTES.test(name)) return 'glutes';
  if (CALF.test(name)) return 'calf';
  if (THIGH.test(name)) return 'thigh';
  if (TRUNK.test(name)) return 'trunk';
  return 'arm';
}

const CZ: [RegExp, string][] = [
  [/^glmax/i, 'Velký hýžďový sval'], [/^glmed/i, 'Střední hýžďový sval'], [/^glmin/i, 'Malý hýžďový sval'], [/^piri/i, 'Hruškovitý sval'],
  [/^psoas/i, 'Bedrokyčlostehenní sval'], [/^iliacus/i, 'Kyčelní sval'], [/^recfem/i, 'Přímý sval stehenní'], [/^vasmed/i, 'Vnitřní hlava čtyřhlavého svalu'],
  [/^vaslat/i, 'Zevní hlava čtyřhlavého svalu'], [/^vasint/i, 'Střední hlava čtyřhlavého svalu'], [/^bflh/i, 'Dvojhlavý sval stehna, dlouhá hlava'],
  [/^bfsh/i, 'Dvojhlavý sval stehna, krátká hlava'], [/^semimem/i, 'Poloblanitý sval'], [/^semiten/i, 'Pološlašitý sval'], [/^sart/i, 'Krejčovský sval'],
  [/^grac/i, 'Štíhlý sval'], [/^tfl/i, 'Napínač povázky stehenní'], [/^add/i, 'Přitahovač stehna'], [/^gasmed/i, 'Lýtkový sval, vnitřní hlava'],
  [/^gaslat/i, 'Lýtkový sval, zevní hlava'], [/^soleus/i, 'Sval měchýřovitý'], [/^tibant/i, 'Přední sval holenní'], [/^tibpost/i, 'Zadní sval holenní'],
  [/^perlong/i, 'Dlouhý sval lýtkový'], [/^perbrev/i, 'Krátký sval lýtkový'], [/^edl/i, 'Dlouhý natahovač prstů'], [/^ehl/i, 'Dlouhý natahovač palce'],
  [/^fdl/i, 'Dlouhý ohýbač prstů'], [/^fhl/i, 'Dlouhý ohýbač palce'], [/^rect_abd/i, 'Přímý sval břišní'], [/^EO/, 'Zevní šikmý sval břišní'],
  [/^IO/, 'Vnitřní šikmý sval břišní'], [/^Ps_/, 'Bederní sval'], [/^QL/, 'Čtyřúhelníkový sval bederní'], [/^MF/, 'Mnohodílný sval'],
  [/^IL_/, 'Kyčelnožeberní sval'], [/^LT/, 'Nejdelší sval zádový'], [/^DELT/, 'Deltový sval'], [/^PECM/, 'Velký sval prsní'], [/^LAT/, 'Široký sval zádový'],
  [/^TRI/, 'Trojhlavý sval pažní'], [/^BIC/, 'Dvojhlavý sval pažní'], [/^BRA/, 'Sval pažní'], [/^BRD/, 'Sval vřetenní'], [/^SUPSP/, 'Nadhřebenový sval'],
  [/^INFSP/, 'Podhřebenový sval'], [/^SUBSC/, 'Podlopatkový sval'], [/^TMAJ/, 'Velký oblý sval'], [/^TMIN/, 'Malý oblý sval'], [/^CORB/, 'Hákový sval pažní'],
  [/^(FD|FC|FP|PL|PT|PQ)/, 'Ohýbač předloktí a ruky'], [/^(ED|EC|EI|EP|ECU|EPL|EPB|APL)/, 'Natahovač předloktí a ruky'], [/^(RI|LU|UI|OP)/, 'Malý sval ruky'],
];

/** "r" / "l" of a MyoSim name: the athlete's right and left. */
export function sideOfName(name: string): 'R' | 'L' | null {
  const m = /_(r|l)(?:_tendon)?$/i.exec(name) ?? /_(r|l)_/i.exec(name);
  return m ? (m[1].toLowerCase() === 'r' ? 'R' : 'L') : null;
}

/** A short Czech name with the side ("Přímý sval stehenní, pravý"). Unknown muscles fall back to their code. */
export function muscleLabel(name: string): string {
  const hit = CZ.find(([re]) => re.test(name));
  const base = hit ? hit[1] : `Sval ${name.replace(/_(r|l)?(_tendon)?$/i, '')}`;
  const side = sideOfName(name);
  return side === null ? base : `${base}, ${side === 'R' ? 'pravá strana' : 'levá strana'}`;
}

/** Ligaments are drawn as tendons only; they are not muscles. */
export const isLigament = (name: string): boolean => /ligament/i.test(name);

/* ───────── regions of a finding -> the bodies and muscles it concerns ───────── */

const REGION_BODIES: Record<string, RegExp[]> = {
  knee: [/^femur/, /^tibia/, /^patella/],
  hip: [/^pelvis/, /^sacrum/, /^femur/],
  ankle: [/^tibia/, /^talus/, /^calcn/],
  foot: [/^talus/, /^calcn/, /^toes/],
  trunk: [/^lumbar/, /^torso/, /^sacrum/, /^head/],
  pelvis: [/^pelvis/, /^sacrum/],
};

/** Names of the bodies a finding's region and side stand for ("knee", "L" -> femur_l, tibia_l, patella_l). Unknown regions give none. */
export function regionBodies(region: string, side: 'L' | 'R' | null, bodyNames: readonly string[]): Set<string> {
  const res = REGION_BODIES[region];
  const out = new Set<string>();
  if (res === undefined) return out;
  for (const name of bodyNames) {
    if (!res.some((re) => re.test(name))) continue;
    const s = /_([rl])$/.exec(name)?.[1];
    if (s !== undefined && side !== null && s !== side.toLowerCase()) continue;
    out.add(name);
  }
  return out;
}

/** Muscles that attach to at least one of the given bodies. */
export function musclesOnBodies(a: Pick<Anatomy, 'muscles' | 'bodies'>, bodies: ReadonlySet<string>): Set<number> {
  const out = new Set<number>();
  a.muscles.forEach((m, i) => {
    if (m.path.some((p) => bodies.has(a.bodies[p[0]].name))) out.add(i);
  });
  return out;
}

/* ───────── the camera that lays the 3D scene over the video ───────── */

export interface OrthoBounds { left: number; right: number; top: number; bottom: number }

/**
 * The orthographic frustum, in world metres (X right, Z up), that makes world (X, Z) land exactly on the video pixel
 * (X * pxPerM, -Z * pxPerM) wherever the video picture sits in the stage (`rect`: letterbox or the Detail crop).
 */
export function orthoBounds(rect: { x: number; y: number; scale: number }, stage: { w: number; h: number }, pxPerM: number): OrthoBounds {
  const k = rect.scale * pxPerM;
  return { left: -rect.x / k, right: (stage.w - rect.x) / k, top: rect.y / k, bottom: -(stage.h - rect.y) / k };
}

/** World (X, Z) -> a point of the stage in CSS pixels, the inverse of `orthoBounds`. */
export function worldToStage(rect: { x: number; y: number; scale: number }, pxPerM: number, X: number, Z: number): { x: number; y: number } {
  const k = rect.scale * pxPerM;
  return { x: rect.x + X * k, y: rect.y - Z * k };
}

/* ───────── hovering a muscle ───────── */

export interface Hit { index: number; distance: number }

/** Distance from a point to a segment. */
export function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * The muscle whose projected centre line passes closest to the pointer (within `tolerance` CSS pixels). `lines` holds the
 * projected paths as flat [x, y, ...] arrays; null entries are muscles that are hidden.
 */
export function nearestMuscle(lines: readonly (ArrayLike<number> | null)[], x: number, y: number, tolerance: number, radii?: ArrayLike<number>): Hit | null {
  let best: Hit | null = null;
  lines.forEach((l, i) => {
    if (l === null) return;
    const tol = tolerance + (radii ? radii[i] ?? 0 : 0);
    for (let k = 0; k + 3 < l.length; k += 2) {
      const d = segmentDistance(x, y, l[k], l[k + 1], l[k + 2], l[k + 3]);
      if (d <= tol && (best === null || d - 0.001 * 0 < best.distance)) best = { index: i, distance: d };
    }
  });
  return best;
}

/* ───────── the centre line and the frames of a tube ───────── */

/**
 * Samples a smooth curve through `n` via points (flat [x, y, z, ...]) into `rings` evenly spaced points (by length): straight for
 * two points, a Catmull-Rom spline through more. Writes `rings * 3` numbers into `out`.
 */
export function sampleCenterline(points: ArrayLike<number>, n: number, rings: number, out: Float32Array): void {
  const cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(points[i * 3] - points[i * 3 - 3], points[i * 3 + 1] - points[i * 3 - 2], points[i * 3 + 2] - points[i * 3 - 1]);
  const total = cum[n - 1] || 1e-9;
  let seg = 0;
  for (let r = 0; r < rings; r++) {
    const d = (r / (rings - 1)) * total;
    while (seg < n - 2 && cum[seg + 1] < d) seg++;
    const span = cum[seg + 1] - cum[seg] || 1e-9;
    const u = Math.min(1, Math.max(0, (d - cum[seg]) / span));
    const i1 = seg, i2 = seg + 1;
    const i0 = Math.max(0, i1 - 1), i3 = Math.min(n - 1, i2 + 1);
    for (let c = 0; c < 3; c++) {
      const p0 = points[i0 * 3 + c], p1 = points[i1 * 3 + c], p2 = points[i2 * 3 + c], p3 = points[i3 * 3 + c];
      out[r * 3 + c] = n === 2
        ? p1 + (p2 - p1) * u
        : 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
    }
  }
}

/**
 * Parallel-transport frames along a centre line: for every ring a unit tangent, a normal and a binormal (so a tube does not twist).
 * `ref` is the direction the first normal is made from (any direction that is not along the line).
 */
export function tubeFrames(line: ArrayLike<number>, rings: number, tangents: Float32Array, normals: Float32Array, binormals: Float32Array, ref: Vec3 = { x: 0, y: 1, z: 0 }): void {
  for (let r = 0; r < rings; r++) {
    const a = Math.max(0, r - 1), b = Math.min(rings - 1, r + 1);
    let tx = line[b * 3] - line[a * 3], ty = line[b * 3 + 1] - line[a * 3 + 1], tz = line[b * 3 + 2] - line[a * 3 + 2];
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    tangents[r * 3] = tx; tangents[r * 3 + 1] = ty; tangents[r * 3 + 2] = tz;
    let nx: number, ny: number, nz: number;
    if (r === 0) {
      /* first normal: the reference direction made perpendicular to the tangent */
      let rx = ref.x, ry = ref.y, rz = ref.z;
      if (Math.abs(tx * rx + ty * ry + tz * rz) > 0.95) { rx = 1; ry = 0; rz = 0; }
      const d = tx * rx + ty * ry + tz * rz;
      nx = rx - tx * d; ny = ry - ty * d; nz = rz - tz * d;
    } else {
      const px = normals[(r - 1) * 3], py = normals[(r - 1) * 3 + 1], pz = normals[(r - 1) * 3 + 2];
      const d = tx * px + ty * py + tz * pz;
      nx = px - tx * d; ny = py - ty * d; nz = pz - tz * d;
    }
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    normals[r * 3] = nx; normals[r * 3 + 1] = ny; normals[r * 3 + 2] = nz;
    binormals[r * 3] = ty * nz - tz * ny;
    binormals[r * 3 + 1] = tz * nx - tx * nz;
    binormals[r * 3 + 2] = tx * ny - ty * nx;
  }
}

/* ───────── motion: interpolation, easing, event moments, the intro, camera presets ───────── */

/** Blends the poses of two frames into `out` ([B,7]: lerp the positions, slerp the unit quaternions w x y z). */
export function lerpPoses(poses: Float32Array, nBodies: number, frame: number, out: Float32Array): void {
  const last = poses.length / (nBodies * 7) - 1;
  const f = Math.min(last, Math.max(0, frame));
  const i0 = Math.floor(f);
  const i1 = Math.min(last, i0 + 1);
  const a = f - i0;
  for (let b = 0; b < nBodies; b++) {
    const o0 = (i0 * nBodies + b) * 7;
    const o1 = (i1 * nBodies + b) * 7;
    const o = b * 7;
    for (let k = 0; k < 3; k++) out[o + k] = poses[o0 + k] + (poses[o1 + k] - poses[o0 + k]) * a;
    let w1 = poses[o1 + 3], x1 = poses[o1 + 4], y1 = poses[o1 + 5], z1 = poses[o1 + 6];
    const w0 = poses[o0 + 3], x0 = poses[o0 + 4], y0 = poses[o0 + 5], z0 = poses[o0 + 6];
    let cos = w0 * w1 + x0 * x1 + y0 * y1 + z0 * z1;
    if (cos < 0) { cos = -cos; w1 = -w1; x1 = -x1; y1 = -y1; z1 = -z1; }
    let s0: number, s1: number;
    if (cos > 0.9995) { s0 = 1 - a; s1 = a; } else {
      const th = Math.acos(cos);
      const sn = Math.sin(th);
      s0 = Math.sin((1 - a) * th) / sn;
      s1 = Math.sin(a * th) / sn;
    }
    const w = w0 * s0 + w1 * s1, x = x0 * s0 + x1 * s1, y = y0 * s0 + y1 * s1, z = z0 * s0 + z1 * s1;
    const n = Math.hypot(w, x, y, z) || 1;
    out[o + 3] = w / n; out[o + 4] = x / n; out[o + 5] = y / n; out[o + 6] = z / n;
  }
}

/** Blends one value of a per-frame table (muscle length, contraction) between two frames. */
export function lerpAt(table: ArrayLike<number>, stride: number, frames: number, frame: number, index: number): number {
  const f = Math.min(frames - 1, Math.max(0, frame));
  const i0 = Math.floor(f);
  const i1 = Math.min(frames - 1, i0 + 1);
  const a = f - i0;
  const v0 = table[i0 * stride + index];
  return v0 + (table[i1 * stride + index] - v0) * a;
}

export const easeInOutCubic = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** The earlier key frames for the ghost trail: every `step` frames back from `frame`, up to `count`, nearest first, never before 0. */
export function onionFrames(frame: number, step = 6, count = 4): number[] {
  const out: number[] = [];
  for (let k = 1; k <= count; k++) {
    const f = Math.floor(frame) - k * step;
    if (f < 0) break;
    out.push(f);
  }
  return out;
}

/** How strongly an event moment glows at `frame`: 1 on the event frame, fading to 0 over `span` frames either side. */
export function pulseIntensity(frame: number, eventFrame: number, span = 6): number {
  const d = Math.abs(frame - eventFrame);
  return d >= span ? 0 : 1 - d / span;
}

export interface TimedEvent { type: string; side: 'L' | 'R' | null; frame: number }
export const PULSE_EVENTS: readonly string[] = ['foot_strike', 'initial_contact', 'peak_knee_flexion'];

/** The strongest event pulse at a frame: which leg and how much (null when none is near). */
export function activePulse(events: readonly TimedEvent[], frame: number, span = 6): { side: 'L' | 'R'; k: number; frame: number } | null {
  let best: { side: 'L' | 'R'; k: number; frame: number } | null = null;
  for (const e of events) {
    if (e.side === null || !PULSE_EVENTS.includes(e.type)) continue;
    const k = pulseIntensity(frame, e.frame, span);
    if (k > 0 && (best === null || k > best.k)) best = { side: e.side, k, frame: e.frame };
  }
  return best;
}

/** Slow motion near events: true when `frame` is within `window` frames of a pulse event. */
export function nearEvent(events: readonly TimedEvent[], frame: number, window = 5): boolean {
  return events.some((e) => PULSE_EVENTS.includes(e.type) && Math.abs(frame - e.frame) <= window);
}

/**
 * The frame offset that lines up two clips on their first initial contact (or foot strike): add it to a frame of clip A to get
 * the matching frame of clip B. Zero when either clip has no such event.
 */
export function alignOffset(a: readonly TimedEvent[], b: readonly TimedEvent[]): number {
  const first = (ev: readonly TimedEvent[]) => ev.filter((e) => e.type === 'initial_contact' || e.type === 'foot_strike').sort((x, y) => x.frame - y.frame)[0];
  const ea = first(a);
  const eb = first(b);
  return ea && eb ? eb.frame - ea.frame : 0;
}

/**
 * The intro of the 3D view: the bones appear bottom-up. `rank` is a bone's height among all bones (0 = lowest, 1 = highest) and `p`
 * the intro's progress 0..1; the bones take the first 80 % of the time, the muscles fade in during the last 25 %.
 */
export function introBone(rank: number, p: number): number {
  const start = rank * 0.45;
  return Math.min(1, Math.max(0, (p - start) / 0.55));
}
export const introMuscles = (p: number): number => Math.min(1, Math.max(0, (p - 0.75) / 0.25));

export type CameraPreset = 'video' | 'front' | 'side' | 'back' | 'top';

/**
 * Where the camera stands for a preset, around `target`, at distance `d`. `heading` is the horizontal direction the athlete faces
 * (unit x, y); 'video' is the camera of the recording (looking along +Y).
 */
export function cameraPreset(name: CameraPreset, heading: { x: number; y: number }, target: Vec3, d: number): { position: Vec3; up: Vec3 } {
  const h = Math.hypot(heading.x, heading.y) < 1e-6 ? { x: 0, y: -1 } : { x: heading.x / Math.hypot(heading.x, heading.y), y: heading.y / Math.hypot(heading.x, heading.y) };
  const up = { x: 0, y: 0, z: 1 };
  switch (name) {
    case 'video': return { position: { x: target.x, y: target.y - d, z: target.z + 0.1 }, up };
    case 'front': return { position: { x: target.x + h.x * d, y: target.y + h.y * d, z: target.z + 0.1 }, up };
    case 'back': return { position: { x: target.x - h.x * d, y: target.y - h.y * d, z: target.z + 0.1 }, up };
    case 'side': return { position: { x: target.x - h.y * d, y: target.y + h.x * d, z: target.z + 0.1 }, up };
    case 'top': return { position: { x: target.x, y: target.y - 0.001, z: target.z + d }, up };
  }
}
