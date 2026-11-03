/*
 * The picture: a <video> with a <canvas> of the same size laid over it. The canvas draws the skeleton of the displayed
 * frame (lib/overlay.ts does the geometry, including the letterbox of `object-fit: contain`).
 *
 * Sync: requestVideoFrameCallback reports the media time of every frame the browser presents; `frameIndexAt` turns it into the
 * skeleton's frame. Without that API the frame is read from `currentTime` on every animation frame while playing, and from
 * `seeked` / `timeupdate` otherwise. The parent owns `frame`; the stage reports what the video shows.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import type { ClipResult } from '../../api/movement';
import { frameIndexAt } from '../lib/frames';
import { buildScene, drawScene, type OverlayColors } from '../lib/overlay';
import { angleLabelTargets } from '../lib/joints';
import { useMoveT } from '../i18n';

export interface Layers { skeleton: boolean; angles: boolean; events: boolean }

type VideoWithRvfc = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
};

/** Keeps `onFrame` called with the frame the video is showing. */
export function useFrameSync(videoRef: RefObject<HTMLVideoElement | null>, times: readonly number[], onFrame: (frame: number) => void, ready: boolean): void {
  const cb = useRef(onFrame);
  cb.current = onFrame;
  useEffect(() => {
    const video = videoRef.current as VideoWithRvfc | null;
    if (video === null || !ready) return undefined;
    const read = (t: number) => cb.current(frameIndexAt(times, t));
    let handle = 0;
    let raf = 0;
    let live = true;
    const onSeeked = () => read(video.currentTime);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('timeupdate', onSeeked);
    if (typeof video.requestVideoFrameCallback === 'function') {
      const loop = (_now: number, meta: { mediaTime: number }) => {
        if (!live) return;
        read(meta.mediaTime);
        handle = video.requestVideoFrameCallback!(loop);
      };
      handle = video.requestVideoFrameCallback(loop);
    } else {
      const tick = () => {
        if (!live) return;
        if (!video.paused) read(video.currentTime);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    return () => {
      live = false;
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('timeupdate', onSeeked);
      if (handle !== 0) video.cancelVideoFrameCallback?.(handle);
      cancelAnimationFrame(raf);
    };
  }, [videoRef, times, ready]);
}

export function VideoStage({
  src, result, frame, highlight, layers, videoRef, onFrame, onPlayingChange,
}: {
  src: string | null;
  result: ClipResult;
  frame: number;
  highlight: ReadonlySet<number>;
  layers: Layers;
  videoRef: RefObject<HTMLVideoElement | null>;
  onFrame: (frame: number) => void;
  onPlayingChange: (playing: boolean) => void;
}) {
  const theme = useTheme();
  const { t } = useMoveT();
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const { skeleton, video } = result;

  useEffect(() => { setLoaded(false); setFailed(false); }, [src]);

  useFrameSync(videoRef, skeleton.times, onFrame, src !== null);

  useEffect(() => {
    const el = boxRef.current;
    if (el === null) return undefined;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const colors = useMemo<OverlayColors>(() => ({
    left: theme.palette.primary.main,
    right: theme.palette.info.main,
    center: theme.palette.common.white,
    highlight: theme.palette.error.main,
    label: theme.palette.common.white,
    labelBg: 'rgba(0, 0, 0, 0.62)',
    event: theme.palette.warning.light,
  }), [theme]);

  const labelTargets = useMemo(() => angleLabelTargets(result.curves), [result.curves]);
  const eventCaptions = useMemo(() => {
    const out: { joint: number; text: string }[] = [];
    for (const e of result.events) {
      if (Math.abs(e.frame - frame) > 3) continue;
      const joint = skeleton.names.indexOf(e.side === 'R' ? 'right_ankle' : e.side === 'L' ? 'left_ankle' : 'hip');
      if (joint >= 0) out.push({ joint, text: `${t(`event.${e.type}`)}${e.side ? ` ${t(`side.short.${e.side}`)}` : ''}` });
    }
    return out;
  }, [result.events, frame, skeleton.names, t]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || size.w === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(size.w * dpr);
    const h = Math.round(size.h * dpr);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    const angles = new Map<number, string>();
    for (const target of labelTargets) {
      const j = skeleton.names.indexOf(target.joint);
      const v = result.curves[target.curve]?.[frame];
      if (j >= 0 && v !== null && v !== undefined) angles.set(j, `${Math.round(v)}°`);
    }
    const scene = buildScene({
      skeleton, frame, box: { w: size.w, h: size.h }, video: { w: video.width, h: video.height }, highlight, layers, angles, eventCaptions,
    });
    drawScene(ctx, scene, { w: size.w, h: size.h }, dpr, colors);
  }, [size, frame, highlight, layers, skeleton, video.width, video.height, colors, labelTargets, result.curves, eventCaptions]);

  const attach = useCallback((el: HTMLVideoElement | null) => {
    (videoRef as { current: HTMLVideoElement | null }).current = el;
  }, [videoRef]);

  return (
    <Box
      ref={boxRef}
      data-testid="video-stage"
      sx={{
        position: 'relative', width: '100%', aspectRatio: `${video.width} / ${video.height}`, maxHeight: { md: '62dvh' },
        mx: 'auto', bgcolor: 'common.black', borderRadius: 2, overflow: 'hidden', containerType: 'size',
      }}
    >
      {src !== null && (
        <Box
          component="video"
          ref={attach}
          src={src}
          muted
          playsInline
          preload="auto"
          onLoadedData={() => setLoaded(true)}
          onError={() => setFailed(true)}
          onPlay={() => onPlayingChange(true)}
          onPause={() => onPlayingChange(false)}
          onEnded={() => onPlayingChange(false)}
          aria-label={t('review.video')}
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
        />
      )}
      <canvas
        ref={canvasRef}
        data-testid="overlay-canvas"
        aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />
      {(src === null || (!loaded && !failed)) && (
        <Typography variant="caption" sx={{ position: 'absolute', left: 12, bottom: 8, color: 'common.white', opacity: 0.85 }}>
          {t('review.video_loading')}
        </Typography>
      )}
      {failed && (
        <Typography variant="caption" role="status" sx={{ position: 'absolute', left: 12, bottom: 8, right: 12, color: 'common.white' }}>
          {t('review.video_failed')}
        </Typography>
      )}
    </Box>
  );
}
