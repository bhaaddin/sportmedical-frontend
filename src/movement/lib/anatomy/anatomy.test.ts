import { describe, expect, it } from 'vitest';
import { contraction, depthOf, footFan, handBones, isFar, muscleColor, normalFor, placeTemplate, shorteningSpeed, thicknessFactor } from './geometry';
import { buildRig, HAND_PARTS } from './rig';
import { TEMPLATES, ellipse, outline } from './templates';
import { buildBones } from './boneModel';
import { MUSCLES, analyseMuscles, anchorPoint, buildMuscles, muscleState, pathLength } from './muscleModel';
import { buildAnatomyFrame, signedArea } from './draw';
import { buildRunningSideResult } from '../../fixtures/synth';
import running from '../../fixtures/running_side.result.json';
import drop from '../../fixtures/drop_jump_front.result.json';
import type { ClipResult } from '../../../api/movement';
import { dist, unit, v } from './vec';

const run = running as unknown as ClipResult;
const dj = drop as unknown as ClipResult;

describe('bone placement', () => {
  it('maps unit bone space onto the segment between two joints: u along it, v across it, both in bone lengths', () => {
    const tpl = { parts: [[[0, 0], [1, 0], [1, 0.1], [0, 0.1]] as [number, number][]], highlight: [] as [number, number][] };
    const placed = placeTemplate(tpl, v(100, 100), v(100, 200), v(1, 0));
    // the bone points straight down, so +v is +x: the corner (1, 0.1) is 100 px along and 10 px across
    expect(placed.length).toBeCloseTo(100);
    expect(placed.parts[0].slice(0, 2)).toEqual([100, 100]);
    expect(placed.parts[0][2]).toBeCloseTo(100);
    expect(placed.parts[0][3]).toBeCloseTo(200);
    expect(placed.parts[0][4]).toBeCloseTo(110);
    expect(placed.parts[0][5]).toBeCloseTo(200);
    expect(placed.half).toBeCloseTo(10);
  });
  it('width scale and a sideways offset move only across the bone', () => {
    const tpl = { parts: [[[0.5, 0.05]] as [number, number][]], highlight: [] as [number, number][] };
    const base = placeTemplate(tpl, v(0, 0), v(0, 100), v(1, 0));
    const fat = placeTemplate(tpl, v(0, 0), v(0, 100), v(1, 0), 2, 0.1);
    expect(base.parts[0]).toEqual([5, 50]);
    expect(fat.parts[0][0]).toBeCloseTo(20); // 0.05*2*100 + 0.1*100
    expect(fat.parts[0][1]).toBeCloseTo(50);
  });
  it('a degenerate segment does not produce NaN', () => {
    const p = placeTemplate(TEMPLATES.femur, v(5, 5), v(5, 5), v(1, 0));
    expect(p.parts.every((part) => part.every(Number.isFinite))).toBe(true);
  });
  it('the shaft outline is closed and symmetric around the bow line, ellipses are round', () => {
    const o = outline([[0, 0.1, 0], [1, 0.1, 0]], 4);
    expect(o).toHaveLength(10);
    expect(Math.max(...o.map((p) => p[1]))).toBeCloseTo(0.1);
    expect(Math.min(...o.map((p) => p[1]))).toBeCloseTo(-0.1);
    const e = ellipse(0, 0, 2, 1, 8);
    expect(Math.max(...e.map((p) => p[0]))).toBeCloseTo(2);
    expect(Math.max(...e.map((p) => p[1]))).toBeCloseTo(1);
  });
  it('orientation of an outline is detectable so parts can be filled as a union', () => {
    expect(signedArea([0, 0, 10, 0, 10, 10, 0, 10])).toBeGreaterThan(0);
    expect(signedArea([0, 0, 0, 10, 10, 10, 10, 0])).toBeLessThan(0);
  });
});

