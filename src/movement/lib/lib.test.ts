import { describe, expect, it } from 'vitest';
import { clampFrame, clock, frameAtRatio, frameIndexAt, ratioOfFrame, seekTimeOf } from './frames';
import { buildScene, containRect, project, unproject } from './overlay';
import { angleLabelTargets, jointIndexesForFlag, jointNamesForFlag } from './joints';
import { estimateFps, snapFps } from './fps';
import { DARK_LIMIT, clipLuminance, isTooDark, meanLuminance } from './luminance';
import { checkClip } from './uploadCheck';
import { asymmetryLevel, computeAsymmetry, formatAsymmetry, formatValue, metricRows } from './asymmetry';
import { curvePath, extentOf, groupCurves } from './curves';
import { clickToVideoPx, markerPixelLength, markerPlausible } from './marker';
import { compareSessions, decisionReady, groupFlags, scoreTrend, scoreView, tagsForMovement } from './review';
import { buildDropJumpFrontResult, buildRunningSideResult, HALPE26_NAMES } from '../fixtures/synth';
import type { ClipDetail, Decision, Flag, MovementSession } from '../../api/movement';

const NB = String.fromCharCode(160);
const times = Array.from({ length: 120 }, (_, i) => Math.round((i / 60) * 10000) / 10000);

describe('frames', () => {
  it('finds the frame shown at a media time, tolerating decoder rounding', () => {
    expect(frameIndexAt(times, 0)).toBe(0);
    expect(frameIndexAt(times, 1 / 60)).toBe(1);
    expect(frameIndexAt(times, 0.033299)).toBe(2); // 2/60 = 0.03333 reached a hair early
    expect(frameIndexAt(times, 0.016)).toBe(0);
    expect(frameIndexAt(times, 99)).toBe(119);
    expect(frameIndexAt(times, -3)).toBe(0);
    expect(frameIndexAt([], 1)).toBe(0);
  });
  it('seeks to the middle of a frame and reads the same frame back', () => {
    for (const f of [0, 1, 57, 119]) expect(frameIndexAt(times, seekTimeOf(times, f))).toBe(f);
  });
  it('clamps and maps ratios', () => {
    expect(clampFrame(-4, 120)).toBe(0);
    expect(clampFrame(500, 120)).toBe(119);
    expect(frameAtRatio(0.5, 120)).toBe(60);
    expect(frameAtRatio(2, 120)).toBe(119);
    expect(ratioOfFrame(119, 120)).toBe(1);
    expect(clock(1.5)).toBe('1,50 s');
  });
});

