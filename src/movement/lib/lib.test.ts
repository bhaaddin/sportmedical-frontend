import { describe, expect, it } from 'vitest';
import { clampFrame, clock, frameAtRatio, frameIndexAt, ratioOfFrame, seekTimeOf } from './frames';
import { DEFAULT_LAYERS, buildScene, containRect, project, unproject, viewRect } from './overlay';
import { confidenceAlpha, detailAspect, edgeAlpha, edgeRegion, edgeStyle, flexionArc, jointRadius, lineUnit, regionsOf, skeletonBounds, trailOf } from './skeleton';
import { angleLabelTargets, angleSpecs, jointIndexesForFlag, jointNamesForFlag } from './joints';
import { estimateFps, snapFps } from './fps';
import { DARK_LIMIT, clipLuminance, isTooDark, meanLuminance } from './luminance';
import { checkClip } from './uploadCheck';
import { asymmetryLevel, computeAsymmetry, formatAsymmetry, formatValue, metricRows } from './asymmetry';
import { curvePath, extentOf, groupCurves } from './curves';
import { clickToVideoPx, markerPixelLength, markerPlausible } from './marker';
import { overallPct, stageOf, stageSteps } from './progress';
import { metricName, compareMetrics, decisionReady, doneClipOf, groupFlags, scoreTrend, scoreView, staffLabel, tagsForMovement } from './review';
import { buildDropJumpFrontResult, buildRunningSideResult, HALPE26_NAMES } from '../fixtures/synth';
import { clipResultSchema, type ClipDetail, type ClipResult, type Decision, type Flag, type MovementSession } from '../../api/movement';
import wholeRunning from '../fixtures/running_side.result.json';
import wholeDrop from '../fixtures/drop_jump_front.result.json';

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
  it('builds a scene whose joints sit at the scaled, letterboxed positions (halpe26 still renders)', () => {
    const result = buildRunningSideResult();
    const box = { w: 640, h: 640 }; // the 1280x720 picture sits in a square: bars above and below
    const scene = buildScene({
      skeleton: result.skeleton, frame: 10, box, video: { w: 1280, h: 720 },
      highlight: new Set([13]), layers: { ...DEFAULT_LAYERS, trail: false, angles: false },
    });
    const rect = containRect(640, 640, 1280, 720);
    const knee = scene.dots.find((d) => d.r > 0 && d.key === 'highlight')!;
    const [x, y] = result.skeleton.frames[10][13];
    expect(knee.x).toBeCloseTo(rect.x + x! * 0.5);
    expect(knee.y).toBeCloseTo(rect.y + y! * 0.5);
    expect(scene.dots.every((d) => d.y >= rect.y && d.y <= rect.y + rect.h)).toBe(true);
    expect(scene.strokes.length).toBeGreaterThan(2);
    expect(scene.rings).toHaveLength(1);
  });
  it('draws nothing for a missing frame, hidden layers or low confidence', () => {
    const result = buildRunningSideResult();
    const base = { skeleton: result.skeleton, box: { w: 500, h: 300 }, video: { w: 1280, h: 720 }, highlight: new Set<number>() };
    const off = { body: false, hands: false, face: false, feet: false, angles: false, trail: false, events: false };
    expect(buildScene({ ...base, frame: 0, layers: off }).dots).toHaveLength(0);
    expect(buildScene({ ...base, frame: 999, layers: DEFAULT_LAYERS }).dots).toHaveLength(0);
    const weak = { ...result.skeleton, frames: [result.skeleton.frames[0].map(([x, y]) => [x, y, 0.05] as [number | null, number | null, number])] };
    const scene = buildScene({ ...base, skeleton: weak, frame: 0, layers: DEFAULT_LAYERS });
    expect(scene.dots).toHaveLength(0);
    expect(scene.strokes).toHaveLength(0);
  });
  it('puts a flexion arc with its value pill at the knee', () => {
    const result = buildRunningSideResult();
    const names = result.skeleton.names;
    const scene = buildScene({
      skeleton: result.skeleton, frame: 5, box: { w: 640, h: 360 }, video: { w: 1280, h: 720 }, highlight: new Set(),
      layers: DEFAULT_LAYERS, angles: angleSpecs(names, result.curves, 5),
    });
    expect(scene.arcs.length).toBeGreaterThanOrEqual(2);
    expect(scene.labels.some((l) => /°$/.test(l.text))).toBe(true);
  });
});

