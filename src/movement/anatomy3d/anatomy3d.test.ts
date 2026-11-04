import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { halfToFloat, parseAnatomy, poseOf } from './anatomyData';
import {
  MUSCLE_GROUPS, bellyRadius, isLigament, muscleGroup, muscleLabel, musclePathWorld, muscleRgb, musclesOnBodies, nearestMuscle, orthoBounds,
  activePulse, alignOffset, cameraPreset, easeInOutCubic, introBone, introMuscles, lerpAt, lerpPoses, nearEvent, onionFrames, pulseIntensity,
  poseVector, polylineLength, radiusProfile, regionBodies, sampleCenterline, segmentDistance, sideOfName, swell, tendonness, tubeFrames, worldToStage,
} from './anatomyMath';
import { containRect, viewRect } from '../lib/overlay';

const read = (name: string) => {
  const dir = resolve(process.cwd(), 'src', 'movement', 'fixtures');
  const json = JSON.parse(readFileSync(resolve(dir, `${name}.anatomy.json`), 'utf8'));
  const buf = readFileSync(resolve(dir, `${name}.anatomy.bin`));
  return { json, bin: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer };
};
const run = read('running_side');
const drop = read('drop_jump_front');

describe('anatomy files', () => {
  it('half floats decode like IEEE 754 binary16', () => {
    expect(halfToFloat(0x0000)).toBe(0);
    expect(halfToFloat(0x3c00)).toBe(1);
    expect(halfToFloat(0xbc00)).toBe(-1);
    expect(halfToFloat(0x3800)).toBeCloseTo(0.5);
    expect(halfToFloat(0x4248)).toBeCloseTo(3.140625);
    expect(halfToFloat(0x7bff)).toBe(65504);
    expect(halfToFloat(0x7c00)).toBe(Infinity);
    expect(Number.isNaN(halfToFloat(0x7e00))).toBe(true);
    expect(halfToFloat(0x0001)).toBeCloseTo(5.96e-8, 9); // the smallest subnormal
  });
  it('the real fixtures parse into arrays of the sizes their json promises', () => {
    for (const f of [run, drop]) {
      const a = parseAnatomy(f.json, f.bin);
      expect(a.bodies).toHaveLength(88);
      expect(a.muscles).toHaveLength(424);
      expect(a.poses).toHaveLength(a.frames * 88 * 7);
      expect(a.muscleLength).toHaveLength(a.frames * 424);
      expect(a.contraction).toHaveLength(a.frames * 424);
      expect(a.angles).toHaveLength(a.frames * a.meta.angleJoints.length);
      expect(a.pxPerM).toBeGreaterThan(100);
      expect(Array.from(a.contraction).every((c) => c >= 0 && c <= 1.001)).toBe(true);
      expect(Array.from(a.muscleLength).every((c) => c > 0.1 && c < 3)).toBe(true);
    }
    expect(parseAnatomy(drop.json, drop.bin).frames).toBe(141);
  });
  it('quaternions in the poses are unit length', () => {
    const a = parseAnatomy(run.json, run.bin);
    for (const [f, b] of [[0, 0], [40, 13], [119, 87]]) {
      const p = poseOf(a, f, b);
      expect(Math.hypot(p.qw, p.qx, p.qy, p.qz)).toBeCloseTo(1, 3);
    }
  });
  it('refuses a binary that is too short or a json that does not match it', () => {
    expect(() => parseAnatomy(run.json, run.bin.slice(0, 1000))).toThrow();
    expect(() => parseAnatomy({ ...run.json, bodies: run.json.bodies.slice(1) }, run.bin)).toThrow();
    expect(() => parseAnatomy({ nope: 1 }, run.bin)).toThrow();
  });
});