describe('rig, facing and depth order', () => {
  it('a side view finds the faced direction from toe versus heel and the near side from it', () => {
    const rig = buildRig(run.skeleton, 40, 'side')!;
    expect(rig.facing).toBe(1);
    expect(rig.fwd.x).toBeGreaterThan(0.9);
    expect(rig.near).toBe('R');
    expect(Math.abs(rig.fwd.x * rig.up.x + rig.fwd.y * rig.up.y)).toBeLessThan(1e-6); // perpendicular to the trunk
  });
  it('a front view has no facing and sends each side outward from the midline', () => {
    const rig = buildRig(dj.skeleton, 60, 'front')!;
    expect(rig.near).toBeNull();
    expect(rig.fwd).toEqual({ x: 0, y: 0 });
    const left = rig.p['L.hip']!;
    const right = rig.p['R.hip']!;
    const outL = rig.lat.L.x * (left.x - rig.pelvisC.x);
    const outR = rig.lat.R.x * (right.x - rig.pelvisC.x);
    expect(outL).toBeGreaterThan(0);
    expect(outR).toBeGreaterThan(0);
    expect(rig.lat.L.x * rig.lat.R.x).toBeLessThan(0);
  });
  it('far limbs are painted first and dimmer in a side view; legs under, arms over in a front view', () => {
    const side = buildRig(run.skeleton, 40, 'side')!;
    expect(depthOf('leg', 'L', side)).toBeLessThan(depthOf('core', null, side));
    expect(depthOf('core', null, side)).toBeLessThan(depthOf('leg', 'R', side));
    expect(depthOf('arm', 'L', side)).toBeLessThan(depthOf('core', null, side));
    expect(depthOf('arm', 'R', side)).toBeGreaterThan(depthOf('leg', 'R', side));
    expect(isFar('L', side)).toBe(true);
    expect(isFar('R', side)).toBe(false);
    const front = buildRig(dj.skeleton, 60, 'front')!;
    expect(depthOf('leg', 'L', front)).toBeLessThan(depthOf('core', null, front));
    expect(depthOf('arm', 'L', front)).toBeGreaterThan(depthOf('core', null, front));
    expect(isFar('L', front)).toBe(false);
  });
  it('the +v side of a bone points to the front in a side view and outward in a front view', () => {
    const side = buildRig(run.skeleton, 40, 'side')!;
    expect(normalFor(side, 'R', v(0, 1)).x).toBeGreaterThan(0.9); // facing right
    const front = buildRig(dj.skeleton, 60, 'front')!;
    const n = normalFor(front, 'L', v(0, 1));
    expect(n.x * front.lat.L.x).toBeGreaterThan(0.9);
  });
  it('returns nothing when the hips are unknown', () => {
    const broken = { ...run.skeleton, frames: [run.skeleton.frames[0].map((k, i) => (run.skeleton.names[i].endsWith('_hip') ? ([k[0], k[1], 0.01] as [number | null, number | null, number]) : k))] };
    expect(buildRig(broken, 0, 'side')).toBeNull();
  });
});

describe('foot and hand bones fan out over their points', () => {
  it('five metatarsals between heel and the two toes, big toe first, the big toe with two phalanges', () => {
    const f = footFan(v(0, 0), v(100, 10), v(100, -10));
    expect(f.metatarsals).toHaveLength(5);
    expect(f.phalanges.map((p) => p.length)).toEqual([2, 1, 1, 1, 1]);
    // the tips of the toes run from the big toe point to the small toe point
    expect(f.phalanges[0][1].b).toEqual({ x: 100, y: 10 });
    expect(f.phalanges[4][0].b).toEqual({ x: 100, y: -10 });
    // the heads stay between the base of the foot and the tips
    for (const m of f.metatarsals) expect(m.b.x).toBeGreaterThan(m.a.x);
    // metatarsals fan: further apart at the heads than at the base
    expect(dist(f.metatarsals[0].b, f.metatarsals[4].b)).toBeGreaterThan(dist(f.metatarsals[0].a, f.metatarsals[4].a));
  });
  it('a foot seen from the side (toes on top of each other) still gets five distinct bones', () => {
    const f = footFan(v(0, 0), v(100, 0), v(100, 0.5));
    expect(f.metatarsals).toHaveLength(5);
    expect(new Set(f.metatarsals.map((m) => `${Math.round(m.a.y * 10)}:${Math.round(m.b.y * 10)}`)).size).toBeGreaterThan(1);
  });
  it('a hand gets a metacarpal and three phalanges per finger, from its 21 points', () => {
    const rig = buildRig(dj.skeleton, 60, 'front')!;
    expect(rig.hand.L).toHaveLength(HAND_PARTS.length);
    const hb = handBones(rig.hand.L)!;
    const phalanges = hb.bones.filter((b) => b.kind === 'phalanx');
    expect(phalanges.length).toBe(14);
    expect(hb.bones.filter((b) => b.kind === 'metacarpal').length).toBe(5 + 1 - 0); // four metacarpals + the thumb's trapezium and metacarpal
    expect(hb.carpals).toHaveLength(5);
    expect(hb.joints.length).toBe(15);
    expect(handBones([undefined])).toBeNull();
  });
});

