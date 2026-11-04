/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * The 3D anatomy engine (three.js, one lazy chunk). One scene - the MyoSim bones as lit meshes and the muscles as volumetric tubes -
 * drawn by any number of views: an OVERLAY view whose orthographic camera lays the scene exactly over the video picture, and an
 * ORBIT view you can rotate. `setFrame` takes a fractional frame: bone poses are slerped/lerped between the two frames around it
 * (so slow motion is fluid), the muscle tubes are rebuilt in place in one geometry with a fixed topology (one draw call).
 * Motion extras - an intro that assembles the skeleton, event pulses, a ghost trail of earlier poses, a fibre flow along active
 * muscles, a cinematic camera - all follow the Animace setting: only "plné" moves on its own.
 * The look of the muscles (belly swelling, redness with the contraction proxy) is a visual model, not EMG.
 */
import type { Anatomy } from './anatomyData';
import {
  MUSCLE_GROUPS, TENDON_RGB, bellyRadius, cameraPreset, easeInOutCubic, introBone, introMuscles, isLigament, lerpAt, lerpPoses, muscleGroup, muscleLabel,
  musclePathWorld, muscleRgb, musclesOnBodies, nearestMuscle, onionFrames, orthoBounds, polylineLength, radiusProfile, sampleCenterline, sideOfName, swell,
  tendonness, tubeFrames, worldToStage, type CameraPreset, type MuscleGroup,
} from './anatomyMath';

export interface EngineLayers { bones: boolean; muscles: boolean; tendons: boolean; ghosts?: boolean }
export interface MuscleInfo { index: number; name: string; label: string; group: MuscleGroup; relativeLength: number; contraction: number }

const RADIAL = 6;
const LEG_BODY = /^(femur|tibia|patella|talus|calcn|toes)_([rl])$/;
/* the ghost trail keeps the bones that show the movement: no hand bones, no rib cage, no vertebrae, no skull */
const HAND_BONE = /(proxph|midph|distph|mc_|thumb|lunate|scaphoid|pisiform|triquetrum|capitate|trapezium|trapezoid|hamate|^torso|^head|^neck|^lumbar|^chest|^Abdomen)/;
const GHOST_OPACITY = [0.34, 0.24, 0.15];

let softwareGl: boolean | null = null;
/** True when WebGL is drawn by the CPU (SwiftShader, llvmpipe, a blocklisted GPU): the scene then drops multisampling and the bump map. */
export function isSoftwareGl(): boolean {
  if (softwareGl !== null) return softwareGl;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    const name = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    softwareGl = /swiftshader|llvmpipe|software|basic render/i.test(name);
  } catch { softwareGl = false; }
  return softwareGl;
}

/** Only the Animace setting "plné" lets things move on their own (the setting is mirrored on <html data-motion>). */
export const motionFull = (): boolean => typeof document !== 'undefined' && document.documentElement.dataset.motion === 'full';

export class AnatomyEngine {
  readonly anatomy: Anatomy;
  readonly THREE: any;
  readonly scene: any;
  private bones = new Map<number, any>();
  private boneMaterials = new Map<number, any>();
  private muscleMesh: any;
  private muscleMaterial: any;
  private geo: any;
  private pos!: Float32Array;
  private nor!: Float32Array;
  private col!: Float32Array;
  private uv!: Float32Array;
  private ringsOf: number[] = [];
  private vertStart: number[] = [];
  private indexStart: number[] = [];
  private indexCount: number[] = [];
  private index!: Uint32Array;
  private pathWorld: Float32Array[] = [];
  private bellyR: number[] = [];
  private groupOf: MuscleGroup[] = [];
  private frame = -1;
  private layers: EngineLayers = { bones: true, muscles: true, tendons: true, ghosts: false };
  private groups = new Set<MuscleGroup>(MUSCLE_GROUPS);
  private highlightBodies = new Set<string>();
  private highlightMuscles = new Set<number>();
  private selected: number | null = null;
  private views: AnatomyView[] = [];
  private scratch = { line: new Float32Array(64 * 3), t: new Float32Array(64 * 3), n: new Float32Array(64 * 3), b: new Float32Array(64 * 3) };
  private poseBuf: Float32Array;
  private fake: { poses: Float32Array; bodies: Anatomy['bodies']; muscles: Anatomy['muscles'] };
  private boneGroup: any;
  private tmpQ: any; private tmpV: any; private tmpS: any;
  /* motion extras */
  private pulse: { side: 'L' | 'R'; k: number } | null = null;
  private pulseMuscles = new Set<number>();
  private ghostNodes: Map<number, any>[] = [];
  private ghostGroup: any = null;
  private flow = 0;
  private flowOn = false;
  private lastClock = 0;
  private introP = 1;
  private introRank = new Map<number, number>();
  private introRaf = 0;
  private shadow: any = null;
  /** milliseconds of the last pose + tube update and of the last render, for the performance readout */
  lastUpdateMs = 0;
  lastRenderMs = 0;