describe('posing a body: v\' = R(q) v + p', () => {
  const poses = new Float32Array([1, 2, 3, 1, 0, 0, 0]); // at (1,2,3), no rotation
  it('the identity quaternion only translates', () => {
    expect(poseVector(poses, 1, 0, 0, [0.5, 0, 0])).toEqual({ x: 1.5, y: 2, z: 3 });
  });
  it('a quarter turn about Z sends x to y', () => {
    const s = Math.SQRT1_2;
    const q = new Float32Array([0, 0, 0, s, 0, 0, s]);
    const v = poseVector(q, 1, 0, 0, [1, 0, 0]);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(1);
    expect(v.z).toBeCloseTo(0);
  });
  it('a half turn about X flips y and z', () => {
    const q = new Float32Array([0, 0, 0, 0, 1, 0, 0]);
    const v = poseVector(q, 1, 0, 0, [0, 1, 2]);
    expect(v.y).toBeCloseTo(-1);
    expect(v.z).toBeCloseTo(-2);
  });
  it('a muscle path follows the bodies it is attached to', () => {
    const a = parseAnatomy(run.json, run.bin);
    const path = musclePathWorld(a, 40, 0);
    const [b0, local] = a.muscles[0].path[0];
    const direct = poseVector(a.poses, a.bodies.length, 40, b0, local);
    expect(path[0]).toBeCloseTo(direct.x);
    expect(path[2]).toBeCloseTo(direct.z);
    expect(polylineLength(path)).toBeGreaterThan(0.01);
  });
  it('a pelvis of the fixture sits where the video says it is: x_px = X * pxPerM', () => {
    const a = parseAnatomy(run.json, run.bin);
    const pelvis = poseOf(a, 40, a.bodies.findIndex((b) => b.name === 'pelvis'));
    expect(pelvis.x * a.pxPerM).toBeGreaterThan(800);
    expect(pelvis.x * a.pxPerM).toBeLessThan(1100);
    expect(-pelvis.z * a.pxPerM).toBeGreaterThan(250);
  });
});

describe('the look of a muscle', () => {
  it('the tube is thin and whitish at the tendon ends and thick in the belly', () => {
    expect(tendonness(0)).toBeCloseTo(1);
    expect(tendonness(1)).toBeCloseTo(1);
    expect(tendonness(0.5)).toBe(0);
    expect(radiusProfile(0.5)).toBeCloseTo(1, 1);
    expect(radiusProfile(0)).toBeLessThan(0.3);
    expect(radiusProfile(1)).toBeLessThan(0.3);
    expect(radiusProfile(0.5)).toBeGreaterThan(radiusProfile(0.12));
  });
  it('the belly radius grows with the length of the muscle, within limits', () => {
    expect(bellyRadius(0.4)).toBeGreaterThan(bellyRadius(0.1));
    expect(bellyRadius(0.001)).toBeCloseTo(0.0038);
    expect(bellyRadius(5)).toBeCloseTo(0.034);
  });
  it('shortened muscles swell, stretched ones thin, and contraction adds a little', () => {
    expect(swell(1, 0)).toBe(1);
    expect(swell(0.85, 0)).toBeGreaterThan(1);
    expect(swell(1.2, 0)).toBeLessThan(1);
    expect(swell(1, 1)).toBeGreaterThan(swell(1, 0));
    expect(swell(0.1, 0)).toBe(1.5);
  });
  it('colour goes from a muted rose to a bright red', () => {
    const [r0, g0] = muscleRgb(0);
    const [r1, g1] = muscleRgb(1);
    expect(r1).toBeGreaterThan(r0);
    expect(g1).toBeLessThan(g0);
    expect(muscleRgb(5)).toEqual(muscleRgb(1));
  });
});

