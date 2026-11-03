import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { halfToFloat, parseAnatomy, poseOf } from './anatomyData';
import {
  MUSCLE_GROUPS, bellyRadius, isLigament, muscleGroup, muscleLabel, musclePathWorld, muscleRgb, musclesOnBodies, nearestMuscle, orthoBounds,
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