  private constructor(THREE: any, anatomy: Anatomy) {
    this.THREE = THREE;
    this.anatomy = anatomy;
    this.scene = new THREE.Scene();
    this.poseBuf = new Float32Array(anatomy.bodies.length * 7);
    this.fake = { poses: this.poseBuf, bodies: anatomy.bodies, muscles: anatomy.muscles };
  }

  /** Loads three.js and the bone meshes, and builds the scene. Heavy: call it lazily, once per clip. */
  static async create(anatomy: Anatomy, glb: ArrayBuffer): Promise<AnatomyEngine> {
    const THREE: any = await import('three');
    const { GLTFLoader }: any = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const gltf: any = await new GLTFLoader().parseAsync(glb, '');
    const engine = new AnatomyEngine(THREE, anatomy);
    engine.buildLights();
    engine.buildBones(gltf.scene);
    engine.buildMuscles();
    engine.buildShadow();
    engine.setFrame(0);
    return engine;
  }

  private buildLights(): void {
    const T = this.THREE;
    this.scene.add(new T.HemisphereLight(0xfff3df, 0x40382f, 1.15));
    const key = new T.DirectionalLight(0xffffff, 1.9);
    key.position.set(-1.6, -2.2, 2.4);
    this.scene.add(key);
    const fill = new T.DirectionalLight(0xbcd0ff, 0.55);
    fill.position.set(2.2, -1.2, 0.4);
    this.scene.add(fill);
    const rim = new T.DirectionalLight(0xffe9c4, 0.7);
    rim.position.set(0.4, 2.5, 1.2);
    this.scene.add(rim);
  }

  private buildBones(root: any): void {
    const T = this.THREE;
    const group = new T.Group();
    group.name = 'bones';
    this.anatomy.bodies.forEach((b, i) => {
      if (!b.hasMesh) return;
      const node = root.getObjectByName(b.name);
      if (!node) return;
      node.removeFromParent();
      node.matrixAutoUpdate = false;
      const mat = isSoftwareGl()
        ? new T.MeshLambertMaterial({ color: 0xe9dec3, emissive: 0x000000 })
        : new T.MeshStandardMaterial({ color: 0xe9dec3, roughness: 0.58, metalness: 0.0, emissive: 0x000000 });
      node.traverse((o: any) => {
        if (o.isMesh) {
          o.material = mat;
          if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
          o.frustumCulled = false;
        }
      });
      group.add(node);
      this.bones.set(i, node);
      this.boneMaterials.set(i, mat);
    });
    this.scene.add(group);
    this.boneGroup = group;
    /* the height of every bone on the first frame: the intro assembles the skeleton from the feet up */
    const a = this.anatomy;
    const zs = [...this.bones.keys()].map((i) => ({ i, z: a.poses[i * 7 + 2] }));
    zs.sort((p, q) => p.z - q.z);
    // MyoSim's world has Z up: the lowest bone (a foot) is first
    zs.forEach((e, r) => this.introRank.set(e.i, r / Math.max(1, zs.length - 1)));
  }

  private buildMuscles(): void {
    const T = this.THREE;
    const { muscles } = this.anatomy;
    let verts = 0;
    let tris = 0;
    muscles.forEach((m) => {
      this.groupOf.push(muscleGroup(m.name));
      const pts = m.path.length;
      const rings = isLigament(m.name) ? 0 : Math.min(40, Math.max(6, (pts - 1) * 5 + 1));
      this.ringsOf.push(rings);
      this.vertStart.push(verts);
      this.indexStart.push(tris * 3);
      this.indexCount.push(rings > 1 ? (rings - 1) * RADIAL * 6 : 0);
      verts += rings * (RADIAL + 1);
      tris += rings > 1 ? (rings - 1) * RADIAL * 2 : 0;
      this.pathWorld.push(new Float32Array(pts * 3));
      this.bellyR.push(0.01);
    });
    this.pos = new Float32Array(verts * 3);
    this.nor = new Float32Array(verts * 3);
    this.col = new Float32Array(verts * 3);
    this.uv = new Float32Array(verts * 2);
    const idx = new Uint32Array(tris * 3);
    muscles.forEach((_, m) => {
      const rings = this.ringsOf[m];
      for (let r = 0; r < rings; r++) {
        for (let j = 0; j <= RADIAL; j++) {
          const v = this.vertStart[m] + r * (RADIAL + 1) + j;
          this.uv[v * 2] = j / RADIAL;
          this.uv[v * 2 + 1] = (r / Math.max(1, rings - 1)) * 4;
        }
      }
      let o = this.indexStart[m];
      for (let r = 0; r < rings - 1; r++) {
        for (let j = 0; j < RADIAL; j++) {
          const a = this.vertStart[m] + r * (RADIAL + 1) + j;
          const b = a + RADIAL + 1;
          idx[o++] = a; idx[o++] = b; idx[o++] = a + 1;
          idx[o++] = a + 1; idx[o++] = b; idx[o++] = b + 1;
        }
      }
    });
    this.index = idx;
    const geo = new T.BufferGeometry();
    const dyn = (arr: Float32Array, n: number) => { const at = new T.BufferAttribute(arr, n); at.setUsage(T.DynamicDrawUsage); return at; };
    geo.setAttribute('position', dyn(this.pos, 3));
    geo.setAttribute('normal', dyn(this.nor, 3));
    geo.setAttribute('color', dyn(this.col, 3));
    geo.setAttribute('uv', dyn(this.uv, 2));
    geo.setIndex(new T.BufferAttribute(idx.slice(), 1));
    this.geo = geo;

    const tex = this.fibreTexture();
    /* the CPU renderer gets the cheaper diffuse-only material (no specular, no bump): the picture is nearly the same, the frame much faster */
    this.muscleMaterial = isSoftwareGl()
      ? new T.MeshLambertMaterial({ vertexColors: true, map: tex, transparent: false, opacity: 1 })
      : new T.MeshStandardMaterial({ vertexColors: true, map: tex, bumpMap: tex, bumpScale: 1.4, roughness: 0.46, metalness: 0.02, transparent: false, opacity: 1 });
    this.muscleMesh = new T.Mesh(geo, this.muscleMaterial);
    this.muscleMesh.frustumCulled = false;
    this.muscleMesh.name = 'muscles';
    this.scene.add(this.muscleMesh);
    this.rebuildIndex();
  }

