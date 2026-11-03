/*
 * A synthetic but plausible ClipResult for the screens and the tests - no backend needed.
 *
 * Two clips of 120 frames at 60 fps (1280x720): a drop jump seen from the front and a run seen from the side. The
 * skeleton is a 26-point halpe26 body moved by simple kinematics; the angle curves are computed from the same numbers
 * the skeleton is drawn from, so the overlay and the charts agree. Everything is deterministic (no Math.random).
 */
import type { ClipResult, Flag, MoveEvent, Metric, Side } from '../../api/movement';
import { computeAsymmetry } from '../lib/asymmetry';

export const FIXTURE_FPS = 60;
export const FIXTURE_FRAMES = 120;
export const FIXTURE_W = 1280;
export const FIXTURE_H = 720;
const S = 300; // pixels per metre
const FLOOR_Y = 690;
const CX = 640;

export const HALPE26_NAMES = [
  'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist', 'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle', 'head', 'neck', 'hip',
  'left_big_toe', 'right_big_toe', 'left_small_toe', 'right_small_toe', 'left_heel', 'right_heel',
] as const;

export const HALPE26_EDGES: [number, number][] = [
  [0, 1], [0, 2], [1, 3], [2, 4], [17, 0], [17, 18], [18, 5], [18, 6], [5, 7], [7, 9], [6, 8], [8, 10], [18, 19], [19, 11], [19, 12],
  [11, 13], [13, 15], [12, 14], [14, 16], [15, 20], [15, 22], [15, 24], [16, 21], [16, 23], [16, 25],
];

const IDX = Object.fromEntries(HALPE26_NAMES.map((n, i) => [n, i])) as Record<(typeof HALPE26_NAMES)[number], number>;
type Pt = [number, number];
type Pose = Record<(typeof HALPE26_NAMES)[number], Pt>;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Cosine-eased interpolation through [phase, value] keys on a 0..1 cycle. */
function cyc(keys: readonly [number, number][], phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  for (let i = 0; i < keys.length - 1; i++) {
    const [p0, v0] = keys[i];
    const [p1, v1] = keys[i + 1];
    if (p >= p0 && p <= p1) {
      const u = (p - p0) / (p1 - p0);
      return v0 + (v1 - v0) * (0.5 - 0.5 * Math.cos(Math.PI * u));
    }
  }
  return keys[keys.length - 1][1];
}

/** Rows of keypoints [x, y, confidence] in video pixels. A little deterministic confidence wobble, one weak point. */
function toFrame(pose: Pose, f: number): [number, number, number][] {
  return HALPE26_NAMES.map((name, i) => {
    const [x, y] = pose[name];
    const conf = 0.93 - 0.1 * Math.abs(Math.sin(f * 0.37 + i)) - (name.includes('small_toe') ? 0.12 : 0);
    return [round1(x), round1(y), round2(conf)];
  });
}

function upperBody(pose: Partial<Pose>, hip: Pt, leanRad: number, sideView: boolean, arms: { L: number; R: number }, lateral = 0): void {
  const trunk = 0.52;
  const neck: Pt = [hip[0] + Math.sin(leanRad) * trunk * S + lateral * S, hip[1] - Math.cos(leanRad) * trunk * S];
  pose.neck = neck;
  pose.head = [neck[0] + Math.sin(leanRad) * 0.1 * S, neck[1] - 0.16 * S];
  const head = pose.head;
  const half = sideView ? 0.03 : 0.19;
  pose.left_shoulder = [neck[0] - half * S, neck[1] + 0.02 * S];
  pose.right_shoulder = [neck[0] + half * S, neck[1] + 0.02 * S];
  if (sideView) {
    pose.nose = [head[0] + 0.07 * S, head[1] + 0.02 * S];
    pose.left_eye = [head[0] + 0.045 * S, head[1] - 0.01 * S];
    pose.right_eye = [head[0] + 0.03 * S, head[1] - 0.01 * S];
    pose.left_ear = [head[0] - 0.01 * S, head[1]];
    pose.right_ear = [head[0] - 0.02 * S, head[1]];
  } else {
    pose.nose = [head[0], head[1] + 0.04 * S];
    pose.left_eye = [head[0] - 0.03 * S, head[1]];
    pose.right_eye = [head[0] + 0.03 * S, head[1]];
    pose.left_ear = [head[0] - 0.07 * S, head[1] + 0.01 * S];
    pose.right_ear = [head[0] + 0.07 * S, head[1] + 0.01 * S];
  }
  for (const side of ['left', 'right'] as const) {
    const sh = pose[`${side}_shoulder`] as Pt;
    const a = arms[side === 'left' ? 'L' : 'R'];
    const elbow: Pt = [sh[0] + Math.sin(a) * 0.28 * S, sh[1] + Math.cos(a) * 0.28 * S];
    const a2 = a + rad(sideView ? 70 : 12);
    pose[`${side}_elbow`] = elbow;
    pose[`${side}_wrist`] = [elbow[0] + Math.sin(a2) * 0.26 * S, elbow[1] + Math.cos(a2) * 0.26 * S];
  }
}