describe('overlay geometry (object-fit: contain)', () => {
  it('letterboxes a 16:9 picture in a square box (bars above and below)', () => {
    const r = containRect(400, 400, 1920, 1080);
    expect(r.scale).toBeCloseTo(400 / 1920);
    expect(r.w).toBeCloseTo(400);
    expect(r.h).toBeCloseTo(225);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(87.5);
  });
  it('pillarboxes a portrait picture in a wide box (bars left and right)', () => {
    const r = containRect(800, 400, 1080, 1920);
    expect(r.scale).toBeCloseTo(400 / 1920);
    expect(r.h).toBeCloseTo(400);
    expect(r.w).toBeCloseTo(225);
    expect(r.x).toBeCloseTo(287.5);
    expect(r.y).toBeCloseTo(0);
  });
  it('projects video pixels into canvas pixels and back', () => {
    const r = containRect(400, 400, 1920, 1080);
    const corner = project(r, 1920, 1080);
    expect(corner.x).toBeCloseTo(400);
    expect(corner.y).toBeCloseTo(312.5);
    const mid = project(r, 960, 540);
    expect(mid.x).toBeCloseTo(200);
    expect(mid.y).toBeCloseTo(200);
    const back = unproject(r, mid.x, mid.y);
    expect(back.x).toBeCloseTo(960);
    expect(back.y).toBeCloseTo(540);
  });
  it('an empty box or video gives a zero rect', () => {
    expect(containRect(0, 10, 100, 100).scale).toBe(0);
    expect(containRect(10, 10, 0, 100).scale).toBe(0);
  });
  it('builds a scene whose joints sit at the scaled, letterboxed positions', () => {
    const result = buildRunningSideResult();
    const box = { w: 640, h: 640 }; // the 1280x720 picture sits in a square: bars above and below
    const scene = buildScene({
      skeleton: result.skeleton, frame: 10, box, video: { w: 1280, h: 720 },
      highlight: new Set([13]), layers: { skeleton: true, angles: false, events: false },
    });
    const rect = containRect(640, 640, 1280, 720);
    const knee = scene.joints.find((j) => j.index === 13)!;
    const [x, y] = result.skeleton.frames[10][13];
    expect(knee.x).toBeCloseTo(rect.x + x * 0.5);
    expect(knee.y).toBeCloseTo(rect.y + y * 0.5);
    expect(knee.highlighted).toBe(true);
    expect(scene.joints.every((j) => j.y >= rect.y && j.y <= rect.y + rect.h)).toBe(true);
    expect(scene.bones.length).toBeGreaterThan(15);
  });
  it('draws nothing for hidden layers, a missing frame or low confidence', () => {
    const result = buildRunningSideResult();
    const base = { skeleton: result.skeleton, box: { w: 500, h: 300 }, video: { w: 1280, h: 720 }, highlight: new Set<number>() };
    expect(buildScene({ ...base, frame: 0, layers: { skeleton: false, angles: false, events: false } }).joints).toHaveLength(0);
    expect(buildScene({ ...base, frame: 999, layers: { skeleton: true, angles: true, events: true } }).joints).toHaveLength(0);
    const weak = { ...result.skeleton, frames: [result.skeleton.frames[0].map(([x, y]) => [x, y, 0.05] as [number, number, number])] };
    expect(buildScene({ ...base, skeleton: weak, frame: 0, layers: { skeleton: true, angles: true, events: true } }).joints).toHaveLength(0);
  });
  it('puts angle labels beside their joint', () => {
    const result = buildRunningSideResult();
    const knee = result.skeleton.names.indexOf('left_knee');
    const scene = buildScene({
      skeleton: result.skeleton, frame: 5, box: { w: 640, h: 360 }, video: { w: 1280, h: 720 }, highlight: new Set(),
      layers: { skeleton: false, angles: true, events: false }, angles: new Map([[knee, '40°']]),
    });
    expect(scene.labels).toHaveLength(1);
    expect(scene.labels[0].text).toBe('40°');
  });
});

describe('joint highlight mapping', () => {
  it('maps a region and side to the right keypoints', () => {
    expect(jointNamesForFlag({ region: 'knee', side: 'L' })).toEqual(['left_hip', 'left_knee', 'left_ankle']);
    const idx = jointIndexesForFlag({ region: 'knee', side: 'R' }, HALPE26_NAMES);
    expect([...idx].sort((a, b) => a - b)).toEqual([HALPE26_NAMES.indexOf('right_hip'), HALPE26_NAMES.indexOf('right_knee'), HALPE26_NAMES.indexOf('right_ankle')].sort((a, b) => a - b));
  });
  it('uses both sides when the flag has none, and nothing for an unknown region', () => {
    expect(jointNamesForFlag({ region: 'pelvis', side: null })).toEqual(['left_hip', 'right_hip']);
    expect(jointNamesForFlag({ region: 'elbow', side: 'L' })).toEqual([]);
    expect(jointIndexesForFlag({ region: 'unknown', side: null }, HALPE26_NAMES).size).toBe(0);
  });
  it('finds the curves that get an on-video label', () => {
    expect(angleLabelTargets({ knee_flexion_L: [], trunk_flexion: [] })).toEqual([
      { joint: 'left_knee', curve: 'knee_flexion_L' }, { joint: 'neck', curve: 'trunk_flexion' },
    ]);
  });
});