describe('muscle length to look', () => {
  it('thicker when shorter than at rest, thinner when stretched, within limits', () => {
    expect(thicknessFactor(1)).toBe(1);
    expect(thicknessFactor(0.9)).toBeGreaterThan(1);
    expect(thicknessFactor(1.1)).toBeLessThan(1);
    expect(thicknessFactor(0.1)).toBe(1.55);
    expect(thicknessFactor(3)).toBe(0.7);
  });
  it('the contraction proxy grows with shortening and shortening speed, never negative, capped at 1', () => {
    expect(contraction(1, 0)).toBe(0);
    expect(contraction(1.2, -3)).toBe(0);
    expect(contraction(0.95, 0)).toBeGreaterThan(0);
    expect(contraction(0.9, 0)).toBeGreaterThan(contraction(0.95, 0));
    expect(contraction(1, 1)).toBeGreaterThan(0);
    expect(contraction(0.5, 5)).toBe(1);
  });
  it('shortening speed is a central difference in rest lengths per second', () => {
    expect(shorteningSpeed(110, 90, 100, 60)).toBeCloseTo(6); // 20% over two frames at 60 fps
    expect(shorteningSpeed(90, 110, 100, 60)).toBeLessThan(0);
    expect(shorteningSpeed(1, 1, 0, 60)).toBe(0);
  });
  it('colour goes from a muted rose to a bright red', () => {
    const rest = muscleColor(0);
    const hard = muscleColor(1);
    expect(hard.r).toBeGreaterThan(rest.r);
    expect(hard.g).toBeLessThan(rest.g);
    expect(hard.a).toBeGreaterThan(rest.a);
    expect(muscleColor(2)).toEqual(hard);
  });
});