interface Built {
  frames: [number, number, number][][];
  curves: Record<string, (number | null)[]>;
  /** Extra per-frame numbers the metrics need. */
  extra: Record<string, number[]>;
}

/* ═══════════════════════ running, side view ═══════════════════════ */

const RUN_PERIOD = 43; // frames per stride of one leg (cadence ≈ 167 steps/min)
const HIP_FLEX: [number, number][] = [[0, 25], [0.17, 5], [0.35, -12], [0.55, 20], [0.8, 42], [1, 25]];
const KNEE_FLEX: [number, number][] = [[0, 15], [0.17, 40], [0.35, 32], [0.5, 85], [0.62, 105], [0.8, 60], [0.92, 25], [1, 15]];
const FOOT_PITCH: [number, number][] = [[0, -8], [0.08, 0], [0.3, 0], [0.4, 35], [0.6, 10], [0.85, -10], [1, -8]];

function buildRunning(): Built {
  const frames: Built['frames'] = [];
  const curves: Built['curves'] = { knee_flexion_L: [], knee_flexion_R: [], hip_flexion_L: [], hip_flexion_R: [], trunk_flexion: [] };
  const extra: Built['extra'] = { overstrideL: [], overstrideR: [] };

  for (let f = 0; f < FIXTURE_FRAMES; f++) {
    const lean = 6 + 1.5 * Math.sin((2 * Math.PI * f) / RUN_PERIOD);
    const leg = {} as Record<Side, { knee: Pt; ankle: Pt; heel: Pt; toe: Pt; small: Pt; hipF: number; kneeF: number }>;
    for (const side of ['L', 'R'] as const) {
      const phase = f / RUN_PERIOD + (side === 'R' ? 0.5 : 0);
      const hipF = cyc(HIP_FLEX, phase);
      const kneeF = cyc(KNEE_FLEX, phase) + (side === 'R' ? 4 : 0);
      const thigh = rad(hipF);
      const shank = thigh - rad(kneeF);
      const knee: Pt = [Math.sin(thigh) * 0.45, -Math.cos(thigh) * 0.45];
      const ankle: Pt = [knee[0] + Math.sin(shank) * 0.45, knee[1] - Math.cos(shank) * 0.45];
      const p = rad(cyc(FOOT_PITCH, phase));
      const toe: Pt = [ankle[0] + 0.16 * Math.cos(p), ankle[1] - 0.08 - 0.16 * Math.sin(p)];
      const heel: Pt = [ankle[0] - 0.06 * Math.cos(p), ankle[1] - 0.08 + 0.06 * Math.sin(p)];
      const small: Pt = [toe[0] - 0.01, toe[1] + 0.005];
      leg[side] = { knee, ankle, heel, toe, small, hipF, kneeF };
    }
    const lowest = Math.min(...(['L', 'R'] as const).flatMap((s) => [leg[s].toe[1], leg[s].heel[1]]));
    const hipH = -lowest; // metres above the floor
    const hip: Pt = [CX, FLOOR_Y - hipH * S];
    // local y is negative below the hip; the screen y grows downwards
    const place = (side: Side, p: Pt): Pt => [hip[0] + (p[0] + (side === 'R' ? 0.03 : 0)) * S, hip[1] - p[1] * S];

    const pose: Partial<Pose> = {};
    pose.hip = hip;
    pose.left_hip = [hip[0] - 0.01 * S, hip[1]];
    pose.right_hip = [hip[0] + 0.04 * S, hip[1]];
    for (const side of ['L', 'R'] as const) {
      const name = side === 'L' ? 'left' : 'right';
      pose[`${name}_knee`] = place(side, leg[side].knee);
      pose[`${name}_ankle`] = place(side, leg[side].ankle);
      pose[`${name}_heel`] = place(side, leg[side].heel);
      pose[`${name}_big_toe`] = place(side, leg[side].toe);
      pose[`${name}_small_toe`] = place(side, leg[side].small);
    }
    upperBody(pose, hip, rad(lean), true, { L: -0.5 * rad(leg.R.hipF) - 0.1, R: -0.5 * rad(leg.L.hipF) - 0.1 });
    frames.push(toFrame(pose as Pose, f));

    curves.knee_flexion_L.push(round1(leg.L.kneeF));
    curves.knee_flexion_R.push(round1(leg.R.kneeF));
    curves.hip_flexion_L.push(round1(leg.L.hipF));
    curves.hip_flexion_R.push(round1(leg.R.hipF));
    curves.trunk_flexion.push(round1(lean));
    extra.overstrideL.push(round1((leg.L.ankle[0] - 0.0) * 100));
    extra.overstrideR.push(round1((leg.R.ankle[0] - 0.0) * 100));
  }
  return { frames, curves, extra };
}