describe('what a muscle is', () => {
  const a = parseAnatomy(run.json, run.bin);
  it('every muscle of the model has a group, a side where it has one, and a Czech label', () => {
    for (const m of a.muscles) {
      expect(MUSCLE_GROUPS).toContain(muscleGroup(m.name));
      expect(muscleLabel(m.name).length).toBeGreaterThan(3);
    }
    expect(a.muscles.some((m) => isLigament(m.name))).toBe(true);
  });
  it('groups by name: glutes, thigh, calf, trunk, arm', () => {
    expect(muscleGroup('glmax1_r')).toBe('glutes');
    expect(muscleGroup('recfem_l')).toBe('thigh');
    expect(muscleGroup('vaslat_r')).toBe('thigh');
    expect(muscleGroup('bflh_r')).toBe('thigh');
    expect(muscleGroup('gasmed_r')).toBe('calf');
    expect(muscleGroup('soleus_l')).toBe('calf');
    expect(muscleGroup('tibant_r')).toBe('calf');
    expect(muscleGroup('rect_abd_r_tendon')).toBe('trunk');
    expect(muscleGroup('EO_L1_r_tendon')).toBe('trunk');
    expect(muscleGroup('DELT1_r_tendon')).toBe('arm');
    expect(muscleGroup('BIClong_tendon_l')).toBe('arm');
  });
  it('says the muscle and the side in Czech', () => {
    expect(muscleLabel('gasmed_r')).toBe('Lýtkový sval, vnitřní hlava, pravá strana');
    expect(muscleLabel('recfem_l')).toBe('Přímý sval stehenní, levá strana');
    expect(muscleLabel('DELT1_r_tendon')).toBe('Deltový sval, pravá strana');
    expect(sideOfName('vasmed_r')).toBe('R');
    expect(sideOfName('TRIlat_tendon_l')).toBe('L');
    expect(sideOfName('rect_abd')).toBeNull();
    expect(muscleLabel('zzz_unknown')).toBe('Sval zzz_unknown');
  });
  it('a finding\'s region and side name its bones, and the muscles on them', () => {
    const names = a.bodies.map((b) => b.name);
    expect([...regionBodies('knee', 'L', names)].sort()).toEqual(['femur_l', 'patella_l', 'tibia_l']);
    expect([...regionBodies('ankle', 'R', names)].sort()).toEqual(['calcn_r', 'talus_r', 'tibia_r']);
    expect(regionBodies('hip', null, names).has('femur_r') && regionBodies('hip', null, names).has('femur_l')).toBe(true);
    expect(regionBodies('elbow', 'L', names).size).toBe(0);
    const muscles = musclesOnBodies(a, regionBodies('knee', 'L', names));
    expect(muscles.size).toBeGreaterThan(5);
    for (const i of muscles) expect(sideOfName(a.muscles[i].name) === 'R').toBe(false);
  });
});

describe('the camera laid over the video', () => {
  const pxPerM = 426;
  it('world (X, Z) lands exactly on the video pixel (X*pxPerM, -Z*pxPerM) through the letterbox', () => {
    const stage = { w: 400, h: 400 };
    const rect = containRect(stage.w, stage.h, 1920, 1080);
    const b = orthoBounds(rect, stage, pxPerM);
    // a point of the video, in world metres
    const X = 960 / pxPerM;
    const Z = -540 / pxPerM; // the centre of the picture
    const p = worldToStage(rect, pxPerM, X, Z);
    expect(p.x).toBeCloseTo(200);
    expect(p.y).toBeCloseTo(200);
    // the frustum maps the same point to the same pixel
    const sx = ((X - b.left) / (b.right - b.left)) * stage.w;
    const sy = ((b.top - Z) / (b.top - b.bottom)) * stage.h;
    expect(sx).toBeCloseTo(p.x);
    expect(sy).toBeCloseTo(p.y);
    // the letterbox bars show world outside the picture
    expect(b.top).toBeGreaterThan(0);
    expect(b.bottom).toBeLessThan(-1080 / pxPerM);
  });
  it('follows the Detail crop: the zoomed view puts the same world point on the zoomed pixel', () => {
    const stage = { w: 340, h: 560 };
    const rect = viewRect(stage.w, stage.h, 1920, 1080, { x0: 700, y0: 100, x1: 1200, y1: 1000 });
    const p = worldToStage(rect, pxPerM, 900 / pxPerM, -400 / pxPerM);
    expect(p.x).toBeCloseTo(rect.x + 900 * rect.scale);
    expect(p.y).toBeCloseTo(rect.y + 400 * rect.scale);
    const b = orthoBounds(rect, stage, pxPerM);
    expect(b.right - b.left).toBeCloseTo(stage.w / (rect.scale * pxPerM));
  });
});

describe('hovering a muscle', () => {
  it('measures the distance to a segment', () => {
    expect(segmentDistance(5, 5, 0, 0, 10, 0)).toBe(5);
    expect(segmentDistance(-3, 4, 0, 0, 10, 0)).toBe(5);
    expect(segmentDistance(1, 1, 2, 2, 2, 2)).toBeCloseTo(Math.SQRT2);
  });
  it('picks the nearest visible muscle within the tolerance, widened by its radius', () => {
    const lines = [new Float32Array([0, 0, 100, 0]), null, new Float32Array([0, 20, 100, 20])];
    expect(nearestMuscle(lines, 50, 3, 6)?.index).toBe(0);
    expect(nearestMuscle(lines, 50, 18, 6)?.index).toBe(2);
    expect(nearestMuscle(lines, 50, 10, 6)).toBeNull();
    expect(nearestMuscle(lines, 50, 10, 6, new Float32Array([0, 0, 6]))?.index).toBe(2);
    expect(nearestMuscle([null], 1, 1, 100)).toBeNull();
  });
});