describe('fps estimate', () => {
  it('reads 60 fps from frame times and snaps to a standard rate', () => {
    const t = Array.from({ length: 60 }, (_, i) => i / 59.94);
    expect(estimateFps(t)).toBe(60);
  });
  it('ignores a few dropped frames (median)', () => {
    const t: number[] = [];
    for (let i = 0; i < 60; i++) if (i % 9 !== 4) t.push(i / 30);
    expect(estimateFps(t)).toBe(30);
  });
  it('says nothing when there are too few frames', () => {
    expect(estimateFps([0, 0.016])).toBeNull();
    expect(estimateFps([0, 0, 0, 0, 0, 0, 0])).toBeNull();
  });
  it('snaps within 4 % and rounds otherwise', () => {
    expect(snapFps(59.2)).toBe(60);
    expect(snapFps(41.234)).toBe(41.2);
  });
});

describe('luminance', () => {
  const solid = (v: number, n = 100) => new Uint8ClampedArray(Array.from({ length: n * 4 }, (_, i) => (i % 4 === 3 ? 255 : v)));
  it('averages RGBA pixels', () => {
    expect(meanLuminance(solid(0))).toBe(0);
    expect(meanLuminance(solid(255))).toBeCloseTo(255, 3);
    expect(meanLuminance(new Uint8ClampedArray(0))).toBe(0);
  });
  it('judges darkness by the median of the sampled frames', () => {
    expect(clipLuminance([10, 200, 210])).toBe(200);
    expect(clipLuminance([])).toBeNull();
    expect(isTooDark(DARK_LIMIT - 1)).toBe(true);
    expect(isTooDark(DARK_LIMIT)).toBe(false);
  });
});

describe('upload check', () => {
  const good = { durationS: 8, width: 1080, height: 1920, fps: 60, luminance: 110 };
  it('passes a good clip', () => {
    const v = checkClip(good);
    expect(v.ok).toBe(true);
    expect(v.warnings).toEqual([]);
  });
  it('rejects low fps, darkness, length and resolution with the reason', () => {
    expect(checkClip({ ...good, fps: 30 }).rejections[0]).toEqual({ code: 'low_fps', detail: '30 fps' });
    expect(checkClip({ ...good, luminance: 20 }).rejections[0].code).toBe('too_dark');
    expect(checkClip({ ...good, durationS: 1 }).rejections[0].code).toBe('too_short');
    expect(checkClip({ ...good, durationS: 120 }).rejections[0].code).toBe('too_long');
    expect(checkClip({ ...good, width: 480, height: 640 }).rejections[0].code).toBe('low_resolution');
    expect(checkClip({ ...good, fps: 24, luminance: 5 }).rejections.map((r) => r.code)).toEqual(['low_fps', 'too_dark']);
  });
  it('50 fps passes; what could not be measured is a warning, not a rejection', () => {
    expect(checkClip({ ...good, fps: 50 }).ok).toBe(true);
    const v = checkClip({ ...good, fps: null, luminance: null });
    expect(v.ok).toBe(true);
    expect(v.warnings.map((w) => w.code)).toEqual(['fps_unknown', 'dark_unknown']);
  });
});

describe('asymmetry', () => {
  it('computes and shows it with a Czech comma', () => {
    expect(computeAsymmetry(18, 22)).toBeCloseTo(20, 5);
    expect(computeAsymmetry(null, 3)).toBeNull();
    expect(computeAsymmetry(0, 0)).toBeNull();
    expect(formatAsymmetry(6.24)).toBe(`6,2${NB}%`);
    expect(formatAsymmetry(-12)).toBe(`12,0${NB}%`);
    expect(formatAsymmetry(null)).toBe('–');
    expect(formatValue(18.44, 'deg')).toBe(`18,4${NB}°`);
    expect(formatValue(0.21, 's')).toBe(`0,2${NB}s`);
  });
  it('levels', () => {
    expect(asymmetryLevel(9)).toBe('ok');
    expect(asymmetryLevel(12)).toBe('watch');
    expect(asymmetryLevel(16)).toBe('red');
    expect(asymmetryLevel(undefined)).toBe('unknown');
  });
  it('pairs left and right metrics by id and keeps single ones', () => {
    const rows = metricRows(buildRunningSideResult().metrics);
    const knee = rows.find((r) => r.id === 'knee_flexion_ic')!;
    expect(knee.left?.side).toBe('L');
    expect(knee.right?.side).toBe('R');
    expect(knee.asymmetryPct).not.toBeNull();
    expect(rows.find((r) => r.id === 'cadence')!.single).not.toBeNull();
  });
});