describe('the bones and muscles of the real fixtures', () => {
  it('a whole-body frame has every bone the brief lists, for both sides', () => {
    for (const [result, view] of [[run, 'side'], [dj, 'front']] as const) {
      const rig = buildRig(result.skeleton, 50, view)!;
      const ids = buildBones(rig).shapes.map((s) => s.id);
      for (const S of ['L', 'R']) {
        for (const bone of ['femur', 'tibia', 'fibula', 'patella', 'calcaneus', 'talus', 'humerus', 'ulna', 'radius', 'clavicle', 'scapula']) expect(ids).toContain(`${S}.${bone}`);
        expect(ids.filter((i) => i.startsWith(`${S}.mt`))).toHaveLength(5);
        expect(ids.filter((i) => i.startsWith(`${S}.hand.`)).length).toBeGreaterThanOrEqual(19);
      }
      expect(ids.filter((i) => i.startsWith('spine.'))).toHaveLength(24);
      expect(ids.filter((i) => i.startsWith('rib.'))).toHaveLength(12);
      for (const id of ['sternum', 'pelvis', 'sacrum', 'skull', 'mandible', 'teeth']) expect(ids).toContain(id);
    }
  });
  it('every coordinate is a finite number on every frame of both clips', () => {
    for (const [result, view] of [[run, 'side'], [dj, 'front']] as const) {
      for (let f = 0; f < result.skeleton.frames.length; f += 7) {
        const a = buildAnatomyFrame(result.skeleton, f, view, 60)!;
        expect(a).not.toBeNull();
        for (const s of a.bones.shapes) for (const p of [...s.polys, ...s.lines]) expect(p.every(Number.isFinite)).toBe(true);
        for (const m of a.muscles) expect(m.line.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))).toBe(true);
      }
    }
  });
  it('the jaw opens with the mouth: the mandible follows the jaw-line points', () => {
    const a = buildBones(buildRig(dj.skeleton, 10, 'front')!).shapes.find((s) => s.id === 'mandible')!;
    const chin = dj.skeleton.frames[10][dj.skeleton.names.indexOf('face_8')];
    const ys = a.polys[0].filter((_, i) => i % 2 === 1);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual((chin[1] as number) - 0.5);
  });
  it('shows the muscles that face the camera: the front ones from the front, the back ones from behind', () => {
    const an = analyseMuscles(dj.skeleton, 'front', 60);
    const front = buildMuscles(buildRig(dj.skeleton, 60, 'front')!, an, 60).map((m) => m.id);
    expect(front).toContain('L.rectus_femoris');
    expect(front).not.toContain('L.hamstrings');
    const back = buildMuscles(buildRig(dj.skeleton, 60, 'back')!, analyseMuscles(dj.skeleton, 'back', 60), 60).map((m) => m.id);
    expect(back).toContain('L.hamstrings');
    expect(back).not.toContain('L.rectus_femoris');
    expect(MUSCLES.map((m) => m.id)).toEqual(expect.arrayContaining(['gluteus_maximus', 'iliopsoas', 'gastrocnemius_medial', 'soleus', 'tibialis_anterior', 'erector_spinae', 'rectus_abdominis', 'pectoralis_major', 'deltoid', 'biceps', 'triceps', 'trapezius']));
  });
  it('measures every muscle against its length in the first frames and gets a ratio of 1 there', () => {
    const an = analyseMuscles(run.skeleton, 'side', 60);
    const i = MUSCLES.findIndex((m) => m.id === 'rectus_femoris') * 2;
    expect(Number.isFinite(an.rest[i])).toBe(true);
    expect(muscleState(an, 0, i).ratio).toBeCloseTo(1, 0);
    // across the stride the thigh muscle changes length
    const ratios = run.skeleton.frames.map((_, f) => muscleState(an, f, i).ratio);
    expect(Math.max(...ratios) - Math.min(...ratios)).toBeGreaterThan(0.02);
    // the analysis is computed once per clip and view
    expect(analyseMuscles(run.skeleton, 'side', 60)).toBe(an);
  });
  it('a muscle that shortens swells and reddens', () => {
    const an = analyseMuscles(run.skeleton, 'side', 60);
    const i = MUSCLES.findIndex((m) => m.id === 'rectus_femoris') * 2;
    let shortest = 0;
    let longest = 0;
    run.skeleton.frames.forEach((_, f) => {
      const r = muscleState(an, f, i).ratio;
      if (r < muscleState(an, shortest, i).ratio) shortest = f;
      if (r > muscleState(an, longest, i).ratio) longest = f;
    });
    const rigS = buildRig(run.skeleton, shortest, 'side')!;
    const rigL = buildRig(run.skeleton, longest, 'side')!;
    const thin = buildMuscles(rigL, an, longest).find((m) => m.id === 'L.rectus_femoris')!;
    const fat = buildMuscles(rigS, an, shortest).find((m) => m.id === 'L.rectus_femoris')!;
    expect(fat.thickness).toBeGreaterThan(thin.thickness);
    expect(fat.c).toBeGreaterThanOrEqual(thin.c);
  });
  it('anchors sit on the bone segment they name, offset to the side of the view', () => {
    const rig = buildRig(run.skeleton, 40, 'side')!;
    const knee = rig.p['R.knee']!;
    const hip = rig.p['R.hip']!;
    const onBone = anchorPoint(rig, 'R', ['thigh', 0.5, 0, 0])!;
    expect(onBone.x).toBeCloseTo((knee.x + hip.x) / 2);
    const front = anchorPoint(rig, 'R', ['thigh', 0.5, 0, 0.1])!;
    expect(front.x - onBone.x).toBeGreaterThan(0); // toward the front (facing right)
    expect(dist(front, onBone)).toBeCloseTo(0.1 * dist(hip, knee));
    expect(anchorPoint(rig, 'R', ['thigh', 0.5, 0.1, 0])!.x).toBeCloseTo(onBone.x); // a front-view offset does not apply in a side view
    expect(pathLength([v(0, 0), v(3, 4), null])).toBeNaN();
    expect(pathLength([v(0, 0), v(3, 4)])).toBe(5);
    expect(unit(v(3, 4)).x).toBeCloseTo(0.6);
  });
  it('still draws a lighter skeleton that has no face or hands (halpe26) without failing', () => {
    const r = buildRunningSideResult();
    const a = buildAnatomyFrame(r.skeleton, 30, 'side', 60);
    expect(a).not.toBeNull();
    const ids = a!.bones.shapes.map((s) => s.id);
    expect(ids).toContain('R.femur');
    expect(ids).not.toContain('skull');
  });
  it('builds a frame fast enough to repeat every video frame', () => {
    buildAnatomyFrame(run.skeleton, 0, 'side', 60);
    const t0 = performance.now();
    for (let f = 0; f < 60; f++) buildAnatomyFrame(run.skeleton, f, 'side', 60);
    expect((performance.now() - t0) / 60).toBeLessThan(8);
  });
});
