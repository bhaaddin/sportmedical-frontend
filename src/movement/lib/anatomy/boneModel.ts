/*
 * The bones of one frame: from the rig (joints, feet, hands, face) to placed, depth-ordered shapes. Pure: nothing here touches a
 * canvas. Every bone is a parametric silhouette placed between two joints (templates.ts), the spine a chain of vertebrae along a
 * curve, the ribs arcs between spine and sternum, the pelvis a polygon in hip-line coordinates, the skull and jaw built on the
 * face points, the foot and hand fanned out over their own points.
 */
import { depthOf, footFan, handBones, isFar, normalFor, placeTemplate, type Group } from './geometry';
import { SIDES, type Rig, type SideId } from './rig';
import { TEMPLATES, ellipse, type BoneTemplate } from './templates';
import { add, clamp, dist, lerp, mid, mul, perp, sub, unit, v, type V } from './vec';

export type Tone = 'bone' | 'small' | 'dark' | 'teeth' | 'cartilage' | 'tendon';

/** One drawable bone-like shape. */
export interface Shape {
  id: string;
  /** Painting order (bigger = later) and the group within it. */
  z: number;
  far: boolean;
  tone: Tone;
  /** Closed outlines, flat [x, y, ...]. */
  polys: number[][];
  /** Open polylines drawn as strokes (ribs, clavicles, tendons), each with `lineWidth`. */
  lines: number[][];
  lineWidth: number;
  highlight: number[];
  /** Half width in pixels, for the shading gradient and the outline weight; the bone axis for the gradient. */
  half: number;
  axis: [V, V] | null;
  /** A flat bone (pelvis, skull, blade): shaded from its middle outward instead of across an axis. */
  flat?: boolean;
}

export interface Caps { x: number; y: number; rx: number; ry: number; rot: number; z: number; far: boolean; id: string }

export interface BoneFrame { shapes: Shape[]; caps: Caps[] }

const flat = (pts: readonly V[]): number[] => {
  const out: number[] = [];
  for (const p of pts) out.push(p.x, p.y);
  return out;
};

function fromPlaced(id: string, tpl: BoneTemplate, a: V, b: V, normal: V, z: number, far: boolean, opts: { widthScale?: number; offsetV?: number; tone?: Tone } = {}): Shape {
  const placed = placeTemplate(tpl, a, b, normal, opts.widthScale ?? 1, opts.offsetV ?? 0);
  return { id, z, far, tone: opts.tone ?? 'bone', polys: placed.parts, lines: [], lineWidth: 0, highlight: placed.highlight, half: placed.half, axis: [a, b] };
}

/** A quadratic Bezier sampled into points. */
function curve(a: V, c: V, b: V, n = 10): V[] {
  const out: V[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const m = 1 - t;
    out.push(v(m * m * a.x + 2 * m * t * c.x + t * t * b.x, m * m * a.y + 2 * m * t * c.y + t * t * b.y));
  }
  return out;
}

/** The point at (lat, along) of a local frame: origin + across*lat + up*along. */
const local = (o: V, across: V, up: V, lat: number, along: number): V => v(o.x + across.x * lat + up.x * along, o.y + across.y * lat + up.y * along);

/* ───────── pelvis templates, in hip-line units (a = ±1 at the hip joints) and torso units ───────── */