  /** A procedural fibre texture: lengthwise striations of varying width, with soft bands along the fibre that the flow slides along. */
  private fibreTexture(): any {
    const T = this.THREE;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 32;
    const g = c.getContext('2d')!;
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let x = 0; x < 128; x += 1) {
      const base = 150 + rnd() * 105;
      for (let y = 0; y < 32; y++) {
        const band = 0.82 + 0.18 * Math.sin((y / 32) * Math.PI * 2);
        const v = Math.min(255, base * band);
        g.fillStyle = `rgb(${v | 0}, ${(v * 0.92) | 0}, ${(v * 0.92) | 0})`;
        g.fillRect(x, y, 1, 1);
      }
    }
    const tex = new T.CanvasTexture(c);
    tex.wrapS = T.RepeatWrapping;
    tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(2, 1);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  /** A soft ground shadow under the athlete, visible in the orbit view only (the overlay looks along the floor). */
  private buildShadow(): void {
    const T = this.THREE;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const mat = new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false });
    this.shadow = new T.Mesh(new T.CircleGeometry(0.5, 24), mat);
    this.shadow.layers.set(1);
    this.shadow.frustumCulled = false;
    this.scene.add(this.shadow);
  }

  /* ───────── state ───────── */

  setLayers(layers: EngineLayers): void {
    this.layers = { ...layers, ghosts: layers.ghosts === true };
    if (this.boneGroup) this.boneGroup.visible = layers.bones;
    this.rebuildIndex();
    if (this.ghostGroup) this.ghostGroup.visible = this.layers.ghosts === true && layers.bones;
    this.refresh();
  }

  setGroups(groups: ReadonlySet<MuscleGroup>): void {
    this.groups = new Set(groups);
    this.rebuildIndex();
    this.refresh();
  }

  /** Highlights bones by name and the muscles attached to them (the findings' region). */
  setHighlight(bodies: ReadonlySet<string>): void {
    this.highlightBodies = new Set(bodies);
    this.highlightMuscles = musclesOnBodies(this.anatomy, this.highlightBodies);
    this.paintBones();
    this.refresh();
  }

  setSelected(index: number | null): void {
    this.selected = index;
    this.refresh();
  }

  /** An event moment: the bones and muscles of the loaded leg glow for a moment (k 0..1); null ends it. */
  setPulse(pulse: { side: 'L' | 'R'; k: number } | null): void {
    const same = (this.pulse === null && pulse === null) || (this.pulse && pulse && this.pulse.side === pulse.side && Math.abs(this.pulse.k - pulse.k) < 0.02);
    if (same) return;
    this.pulse = pulse;
    const bodies = new Set<string>();
    if (pulse) this.anatomy.bodies.forEach((b) => { const m = LEG_BODY.exec(b.name); if (m && m[2].toUpperCase() === pulse.side) bodies.add(b.name); });
    this.pulseMuscles = pulse ? musclesOnBodies(this.anatomy, bodies) : new Set();
    this.paintBones();
    this.refresh();
  }

  private paintBones(): void {
    this.boneMaterials.forEach((mat, i) => {
      const name = this.anatomy.bodies[i].name;
      let r = 0, g = 0, b = 0;
      if (this.highlightBodies.has(name)) { r = 0.54; g = 0.25; b = 0.07; }
      if (this.pulse) {
        const m = LEG_BODY.exec(name);
        if (m && m[2].toUpperCase() === this.pulse.side) { const k = this.pulse.k; r = Math.max(r, 0.9 * k); g = Math.max(g, 0.45 * k); b = Math.max(b, 0.1 * k); }
      }
      mat.emissive.setRGB(r, g, b);
    });
  }

  /** Slow-motion playback turns the fibre flow on; a paused picture holds still. */
  setFlowActive(on: boolean): void {
    this.flowOn = on;
    this.lastClock = performance.now();
  }

  private visible(m: number): boolean {
    return this.layers.muscles && this.ringsOf[m] > 1 && this.groups.has(this.groupOf[m]);
  }

  /** The triangle list holds only the visible muscles. */
  private rebuildIndex(): void {
    if (!this.geo) return;
    let n = 0;
    for (let m = 0; m < this.ringsOf.length; m++) if (this.visible(m)) n += this.indexCount[m];
    const out = new Uint32Array(n);
    let o = 0;
    for (let m = 0; m < this.ringsOf.length; m++) {
      if (!this.visible(m)) continue;
      out.set(this.index.subarray(this.indexStart[m], this.indexStart[m] + this.indexCount[m]), o);
      o += this.indexCount[m];
    }
    this.geo.setIndex(new this.THREE.BufferAttribute(out, 1));
    this.muscleMesh.visible = n > 0;
  }

  /* ───────── the intro: bones assemble from the feet up, then the muscles fade in ───────── */

  playIntro(ms = 1000): void {
    cancelAnimationFrame(this.introRaf);
    if (!motionFull()) { this.setIntro(1); return; }
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      this.setIntro(p);
      this.renderAll();
      if (p < 1) this.introRaf = requestAnimationFrame(tick);
    };
    this.setIntro(0);
    this.introRaf = requestAnimationFrame(tick);
  }

  private setIntro(p: number): void {
    this.introP = p;
    this.boneMaterials.forEach((mat, i) => {
      const k = introBone(this.introRank.get(i) ?? 0, p);
      mat.transparent = k < 1;
      mat.opacity = k;
    });
    if (this.muscleMaterial) {
      const op = introMuscles(p);
      const was = this.muscleMaterial.transparent;
      this.muscleMaterial.opacity = op;
      this.muscleMaterial.transparent = op < 1; // blending costs fill rate: only while fading in
      if (was !== this.muscleMaterial.transparent) this.muscleMaterial.needsUpdate = true;
    }
    if (this.frame >= 0) this.setFrame(this.frame);
  }

  /* ───────── a frame ───────── */

  /** Poses the bones and rebuilds the tubes for a (fractional) frame: the poses are blended between the frames around it. */
  setFrame(frame: number): void {
    const t0 = performance.now();
    const a = this.anatomy;
    const f = Math.max(0, Math.min(a.frames - 1, frame));
    this.frame = f;
    if (this.flowOn && motionFull()) this.flow += Math.min(0.1, (t0 - this.lastClock) / 1000);
    this.lastClock = t0;
    lerpPoses(a.poses, a.bodies.length, f, this.poseBuf);
    this.poseNodes(this.bones, this.poseBuf, this.introP < 1);
    if (this.layers.ghosts) this.updateGhosts(f);
    this.scene.updateMatrixWorld(true);
    this.updateMuscles(f);
    this.updateShadow();
    this.lastUpdateMs = performance.now() - t0;
  }

  private poseNodes(nodes: Map<number, any>, poses: Float32Array, intro: boolean): void {
    const T = this.THREE;
    const q = this.tmpQ ?? (this.tmpQ = new T.Quaternion());
    const p = this.tmpV ?? (this.tmpV = new T.Vector3());
    const s = this.tmpS ?? (this.tmpS = new T.Vector3(1, 1, 1));
    nodes.forEach((node, i) => {
      const o = i * 7;
      p.set(poses[o], poses[o + 1], poses[o + 2]);
      q.set(poses[o + 4], poses[o + 5], poses[o + 6], poses[o + 3]);
      if (intro) { const k = introBone(this.introRank.get(i) ?? 0, this.introP); s.setScalar(0.82 + 0.18 * easeInOutCubic(k)); } else s.set(1, 1, 1);
      node.matrix.compose(p, q, s);
      node.matrixWorldNeedsUpdate = true;
    });
  }

  /** Semi-transparent copies of the skeleton at earlier key frames, fading out: the path of the movement. */
  private updateGhosts(f: number): void {
    const T = this.THREE;
    if (this.ghostGroup === null) {
      this.ghostGroup = new T.Group();
      for (let g = 0; g < GHOST_OPACITY.length; g++) {
        const mat = new T.MeshBasicMaterial({ color: 0xbfd2e6, transparent: true, opacity: GHOST_OPACITY[g], depthWrite: false });
        const nodes = new Map<number, any>();
        this.bones.forEach((node, i) => {
          /* the tiny hand bones are left out of the ghosts: invisible at that size, a third of the triangles */
          if (HAND_BONE.test(this.anatomy.bodies[i].name)) return;
          const c = node.clone();
          c.traverse((o: any) => { if (o.isMesh) { o.material = mat; o.frustumCulled = false; } });
          c.matrixAutoUpdate = false;
          this.ghostGroup.add(c);
          nodes.set(i, c);
        });
        this.ghostNodes.push(nodes);
      }
      this.scene.add(this.ghostGroup);
    }
    const frames = onionFrames(f, 6, GHOST_OPACITY.length);
    const buf = new Float32Array(this.poseBuf.length);
    this.ghostNodes.forEach((nodes, g) => {
      const fg = frames[g];
      const visible = fg !== undefined;
      nodes.forEach((n) => { n.visible = visible; });
      if (!visible) return;
      lerpPoses(this.anatomy.poses, this.anatomy.bodies.length, fg, buf);
      this.poseNodes(nodes, buf, false);
    });
  }

  private updateShadow(): void {
    if (!this.shadow) return;
    let zmin = Infinity;
    let x = 0, y = 0, n = 0;
    this.anatomy.bodies.forEach((b, i) => {
      if (!/^(calcn|toes)_/.test(b.name)) return;
      const o = i * 7;
      zmin = Math.min(zmin, this.poseBuf[o + 2]);
      x += this.poseBuf[o]; y += this.poseBuf[o + 1]; n++;
    });
    if (n === 0) { this.shadow.visible = false; return; }
    this.shadow.position.set(x / n, y / n, zmin - 0.03);
    this.shadow.scale.set(1.1, 1.1, 1);
  }

  private refresh(): void {
    if (this.frame >= 0) this.updateMuscles(this.frame);
  }

  private updateMuscles(f: number): void {
    const a = this.anatomy;
    const M = a.muscles.length;
    const s = this.scratch;
    for (let m = 0; m < M; m++) {
      const path = a.muscles[m].path;
      const rings = this.ringsOf[m];
      if (!this.visible(m)) continue;
      musclePathWorld(this.fake, 0, m, this.pathWorld[m]);
      const rel = lerpAt(a.muscleLength, M, a.frames, f, m) || 1;
      const contraction = lerpAt(a.contraction, M, a.frames, f, m);
      const len = polylineLength(this.pathWorld[m], path.length);
      this.bellyR[m] = bellyRadius(len / Math.max(0.4, rel));
      sampleCenterline(this.pathWorld[m], path.length, rings, s.line);
      tubeFrames(s.line, rings, s.t, s.n, s.b);
      const sel = this.selected === m;
      const pulsed = this.pulse !== null && this.pulseMuscles.has(m);
      const hi = sel || this.highlightMuscles.has(m);
      const base = muscleRgb(sel ? 1 : pulsed ? Math.min(1, contraction + 0.6 * this.pulse!.k) : contraction);
      const sw = swell(rel, contraction) * (sel ? 1.25 : 1) * (pulsed ? 1 + 0.18 * this.pulse!.k : 1);
      /* the fibres slide along the muscle faster the harder it works */
      const flowShift = this.flow * (0.25 + 2.2 * contraction);
      const flowing = this.flowOn && motionFull();
      for (let r = 0; r < rings; r++) {
        const t = r / (rings - 1);
        const tn = tendonness(t);
        const radius = tn > 0.5 && !this.layers.tendons ? 0 : this.bellyR[m] * radiusProfile(t) * (1 - tn) * sw + this.bellyR[m] * radiusProfile(t) * tn * 0.8;
        const cx = s.line[r * 3], cy = s.line[r * 3 + 1], cz = s.line[r * 3 + 2];
        const nx = s.n[r * 3], ny = s.n[r * 3 + 1], nz = s.n[r * 3 + 2];
        const bx = s.b[r * 3], by = s.b[r * 3 + 1], bz = s.b[r * 3 + 2];
        let cr = base[0] + (TENDON_RGB[0] - base[0]) * tn;
        let cg = base[1] + (TENDON_RGB[1] - base[1]) * tn;
        let cb = base[2] + (TENDON_RGB[2] - base[2]) * tn;
        if (hi) { cr = cr * 0.45 + 0.55; cg = cg * 0.45 + 0.5 * 0.6 * 0.55 + 0.12; cb = cb * 0.45 + 0.05; }
        for (let j = 0; j <= RADIAL; j++) {
          const ang = (j / RADIAL) * Math.PI * 2;
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const ox = nx * ca + bx * sa, oy = ny * ca + by * sa, oz = nz * ca + bz * sa;
          const vi = this.vertStart[m] + r * (RADIAL + 1) + j;
          const v = vi * 3;
          this.pos[v] = cx + ox * radius; this.pos[v + 1] = cy + oy * radius; this.pos[v + 2] = cz + oz * radius;
          this.nor[v] = ox; this.nor[v + 1] = oy; this.nor[v + 2] = oz;
          this.col[v] = cr; this.col[v + 1] = cg; this.col[v + 2] = cb;
          if (flowing) this.uv[vi * 2 + 1] = t * 4 - flowShift;
        }
      }
    }
    const at = this.geo.attributes;
    at.position.needsUpdate = true;
    at.normal.needsUpdate = true;
    at.color.needsUpdate = true;
    if (this.flowOn && motionFull()) at.uv.needsUpdate = true;
  }

  /* ───────── reading ───────── */

  get currentFrame(): number { return this.frame; }

  muscleInfo(index: number): MuscleInfo {
    const a = this.anatomy;
    const M = a.muscles.length;
    const f = Math.max(0, this.frame);
    return {
      index, name: a.muscles[index].name, label: muscleLabel(a.muscles[index].name), group: this.groupOf[index],
      relativeLength: lerpAt(a.muscleLength, M, a.frames, f, index), contraction: lerpAt(a.contraction, M, a.frames, f, index),
    };
  }

  /** The visible muscle under a stage point (CSS pixels) of a view, or null. */
  pick(view: AnatomyView, x: number, y: number): MuscleInfo | null {
    const lines: (Float32Array | null)[] = [];
    const radii = new Float32Array(this.ringsOf.length);
    for (let m = 0; m < this.ringsOf.length; m++) {
      if (!this.visible(m)) { lines.push(null); continue; }
      const w = this.pathWorld[m];
      const pts = w.length / 3;
      const flat = new Float32Array(pts * 2);
      for (let i = 0; i < pts; i++) {
        const p = view.project(w[i * 3], w[i * 3 + 1], w[i * 3 + 2]);
        flat[i * 2] = p.x;
        flat[i * 2 + 1] = p.y;
      }
      lines.push(flat);
      radii[m] = view.pixelsPerMetre() * this.bellyR[m] * 0.8;
    }
    const hit = nearestMuscle(lines, x, y, 6, radii);
    return hit === null ? null : this.muscleInfo(hit.index);
  }

  /** The bone under a ray (NDC coordinates of a view), with the point where it was hit; for "fly to this bone". */
  pickBone(camera: any, ndc: { x: number; y: number }): { name: string; point: any } | null {
    const T = this.THREE;
    const ray = new T.Raycaster();
    ray.setFromCamera(new T.Vector2(ndc.x, ndc.y), camera);
    const hits = ray.intersectObjects(this.boneGroup.children, true);
    if (hits.length === 0) return null;
    let node = hits[0].object;
    while (node && !this.anatomy.bodies.some((b) => b.name === node.name)) node = node.parent;
    return { name: node ? node.name : '', point: hits[0].point.clone() };
  }

  /** The horizontal direction the athlete faces (from heel to toes), a unit vector in X/Y. */
  heading(): { x: number; y: number } {
    const a = this.anatomy;
    const f = Math.max(0, this.frame);
    const get = (name: string) => { const i = a.bodies.findIndex((b) => b.name === name); return i < 0 ? null : { x: this.poseBuf[i * 7], y: this.poseBuf[i * 7 + 1] }; };
    void f;
    const t = get('toes_r'), c = get('calcn_r');
    if (!t || !c) return { x: 0, y: -1 };
    const dx = t.x - c.x, dy = t.y - c.y;
    const l = Math.hypot(dx, dy);
    return l < 1e-4 ? { x: 0, y: -1 } : { x: dx / l, y: dy / l };
  }

  /* ───────── views ───────── */

  createView(canvas: HTMLCanvasElement, mode: 'overlay' | 'orbit'): AnatomyView {
    const v = new AnatomyView(this, canvas, mode);
    this.views.push(v);
    return v;
  }

  removeView(v: AnatomyView): void {
    this.views = this.views.filter((x) => x !== v);
  }

  renderAll(): void {
    const t0 = performance.now();
    for (const v of this.views) v.render();
    this.lastRenderMs = performance.now() - t0;
  }

  /** Average milliseconds per frame (pose + tubes + draw of every view) over `n` frames, GPU work finished. */
  bench(n = 60, step = 1): number {
    const first = performance.now();
    for (let i = 0; i < n; i++) {
      this.setFrame((i * step) % this.anatomy.frames);
      this.renderAll();
    }
    for (const v of this.views) v.finish();
    return (performance.now() - first) / n;
  }

  /** The position of a body on the current frame (for the orbit view to follow the athlete). */
  bodyPosition(name: string): { x: number; y: number; z: number } | null {
    const i = this.anatomy.bodies.findIndex((b) => b.name === name);
    if (i < 0 || this.frame < 0) return null;
    const o = i * 7;
    return { x: this.poseBuf[o], y: this.poseBuf[o + 1], z: this.poseBuf[o + 2] };
  }

  get boneRoot(): any { return this.boneGroup; }

  dispose(): void {
    cancelAnimationFrame(this.introRaf);
    for (const v of [...this.views]) v.dispose();
    this.views = [];
    this.scene.traverse((o: any) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { for (const m of Array.isArray(o.material) ? o.material : [o.material]) { m.map?.dispose(); m.dispose(); } }
    });
  }

  get sideNames(): { name: string; side: 'R' | 'L' | null }[] {
    return this.anatomy.muscles.map((m) => ({ name: m.name, side: sideOfName(m.name) }));
  }
}

