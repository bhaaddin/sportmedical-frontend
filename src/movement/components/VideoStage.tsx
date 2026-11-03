/*
 * The picture: a <video> with a <canvas> of the same size laid over it. The canvas draws the skeleton of the displayed frame
 * (lib/overlay.ts does the geometry; lib/skeleton.ts the styling). "Detail" crops the stage to the athlete and zooms the video
 * and the canvas together, so the fine detail (fingers, face, feet) is readable on a phone.
 *
 * Sync: requestVideoFrameCallback reports the media time of every frame the browser presents; `frameIndexAt` turns it into the
 * skeleton's frame. Without that API the frame is read from `currentTime` on every animation frame while playing, and from
 * `seeked` / `timeupdate` otherwise. The parent owns `frame`; the stage reports what the video shows. One canvas draw per frame.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import type { ClipResult } from '../../api/movement';
import { frameIndexAt } from '../lib/frames';
import { buildScene, drawScene, viewRect, wireLayersOf, type OverlayColors, type OverlayScene, type OverlayStyle, type ViewLayers } from '../lib/overlay';
import { buildAnatomyFrame, drawAnatomy, type AnatomyFrame } from '../lib/anatomy/draw';
import { angleSpecs } from '../lib/joints';
import { detailAspect, skeletonBounds } from '../lib/skeleton';
import { useMoveT } from '../i18n';
import type { AnatomyEngine, AnatomyView, MuscleInfo } from '../anatomy3d/engine';


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

/** The Animace setting is mirrored on <html data-motion>: only "full" pulses. */
const motionIsFull = (): boolean => typeof document !== 'undefined' && document.documentElement.dataset.motion === 'full';