/* ═══════════════════════ drop jump, front view ═══════════════════════ */

const G = 9.81;
const DJ = { stepOff: 30, contact1: 45, takeoff: 73, contact2: 106 } as const;

function hipHeightDJ(f: number): { hip: number; contact: boolean; onBox: boolean } {
  const dt = 1 / FIXTURE_FPS;
  if (f < DJ.stepOff) return { hip: 1.23, contact: false, onBox: true };
  if (f < DJ.contact1) {
    const u = ((f - DJ.stepOff) * dt) / ((DJ.contact1 - DJ.stepOff) * dt);
    return { hip: 1.23 - 0.32 * u * u, contact: false, onBox: false };
  }
  if (f < DJ.takeoff) {
    const x = (f - DJ.contact1) / (DJ.takeoff - DJ.contact1);
    return { hip: 0.91 - 0.21 * Math.sin(Math.PI * Math.pow(x, 0.9)), contact: true, onBox: false };
  }
  if (f < DJ.contact2) {
    const t = (f - DJ.takeoff) * dt;
    const flight = (DJ.contact2 - DJ.takeoff) * dt;
    const v0 = (G * flight) / 2;
    return { hip: 0.91 + v0 * t - 0.5 * G * t * t, contact: false, onBox: false };
  }
  const x = (f - DJ.contact2) / (DJ.takeoff - DJ.contact1);
  return { hip: 0.91 - 0.21 * Math.sin(Math.PI * Math.pow(x, 0.9)), contact: true, onBox: false };
}