describe('whole-body skeleton (133 points) drawn from edges and groups', () => {
  const sk = wholeRunning.skeleton as unknown as ClipResult['skeleton'];
  const regions = regionsOf(sk);
  const scene = (layers = DEFAULT_LAYERS, frame = 30, highlight = new Set<number>()) => buildScene({
    skeleton: sk, frame, box: { w: 960, h: 540 }, video: { w: 1920, h: 1080 }, highlight, layers,
  });

  it('the real fixtures parse and carry 133 points and 140 edges', () => {
    for (const r of [wholeRunning, wholeDrop]) {
      expect(() => clipResultSchema.parse(r)).not.toThrow();
      expect(r.skeleton.names).toHaveLength(133);
      expect(r.skeleton.edges).toHaveLength(140);
    }
    expect(wholeDrop.skeleton.frames).toHaveLength(141);
    expect(wholeRunning.skeleton.frames).toHaveLength(120);
  });
  it('splits the points into regions by the ranges of `groups`', () => {
    expect(regions.filter((r) => r === 'body')).toHaveLength(17);
    expect(regions.filter((r) => r === 'feet')).toHaveLength(6);
    expect(regions.filter((r) => r === 'face')).toHaveLength(68);
    expect(regions.filter((r) => r === 'leftHand')).toHaveLength(21);
    expect(regions.filter((r) => r === 'rightHand')).toHaveLength(21);
  });
  it('without `groups` the regions come from the point names (halpe26)', () => {
    const r = regionsOf({ names: ['nose', 'left_knee', 'left_heel', 'face_3', 'left_hand_wrist', 'right_thumb2'] });
    expect(r).toEqual(['body', 'body', 'feet', 'face', 'leftHand', 'rightHand']);
  });
  it('draws every region: face mesh, both hands, feet and the body with a halo', () => {
    const s = scene();
    const by = (region: string) => s.strokes.filter((b) => b.region === region);
    expect(by('face').reduce((n, b) => n + b.segs.length / 4, 0)).toBeGreaterThan(55);
    expect(by('leftHand').reduce((n, b) => n + b.segs.length / 4, 0)).toBeGreaterThanOrEqual(20);
    expect(by('rightHand').reduce((n, b) => n + b.segs.length / 4, 0)).toBeGreaterThanOrEqual(20);
    expect(by('feet').length).toBeGreaterThan(0);
    expect(by('body').every((b) => b.halo)).toBe(true);
    expect(by('face').every((b) => !b.halo && b.width < 1.2)).toBe(true);
    expect(s.dots.length).toBeGreaterThan(120);
    // few canvas calls: edges are batched by region, colour and fade
    expect(s.strokes.length).toBeLessThan(20);
  });
  it('colours left warm and right cool, the face neutral', () => {
    const s = scene();
    const keys = (region: string) => new Set(s.strokes.filter((b) => b.region === region).map((b) => b.key));
    expect(keys('leftHand')).toEqual(new Set(['left']));
    expect(keys('rightHand')).toEqual(new Set(['right']));
    expect(keys('face')).toEqual(new Set(['face']));
    expect(keys('body').has('left') && keys('body').has('right')).toBe(true);
  });
  it('each layer toggle removes exactly its region', () => {
    const regionsIn = (l: typeof DEFAULT_LAYERS) => new Set(scene(l).dots.map((d) => d.region));
    expect(regionsIn({ ...DEFAULT_LAYERS, hands: false }).has('leftHand')).toBe(false);
    expect(regionsIn({ ...DEFAULT_LAYERS, hands: false }).has('face')).toBe(true);
    expect(regionsIn({ ...DEFAULT_LAYERS, face: false }).has('face')).toBe(false);
    expect(regionsIn({ ...DEFAULT_LAYERS, feet: false }).has('feet')).toBe(false);
    const noBody = regionsIn({ ...DEFAULT_LAYERS, body: false });
    expect(noBody.has('body')).toBe(false);
    expect(scene({ ...DEFAULT_LAYERS, angles: false }).arcs).toHaveLength(0);
    expect(scene({ ...DEFAULT_LAYERS, trail: false }).trails).toHaveLength(0);
    expect(scene().trails.length).toBeGreaterThan(0);
  });
  it('highlights a flag\'s joints in the highlight colour with a ring each', () => {
    const idx = jointIndexesForFlag({ region: 'knee', side: 'L' }, sk.names);
    const s = scene(DEFAULT_LAYERS, 30, idx);
    expect(s.rings).toHaveLength(idx.size);
    expect(s.strokes.some((b) => b.key === 'highlight' && b.region === 'body')).toBe(true);
  });
  it('line widths follow the displayed size of the video', () => {
    const big = buildScene({ skeleton: sk, frame: 30, box: { w: 1920, h: 1080 }, video: { w: 1920, h: 1080 }, highlight: new Set(), layers: DEFAULT_LAYERS });
    const small = buildScene({ skeleton: sk, frame: 30, box: { w: 390, h: 220 }, video: { w: 1920, h: 1080 }, highlight: new Set(), layers: DEFAULT_LAYERS });
    const body = (sc: typeof big) => sc.strokes.find((b) => b.region === 'body')!.width;
    expect(body(big)).toBeGreaterThan(body(small) * 1.5);
    expect(lineUnit(100)).toBe(0.55);
    expect(lineUnit(9999)).toBe(2.2);
  });
  it('joint markers are sized by importance', () => {
    const r = (name: string, region: Parameters<typeof jointRadius>[1]) => jointRadius(name, region, 1, false);
    expect(r('left_knee', 'body')).toBeGreaterThan(r('left_elbow', 'body'));
    expect(r('left_elbow', 'body')).toBeGreaterThan(r('left_index3', 'leftHand'));
    expect(r('left_index3', 'leftHand')).toBeGreaterThan(r('face_5', 'face'));
    expect(jointRadius('left_knee', 'body', 1, true)).toBeGreaterThan(r('left_knee', 'body'));
  });
  it('fades points by confidence and hides them below 0.3', () => {
    expect(confidenceAlpha(0.29)).toBe(0);
    expect(confidenceAlpha(0.3)).toBeGreaterThan(0);
    expect(confidenceAlpha(0.3)).toBeLessThan(confidenceAlpha(0.5));
    expect(confidenceAlpha(0.5)).toBeLessThan(1);
    expect(confidenceAlpha(0.7)).toBe(1);
    expect(confidenceAlpha(Number.NaN)).toBe(0);
    expect(edgeAlpha(0.9, 0.4)).toBe(confidenceAlpha(0.4));
  });
  it('edge style by region: the body bold with halo and glow, hands thin, face finest', () => {
    const body = edgeStyle('body', 1, false);
    expect(body).toMatchObject({ halo: true, glow: true });
    expect(edgeStyle('body', 1, true).width).toBeGreaterThan(body.width);
    expect(body.width).toBeGreaterThan(edgeStyle('feet', 1, false).width);
    expect(edgeStyle('feet', 1, false).width).toBeGreaterThan(edgeStyle('leftHand', 1, false).width);
    expect(edgeStyle('leftHand', 1, false).width).toBeGreaterThan(edgeStyle('face', 1, false).width);
    expect(edgeRegion('body', 'leftHand')).toBe('leftHand');
    expect(edgeRegion('body', 'feet')).toBe('feet');
    expect(edgeRegion('body', 'body')).toBe('body');
  });
});