describe('tube geometry', () => {
  it('samples two points as a straight line and more as a smooth curve through them', () => {
    const out = new Float32Array(5 * 3);
    sampleCenterline(new Float32Array([0, 0, 0, 4, 0, 0]), 2, 5, out);
    expect(Array.from(out.slice(0, 3))).toEqual([0, 0, 0]);
    expect(out[6]).toBeCloseTo(2);
    expect(out[12]).toBeCloseTo(4);
    const curve = new Float32Array(9 * 3);
    sampleCenterline(new Float32Array([0, 0, 0, 1, 1, 0, 2, 0, 0]), 3, 9, curve);
    expect(curve[0]).toBeCloseTo(0);
    expect(curve[24]).toBeCloseTo(2);
    expect(Math.max(...Array.from({ length: 9 }, (_, i) => curve[i * 3 + 1]))).toBeGreaterThan(0.5);
  });
  it('frames along a bend are unit, perpendicular to the tangent and to each other', () => {
    const n = 12;
    const line = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { line[i * 3] = Math.cos(i / 4); line[i * 3 + 1] = i * 0.1; line[i * 3 + 2] = Math.sin(i / 4); }
    const t = new Float32Array(n * 3), nr = new Float32Array(n * 3), b = new Float32Array(n * 3);
    tubeFrames(line, n, t, nr, b);
    for (let i = 0; i < n; i++) {
      const dot = (a: Float32Array, c: Float32Array) => a[i * 3] * c[i * 3] + a[i * 3 + 1] * c[i * 3 + 1] + a[i * 3 + 2] * c[i * 3 + 2];
      expect(dot(t, t)).toBeCloseTo(1, 4);
      expect(dot(nr, nr)).toBeCloseTo(1, 4);
      expect(dot(b, b)).toBeCloseTo(1, 4);
      expect(dot(t, nr)).toBeCloseTo(0, 4);
      expect(dot(nr, b)).toBeCloseTo(0, 4);
    }
  });
  it('a line along the reference direction still gets a valid frame', () => {
    const line = new Float32Array([0, 0, 0, 0, 1, 0, 0, 2, 0]);
    const t = new Float32Array(9), nr = new Float32Array(9), b = new Float32Array(9);
    tubeFrames(line, 3, t, nr, b, { x: 0, y: 1, z: 0 });
    expect(Number.isFinite(nr[0] + nr[1] + nr[2])).toBe(true);
    expect(Math.hypot(nr[0], nr[1], nr[2])).toBeCloseTo(1, 4);
  });
});

describe('smooth playback: poses and muscle values between frames', () => {
  const two = (q1: number[]) => new Float32Array([0, 0, 0, 1, 0, 0, 0, 2, 4, 6, ...q1]); // one body, two frames
  it('positions are lerped and a half step lands in the middle', () => {
    const out = new Float32Array(7);
    lerpPoses(two([1, 0, 0, 0]), 1, 0.5, out);
    expect(Array.from(out.slice(0, 3))).toEqual([1, 2, 3]);
    lerpPoses(two([1, 0, 0, 0]), 1, 0, out);
    expect(Array.from(out.slice(0, 3))).toEqual([0, 0, 0]);
    lerpPoses(two([1, 0, 0, 0]), 1, 1, out);
    expect(Array.from(out.slice(0, 3))).toEqual([2, 4, 6]);
  });
  it('quaternions are slerped: halfway between no turn and a quarter turn about Z is an eighth turn, still unit length', () => {
    const s = Math.SQRT1_2;
    const out = new Float32Array(7);
    lerpPoses(two([s, 0, 0, s]), 1, 0.5, out);
    const half = Math.PI / 8;
    expect(out[3]).toBeCloseTo(Math.cos(half), 4);
    expect(out[6]).toBeCloseTo(Math.sin(half), 4);
    expect(Math.hypot(out[3], out[4], out[5], out[6])).toBeCloseTo(1, 5);
  });
  it('takes the short way round when the second quaternion is the negative of the first', () => {
    const out = new Float32Array(7);
    lerpPoses(two([-1, 0, 0, 0]), 1, 0.5, out);
    expect(Math.abs(out[3])).toBeCloseTo(1, 5);
  });
  it('clamps beyond the clip and blends a table of values', () => {
    const out = new Float32Array(7);
    lerpPoses(two([1, 0, 0, 0]), 1, 99, out);
    expect(Array.from(out.slice(0, 3))).toEqual([2, 4, 6]);
    expect(lerpAt([1, 3, 5, 7], 2, 2, 0.5, 0)).toBe(3); // frames [1,3] and [5,7], index 0: 1 -> 5
    expect(lerpAt([1, 3, 5, 7], 2, 2, 0.5, 1)).toBe(5);
    expect(lerpAt([1, 3, 5, 7], 2, 2, 9, 0)).toBe(5);
  });
});

