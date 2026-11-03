/*
 * The anatomy of a clip (CONTRACT section 3b): `anatomy.json` describes the MyoSim bodies and the muscle paths, `anatomy.bin`
 * holds the per-frame numbers - body poses (float32 [T,B,7]: x y z in metres, then a quaternion w x y z), relative muscle length
 * and the contraction proxy (float16 [T,M]) and joint angles (float32 [T,J]). Pure parsing, no rendering.
 */
import { z } from 'zod';

const blockSchema = z.object({ offset: z.number().int(), dtype: z.string(), shape: z.array(z.number().int()) });

export const anatomyMetaSchema = z.object({
  schemaVersion: z.number(),
  model: z.string(),
  modelLicence: z.string().optional(),
  frames: z.number().int(),
  fps: z.number(),
  pxPerM: z.number(),
  worldToImage: z.string().optional(),
  bodies: z.array(z.object({ name: z.string(), hasMesh: z.boolean() })),
  muscles: z.array(z.object({ name: z.string(), path: z.array(z.tuple([z.number().int(), z.tuple([z.number(), z.number(), z.number()])])) })),
  angleJoints: z.array(z.string()).default([]),
  fitRmsErrorM: z.array(z.number()).optional(),
  blocks: z.object({ poses: blockSchema, muscleLength: blockSchema, contraction: blockSchema, angles: blockSchema.optional() }),
  note: z.string().optional(),
});
export type AnatomyMeta = z.infer<typeof anatomyMetaSchema>;

export interface Anatomy {
  meta: AnatomyMeta;
  frames: number;
  fps: number;
  pxPerM: number;
  bodies: AnatomyMeta['bodies'];
  muscles: AnatomyMeta['muscles'];
  /** [T, B, 7] */
  poses: Float32Array;
  /** [T, M] relative to the neutral length (1 = neutral). */
  muscleLength: Float32Array;
  /** [T, M] 0..1, a shortening-speed proxy - NOT EMG. */
  contraction: Float32Array;
  /** [T, J] degrees. */
  angles: Float32Array;
}

/** IEEE half precision (little-endian bits) to a number. */
export function halfToFloat(h: number): number {
  const sign = h & 0x8000 ? -1 : 1;
  const exp = (h >> 10) & 0x1f;
  const frac = h & 0x3ff;
  if (exp === 0) return sign * Math.pow(2, -14) * (frac / 1024);
  if (exp === 0x1f) return frac === 0 ? sign * Infinity : Number.NaN;
  return sign * Math.pow(2, exp - 15) * (1 + frac / 1024);
}

const count = (shape: readonly number[]): number => shape.reduce((a, b) => a * b, 1);

function readFloat32(view: DataView, offset: number, n: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = view.getFloat32(offset + i * 4, true);
  return out;
}

function readFloat16(view: DataView, offset: number, n: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = halfToFloat(view.getUint16(offset + i * 2, true));
  return out;
}

/** Validates the json and slices the binary into typed arrays; throws on a file that does not match its own description. */
export function parseAnatomy(json: unknown, bin: ArrayBuffer): Anatomy {
  const meta = anatomyMetaSchema.parse(json);
  const view = new DataView(bin);
  const { poses, muscleLength, contraction, angles } = meta.blocks;
  const T = meta.frames;
  if (poses.dtype !== '<f4' || poses.shape[0] !== T || poses.shape[1] !== meta.bodies.length || poses.shape[2] !== 7) throw new Error('anatomy: poses block does not match the bodies');
  if (muscleLength.dtype !== '<f2' || muscleLength.shape[1] !== meta.muscles.length || contraction.dtype !== '<f2') throw new Error('anatomy: muscle blocks do not match the muscles');
  for (const b of [poses, muscleLength, contraction]) {
    const bytes = b.dtype === '<f4' ? 4 : 2;
    if (b.offset + count(b.shape) * bytes > bin.byteLength) throw new Error('anatomy: the binary is shorter than its blocks');
  }
  return {
    meta, frames: T, fps: meta.fps, pxPerM: meta.pxPerM, bodies: meta.bodies, muscles: meta.muscles,
    poses: readFloat32(view, poses.offset, count(poses.shape)),
    muscleLength: readFloat16(view, muscleLength.offset, count(muscleLength.shape)),
    contraction: readFloat16(view, contraction.offset, count(contraction.shape)),
    angles: angles ? readFloat32(view, angles.offset, count(angles.shape)) : new Float32Array(0),
  };
}

/** The pose of one body on one frame: position and a unit quaternion (w, x, y, z). */
export function poseOf(a: Pick<Anatomy, 'poses' | 'bodies'>, frame: number, body: number): { x: number; y: number; z: number; qw: number; qx: number; qy: number; qz: number } {
  const o = (frame * a.bodies.length + body) * 7;
  const p = a.poses;
  return { x: p[o], y: p[o + 1], z: p[o + 2], qw: p[o + 3], qx: p[o + 4], qy: p[o + 5], qz: p[o + 6] };
}