describe('Detail zoom onto the athlete', () => {
  const sk = wholeDrop.skeleton as unknown as ClipResult['skeleton'];
  it('bounds hold the athlete in every frame, with a margin, and ignore face and hand points', () => {
    const b = skeletonBounds(sk)!;
    expect(b.x0).toBeGreaterThan(0);
    expect(b.x1).toBeLessThan(1920);
    expect(b.y1 - b.y0).toBeGreaterThan(300);
    for (const frame of sk.frames) for (const [x, y, c] of frame.slice(0, 23)) if (c >= 0.3) { expect(x!).toBeGreaterThan(b.x0); expect(x!).toBeLessThan(b.x1); expect(y!).toBeGreaterThan(b.y0); expect(y!).toBeLessThan(b.y1); }
    expect(skeletonBounds({ ...sk, frames: [] })).toBeNull();
  });
  it('the zoomed view puts the bounds inside the stage and covers it with the picture', () => {
    const b = skeletonBounds(sk)!;
    const stage = { w: 400, h: 400 / detailAspect(b, 1920 / 1080) };
    const v = viewRect(stage.w, stage.h, 1920, 1080, b);
    const tl = project(v, b.x0, b.y0);
    const br = project(v, b.x1, b.y1);
    expect(tl.x).toBeGreaterThanOrEqual(-0.5);
    // (the padding may reach past the picture's own edge; the view is then clamped to it)
    expect(br.x).toBeLessThanOrEqual(stage.w + 0.5);
    // the picture always covers the stage: no empty bars next to a crop
    expect(v.x).toBeLessThanOrEqual(0);
    expect(v.y).toBeLessThanOrEqual(0);
    expect(v.x + v.w).toBeGreaterThanOrEqual(stage.w - 0.5);
    expect(v.y + v.h).toBeGreaterThanOrEqual(stage.h - 0.5);
    expect(v.scale).toBeGreaterThan(containRect(stage.w, stage.h, 1920, 1080).scale);
    expect(v.w).toBeCloseTo(1920 * v.scale);
  });
  it('without a zoom the view is the plain contain rect; the stage never gets thinner than 3:5', () => {
    expect(viewRect(400, 400, 1920, 1080, null)).toEqual(containRect(400, 400, 1920, 1080));
    expect(detailAspect({ x0: 0, y0: 0, x1: 100, y1: 1000 }, 16 / 9)).toBe(0.6);
    expect(detailAspect({ x0: 0, y0: 0, x1: 5000, y1: 100 }, 16 / 9)).toBeCloseTo(16 / 9);
  });
  it('a zoomed scene puts the joints inside the stage', () => {
    const b = skeletonBounds(sk)!;
    const stage = { w: 360, h: 360 / detailAspect(b, 1920 / 1080) };
    const s = buildScene({ skeleton: sk, frame: 70, box: stage, video: { w: 1920, h: 1080 }, highlight: new Set(), layers: DEFAULT_LAYERS, zoom: b });
    const body = s.dots.filter((d) => d.region === 'body');
    expect(body.length).toBeGreaterThan(10);
    expect(body.every((d) => d.x >= 0 && d.x <= stage.w && d.y >= 0 && d.y <= stage.h)).toBe(true);
  });
});