describe('easing, ghosts and event moments', () => {
  it('eases in and out, 0 to 1', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25);
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75);
    expect(easeInOutCubic(-3)).toBe(0);
    expect(easeInOutCubic(7)).toBe(1);
  });
  it('picks the ghost frames: every 6 frames back, nearest first, never before the start', () => {
    expect(onionFrames(40)).toEqual([34, 28, 22, 16]);
    expect(onionFrames(40.7, 6, 3)).toEqual([34, 28, 22]);
    expect(onionFrames(14)).toEqual([8, 2]);
    expect(onionFrames(3)).toEqual([]);
  });
  it('an event glows brightest on its frame and fades out over six frames either side', () => {
    expect(pulseIntensity(50, 50)).toBe(1);
    expect(pulseIntensity(53, 50)).toBeCloseTo(0.5);
    expect(pulseIntensity(56, 50)).toBe(0);
    expect(pulseIntensity(44, 50)).toBe(0);
  });
  it('the active pulse is the strongest event of a loaded leg; unrelated events and sideless ones do not pulse', () => {
    const ev = [{ type: 'foot_strike', side: 'R' as const, frame: 20 }, { type: 'toe_off', side: 'L' as const, frame: 22 }, { type: 'peak_knee_flexion', side: 'L' as const, frame: 24 }, { type: 'initial_contact', side: null, frame: 21 }];
    expect(activePulse(ev, 20)).toMatchObject({ side: 'R', k: 1 });
    expect(activePulse(ev, 23)).toMatchObject({ side: 'L' }); // the peak knee flexion, not the toe-off
    expect(activePulse(ev, 60)).toBeNull();
    expect(nearEvent(ev, 22)).toBe(true);
    expect(nearEvent(ev, 40)).toBe(false);
  });
  it('lines up two clips on their first initial contact', () => {
    const a = [{ type: 'foot_strike', side: 'R' as const, frame: 22 }, { type: 'toe_off', side: 'R' as const, frame: 37 }];
    const b = [{ type: 'initial_contact', side: 'L' as const, frame: 45 }];
    expect(alignOffset(a, b)).toBe(23);
    expect(alignOffset(b, a)).toBe(-23);
    expect(alignOffset(a, [])).toBe(0);
    expect(alignOffset([], b)).toBe(0);
  });
});

describe('the intro and the camera presets', () => {
  it('the bones assemble from the feet up: a low bone is complete before a high one starts to grow', () => {
    expect(introBone(0, 0)).toBe(0);
    expect(introBone(0, 1)).toBe(1);
    expect(introBone(1, 1)).toBe(1);
    expect(introBone(0, 0.4)).toBeGreaterThan(introBone(1, 0.4));
    expect(introBone(1, 0.2)).toBe(0);
  });
  it('the muscles fade in last', () => {
    expect(introMuscles(0.5)).toBe(0);
    expect(introMuscles(0.875)).toBeCloseTo(0.5);
    expect(introMuscles(1)).toBe(1);
  });
  it('presets stand around the target: the video camera looks along +Y, front and back along the heading, side beside it, top above', () => {
    const t = { x: 2, y: 0, z: -0.9 };
    const h = { x: 1, y: 0 };
    expect(cameraPreset('video', h, t, 3).position).toEqual({ x: 2, y: -3, z: -0.8 });
    expect(cameraPreset('front', h, t, 3).position.x).toBeCloseTo(5);
    expect(cameraPreset('back', h, t, 3).position.x).toBeCloseTo(-1);
    const side = cameraPreset('side', h, t, 3).position;
    expect(side.x).toBeCloseTo(2);
    expect(Math.abs(side.y)).toBeCloseTo(3);
    expect(cameraPreset('top', h, t, 3).position.z).toBeCloseTo(2.1);
    expect(cameraPreset('front', { x: 0, y: 0 }, t, 3).position.y).toBe(-3); // no heading: falls back to the video camera
  });
});