/** Front: half outline of the pelvis (iliac wing, acetabular rim, ischium, pubic ramus), a = out from the midline, b = up (torso lengths). */
export const PELVIS_FRONT_HALF: [number, number][] = [
  [0.04, -0.1], [0.3, -0.145], [0.58, -0.17], [0.82, -0.17], [1.0, -0.13], [1.12, -0.04], [1.26, 0.03], [1.44, 0.08], [1.58, 0.15], [1.6, 0.22], [1.48, 0.28], [1.2, 0.27], [0.95, 0.25], [0.62, 0.22], [0.3, 0.2], [0.04, 0.19],
];
/** The pelvic inlet and the two obturator foramina, as ellipses (a, b, ra, rb). */
const PELVIS_HOLES_FRONT: [number, number, number, number][] = [[0, 0.03, 0.6, 0.115], [0.7, -0.09, 0.2, 0.07], [-0.7, -0.09, 0.2, 0.07]];
const SACRUM_FRONT: [number, number][] = [[-0.34, 0.2], [0.34, 0.2], [0.2, -0.01], [0.06, -0.13], [-0.06, -0.13], [-0.2, -0.01]];
/** Side: the pelvis in profile around the hip joint; fa = forward, b = up (torso lengths). */
const PELVIS_SIDE: [number, number][] = [
  [-0.19, 0.12], [-0.15, 0.21], [-0.02, 0.255], [0.1, 0.215], [0.15, 0.15], [0.085, 0.06], [0.1, -0.015], [0.125, -0.1], [0.06, -0.145], [-0.04, -0.12], [-0.1, -0.15], [-0.16, -0.1], [-0.19, 0.0],
];
const SACRUM_SIDE: [number, number][] = [[-0.21, 0.22], [-0.15, 0.24], [-0.17, 0.08], [-0.2, -0.05], [-0.25, -0.13], [-0.22, -0.16], [-0.17, -0.05], [-0.14, 0.1]];

