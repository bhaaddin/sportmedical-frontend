/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * The 3D anatomy engine (three.js, one lazy chunk). One scene - the MyoSim bones as lit meshes and the muscles as volumetric tubes -
 * drawn by any number of views: an OVERLAY view whose orthographic camera lays the scene exactly over the video picture, and an
 * ORBIT view you can rotate. `setFrame` poses the bones (v' = R(q) v + p) and rebuilds the muscle tubes in place; the muscle
 * mesh is one geometry with a fixed topology, updated in its own buffers, so a frame costs a few milliseconds and one draw call.
 * The look of the muscles (belly swelling, redness with the contraction proxy) is a visual model, not EMG.
 */
import type { Anatomy } from './anatomyData';
import {
  MUSCLE_GROUPS, TENDON_RGB, bellyRadius, isLigament, muscleGroup, muscleLabel, musclePathWorld, muscleRgb, musclesOnBodies, nearestMuscle,
  orthoBounds, polylineLength, radiusProfile, sampleCenterline, sideOfName, swell, tendonness, tubeFrames, worldToStage,
  type MuscleGroup,
} from './anatomyMath';

export interface EngineLayers { bones: boolean; muscles: boolean; tendons: boolean }
export interface MuscleInfo { index: number; name: string; label: string; group: MuscleGroup; relativeLength: number; contraction: number }

const RADIAL = 6;

export class AnatomyEngine {
  readonly anatomy: Anatomy;
  readonly THREE: any;
  readonly scene: any;
  private bones = new Map<number, any>();
  private boneMaterials = new Map<number, any>();
  private muscleMesh: any;
  private geo: any;
  private pos!: Float32Array;
  private nor!: Float32Array;
  private col!: Float32Array;
  private ringsOf: number[] = [];
  private vertStart: number[] = [];
  private indexStart: number[] = [];
  private indexCount: number[] = [];
  private index!: Uint32Array;
  private pathWorld: Float32Array[] = [];
  private bellyR: number[] = [];
  private groupOf: MuscleGroup[] = [];
  private frame = -1;
  private layers: EngineLayers = { bones: true, muscles: true, tendons: true };
  private groups = new Set<MuscleGroup>(MUSCLE_GROUPS);
  private highlightBodies = new Set<string>();
  private highlightMuscles = new Set<number>();
  private selected: number | null = null;
  private views: AnatomyView[] = [];
  private scratch = { line: new Float32Array(64 * 3), t: new Float32Array(64 * 3), n: new Float32Array(64 * 3), b: new Float32Array(64 * 3) };
  /** milliseconds of the last pose + tube update and of the last render, for the performance readout */
  lastUpdateMs = 0;
  lastRenderMs = 0;

  private constructor(THREE: any, anatomy: Anatomy) {
    this.THREE = THREE;
    this.anatomy = anatomy;
    this.scene = new THREE.Scene();
  }

  /** Loads three.js and the bone meshes, and builds the scene. Heavy: call it lazily, once per clip. */
  static async create(anatomy: Anatomy, glb: ArrayBuffer): Promise<AnatomyEngine> {
    const THREE: any = await import('../../vendor/three/three.min.js');
    const { GLTFLoader }: any = await import('../../vendor/three/GLTFLoader.js');
    const gltf: any = await new GLTFLoader().parseAsync(glb, '');
    const engine = new AnatomyEngine(THREE, anatomy);
    engine.buildLights();
    engine.buildBones(gltf.scene);
    engine.buildMuscles();
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
      const mat = new T.MeshStandardMaterial({ color: 0xe9dec3, roughness: 0.58, metalness: 0.0, emissive: 0x000000 });
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
  }
  private boneGroup: any;

  private buildMuscles(): void {
    const T = this.THREE;
    const { muscles } = this.anatomy;
    let verts = 0;
    let tris = 0;
    muscles.forEach((m, i) => {
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
      void i;
    });
    this.pos = new Float32Array(verts * 3);
    this.nor = new Float32Array(verts * 3);
    this.col = new Float32Array(verts * 3);
    const uv = new Float32Array(verts * 2);
    const idx = new Uint32Array(tris * 3);
    muscles.forEach((_, m) => {
      const rings = this.ringsOf[m];
      for (let r = 0; r < rings; r++) {
        for (let j = 0; j <= RADIAL; j++) {
          const v = this.vertStart[m] + r * (RADIAL + 1) + j;
          uv[v * 2] = j / RADIAL;
          uv[v * 2 + 1] = r / Math.max(1, rings - 1);
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
    const posAttr = new T.BufferAttribute(this.pos, 3);
    posAttr.setUsage(T.DynamicDrawUsage);
    const norAttr = new T.BufferAttribute(this.nor, 3);
    norAttr.setUsage(T.DynamicDrawUsage);
    const colAttr = new T.BufferAttribute(this.col, 3);
    colAttr.setUsage(T.DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('normal', norAttr);
    geo.setAttribute('color', colAttr);
    geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
    geo.setIndex(new T.BufferAttribute(idx.slice(), 1));
    this.geo = geo;

    const tex = this.fibreTexture();
    const mat = new T.MeshStandardMaterial({ vertexColors: true, map: tex, bumpMap: tex, bumpScale: 1.4, roughness: 0.46, metalness: 0.02 });
    this.muscleMesh = new T.Mesh(geo, mat);
    this.muscleMesh.frustumCulled = false;
    this.muscleMesh.name = 'muscles';
    this.scene.add(this.muscleMesh);
    this.rebuildIndex();
  }

  /** A procedural fibre texture: lengthwise striations of varying width and brightness. */
  private fibreTexture(): any {
    const T = this.THREE;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 8;
    const g = c.getContext('2d')!;
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let x = 0; x < 128; x += 1) {
      const v = 150 + rnd() * 105;
      g.fillStyle = `rgb(${v | 0}, ${(v * 0.92) | 0}, ${(v * 0.92) | 0})`;
      g.fillRect(x, 0, 1, 8);
    }
    const tex = new T.CanvasTexture(c);
    tex.wrapS = T.RepeatWrapping;
    tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(2, 1);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  /* ───────── state ───────── */

  setLayers(layers: EngineLayers): void {
    this.layers = layers;
    if (this.boneGroup) this.boneGroup.visible = layers.bones;
    this.rebuildIndex();
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
    this.boneMaterials.forEach((mat, i) => {
      mat.emissive.setHex(this.highlightBodies.has(this.anatomy.bodies[i].name) ? 0x8a3f12 : 0x000000);
    });
    this.refresh();
  }

  setSelected(index: number | null): void {
    this.selected = index;
    this.refresh();
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
    const T = this.THREE;
    this.geo.setIndex(new T.BufferAttribute(out, 1));
    this.muscleMesh.visible = n > 0;
  }

  /** Poses the bones and rebuilds the tubes for a frame. */
  setFrame(frame: number): void {
    const t0 = performance.now();
    const a = this.anatomy;
    const f = Math.max(0, Math.min(a.frames - 1, frame));
    this.frame = f;
    const T = this.THREE;
    const q = this.tmpQ ?? (this.tmpQ = new T.Quaternion());
    const p = this.tmpV ?? (this.tmpV = new T.Vector3());
    const one = this.tmpS ?? (this.tmpS = new T.Vector3(1, 1, 1));
    this.bones.forEach((node, i) => {
      const o = (f * a.bodies.length + i) * 7;
      p.set(a.poses[o], a.poses[o + 1], a.poses[o + 2]);
      q.set(a.poses[o + 4], a.poses[o + 5], a.poses[o + 6], a.poses[o + 3]);
      node.matrix.compose(p, q, one);
      node.matrixWorldNeedsUpdate = true;
    });
    this.scene.updateMatrixWorld(true);
    this.updateMuscles(f);
    this.lastUpdateMs = performance.now() - t0;
  }

  private tmpQ: any; private tmpV: any; private tmpS: any;

  private refresh(): void {
    if (this.frame >= 0) this.updateMuscles(this.frame);
  }

  private updateMuscles(f: number): void {
    const a = this.anatomy;
    const M = a.muscles.length;
    const s = this.scratch;
    const nMax = 40;
    if (s.line.length < nMax * 3) return;
    for (let m = 0; m < M; m++) {
      const path = a.muscles[m].path;
      const rings = this.ringsOf[m];
      if (!this.visible(m)) continue;
      musclePathWorld(a, f, m, this.pathWorld[m]);
      const rel = a.muscleLength[f * M + m] || 1;
      const contraction = a.contraction[f * M + m];
      const len = polylineLength(this.pathWorld[m], path.length);
      this.bellyR[m] = bellyRadius(len / Math.max(0.4, rel));
      sampleCenterline(this.pathWorld[m], path.length, rings, s.line);
      tubeFrames(s.line, rings, s.t, s.n, s.b);
      const sel = this.selected === m;
      const hi = sel || this.highlightMuscles.has(m);
      const base = muscleRgb(sel ? 1 : contraction);
      const sw = swell(rel, contraction) * (sel ? 1.25 : 1);
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
          const v = (this.vertStart[m] + r * (RADIAL + 1) + j) * 3;
          this.pos[v] = cx + ox * radius; this.pos[v + 1] = cy + oy * radius; this.pos[v + 2] = cz + oz * radius;
          this.nor[v] = ox; this.nor[v + 1] = oy; this.nor[v + 2] = oz;
          this.col[v] = cr; this.col[v + 1] = cg; this.col[v + 2] = cb;
        }
      }
    }
    const at = this.geo.attributes;
    at.position.needsUpdate = true;
    at.normal.needsUpdate = true;
    at.color.needsUpdate = true;
  }

  /* ───────── reading ───────── */

  get currentFrame(): number { return this.frame; }

  muscleInfo(index: number): MuscleInfo {
    const a = this.anatomy;
    const M = a.muscles.length;
    const f = Math.max(0, this.frame);
    return {
      index, name: a.muscles[index].name, label: muscleLabel(a.muscles[index].name), group: this.groupOf[index],
      relativeLength: a.muscleLength[f * M + index], contraction: a.contraction[f * M + index],
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
  bench(n = 60): number {
    const first = performance.now();
    for (let i = 0; i < n; i++) {
      this.setFrame(i % this.anatomy.frames);
      this.renderAll();
    }
    for (const v of this.views) v.finish();
    return (performance.now() - first) / n;
  }

  /** The position of a body on the current frame (for the orbit view to follow the athlete). */
  bodyPosition(name: string): { x: number; y: number; z: number } | null {
    const i = this.anatomy.bodies.findIndex((b) => b.name === name);
    if (i < 0 || this.frame < 0) return null;
    const o = (this.frame * this.anatomy.bodies.length + i) * 7;
    return { x: this.anatomy.poses[o], y: this.anatomy.poses[o + 1], z: this.anatomy.poses[o + 2] };
  }

  dispose(): void {
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

  constructor(engine: AnatomyEngine, canvas: HTMLCanvasElement, mode: 'overlay' | 'orbit') {
    this.engine = engine;
    const T = engine.THREE;
    this.canvas = canvas;
    this.mode = mode;
    this.renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
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
      this.preset('video');
    }
  }

  async attachControls(): Promise<void> {
    if (this.mode !== 'orbit' || this.controls) return;
    const { OrbitControls }: any = await import('../../vendor/three/OrbitControls.js');
    const c = new OrbitControls(this.camera, this.canvas);
    c.enableDamping = false;
    c.enablePan = true;
    c.minDistance = 0.8;
    c.maxDistance = 8;
    c.target.copy(this.target);
    c.addEventListener('change', () => this.render());
    this.controls = c;
  }

  /** Camera presets around the athlete: as in the video, from the other side, from the left and the right. */
  preset(name: 'video' | 'opposite' | 'left' | 'right'): void {
    const d = 3.4;
    const t = this.target;
    const at: Record<string, [number, number, number]> = { video: [0, -d, 0.1], opposite: [0, d, 0.1], left: [-d, 0, 0.1], right: [d, 0, 0.1] };
    const [x, y, z] = at[name];
    this.camera.position.set(t.x + x, t.y + y, t.z + z);
    this.camera.lookAt(t.x, t.y, t.z);
    if (this.controls) { this.controls.target.copy(t); this.controls.update(); }
    this.render();
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
    if (this.mode !== 'orbit') return;
    const p = this.engine.bodyPosition('pelvis');
    if (!p) return;
    if (this.lastTarget === null) {
      /* first time: stand in front of the athlete, the way the video sees them */
      this.camera.position.set(p.x, p.y - 3.4, p.z + 0.1);
    } else {
      this.camera.position.x += p.x - this.lastTarget.x;
      this.camera.position.y += p.y - this.lastTarget.y;
      this.camera.position.z += p.z - this.lastTarget.z;
    }
    this.lastTarget = p;
    this.target.set(p.x, p.y, p.z);
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
    this.controls?.dispose();
    this.renderer.dispose();
    this.engine.removeView(this);
  }
}