function buildDropJump(): Built {
  const frames: Built['frames'] = [];
  const curves: Built['curves'] = { knee_flexion_L: [], knee_flexion_R: [], hip_flexion_L: [], hip_flexion_R: [], trunk_flexion: [] };
  const extra: Built['extra'] = { valgusL: [], valgusR: [], hipH: [] };
  const LEG = 0.9;

  for (let f = 0; f < FIXTURE_FRAMES; f++) {
    const { hip: hipH, contact, onBox } = hipHeightDJ(f);
    /* On the box the athlete stands 0.4 m behind the landing spot; stepping off carries them forward. */
    const u = f < DJ.stepOff ? 0 : Math.min(1, (f - DJ.stepOff) / (DJ.contact1 - DJ.stepOff));
    const CXF = CX - 0.4 * S * (1 - u);
    const fall = f >= DJ.stepOff && f < DJ.contact1;
    const dLeg = onBox ? 0.88 : fall ? 0.88 - 0.02 * ((f - DJ.stepOff) / (DJ.contact1 - DJ.stepOff)) : contact ? hipH - 0.05 : 0.86;
    const ankleH = onBox ? 0.35 : hipH - dLeg;
    const flexNorm = contact ? Math.min(1, Math.max(0, (0.91 - hipH) / 0.21)) : 0;
    const pose: Partial<Pose> = {};
    const hipY = FLOOR_Y - hipH * S;
    const hips = { L: [CXF - 0.1 * S, hipY + (contact ? 0.006 * S : 0)] as Pt, R: [CXF + 0.1 * S, hipY - (contact ? 0.006 * S : 0)] as Pt };
    pose.hip = [CXF, hipY];
    pose.left_hip = hips.L;
    pose.right_hip = hips.R;
    const valgus: Record<Side, number> = { L: 0.045 * flexNorm, R: 0.012 * flexNorm };

    for (const side of ['L', 'R'] as const) {
      const name = side === 'L' ? 'left' : 'right';
      const sign = side === 'L' ? -1 : 1;
      const ankle: Pt = [CXF + sign * 0.17 * S, FLOOR_Y - ankleH * S];
      const hipP = hips[side];
      const d = Math.hypot(ankle[0] - hipP[0], ankle[1] - hipP[1]) / S;
      const kneeF = deg(2 * Math.acos(Math.min(1, d / LEG)));
      const knee: Pt = [(hipP[0] + ankle[0]) / 2 - sign * valgus[side] * S, (hipP[1] + ankle[1]) / 2];
      pose[`${name}_knee`] = knee;
      pose[`${name}_ankle`] = ankle;
      pose[`${name}_heel`] = [ankle[0] - sign * 0.01 * S, ankle[1] + 0.07 * S];
      pose[`${name}_big_toe`] = [ankle[0] + sign * 0.03 * S, ankle[1] + 0.08 * S];
      pose[`${name}_small_toe`] = [ankle[0] - sign * 0.01 * S, ankle[1] + 0.085 * S];
      curves[`knee_flexion_${side}`].push(round1(kneeF));
      curves[`hip_flexion_${side}`].push(round1(kneeF * 0.78 + (side === 'L' ? -3 : 0)));
      const valgusDeg = deg(Math.atan(valgus[side] / Math.max(0.2, d / 2)));
      extra[`valgus${side}`].push(round1(valgusDeg));
    }
    const lean = 8 + 22 * flexNorm;
    upperBody(pose, [CXF, hipY], rad(0), false, { L: rad(8 + 10 * flexNorm), R: rad(-8 - 10 * flexNorm) }, 0.022 * flexNorm);
    // forward lean is not visible from the front: the trunk only shortens
    const shrink = Math.cos(rad(lean)) / Math.cos(rad(8));
    for (const key of ['neck', 'head', 'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist'] as const) {
      const p = pose[key] as Pt;
      pose[key] = [p[0], hipY - (hipY - p[1]) * shrink];
    }
    frames.push(toFrame(pose as Pose, f));
    curves.trunk_flexion.push(round1(lean));
    extra.hipH.push(round2(hipH));
  }
  return { frames, curves, extra };
}

/* ═══════════════════════ shared assembly ═══════════════════════ */

const times = Array.from({ length: FIXTURE_FRAMES }, (_, f) => Math.round((f / FIXTURE_FPS) * 10000) / 10000);
const baseVideo = { fps: FIXTURE_FPS, frameCount: FIXTURE_FRAMES, width: FIXTURE_W, height: FIXTURE_H, durationS: FIXTURE_FRAMES / FIXTURE_FPS };
const skeletonOf = (frames: Built['frames']): ClipResult['skeleton'] => ({
  keypointSet: 'halpe26', names: [...HALPE26_NAMES], edges: HALPE26_EDGES, times, frames,
});

function evt(type: MoveEvent['type'], side: Side | null, frame: number): MoveEvent {
  return { type, side, frame, t: times[Math.min(frame, FIXTURE_FRAMES - 1)] };
}

function metric(id: string, side: Side | null, value: number, unit: string, event: MoveEvent['type'] | null, frame: number | null, normBand: [number, number] | null, asym: number | null): Metric {
  return { id, side, value: round1(value), unit, event, frame, normBand, asymmetryPct: asym === null ? null : round1(asym) };
}