describe('flexion arc and motion trail', () => {
  it('starts along the continuation of the upper segment and sweeps by the measured value', () => {
    // straight leg down, the shank then swings backward (to the left on screen)
    const a = flexionArc({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: -5, y: 20 }, 40);
    expect(a.start).toBeCloseTo(Math.PI / 2); // pointing down
    expect(Math.abs(a.sweep)).toBeCloseTo((40 * Math.PI) / 180);
    expect(a.sweep).toBeGreaterThan(0); // clockwise on a y-down canvas: down -> left
    expect(a.mid).toBeCloseTo(a.start + a.sweep / 2);
    const other = flexionArc({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 5, y: 20 }, 40);
    expect(other.sweep).toBeLessThan(0);
    expect(flexionArc({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 20 }, 0).sweep).toBeCloseTo(0);
    expect(Math.abs(flexionArc({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 5, y: 20 }, 400).sweep)).toBeCloseTo(Math.PI);
  });
  it('the trail holds the last frames of one point, oldest first, without unknown points', () => {
    const frames = Array.from({ length: 30 }, (_, f) => [[f * 2, f, 0.9], [null, null, 0.9]] as [number | null, number | null, number][]);
    const t = trailOf(frames, 20, 0, 10);
    expect(t).toHaveLength(11);
    expect(t[0].x).toBe(20);
    expect(t.at(-1)!.x).toBe(40);
    expect(trailOf(frames, 20, 1, 10)).toEqual([]);
    expect(trailOf(frames, 3, 0, 10)).toHaveLength(4);
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

describe('metric names and asymmetry from the pipeline', () => {
  const maybe = (key: string, fallback: string) => (key === 'metric.cadence' ? 'Kadence (naše)' : fallback);
  it('shows the pipeline label in the language of the screen, then our wording, then a readable id - never the raw code', () => {
    expect(metricName({ cs: 'Doba kontaktu', en: 'Contact time' }, 'contact_time', 'cs', maybe)).toBe('Doba kontaktu');
    expect(metricName({ cs: 'Doba kontaktu', en: 'Contact time' }, 'contact_time', 'en', maybe)).toBe('Contact time');
    expect(metricName(null, 'cadence', 'cs', maybe)).toBe('Kadence (naše)');
    expect(metricName(undefined, 'knee_valgus_ic', 'cs', maybe)).toBe('Knee valgus ic');
    expect(metricName({ cs: '', en: '' }, 'landing.asynchrony', 'cs', maybe)).toBe('Landing asynchrony');
  });
  it('keeps the label with the row and does not invent an asymmetry the pipeline left empty', () => {
    const m = (side: 'L' | 'R', value: number, asym: number | null) => ({ id: 'knee_valgus_peak', side, value, unit: 'deg', normBand: null, asymmetryPct: asym, label: { cs: 'Zapadnutí kolene', en: 'Knee valgus' } });
    const rows = metricRows([m('L', 0.4, null), m('R', 0, null)]);
    expect(rows[0].label?.cs).toBe('Zapadnutí kolene');
    expect(rows[0].asymmetryPct).toBeNull();
    expect(formatAsymmetry(rows[0].asymmetryPct)).toBe('–');
    expect(metricRows([m('L', 12, 20), m('R', 10, 20)])[0].asymmetryPct).toBe(20);
  });
});

describe('processing stages', () => {
  const states = (status: Parameters<typeof stageSteps>[0], progress?: Parameters<typeof stageSteps>[1]) => stageSteps(status, progress).map((s) => s.state).join(',');
  it('maps the wire stages onto the five steps', () => {
    expect(stageOf('downloaded')).toBe('pose');
    expect(stageOf('pose')).toBe('pose');
    expect(stageOf('analysis')).toBe('analysis');
    expect(stageOf('anatomy')).toBe('anatomy');
    expect(stageOf('something new')).toBeNull();
  });
  it('waiting shows nothing running; processing without progress is downloading', () => {
    expect(states('queued')).toBe('pending,pending,pending,pending,pending');
    expect(states('uploaded')).toBe('pending,pending,pending,pending,pending');
    expect(states('processing')).toBe('active,pending,pending,pending,pending');
  });
  it('a stage in progress has the earlier ones done and carries its percentage', () => {
    expect(states('processing', { stage: 'downloaded', pct: 100 })).toBe('done,active,pending,pending,pending');
    expect(states('processing', { stage: 'analysis', pct: 10 })).toBe('done,done,active,pending,pending');
    expect(states('processing', { stage: 'anatomy', pct: 50 })).toBe('done,done,done,active,pending');
    expect(stageSteps('processing', { stage: 'pose', pct: 130 })[1].pct).toBe(100);
    expect(stageSteps('processing', { stage: 'pose', pct: 30 })[2].pct).toBeNull();
  });
  it('done has every step done; failed stops at the stage it reached', () => {
    expect(states('done')).toBe('done,done,done,done,done');
    expect(states('failed', { stage: 'pose', pct: 12 })).toBe('done,active,pending,pending,pending');
  });
  it('the overall bar is a quarter per working stage', () => {
    expect(overallPct('queued')).toBe(0);
    expect(overallPct('processing', { stage: 'pose', pct: 50 })).toBe(38);
    expect(overallPct('processing', { stage: 'anatomy', pct: 100 })).toBe(100);
    expect(overallPct('done')).toBe(100);
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
    expect(scoreView({ result, decisions: [{ ...d, action: 'reject', band: null }] })).toEqual({ kind: 'rejected' });
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
  it('builds the band trend and the before/after comparison from the clips', () => {
    const mk = (id: string, date: string, band: 'green' | 'watch' | 'red'): MovementSession => ({
      id, patientId: 'p', appointmentId: null, date,
      clips: [{ clipId: `${id}-c`, movement: 'running', view: 'side', status: 'done', band, hasDecision: false }],
    });
    const s = [mk('b', '2026-10-02', 'green'), mk('a', '2026-09-01', 'red')];
    expect(scoreTrend(s, 'running').map((p) => p.level)).toEqual([3, 1]);
    expect(scoreTrend(s, 'drop_jump')).toEqual([]);
    expect(doneClipOf(s[0], 'running')).toBe('b-c');
    const metric = (value: number) => ({ id: 'knee_flexion_ic', side: 'L' as const, value, unit: 'deg' });
    const rows = compareMetrics([metric(12)], [metric(20)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ before: 12, after: 20, delta: 8 });
    expect(compareMetrics(undefined, [metric(5)])[0]).toMatchObject({ before: null, delta: null });
  });
  it('names a decision author only by the tail of the staff id', () => {
    expect(staffLabel('0190a000-0000-7000-8000-00000000a1b2')).toBe('Klinik a1b2');
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