/** One canvas drawing the engine's scene: laid over the video (orthographic) or free to rotate (perspective + orbit controls). */
export class AnatomyView {
  readonly canvas: HTMLCanvasElement;
  readonly mode: 'overlay' | 'orbit';
  private renderer: any;
  private camera: any;
  private controls: any = null;
  private size = { w: 1, h: 1 };
  private rect = { x: 0, y: 0, scale: 1 };
  private target: any;
  private lastTarget: { x: number; y: number; z: number } | null = null;
  private engine: AnatomyEngine;
  /* the cinematic camera */
  private follow_ = true;
  private auto = false;
  private fly: { t0: number; ms: number; from: { p: any; t: any }; to: { p: any; t: any } } | null = null;
  private raf = 0;
  private lastTick = 0;

  constructor(engine: AnatomyEngine, canvas: HTMLCanvasElement, mode: 'overlay' | 'orbit') {
    this.engine = engine;
    const T = engine.THREE;
    this.canvas = canvas;
    this.mode = mode;
    this.renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: !isSoftwareGl(), powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.target = new T.Vector3(0, 0, 0);
    if (mode === 'overlay') {
      this.camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.05, 40);
      this.camera.up.set(0, 0, 1);
      this.camera.position.set(0, -8, 0);
      this.camera.lookAt(0, 0, 0);
    } else {
      this.camera = new T.PerspectiveCamera(30, 1, 0.05, 60);
      this.camera.up.set(0, 0, 1);
      this.camera.layers.enable(1); // the ground shadow
    }
  }

  async attachControls(): Promise<void> {
    if (this.mode !== 'orbit' || this.controls) return;
    const { OrbitControls }: any = await import('three/examples/jsm/controls/OrbitControls.js');
    const c = new OrbitControls(this.camera, this.canvas);
    c.enableDamping = false;
    c.enablePan = true;
    c.minDistance = 0.8;
    c.maxDistance = 8;
    c.target.copy(this.target);
    c.addEventListener('change', () => this.render());
    c.addEventListener('start', () => { this.cancelFly(); });
    this.controls = c;
    this.canvas.addEventListener('dblclick', (e) => this.flyToBoneAt(e));
  }

  /** "Sledovat": the camera travels with the pelvis. */
  setFollow(on: boolean): void { this.follow_ = on; if (on) this.lastTarget = null; }
  /** Slow turntable around the athlete. Off under reduced motion. */
  setAutoOrbit(on: boolean): void {
    this.auto = on && motionFull();
    if (this.auto) this.startLoop();
  }
  get autoOrbit(): boolean { return this.auto; }

  /** The camera stands where a preset says, moving there in ~600 ms (instantly unless Animace is "plné"). */
  preset(name: CameraPreset | 'opposite' | 'left' | 'right'): void {
    const legacy: Record<string, CameraPreset> = { opposite: 'back', left: 'side', right: 'side' };
    const key = (legacy[name] ?? name) as CameraPreset;
    const t = this.currentTarget();
    const p = cameraPreset(key, this.engine.heading(), t, 3.4);
    this.flyTo(new (this.engine.THREE.Vector3)(p.position.x, p.position.y, p.position.z), new (this.engine.THREE.Vector3)(t.x, t.y, t.z));
  }

  private currentTarget(): { x: number; y: number; z: number } {
    const p = this.engine.bodyPosition('pelvis');
    return p ?? { x: this.target.x, y: this.target.y, z: this.target.z };
  }

  flyTo(position: any, target: any, ms = 600): void {
    const T = this.engine.THREE;
    if (!motionFull()) { this.applyCamera(position, target); return; }
    this.fly = { t0: performance.now(), ms, from: { p: this.camera.position.clone(), t: this.target.clone() }, to: { p: position.clone ? position.clone() : new T.Vector3(position.x, position.y, position.z), t: target.clone ? target.clone() : new T.Vector3(target.x, target.y, target.z) } };
    this.startLoop();
  }

  private cancelFly(): void { this.fly = null; }

  private applyCamera(position: any, target: any): void {
    this.camera.position.copy(position);
    this.target.copy(target);
    this.lastTarget = this.follow_ ? { x: target.x, y: target.y, z: target.z } : null;
    if (this.controls) { this.controls.target.copy(target); this.following = true; this.controls.update(); this.following = false; } else this.camera.lookAt(target);
    this.render();
  }

  /** Double-click a bone: the camera flies to it. */
  private flyToBoneAt(e: MouseEvent): void {
    const r = this.canvas.getBoundingClientRect();
    const hit = this.engine.pickBone(this.camera, { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 });
    if (hit === null) return;
    const dir = this.camera.position.clone().sub(this.target).normalize();
    this.follow_ = false;
    this.flyTo(hit.point.clone().add(dir.multiplyScalar(1.1)), hit.point);
  }

  private startLoop(): void {
    if (this.raf) return;
    this.lastTick = performance.now();
    const tick = (now: number) => {
      this.raf = 0;
      const dt = Math.min(0.1, (now - this.lastTick) / 1000);
      this.lastTick = now;
      let busy = false;
      if (this.fly) {
        const k = easeInOutCubic((now - this.fly.t0) / this.fly.ms);
        const p = this.fly.from.p.clone().lerp(this.fly.to.p, k);
        const t = this.fly.from.t.clone().lerp(this.fly.to.t, k);
        this.camera.position.copy(p);
        this.target.copy(t);
        if (this.controls) { this.controls.target.copy(t); this.following = true; this.controls.update(); this.following = false; } else this.camera.lookAt(t);
        if (k >= 1) this.fly = null; else busy = true;
      }
      if (this.auto && motionFull() && !this.fly) {
        /* a slow turntable: a quarter turn in ~12 s around the vertical axis through the athlete */
        const ang = dt * 0.52;
        const v = this.camera.position.clone().sub(this.target);
        const c = Math.cos(ang), s = Math.sin(ang);
        this.camera.position.set(this.target.x + v.x * c - v.y * s, this.target.y + v.x * s + v.y * c, this.camera.position.z);
        if (this.controls) { this.following = true; this.controls.update(); this.following = false; } else this.camera.lookAt(this.target);
        busy = true;
      }
      this.engine.renderAll();
      if (busy) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  setSize(w: number, h: number, dpr: number): void {
    this.size = { w: Math.max(1, w), h: Math.max(1, h) };
    this.renderer.setPixelRatio(Math.min(dpr, 1.75));
    this.renderer.setSize(this.size.w, this.size.h, false);
    if (this.mode === 'orbit') {
      this.camera.aspect = this.size.w / this.size.h;
      this.camera.updateProjectionMatrix();
    } else this.applyRect();
  }

  /** Overlay: where the video picture sits in the stage; the frustum follows it (letterbox, Detail zoom). */
  setRect(rect: { x: number; y: number; scale: number }): void {
    this.rect = rect;
    if (this.mode === 'overlay') this.applyRect();
  }

  private applyRect(): void {
    if (this.rect.scale <= 0) return;
    const b = orthoBounds(this.rect, this.size, this.engine.anatomy.pxPerM);
    Object.assign(this.camera, { left: b.left, right: b.right, top: b.top, bottom: b.bottom });
    this.camera.updateProjectionMatrix();
  }

  /** A world point to the stage in CSS pixels. */
  project(x: number, y: number, z: number): { x: number; y: number } {
    if (this.mode === 'overlay') return worldToStage(this.rect, this.engine.anatomy.pxPerM, x, z);
    const v = new (this.engine.THREE.Vector3)(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.size.w, y: (-v.y * 0.5 + 0.5) * this.size.h };
  }

  /** How many CSS pixels a metre covers here (roughly, at the athlete). */
  pixelsPerMetre(): number {
    if (this.mode === 'overlay') return this.rect.scale * this.engine.anatomy.pxPerM;
    const a = this.project(this.target.x, this.target.y, this.target.z);
    const b = this.project(this.target.x, this.target.y, this.target.z + 1);
    return Math.abs(a.y - b.y);
  }

  /** The orbit view keeps the athlete centred as they move: the camera travels with the pelvis. */
  follow(): void {
    if (this.mode !== 'orbit' || this.fly) return;
    const p = this.engine.bodyPosition('pelvis');
    if (!p) return;
    if (this.lastTarget === null && this.camera.position.lengthSq() < 1e-6) {
      /* first time: stand in front of the athlete, the way the video sees them */
      this.camera.position.set(p.x, p.y - 3.4, p.z + 0.1);
    } else if (this.lastTarget !== null && this.follow_) {
      this.camera.position.x += p.x - this.lastTarget.x;
      this.camera.position.y += p.y - this.lastTarget.y;
      this.camera.position.z += p.z - this.lastTarget.z;
    } else if (this.lastTarget === null && !this.follow_) {
      /* not following: the camera stays where it is */
    }
    this.lastTarget = this.follow_ ? p : this.lastTarget;
    if (this.follow_) this.target.set(p.x, p.y, p.z);
    if (this.controls) {
      this.controls.target.copy(this.target);
      this.following = true;
      this.controls.update();
      this.following = false;
    } else this.camera.lookAt(this.target);
  }

  private following = false;

  render(): void {
    if (this.following) return;
    this.follow();
    this.renderer.render(this.engine.scene, this.camera);
  }

  finish(): void {
    this.renderer.getContext().finish();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.controls?.dispose();
    this.renderer.dispose();
    this.engine.removeView(this);
  }
}