describe('curves', () => {
  it('groups left and right of one angle into a chart and drops empty series', () => {
    const g = groupCurves({ knee_flexion_L: [1, 2], knee_flexion_R: [1, 2], trunk_flexion: [3, 4], hip_flexion_L: [null, null] });
    expect(g).toEqual([{ base: 'knee_flexion', keys: ['knee_flexion_L', 'knee_flexion_R'] }, { base: 'trunk_flexion', keys: ['trunk_flexion'] }]);
  });
  it('draws a path, breaking the line at a null', () => {
    const ext = extentOf([[0, 10]]);
    const d = curvePath([0, null, 10, 10], 300, 100, ext);
    expect(d.startsWith('M0.00')).toBe(true);
    expect((d.match(/M/g) ?? []).length).toBe(2);
    expect(extentOf([[5, 5]]).max).toBeGreaterThan(extentOf([[5, 5]]).min);
  });
});

describe('1 m marker conversion', () => {
  const rect = containRect(400, 400, 1920, 1080); // bars above and below
  it('turns a click into native video pixels through the letterbox', () => {
    const p = clickToVideoPx(rect, 1920, 1080, 200, 200)!;
    expect(p.x).toBeCloseTo(960);
    expect(p.y).toBeCloseTo(540);
    const corner = clickToVideoPx(rect, 1920, 1080, 0, 87.5)!;
    expect(corner.x).toBeCloseTo(0);
    expect(corner.y).toBeCloseTo(0);
  });
  it('ignores a click in the bars', () => {
    expect(clickToVideoPx(rect, 1920, 1080, 200, 10)).toBeNull();
    expect(clickToVideoPx(containRect(0, 0, 10, 10), 10, 10, 1, 1)).toBeNull();
  });
  it('measures the distance in native pixels regardless of the display scale', () => {
    const a = clickToVideoPx(rect, 1920, 1080, 100, 200)!;
    const b = clickToVideoPx(rect, 1920, 1080, 300, 200)!;
    expect(markerPixelLength(a, b)).toBeCloseTo(960, 0);
    const bigger = containRect(800, 800, 1920, 1080);
    const a2 = clickToVideoPx(bigger, 1920, 1080, 200, 400)!;
    const b2 = clickToVideoPx(bigger, 1920, 1080, 600, 400)!;
    expect(markerPixelLength(a2, b2)).toBeCloseTo(960, 0);
    expect(markerPixelLength({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
  it('a tiny mark is a mis-click', () => {
    expect(markerPlausible(3, 1920, 1080)).toBe(false);
    expect(markerPlausible(412, 1920, 1080)).toBe(true);
  });
});

describe('review rules', () => {
  const flag = (id: string, severity: Flag['severity']): Flag => ({ id, ruleId: id, region: 'knee', side: 'L', severity, evidence: { frame: 1 }, sentence: { cs: 'a', en: 'b' }, ruleVersion: 'v' });
  it('groups flags by severity, worst first', () => {
    const g = groupFlags([flag('a', 'info'), flag('b', 'red'), flag('c', 'watch'), flag('d', 'red')]);
    expect(g.map((x) => x.severity)).toEqual(['red', 'watch', 'info']);
    expect(g[0].flags.map((f) => f.id)).toEqual(['b', 'd']);
    expect(groupFlags([])).toEqual([]);
  });
  it('the score is a draft until a decision exists', () => {
    const result = buildRunningSideResult();
    const base = { result, decisions: [] as Decision[] };
    expect(scoreView(base)).toEqual({ kind: 'draft', band: 'watch' });
    const d: Decision = { id: '1', action: 'accept', band: 'green', faultTags: [], unsure: false, note: '', decidedBy: 'x', decidedAt: '2026-11-03T10:00:00Z' };
    expect(scoreView({ result, decisions: [d] })).toEqual({ kind: 'decided', band: 'green' });
    expect(scoreView({ result: { ...result, score: { ...result.score, band: 'needs_review' } }, decisions: [] })).toEqual({ kind: 'needs_review' });
    expect(scoreView({ result: null, decisions: [] } as unknown as Pick<ClipDetail, 'result' | 'decisions'>)).toBeNull();
  });
  it('a decision needs a band unless it rejects', () => {
    expect(decisionReady(null, 'green')).toBe(false);
    expect(decisionReady('accept', null)).toBe(false);
    expect(decisionReady('edit', 'red')).toBe(true);
    expect(decisionReady('reject', null)).toBe(true);
  });
  it('lists the fixed fault tags, relevant ones first, none twice', () => {
    const run = tagsForMovement('running');
    expect(run.main).toContain('overstride');
    expect(run.other).toContain('stiff_landing');
    expect(new Set([...run.main, ...run.other]).size).toBe(12);
    expect(tagsForMovement('drop_jump').main).toContain('knee_valgus');
  });
  it('builds the trend and the before/after comparison', () => {
    const mk = (id: string, date: string, errors: number, value: number): MovementSession => ({
      id, patientId: 'p', date,
      clips: [{ clipId: `${id}-c`, movement: 'running', view: 'side', status: 'done', score: { band: 'watch', errorCount: errors }, decisionBand: null, keyMetrics: [{ id: 'knee_flexion_ic', side: 'L', value, unit: 'deg' }] }],
    });
    const s = [mk('b', '2026-10-02', 2, 20), mk('a', '2026-09-01', 4, 12)];
    expect(scoreTrend(s, 'running').map((p) => p.errorCount)).toEqual([4, 2]);
    const rows = compareSessions(s[1], s[0], 'running');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ before: 12, after: 20, delta: 8 });
  });
});

describe('fixtures are a valid, consistent ClipResult', () => {
  for (const [name, build] of [['running side', buildRunningSideResult], ['drop jump front', buildDropJumpFrontResult]] as const) {
    it(`${name}: 120 frames, one entry per frame everywhere`, () => {
      const r = build();
      expect(r.skeleton.frames).toHaveLength(120);
      expect(r.skeleton.times).toHaveLength(120);
      expect(r.skeleton.frames.every((f) => f.length === 26)).toBe(true);
      for (const c of Object.values(r.curves)) expect(c).toHaveLength(r.video.frameCount);
      for (const e of r.events) expect(e.frame).toBeLessThan(120);
      for (const f of r.flags) expect(f.evidence.frame).toBeLessThan(120);
      expect(r.flags.every((f) => f.sentence.cs.length > 0 && f.sentence.en.length > 0)).toBe(true);
      expect(new Set(r.flags.map((f) => f.severity)).size).toBeGreaterThan(1);
      // every keypoint stays inside the 1280x720 picture
      for (const f of r.skeleton.frames) for (const [x, y] of f) { expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(1280); expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(720); }
    });
  }
  it('running has foot strikes and toe-offs for both legs', () => {
    const r = buildRunningSideResult();
    for (const side of ['L', 'R']) {
      expect(r.events.filter((e) => e.type === 'foot_strike' && e.side === side).length).toBeGreaterThanOrEqual(2);
      expect(r.events.filter((e) => e.type === 'toe_off' && e.side === side).length).toBeGreaterThanOrEqual(2);
    }
  });
});