/** Left/right metrics with a reported asymmetry. */
function pair(id: string, unit: string, event: MoveEvent['type'] | null, l: { v: number; f: number }, r: { v: number; f: number }, norm: [number, number] | null): Metric[] {
  const a = computeAsymmetry(l.v, r.v);
  return [metric(id, 'L', l.v, unit, event, l.f, norm, a), metric(id, 'R', r.v, unit, event, r.f, norm, a)];
}

function stats(values: readonly (number | null)[], from: number, to: number): { max: number; frame: number } {
  let max = -Infinity;
  let frame = from;
  for (let i = from; i <= to && i < values.length; i++) {
    const v = values[i];
    if (v !== null && v > max) { max = v; frame = i; }
  }
  return { max, frame };
}

export function buildRunningSideResult(clipId = 'fx-running-side'): ClipResult {
  const b = buildRunning();
  const events: MoveEvent[] = [];
  for (const side of ['L', 'R'] as const) {
    const offset = side === 'R' ? 0.5 : 0;
    for (let f = 1; f < FIXTURE_FRAMES; f++) {
      const p0 = (((f - 1) / RUN_PERIOD + offset) % 1 + 1) % 1;
      const p1 = ((f / RUN_PERIOD + offset) % 1 + 1) % 1;
      if (p1 < p0) events.push(evt('foot_strike', side, f));
      if (p0 < 0.35 && p1 >= 0.35) events.push(evt('toe_off', side, f));
    }
  }
  events.sort((a, c) => a.frame - c.frame);
  const strike = (s: Side) => events.find((e) => e.type === 'foot_strike' && e.side === s)!;
  const sl = strike('L');
  const sr = strike('R');
  const kneeL = b.curves.knee_flexion_L;
  const kneeR = b.curves.knee_flexion_R;
  const stanceL = stats(kneeL, sl.frame, sl.frame + 14);
  const stanceR = stats(kneeR, sr.frame, sr.frame + 14);
  const contactOf = (s: Side) => {
    const st = events.filter((e) => e.type === 'foot_strike' && e.side === s);
    const to = events.filter((e) => e.type === 'toe_off' && e.side === s);
    const gaps = st.map((x) => to.find((t) => t.frame > x.frame)).map((t, i) => (t ? (t.frame - st[i].frame) / FIXTURE_FPS : null)).filter((v): v is number => v !== null);
    return gaps.length ? gaps.reduce((a, c) => a + c, 0) / gaps.length : 0.2;
  };
  events.push(evt('peak_knee_flexion', 'L', stanceL.frame), evt('peak_knee_flexion', 'R', stanceR.frame));
  events.sort((a, c) => a.frame - c.frame);

  const metrics: Metric[] = [
    ...pair('knee_flexion_ic', 'deg', 'foot_strike', { v: kneeL[sl.frame]!, f: sl.frame }, { v: kneeR[sr.frame]!, f: sr.frame }, [10, 25]),
    ...pair('knee_flexion_peak_stance', 'deg', 'peak_knee_flexion', { v: stanceL.max, f: stanceL.frame }, { v: stanceR.max, f: stanceR.frame }, [35, 50]),
    ...pair('hip_flexion_ic', 'deg', 'foot_strike', { v: b.curves.hip_flexion_L[sl.frame]!, f: sl.frame }, { v: b.curves.hip_flexion_R[sr.frame]!, f: sr.frame }, [20, 35]),
    ...pair('contact_time', 's', null, { v: round2(contactOf('L')), f: sl.frame }, { v: round2(contactOf('R')), f: sr.frame }, [0.18, 0.26]),
    ...pair('overstride', 'cm', 'foot_strike', { v: b.extra.overstrideL[sl.frame], f: sl.frame }, { v: b.extra.overstrideR[sr.frame], f: sr.frame }, [0, 10]),
    metric('cadence', null, 167, 'spm', null, null, [160, 185], null),
    metric('trunk_flexion_mean', null, 6, 'deg', null, null, [4, 10], null),
  ];

  const overR = b.extra.overstrideR[sr.frame];
  const flags: Flag[] = [
    {
      id: 'running.overstride', ruleId: 'overstride_gt_10cm', region: 'ankle', side: 'R', severity: 'red',
      evidence: { frame: sr.frame, value: overR, unit: 'cm', threshold: 10, normBand: [0, 10] },
      sentence: { cs: `Pravá noha dopadá ${String(Math.round(overR)).replace('.', ',')} cm před těžištěm, víc než je vhodné.`, en: `The right foot lands ${Math.round(overR)} cm ahead of the centre of mass, more than advisable.` },
      ruleVersion: 'running.v1',
    },
    {
      id: 'running.knee_flexion_ic', ruleId: 'knee_flexion_ic_asym_gt_25', region: 'knee', side: 'R', severity: 'watch',
      evidence: { frame: sr.frame, value: kneeR[sr.frame], unit: 'deg', threshold: 25, normBand: [10, 25] },
      sentence: { cs: 'Koleno pravé nohy je při dopadu víc pokrčené než levé.', en: 'The right knee is more flexed at foot strike than the left.' },
      ruleVersion: 'running.v1',
    },
    {
      id: 'running.contact_time_asym', ruleId: 'contact_time_asym_gt_10', region: 'foot', side: null, severity: 'watch',
      evidence: { frame: sl.frame, value: null, unit: null, threshold: 10, normBand: null },
      sentence: { cs: 'Doba kontaktu se zemí se mezi nohama liší.', en: 'Ground contact time differs between the legs.' },
      ruleVersion: 'running.v1',
    },
    {
      id: 'running.trunk_lean', ruleId: 'trunk_lean_in_band', region: 'trunk', side: null, severity: 'info',
      evidence: { frame: 20, value: b.curves.trunk_flexion[20], unit: 'deg', threshold: null, normBand: [4, 10] },
      sentence: { cs: 'Předklon trupu je v normě.', en: 'Trunk lean is within the norm.' },
      ruleVersion: 'running.v1',
    },
  ];

  return {
    schemaVersion: 1, clipId, movement: 'running', view: 'side', video: baseVideo,
    versions: { pipeline: '0.1.0', rules: 'running.v1', poseModel: 'rtmpose-halpe26' },
    qa: { passed: true, usableFrameRatio: 0.97, meanConfidence: 0.81, reasons: [] },
    skeleton: skeletonOf(b.frames),
    scale: { metersPerPixel: round2(1 / S * 1000) / 1000, source: 'marker', disagreementPct: 3.1 },
    events, curves: b.curves, metrics, flags,
    score: { band: 'watch', errorCount: 3, reasonKey: 'movement.score.running_errors' },
  };
}