/** Build all the bones of a frame. */
export function buildBones(rig: Rig): BoneFrame {
  const shapes: Shape[] = [];
  const caps: Caps[] = [];
  const T = rig.torso;
  const side = rig.view === 'side';
  const back = side ? mul(rig.fwd, -1) : v(0, 0);
  const across = perp(rig.up);
  const coreZ = (k: number) => depthOf('core', null, rig) + k * 0.01;

  /* ── legs ── */
  for (const S of SIDES) {
    const hip = rig.p[`${S}.hip`];
    const knee = rig.p[`${S}.knee`];
    const ankle = rig.p[`${S}.ankle`];
    const heel = rig.p[`${S}.heel`];
    const toeB = rig.p[`${S}.big_toe`];
    const toeS = rig.p[`${S}.small_toe`];
    const z = depthOf('leg', S, rig);
    const far = isFar(S, rig);
    if (hip && knee) {
      const n = normalFor(rig, S, unit(sub(knee, hip)));
      shapes.push(fromPlaced(`${S}.femur`, TEMPLATES.femur, hip, knee, n, z, far));
      caps.push({ id: `${S}.hip`, x: hip.x, y: hip.y, rx: dist(hip, knee) * 0.04, ry: dist(hip, knee) * 0.04, rot: 0, z, far });
    }
    if (knee && ankle) {
      const dir = unit(sub(ankle, knee));
      const n = normalFor(rig, S, dir);
      shapes.push(fromPlaced(`${S}.tibia`, TEMPLATES.tibia, knee, ankle, n, z, far));
      shapes.push(fromPlaced(`${S}.fibula`, TEMPLATES.fibula, knee, ankle, n, z, far, { offsetV: side ? -0.04 : 0.062 }));
      const thigh = hip ? dist(hip, knee) : dist(knee, ankle);
      if (hip) {
        const fd = unit(sub(knee, hip));
        const bis = unit(add(fd, dir));
        const joint = perp(bis);
        caps.push({ id: `${S}.knee`, x: knee.x, y: knee.y, rx: thigh * 0.1, ry: thigh * 0.022, rot: Math.atan2(joint.y, joint.x), z, far });
        /* the patella rides on the front of the knee, sliding down as it bends */
        const anterior = side ? rig.fwd : mul(bis, 1);
        const c = side
          ? add(knee, mul(unit(add(anterior, mul(sub(dir, fd), 0.35))), thigh * 0.062))
          : add(knee, mul(fd, -thigh * 0.04));
        shapes.push({
          id: `${S}.patella`, z: z + 0.5, far, tone: 'bone',
          polys: [ellipse(c.x, c.y, thigh * 0.04, thigh * (side ? 0.05 : 0.055), 12, Math.atan2(fd.y, fd.x)).flat()],
          lines: [], lineWidth: 0, highlight: [], half: thigh * 0.045, axis: [add(c, mul(fd, -thigh * 0.05)), add(c, mul(fd, thigh * 0.05))],
        });
      }
      const sh = dist(knee, ankle);
      caps.push({ id: `${S}.ankle`, x: ankle.x, y: ankle.y, rx: sh * 0.08, ry: sh * 0.02, rot: Math.atan2(perp(dir).y, perp(dir).x), z, far });
    }
    if (heel && toeB && toeS && ankle) {
      const tip = lerp(toeB, toeS, 0.5);
      const FL = Math.max(1, dist(heel, tip));
      const f = unit(sub(tip, heel));
      const nf = normalFor(rig, S, f);
      const lift = mul(sub(ankle, heel), 0.3);
      const fan = footFan(heel, toeB, toeS);
      shapes.push(fromPlaced(`${S}.calcaneus`, TEMPLATES.calcaneus, add(heel, lift), add(fan.tarsus, lift), nf, z, far, { widthScale: FL * 0.34 / Math.max(1, dist(heel, fan.tarsus)) * 0.45 }));
      shapes.push(fromPlaced(`${S}.talus`, TEMPLATES.talus, add(add(ankle, mul(f, -FL * 0.07)), mul(sub(heel, ankle), 0.22)), add(add(ankle, mul(f, FL * 0.14)), mul(sub(heel, ankle), 0.22)), nf, z, far, { widthScale: 0.8 }));
      fan.metatarsals.forEach((m, k) => {
        shapes.push(fromPlaced(`${S}.mt${k}`, TEMPLATES.metatarsal, add(m.a, lift), add(m.b, lift), nf, z, far, { widthScale: 0.75 }));
      });
      fan.phalanges.forEach((toe, k) => toe.forEach((p, i) => {
        shapes.push(fromPlaced(`${S}.toe${k}.${i}`, TEMPLATES.phalanx, add(p.a, lift), add(p.b, lift), nf, z, far, { tone: 'small', widthScale: 0.9 }));
      }));
    }
  }

  /* ── arms ── */
  for (const S of SIDES) {
    const sh = rig.p[`${S}.shoulder`];
    const el = rig.p[`${S}.elbow`];
    const wr = rig.p[`${S}.wrist`];
    const z = depthOf('arm', S, rig);
    const far = isFar(S, rig);
    if (sh && el) {
      const n = normalFor(rig, S, unit(sub(el, sh)));
      shapes.push(fromPlaced(`${S}.humerus`, TEMPLATES.humerus, sh, el, n, z, far));
      const L = dist(sh, el);
      caps.push({ id: `${S}.shoulder`, x: sh.x, y: sh.y, rx: L * 0.05, ry: L * 0.05, rot: 0, z, far });
    }
    if (el && wr) {
      const dir = unit(sub(wr, el));
      const n = normalFor(rig, S, dir);
      shapes.push(fromPlaced(`${S}.ulna`, TEMPLATES.ulna, el, wr, n, z, far, { offsetV: -0.03 }));
      shapes.push(fromPlaced(`${S}.radius`, TEMPLATES.radius, el, wr, n, z, far, { offsetV: 0.032 }));
      const L = dist(el, wr);
      caps.push({ id: `${S}.elbow`, x: el.x, y: el.y, rx: L * 0.07, ry: L * 0.05, rot: Math.atan2(perp(dir).y, perp(dir).x), z, far });
      caps.push({ id: `${S}.wrist`, x: wr.x, y: wr.y, rx: L * 0.055, ry: L * 0.03, rot: Math.atan2(perp(dir).y, perp(dir).x), z, far });
    }
    const hb = handBones(rig.hand[S]);
    if (hb !== null) {
      for (const b of hb.bones) {
        const nb = perp(unit(sub(b.b, b.a)));
        shapes.push(fromPlaced(`${S}.hand.${b.id}`, b.kind === 'phalanx' ? TEMPLATES.phalanx : TEMPLATES.metatarsal, b.a, b.b, nb, z + 0.4, far, { tone: 'small', widthScale: 0.9 }));
      }
      const handLen = hb.carpals.length ? dist(hb.carpals[0], rig.hand[S][0] ?? hb.carpals[0]) * 5 + 1 : 20;
      hb.carpals.forEach((c, i) => {
        shapes.push(fromPlaced(`${S}.carpal${i}`, TEMPLATES.block, add(c, mul(hb.palm, -handLen * 0.07)), add(c, mul(hb.palm, handLen * 0.07)), perp(hb.palm), z + 0.4, far, { tone: 'small', widthScale: 0.9 }));
      });
      hb.joints.forEach((j, i) => caps.push({ id: `${S}.fj${i}`, x: j.x, y: j.y, rx: Math.max(0.8, handLen * 0.018), ry: Math.max(0.8, handLen * 0.018), rot: 0, z: z + 0.5, far }));
    }
  }

  /* ── spine: lumbar and thoracic along a curve from the sacrum to the neck, then the cervical vertebrae up to the skull ── */
  const S0 = add(rig.pelvisC, mul(rig.up, T * 0.03));
  const NB = add(rig.shoulderC, mul(rig.up, T * 0.02));
  const face = rig.face;
  const chin = face[8];
  const browC = face[19] && face[24] ? mid(face[19]!, face[24]!) : undefined;
  const jawL = face[0];
  const jawR = face[16];
  const head = chin && browC ? { h: dist(chin, browC), up: unit(sub(browC, chin)), chin, browC } : null;
  const SB = jawL && jawR ? add(mid(jawL, jawR), mul(back, head ? head.h * 0.14 : 0)) : head ? add(head.chin, mul(head.up, head.h * 0.5)) : add(NB, mul(rig.up, T * 0.3));
  const trunkCurve = (t: number): V => {
    const base = lerp(S0, NB, t);
    return add(base, mul(back, T * 0.04 * (Math.sin(Math.PI * t) - 0.5 * Math.sin(2 * Math.PI * t))));
  };
  const spine: { c: V; tan: V; spacing: number; kind: 'L' | 'T' | 'C' }[] = [];
  const nBody = 17;
  for (let j = 0; j < nBody; j++) {
    const t = (j + 0.5) / nBody;
    const c = trunkCurve(t);
    const tan = unit(sub(trunkCurve(Math.min(1, t + 0.02)), trunkCurve(Math.max(0, t - 0.02))));
    spine.push({ c, tan, spacing: (dist(S0, NB) / nBody) * 1.02, kind: j < 5 ? 'L' : 'T' });
  }
  for (let i = 0; i < 7; i++) {
    const t = (i + 0.5) / 7;
    const base = lerp(NB, SB, t);
    const c = add(base, mul(back, T * 0.006 * Math.sin(Math.PI * t)));
    spine.push({ c, tan: unit(sub(SB, NB)), spacing: (dist(NB, SB) / 7) * 1.05, kind: 'C' });
  }
  spine.forEach((s, j) => {
    const k = s.kind === 'L' ? 0 : s.kind === 'T' ? 1 : 2;
    const thick = T * (side ? [0.085, 0.062, 0.042][k] : [0.115, 0.082, 0.05][k]);
    const a = sub(s.c, mul(s.tan, s.spacing * 0.42));
    const b = add(s.c, mul(s.tan, s.spacing * 0.42));
    const nrm = perp(s.tan);
    const shape = fromPlaced(`spine.${j}`, TEMPLATES.vertebra, a, b, nrm, coreZ(2), false, { widthScale: thick / Math.max(1, dist(a, b)), tone: 'small' });
    /* a spinous process pointing back (side) or transverse processes (front) */
    const px = side ? [s.c, add(s.c, add(mul(back, thick * 1.1), mul(s.tan, -s.spacing * 0.35)))] : [add(s.c, mul(nrm, -thick * 0.95)), add(s.c, mul(nrm, thick * 0.95))];
    shape.lines = [flat(px)];
    shape.lineWidth = Math.max(1, s.spacing * 0.22);
    shapes.push(shape);
  });
  const thoracic = (k: number): V => spine[17 - k]?.c ?? spine[spine.length - 1].c; // rib k (1..12) rests on T_k

  /* ── ribcage: twelve arcs, a sternum and the costal margin ── */
  const jug = sub(rig.shoulderC, mul(rig.up, T * 0.03));
  const xiph = sub(jug, mul(rig.up, T * 0.4));
  const D1 = T * 0.2;
  const D2 = T * 0.3;
  const stern = (t: number): V => {
    const p = lerp(jug, xiph, t);
    return side ? add(p, mul(rig.fwd, D1 + (D2 - D1) * t)) : p;
  };
  for (let k = 1; k <= 12; k++) {
    const s0 = thoracic(k);
    const lowest = k > 10;
    const e: V = side
      ? lowest ? add(s0, add(mul(rig.fwd, T * 0.14), mul(rig.up, -T * 0.05))) : k <= 7 ? add(stern((k - 1) / 6 * 0.95), mul(rig.up, -T * 0.05)) : add(stern(0.95), add(mul(rig.up, -(k - 7) * T * 0.04), mul(rig.fwd, -(k - 7) * T * 0.035)))
      : null as unknown as V;
    const rows: V[][] = [];
    if (side) {
      const c = add(mid(s0, e), add(mul(rig.up, T * 0.045), mul(rig.fwd, T * 0.02)));
      rows.push(curve(s0, c, e));
    } else {
      const W = T * (0.17 + 0.12 * Math.sin((Math.PI * (k - 0.5)) / 12)) * (lowest ? 0.8 : 1);
      const drop = T * (0.06 + 0.05 * (k / 12));
      for (const sgn of [-1, 1]) {
        const end = lowest ? add(s0, add(mul(across, sgn * W * 0.8), mul(rig.up, -drop * 0.9))) : add(add(stern(clamp((k - 1) / 7, 0, 0.98)), mul(across, sgn * T * 0.03)), mul(rig.up, -drop * 0.35));
        const ctrl = add(add(s0, mul(across, sgn * W * 1.15)), mul(rig.up, T * 0.012));
        rows.push(curve(s0, ctrl, end));
      }
    }
    const shape: Shape = { id: `rib.${k}`, z: coreZ(3) + k * 0.001, far: false, tone: 'bone', polys: [], lines: rows.map(flat), lineWidth: T * 0.019, highlight: [], half: T * 0.012, axis: null };
    shapes.push(shape);
  }
  /* the sternum: manubrium, body and xiphoid as one tapering strip */
  {
    const w = rig.view === 'side' ? T * 0.028 : T * 0.05;
    const nrm = side ? perp(rig.up) : across;
    const sA = stern(0);
    const sB = stern(0.88);
    const sC = stern(1.0);
    shapes.push({
      id: 'sternum', z: coreZ(4), far: false, tone: 'bone', lines: [], lineWidth: 0, highlight: [], half: w, axis: [sA, sC],
      polys: [flat([add(sA, mul(nrm, w * 1.2)), add(sB, mul(nrm, w * 0.8)), add(sC, mul(nrm, w * 0.25)), sub(sC, mul(nrm, w * 0.25)), sub(sB, mul(nrm, w * 0.8)), sub(sA, mul(nrm, w * 1.2))])],
    });
  }

  /* ── pelvis and sacrum ── */
  {
    const hipL = rig.p['L.hip']!;
    const hipR = rig.p['R.hip']!;
    const lx = mul(sub(hipR, hipL), 0.5);
    const place = (pts: [number, number][], fn: (a: number, b: number) => V): number[] => flat(pts.map(([a, b]) => fn(a, b)));
    const frontPt = (a: number, b: number) => local(rig.pelvisC, lx, mul(rig.up, T), a, b);
    const sidePt = (a: number, b: number) => add(add(rig.pelvisC, mul(rig.fwd, a * T)), mul(rig.up, b * T));
    const fn = side ? sidePt : frontPt;
    const z5 = coreZ(5);
    const axis: [V, V] = [add(rig.pelvisC, mul(rig.up, T * 0.2)), sub(rig.pelvisC, mul(rig.up, T * 0.14))];
    const mk = (id: string, z: number, tone: Tone, polys: number[][]): Shape => ({ id, z, far: false, tone, polys, lines: [], lineWidth: 0, highlight: [], half: T * 0.2, axis, flat: true });
    const ring = (pt: (a: number, b: number) => V, a: number, b: number, ra: number, rb: number): number[] => ellipse(0, 0, 1, 1, 14).map(([x, y]) => pt(a + x * ra, b + y * rb)).flatMap((p) => [p.x, p.y]);
    if (side) {
      shapes.push(mk('pelvis', z5, 'bone', [place(PELVIS_SIDE, fn)]));
      shapes.push(mk('pelvis.hole', z5 + 0.01, 'dark', [ring(sidePt, 0.03, -0.02, 0.03, 0.04)]));
      shapes.push(mk('sacrum', z5 + 0.02, 'bone', [place(SACRUM_SIDE, fn)]));
    } else {
      const left: [number, number][] = [...PELVIS_FRONT_HALF].map(([a, b]) => [-a, b] as [number, number]);
      const right: [number, number][] = [...PELVIS_FRONT_HALF].reverse();
      shapes.push(mk('pelvis', z5, 'bone', [place(left, fn), place(right, fn)]));
      shapes.push(mk('pelvis.holes', z5 + 0.01, 'dark', PELVIS_HOLES_FRONT.map(([a, b, ra, rb]) => ring(frontPt, a, b, ra, rb))));
      shapes.push(mk('sacrum', z5 + 0.02, 'bone', [place(SACRUM_FRONT, fn)]));
    }
  }

  /* ── clavicles and shoulder blades ── */
  for (const S of SIDES) {
    const sh = rig.p[`${S}.shoulder`];
    if (!sh) continue;
    const z = depthOf('core', null, rig);
    const far = isFar(S, rig);
    const arch = add(mid(jug, sh), mul(rig.up, T * 0.035));
    shapes.push({ id: `${S}.clavicle`, z: z + 0.06, far, tone: 'bone', polys: [], lines: [flat(curve(add(jug, mul(sub(sh, jug), 0.0)), arch, sh, 8))], lineWidth: T * 0.026, highlight: [], half: T * 0.013, axis: null });
    const lateral = side ? mul(back, T * 0.07) : mul(rig.lat[S], T * 0.1);
    const top = add(thoracic(2), lateral);
    const bottom = add(thoracic(8), mul(lateral, 0.9));
    const spineEdge = add(thoracic(5), mul(lateral, 0.85));
    shapes.push({
      id: `${S}.scapula`, z: z - 0.5, far, tone: 'bone', lines: [], lineWidth: 0, highlight: [], half: T * 0.1, axis: [top, bottom], flat: true,
      polys: [flat([sh, add(mid(sh, top), mul(rig.up, T * 0.03)), top, spineEdge, bottom, add(mid(bottom, sh), mul(rig.lat[S], T * 0.02))])],
    });
  }

  /* ── a skull in profile: cranium, facial skeleton, orbit, ear canal, zygomatic arch, and a jaw that hinges open with the mouth ── */
  if (head && side) {
    const { h, up, chin: ch } = head;
    const fa = unit(sub(rig.fwd, mul(up, rig.fwd.x * up.x + rig.fwd.y * up.y)));
    const z = coreZ(7);
    const P = (a: number, b: number): V => add(ch, add(mul(fa, a * h), mul(up, b * h)));
    const lens = (pts: [number, number][]) => flat(pts.map(([a, b]) => P(a, b)));
    const cranium: [number, number][] = [];
    for (let i = 0; i < 30; i++) {
      const t = (i / 30) * Math.PI * 2;
      cranium.push([-0.12 + Math.cos(t) * 0.82, 1.08 + Math.sin(t) * 0.78]);
    }
    const faceBones: [number, number][] = [[0.5, 1.15], [0.62, 1.02], [0.66, 0.9], [0.62, 0.78], [0.64, 0.62], [0.58, 0.46], [0.54, 0.36], [0.2, 0.34], [-0.05, 0.55], [-0.1, 0.8], [0.2, 1.15]];
    shapes.push({ id: 'skull', z, far: false, tone: 'bone', polys: [lens(cranium), lens(faceBones)], lines: [], lineWidth: 0, highlight: lens([[-0.55, 1.5], [-0.2, 1.78], [0.25, 1.8]]), half: h * 0.8, axis: [P(-0.1, 1.0), P(0.5, 0.9)], flat: true });
    shapes.push({ id: 'zygoma', z: z + 0.01, far: false, tone: 'small', polys: [], lines: [lens([[0.4, 0.7], [0.15, 0.7], [-0.1, 0.76]])], lineWidth: h * 0.07, highlight: [], half: h * 0.04, axis: null });
    const oc = P(0.46, 0.88);
    shapes.push({ id: 'orbits', z: z + 0.03, far: false, tone: 'dark', polys: [ellipse(oc.x, oc.y, h * 0.11, h * 0.13, 14, Math.atan2(up.y, up.x) + Math.PI / 2).flat(), ellipse(P(-0.1, 0.78).x, P(-0.1, 0.78).y, h * 0.05, h * 0.05, 8).flat()], lines: [], lineWidth: 0, highlight: [], half: h * 0.1, axis: null });
    /* the jaw hinges at the condyle; the mouth opening (lip points) swings it down */
    const upperM = face[62], lowerM = face[66];
    const open = upperM && lowerM ? Math.min(0.6, (dist(upperM, lowerM) / h) * 1.6) : 0;
    const hinge: [number, number] = [-0.07, 0.8];
    const rot = (p: [number, number]): [number, number] => {
      const dx = p[0] - hinge[0];
      const dy = p[1] - hinge[1];
      return [hinge[0] + dx * Math.cos(open) - dy * Math.sin(open), hinge[1] + dx * Math.sin(open) + dy * Math.cos(open)];
    };
    const mand: [number, number][] = [[-0.12, 0.84], [-0.02, 0.86], [0.08, 0.64], [0.22, 0.42], [0.42, 0.24], [0.56, 0.14], [0.58, 0.02], [0.44, 0.0], [0.2, 0.04], [-0.08, 0.1], [-0.28, 0.22], [-0.26, 0.5]];
    shapes.push({ id: 'mandible', z: z + 0.04, far: false, tone: 'bone', polys: [lens(mand.map(rot))], lines: [], lineWidth: 0, highlight: [], half: h * 0.12, axis: [P(rot([-0.1, 0.8])[0], rot([-0.1, 0.8])[1]), P(rot([0.5, 0.06])[0], rot([0.5, 0.06])[1])] });
    const tooth = (a: number, b: number, r: boolean): number[] => {
      const q: [number, number] = r ? rot([a, b]) : [a, b];
      const c = P(q[0], q[1]);
      return ellipse(c.x, c.y, h * 0.045, h * 0.07, 8).flat();
    };
    shapes.push({ id: 'teeth', z: z + 0.05, far: false, tone: 'teeth', polys: [tooth(0.56, 0.4, false), tooth(0.54, 0.12, true)], lines: [], lineWidth: 0, highlight: [], half: h * 0.05, axis: null });
  } else
  /* ── skull and mandible, built on the face points (in a head frame: w across, up from the chin, units of the chin-to-brow height h) ── */
  if (head) {
    const { h, up, chin: ch } = head;
    const w = perp(up);
    const z = coreZ(7);
    const P = (a: number, b: number): V => add(ch, add(mul(w, a * h), mul(up, b * h)));
    const lens = (pts: [number, number][]) => flat(pts.map(([a, b]) => P(a, b)));
    /* the cranium: wider at the temples, rounder at the crown */
    const crown: [number, number][] = [];
    for (let i = 0; i <= 28; i++) {
      const a = Math.PI * (i / 28);
      const sx = Math.cos(a);
      const sy = Math.sin(a);
      crown.push([sx * (0.58 - 0.06 * Math.pow(sy, 3)), 1.02 + sy * 0.76 - 0.1 * Math.pow(Math.abs(sx), 6)]);
    }
    const cranium = lens([...crown, [-0.54, 0.86], [-0.5, 0.62], [0.5, 0.62], [0.54, 0.86]]);
    /* the facial skeleton: brow ridge, cheek bones, maxilla */
    const facial = lens([[-0.52, 1.0], [-0.46, 1.06], [0.46, 1.06], [0.52, 1.0], [0.55, 0.78], [0.46, 0.6], [0.34, 0.46], [0.3, 0.36], [-0.3, 0.36], [-0.34, 0.46], [-0.46, 0.6], [-0.55, 0.78]]);
    shapes.push({
      id: 'skull', z, far: false, tone: 'bone', polys: [cranium, facial], lines: [], lineWidth: 0, flat: true,
      highlight: lens([[-0.38, 1.55], [-0.12, 1.74], [0.14, 1.76]]), half: h * 0.75, axis: [P(0, 0.9), P(0, 1.2)],
    });
    /* zygomatic arches back to the ears */
    shapes.push({ id: 'zygoma', z: z + 0.01, far: false, tone: 'small', polys: [], lines: [lens([[-0.56, 0.78], [-0.66, 0.8], [-0.7, 0.9]]), lens([[0.56, 0.78], [0.66, 0.8], [0.7, 0.9]])], lineWidth: h * 0.07, highlight: [], half: h * 0.04, axis: null });
    const eyeCentre = (a: number, b: number): V | null => {
      const pts = face.slice(a, b + 1).filter((p): p is V => p !== undefined);
      return pts.length ? mul(pts.reduce((s, p) => add(s, p), v(0, 0)), 1 / pts.length) : null;
    };
    const orbits: number[][] = [];
    for (const [a, b] of [[36, 41], [42, 47]] as const) {
      const c = eyeCentre(a, b);
      if (c) orbits.push(ellipse(c.x, c.y, h * 0.135, h * 0.115, 14, Math.atan2(w.y, w.x)).flat());
    }
    const nose = face[30];
    const noseBase = face[33] ?? nose;
    if (nose && noseBase) {
      const nc = lerp(nose, noseBase, 0.5);
      orbits.push(flat([add(nc, mul(up, h * 0.13)), add(nc, add(mul(w, -h * 0.075), mul(up, -h * 0.02))), add(nc, add(mul(w, -h * 0.06), mul(up, -h * 0.12))), add(nc, add(mul(w, h * 0.06), mul(up, -h * 0.12))), add(nc, add(mul(w, h * 0.075), mul(up, -h * 0.02)))]));
    }
    if (orbits.length) shapes.push({ id: 'orbits', z: z + 0.03, far: false, tone: 'dark', polys: orbits, lines: [], lineWidth: 0, highlight: [], half: h * 0.1, axis: null });
    /* the jaw follows the jaw-line points, so it opens with the mouth */
    const jaw = face.slice(0, 17);
    if (jaw.every((p) => p !== undefined)) {
      const outer = jaw as V[];
      const centre = mid(outer[0], outer[16]);
      const inner = outer.map((p) => lerp(p, add(centre, mul(up, h * 0.2)), 0.22)).reverse();
      const ramusL = add(outer[0], add(mul(up, h * 0.34), mul(w, -h * 0.03)));
      const ramusR = add(outer[16], add(mul(up, h * 0.34), mul(w, h * 0.03)));
      shapes.push({ id: 'mandible', z: z + 0.04, far: false, tone: 'bone', polys: [flat([ramusL, ...outer, ramusR, ...inner])], lines: [], lineWidth: 0, highlight: [], half: h * 0.12, axis: [centre, ch] });
    }
    /* teeth between the lips */
    const upperL = face[60], upperR = face[64], lowerM = face[66], upperM = face[62];
    if (upperL && upperR && upperM && lowerM) {
      const tw = dist(upperL, upperR) * 0.95;
      const th = Math.max(h * 0.06, dist(upperM, lowerM) + h * 0.05);
      const c = mid(upperM, lowerM);
      shapes.push({
        id: 'teeth', z: z + 0.05, far: false, tone: 'teeth', lines: [], lineWidth: 0, highlight: [], half: th / 2, axis: null,
        polys: [flat([add(c, add(mul(w, -tw / 2), mul(up, th / 2))), add(c, add(mul(w, tw / 2), mul(up, th / 2))), add(c, add(mul(w, tw / 2), mul(up, -th / 2))), add(c, add(mul(w, -tw / 2), mul(up, -th / 2)))])],
      });
    }
  }

  return { shapes, caps };
}