export function VideoStage({
  src, result, frame, highlight, layers, style, detail, videoRef, onFrame, onPlayingChange, engine = null, onPick,
}: {
  src: string | null;
  result: ClipResult;
  frame: number;
  highlight: ReadonlySet<number>;
  layers: ViewLayers;
  style: OverlayStyle;
  detail: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onFrame: (frame: number) => void;
  onPlayingChange: (playing: boolean) => void;
  /** The 3D anatomy engine, when the clip has an anatomy and it has loaded. */
  engine?: AnatomyEngine | null;
  /** The muscle under the pointer (hover or tap) in the 3D style. */
  onPick?: (info: MuscleInfo | null) => void;
}) {
  const theme = useTheme();
  const { t } = useMoveT();
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{ scene: OverlayScene; size: { w: number; h: number }; anatomy: AnatomyFrame | null; anatomyOn: boolean } | null>(null);
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

  const bounds = useMemo(() => skeletonBounds(skeleton), [skeleton]);
  const zoom = detail ? bounds : null;
  const videoAspect = video.width / video.height;
  const aspect = zoom ? detailAspect(zoom, videoAspect) : videoAspect;

  const colors = useMemo<OverlayColors>(() => ({
    left: theme.palette.warning.main,
    right: theme.palette.info.main,
    center: theme.palette.common.white,
    face: theme.palette.common.white,
    highlight: theme.palette.error.main,
    label: theme.palette.common.white,
    labelBg: 'rgba(8, 12, 16, 0.78)',
    event: theme.palette.common.white,
    halo: 'rgba(4, 8, 12, 0.8)',
  }), [theme]);

  const eventCaptions = useMemo(() => {
    const out: { joint: number; text: string }[] = [];
    for (const e of result.events) {
      if (Math.abs(e.frame - frame) > 3) continue;
      const joint = skeleton.names.indexOf(e.side === 'R' ? 'right_ankle' : e.side === 'L' ? 'left_ankle' : 'left_hip');
      if (joint >= 0) out.push({ joint, text: `${t(`event.${e.type}`)}${e.side ? ` ${t(`side.short.${e.side}`)}` : ''}` });
    }
    return out;
  }, [result.events, frame, skeleton.names, t]);

  const layersRef = useRef(layers);
  layersRef.current = layers;
  const paint = useCallback((pulse: number) => {
    const canvas = canvasRef.current;
    const cur = sceneRef.current;
    if (canvas === null || cur === null) return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    const t0 = performance.now();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cur.size.w, cur.size.h);
    if (cur.anatomyOn && cur.anatomy !== null) {
      const l = layersRef.current;
      drawAnatomy(ctx, cur.anatomy, cur.scene.rect, dpr, { layers: { bones: l.bones, muscles: l.muscles, tendons: l.tendons, joints: l.joints }, unit: cur.scene.unit });
    }
    drawScene(ctx, cur.scene, cur.size, dpr, colors, pulse, false);
    /* the cost of one frame's drawing, for the browser pass (exponential average) */
    const ms = performance.now() - t0;
    const prev = Number(canvas.dataset.drawMs ?? ms);
    canvas.dataset.drawMs = String(prev * 0.8 + ms * 0.2);
    canvas.dataset.drawMsMax = String(Math.max(Number(canvas.dataset.drawMsMax ?? 0), ms));
  }, [colors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || size.w === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(size.w * dpr);
    const h = Math.round(size.h * dpr);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const anatomyOn = style !== 'wire';
    const scene = buildScene({
      skeleton, frame, box: size, video: { w: video.width, h: video.height }, highlight, zoom,
      layers: anatomyOn ? { body: true, hands: true, face: true, feet: true, angles: layers.angles, trail: layers.trail, events: layers.events } : wireLayersOf(layers),
      noLines: anatomyOn, noDots: anatomyOn && !layers.points,
      angles: angleSpecs(skeleton.names, result.curves, frame), eventCaptions,
    });
    const anatomy = style === 'anatomy' && (layers.bones || layers.muscles || layers.tendons || layers.joints) ? buildAnatomyFrame(skeleton, frame, result.view, video.fps) : null;
    sceneRef.current = { scene, size, anatomy, anatomyOn: style === 'anatomy' };
    paint(0);
  }, [size, frame, highlight, layers, style, zoom, skeleton, video.width, video.height, video.fps, result.view, result.curves, eventCaptions, paint]);

  /* A selected finding pulses its ring - only while Animace is "plné"; otherwise the ring stands still. */
  useEffect(() => {
    if (highlight.size === 0 || !motionIsFull()) return undefined;
    let raf = 0;
    const tick = (now: number) => {
      paint((Math.sin(now / 380) + 1) / 2);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [highlight, paint]);

  /* the WebGL canvas of the 3D anatomy, laid exactly over the picture */
  const glRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<AnatomyView | null>(null);
  const gl3d = style === 'anatomy3d' && engine !== null;
  useEffect(() => {
    if (!gl3d || engine === null || glRef.current === null) return undefined;
    const v = engine.createView(glRef.current, 'overlay');
    viewRef.current = v;
    return () => { v.dispose(); viewRef.current = null; };
  }, [gl3d, engine]);

  const attach = useCallback((el: HTMLVideoElement | null) => {
    (videoRef as { current: HTMLVideoElement | null }).current = el;
  }, [videoRef]);

  /* the video sits exactly where the overlay assumes it (contain, or the zoomed crop) */
  const rect = size.w > 0 ? viewRect(size.w, size.h, video.width, video.height, zoom) : null;
  useEffect(() => {
    const v = viewRef.current;
    if (v === null || engine === null || rect === null) return;
    v.setSize(size.w, size.h, window.devicePixelRatio || 1);
    v.setRect(rect);
    engine.renderAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl3d, engine, size.w, size.h, rect?.x, rect?.y, rect?.scale]);

  const pick = (e: React.PointerEvent) => {
    const v = viewRef.current;
    if (!gl3d || v === null || engine === null || onPick === undefined) return;
    const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
    onPick(engine.pick(v, e.clientX - b.left, e.clientY - b.top));
  };

  return (
    <Box
      ref={boxRef}
      data-testid="video-stage"
      data-detail={detail ? 'on' : 'off'}
      data-style={style}
      onPointerMove={pick}
      onPointerDown={pick}
      onPointerLeave={() => onPick?.(null)}
      sx={{
        position: 'relative', width: '100%', aspectRatio: `${aspect}`, maxWidth: { md: `calc(66dvh * ${aspect})` },
        mx: 'auto', bgcolor: 'common.black', borderRadius: 2, overflow: 'hidden',
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
          sx={rect
            ? { position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, maxWidth: 'none', objectFit: 'fill' }
            : { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
        />
      )}
      {gl3d && <canvas ref={glRef} data-testid="anatomy-canvas" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />}
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
