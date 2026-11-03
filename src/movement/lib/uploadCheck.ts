/* The client-side check a clip passes before it is uploaded. Rejections are reasons the page words in plain Czech. */
import { isTooDark } from './luminance';

export const MIN_FPS = 50;
export const MIN_DURATION_S = 2;
export const MAX_DURATION_S = 60;
/** The shorter side of the picture, in pixels (720p). */
export const MIN_SHORT_SIDE = 720;

export type RejectCode = 'low_fps' | 'too_dark' | 'too_short' | 'too_long' | 'low_resolution';
export type WarnCode = 'fps_unknown' | 'dark_unknown';

export interface ProbeResult {
  durationS: number;
  width: number;
  height: number;
  /** Null when the browser cannot report frame times. */
  fps: number | null;
  /** Mean luminance 0..255 over the sampled frames, null when it could not be read. */
  luminance: number | null;
}

export interface Reason<C extends string> { code: C; detail: string }

export interface CheckVerdict {
  ok: boolean;
  rejections: Reason<RejectCode>[];
  warnings: Reason<WarnCode>[];
}

const one = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/** Rejects only what it KNOWS is wrong; what it could not measure becomes a warning, never a rejection. */
export function checkClip(p: ProbeResult): CheckVerdict {
  const rejections: Reason<RejectCode>[] = [];
  const warnings: Reason<WarnCode>[] = [];

  if (p.fps === null) warnings.push({ code: 'fps_unknown', detail: '' });
  else if (p.fps < MIN_FPS) rejections.push({ code: 'low_fps', detail: `${one(p.fps)} fps` });

  if (p.durationS < MIN_DURATION_S) rejections.push({ code: 'too_short', detail: `${one(p.durationS)} s` });
  else if (p.durationS > MAX_DURATION_S) rejections.push({ code: 'too_long', detail: `${one(p.durationS)} s` });

  if (Math.min(p.width, p.height) < MIN_SHORT_SIDE) rejections.push({ code: 'low_resolution', detail: `${p.width}×${p.height}` });

  if (p.luminance === null) warnings.push({ code: 'dark_unknown', detail: '' });
  else if (isTooDark(p.luminance)) rejections.push({ code: 'too_dark', detail: `${Math.round(p.luminance)}/255` });

  return { ok: rejections.length === 0, rejections, warnings };
}