export function buildDropJumpFrontResult(clipId = 'fx-dropjump-front'): ClipResult {
  const b = buildDropJump();
  const events: MoveEvent[] = [
    evt('initial_contact', 'R', DJ.contact1 - 1),
    evt('initial_contact', 'L', DJ.contact1),
    evt('toe_off', 'L', DJ.takeoff),
    evt('toe_off', 'R', DJ.takeoff),
    evt('initial_contact', 'L', DJ.contact2),
    evt('initial_contact', 'R', DJ.contact2),
  ];
  const kL = b.curves.knee_flexion_L;
  const kR = b.curves.knee_flexion_R;
  const peakL = stats(kL, DJ.contact1, DJ.takeoff);
  const peakR = stats(kR, DJ.contact1, DJ.takeoff);
  events.push(evt('peak_knee_flexion', 'L', peakL.frame), evt('peak_knee_flexion', 'R', peakR.frame));
  events.sort((a, c) => a.frame - c.frame);
  const valL = stats(b.extra.valgusL, DJ.contact1, DJ.takeoff);
  const valR = stats(b.extra.valgusR, DJ.contact1, DJ.takeoff);
  const contactS = (DJ.takeoff - DJ.contact1) / FIXTURE_FPS;

  const metrics: Metric[] = [
    ...pair('knee_flexion_ic', 'deg', 'initial_contact', { v: kL[DJ.contact1]!, f: DJ.contact1 }, { v: kR[DJ.contact1 - 1]!, f: DJ.contact1 - 1 }, [10, 25]),
    ...pair('knee_flexion_peak', 'deg', 'peak_knee_flexion', { v: peakL.max, f: peakL.frame }, { v: peakR.max, f: peakR.frame }, [70, 100]),
    ...pair('knee_valgus_peak', 'deg', 'peak_knee_flexion', { v: valL.max, f: valL.frame }, { v: valR.max, f: valR.frame }, [0, 5]),
    ...pair('ground_contact_time', 's', null, { v: round2(contactS), f: DJ.contact1 }, { v: round2(contactS + 0.017), f: DJ.contact1 - 1 }, [0.15, 0.3]),
    metric('trunk_flexion_peak', null, stats(b.curves.trunk_flexion as number[], DJ.contact1, DJ.takeoff).max, 'deg', 'peak_knee_flexion', peakL.frame, [20, 45], null),
    metric('stance_width_ratio', null, 1.7, 'x', 'initial_contact', DJ.contact1, [1, 1.5], null),
  ];

  const flags: Flag[] = [
    {
      id: 'landing.knee_valgus', ruleId: 'knee_valgus_gt_5', region: 'knee', side: 'L', severity: 'red',
      evidence: { frame: valL.frame, value: valL.max, unit: 'deg', threshold: 5, normBand: [0, 5] },
      sentence: { cs: 'Levé koleno se při doskoku propadá dovnitř.', en: 'The left knee collapses inward on landing.' },
      ruleVersion: 'landing.v1',
    },
    {
      id: 'landing.asymmetric', ruleId: 'contact_asym_gt_10', region: 'hip', side: null, severity: 'watch',
      evidence: { frame: DJ.contact1, value: null, unit: null, threshold: 10, normBand: null },
      sentence: { cs: 'Pravá noha dopadá o chvilku dřív než levá.', en: 'The right foot lands slightly before the left.' },
      ruleVersion: 'landing.v1',
    },
    {
      id: 'landing.stance_width', ruleId: 'stance_width_gt_1_5', region: 'ankle', side: null, severity: 'watch',
      evidence: { frame: DJ.contact1, value: 1.7, unit: 'x', threshold: 1.5, normBand: [1, 1.5] },
      sentence: { cs: 'Postoj při doskoku je širší než šířka boků.', en: 'Landing stance is wider than hip width.' },
      ruleVersion: 'landing.v1',
    },
    {
      id: 'landing.knee_flexion_peak', ruleId: 'knee_flexion_peak_in_band', region: 'knee', side: 'R', severity: 'info',
      evidence: { frame: peakR.frame, value: peakR.max, unit: 'deg', threshold: null, normBand: [70, 100] },
      sentence: { cs: 'Hloubka pokrčení pravého kolena je v normě.', en: 'Right knee flexion depth is within the norm.' },
      ruleVersion: 'landing.v1',
    },
  ];

  return {
    schemaVersion: 1, clipId, movement: 'drop_jump', view: 'front', video: baseVideo,
    versions: { pipeline: '0.1.0', rules: 'landing.v1', poseModel: 'rtmpose-halpe26' },
    qa: { passed: true, usableFrameRatio: 0.98, meanConfidence: 0.84, reasons: [] },
    skeleton: skeletonOf(b.frames),
    scale: { metersPerPixel: round2(1 / S * 1000) / 1000, source: 'height', disagreementPct: 2.4 },
    events, curves: b.curves, metrics, flags,
    score: { band: 'red', errorCount: 3, reasonKey: 'movement.score.landing_errors' },
  };
}

/** A clip whose QA failed (no skeleton worth showing): for the failed / needs-review states. */
export function buildQaRejectedResult(clipId = 'fx-qa-rejected'): ClipResult {
  const r = buildRunningSideResult(clipId);
  return {
    ...r,
    qa: { passed: false, usableFrameRatio: 0.42, meanConfidence: 0.38, reasons: [{ code: 'low_fps', messageKey: 'movement.qa.low_fps', detail: '30 fps' }, { code: 'too_dark', messageKey: 'movement.qa.too_dark', detail: '31/255' }] },
    skeleton: { ...r.skeleton, frames: [], times: [] },
    events: [], curves: {}, metrics: [], flags: [],
    score: { band: 'needs_review', errorCount: 0, reasonKey: 'movement.score.qa_failed' },
  };
}
