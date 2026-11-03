/*
 * Reads what the browser can learn about a chosen clip BEFORE it is uploaded: size, length, brightness and the frame rate.
 * (The pure rules are in uploadCheck / luminance / fps; this file is only the DOM plumbing around them.)
 */
import { estimateFps } from './fps';
import { clipLuminance, meanLuminance } from './luminance';
import type { ProbeResult } from './uploadCheck';

type Rvfc = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
};

const once = (el: HTMLVideoElement, event: string, ms: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); el.removeEventListener(event, ok); el.removeEventListener('error', bad); };
    const timer = setTimeout(() => { cleanup(); reject(new Error(`${event} timeout`)); }, ms);
    const ok = () => { cleanup(); resolve(); };
    const bad = () => { cleanup(); reject(new Error('video error')); };
    el.addEventListener(event, ok);
    el.addEventListener('error', bad);
  });

function makeProbeVideo(url: string): HTMLVideoElement {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.src = url;
  return v;
}

/** Null when the browser cannot decode the file at all (the server will check it instead). */
export async function probeVideo(file: File): Promise<ProbeResult | null> {
  const url = URL.createObjectURL(file);
  const v = makeProbeVideo(url);
  try {
    await once(v, 'loadeddata', 10_000);
    const { duration, videoWidth: width, videoHeight: height } = v;
    const luminance = await sampleLuminance(v);
    const fps = await sampleFps(v);
    return { durationS: duration, width, height, fps, luminance };
  } catch {
    return null;
  } finally {
    v.removeAttribute('src');
    v.load();
    URL.revokeObjectURL(url);
  }
}

async function sampleLuminance(v: HTMLVideoElement): Promise<number | null> {
  try {
    const canvas = document.createElement('canvas');
    const w = 96;
    const h = Math.max(1, Math.round((96 * v.videoHeight) / v.videoWidth));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx === null) return null;
    const means: number[] = [];
    for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      v.currentTime = v.duration * f;
      await once(v, 'seeked', 5_000);
      ctx.drawImage(v, 0, 0, w, h);
      means.push(meanLuminance(ctx.getImageData(0, 0, w, h).data));
    }
    return clipLuminance(means);
  } catch {
    return null;
  }
}

/** Plays about one second muted and reads the media time of every presented frame. */
async function sampleFps(v: Rvfc): Promise<number | null> {
  if (typeof v.requestVideoFrameCallback !== 'function') return null;
  try {
    v.currentTime = 0;
    await once(v, 'seeked', 5_000).catch(() => undefined);
    const times: number[] = [];
    let running = true;
    const loop = (_now: number, meta: { mediaTime: number }) => {
      if (!running) return;
      times.push(meta.mediaTime);
      v.requestVideoFrameCallback!(loop);
    };
    v.requestVideoFrameCallback(loop);
    await v.play();
    await new Promise((r) => setTimeout(r, 1000));
    running = false;
    v.pause();
    return estimateFps(times);
  } catch {
    return null;
  }
}

/** One frame of the clip as an object URL (a JPEG from a canvas) for the marker picker. */
export async function grabFrame(file: File, at = 0.2): Promise<{ url: string; width: number; height: number } | null> {
  const src = URL.createObjectURL(file);
  const v = makeProbeVideo(src);
  try {
    await once(v, 'loadeddata', 10_000);
    v.currentTime = Math.min(v.duration * at, Math.max(0, v.duration - 0.1));
    await once(v, 'seeked', 5_000);
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')!.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob === null ? null : { url: URL.createObjectURL(blob), width: v.videoWidth, height: v.videoHeight };
  } catch {
    return null;
  } finally {
    v.removeAttribute('src');
    v.load();
    URL.revokeObjectURL(src);
  }
}
