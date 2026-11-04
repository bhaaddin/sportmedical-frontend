/*
 * The review: the video with the skeleton over it, a scrubber with the events, the findings, the angle curves, the left-right
 * table and the clinician's decision. One piece of state ties them: the frame. The video reports it (video -> frame), and the
 * scrubber, a chart, a finding or a metric sets it (anything -> video.currentTime).
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, IconButton, Snackbar, Stack, Typography } from '@mui/material';
import { ThreeDRotation, ZoomIn, Pause, PlayArrow, SkipNext, SkipPrevious, NavigateBefore, NavigateNext } from '@mui/icons-material';
import { Shelf } from '../../ui/shelf';
import { useDevice } from '../../layout/useDevice';
import { getClipVideo, useDecision, type ClipDetail, type DecisionInput, type Flag } from '../../api/movement';
import { clampFrame, clock, seekTimeOf } from '../lib/frames';
import { jointIndexesForFlag } from '../lib/joints';
import { useMoveT } from '../i18n';
import { VideoStage } from './VideoStage';
import { useAnatomyEngine } from '../anatomy3d/useAnatomyEngine';
import { Anatomy3DPanel } from '../anatomy3d/Anatomy3DPanel';
import { MUSCLE_GROUPS, activePulse, nearEvent, regionBodies, type MuscleGroup } from '../anatomy3d/anatomyMath';
import type { MuscleInfo } from '../anatomy3d/engine';
import { DEFAULT_VIEW_LAYERS, type OverlayStyle, type ViewLayers } from '../lib/overlay';
import { Scrubber } from './Scrubber';
import { AngleCurves } from './AngleCurves';
import { FlagList, MetricsTable, ScoreBlock } from './Findings';
import { DecisionPanel } from './DecisionPanel';

/** The clip's video as a playable address: the mock gives a URL, the API a blob that needs our token. */
export function useClipVideoSrc(clipId: string): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let live = true;
    setSrc(null);
    getClipVideo(clipId)
      .then((v) => {
        if (!live) return;
        if (typeof v === 'string') setSrc(v);
        else { url = URL.createObjectURL(v); setSrc(url); }
      })
      .catch(() => undefined);
    return () => { live = false; if (url !== null) URL.revokeObjectURL(url); };
  }, [clipId]);
  return src;
}

/** The sentence of a processing warning: which view the clip looks like, which movement it should be. */
function warningText(code: string, t: ReturnType<typeof useMoveT>['t'], result: NonNullable<ClipDetail['result']>): string {
  if (code === 'view_mismatch') return t('warning.view_mismatch', { detected: t(`view.${(result.qa.detectedView?.view ?? 'side') as 'side' | 'front' | 'back'}`).toLowerCase(), selected: t(`view.${result.view}`).toLowerCase() });
  if (code === 'movement_mismatch') return t('warning.movement_mismatch', { movement: t(`movement.${result.movement}`).toLowerCase() });
  return t('warning.other');
}

const SPEEDS = [0.1, 0.25, 0.5, 1] as const;
const LAYER_KEYS = ['bones', 'muscles', 'tendons', 'joints', 'points', 'angles', 'trail', 'ghosts', 'events'] as const;
/** In the wireframe style only these toggles mean something. */
const WIRE_KEYS = new Set<string>(['bones', 'angles', 'trail', 'events']);
/** In the 3D style the joint caps do not exist (the real joints are in the meshes). */
const D3_KEYS = new Set<string>(['bones', 'muscles', 'tendons', 'points', 'angles', 'trail', 'ghosts', 'events']);
/** The 2D anatomy has no 3D ghost trail. */
const ANATOMY2D_KEYS = new Set<string>(['bones', 'muscles', 'tendons', 'joints', 'points', 'angles', 'trail', 'events']);
const NO_BODIES: ReadonlySet<string> = new Set();

/** How long a saved decision can still be taken back before it is sent. */
export const UNDO_MS = 5000;

export function ReviewView({ clip: loaded, videoSrc }: { clip: ClipDetail; videoSrc?: string | null }) {
  /* A decision shows at once and is sent after UNDO_MS; "Vrátit zpět" cancels it. Leaving the screen sends it immediately. */
  const decide = useDecision(loaded.clipId);
  const [pending, setPending] = useState<DecisionInput | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const pendingRef = useRef<DecisionInput | null>(null);
  const send = useCallback((input: DecisionInput) => {
    pendingRef.current = null;
    decide.mutate(input, { onSettled: () => setPending(null) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decide.mutate]);
  const submitDecision = (input: DecisionInput) => {
    window.clearTimeout(timer.current);
    pendingRef.current = input;
    setPending(input);
    timer.current = window.setTimeout(() => send(input), UNDO_MS);
  };
  const undoDecision = () => { window.clearTimeout(timer.current); pendingRef.current = null; setPending(null); };
  useEffect(() => () => { window.clearTimeout(timer.current); if (pendingRef.current !== null) send(pendingRef.current); }, [send]);
  const clip: ClipDetail = pending === null ? loaded : {
    ...loaded,
    decisions: [...loaded.decisions, { id: 'pending', action: pending.action, band: pending.band ?? null, faultTags: pending.faultTags, unsure: pending.unsure, note: pending.note, decidedBy: 'pending', decidedAt: new Date().toISOString() }],
  };

  const { t, lang } = useMoveT();
  const device = useDevice();
  const phone = device === 'phone';
  const result = clip.result!;
  const qaWarnings = result.qa.warnings ?? [];
  const count = result.skeleton.times.length;
  const times = result.skeleton.times;
  const fetched = useClipVideoSrc(clip.clipId);
  const src = videoSrc === undefined ? fetched : videoSrc;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(() => result.flags[0]?.evidence.frame ?? 0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [layers, setLayers] = useState<ViewLayers>(DEFAULT_VIEW_LAYERS);
  const available = result.anatomy?.available === true;
  const { engine, status } = useAnatomyEngine(clip.clipId, available);
  const [style, setStyle] = useState<OverlayStyle>(available ? 'anatomy3d' : 'anatomy');
  const [groups, setGroups] = useState<ReadonlySet<MuscleGroup>>(() => new Set(MUSCLE_GROUPS));
  const [orbit, setOrbit] = useState(false);
  const [slowEvents, setSlowEvents] = useState(false);
  const [picked, setPicked] = useState<MuscleInfo | null>(null);
  /* until the 3D engine is ready the 2D anatomy is drawn, so the picture is never empty */
  const orbitOpen = orbit && style === 'anatomy3d';
  const shownStyle: OverlayStyle = style === 'anatomy3d' && engine === null ? 'anatomy' : style;
  const [detail, setDetail] = useState(false);
  const [selected, setSelected] = useState<Flag | null>(null);
  const highlight = useMemo<ReadonlySet<number>>(
    () => (selected === null ? new Set<number>() : jointIndexesForFlag(selected, result.skeleton.names)),
    [selected, result.skeleton.names],
  );

  const seek = useCallback((target: number) => {
    const f = clampFrame(target, count);
    setFrame(f);
    const v = videoRef.current;
    if (v !== null) {
      v.pause();
      v.currentTime = seekTimeOf(times, f);
    }
  }, [count, times]);

  /* Start on the first finding, so the page opens on something worth looking at. */
  const started = useRef(false);
  useEffect(() => {
    if (started.current || src === null) return;
    started.current = true;
    const v = videoRef.current;
    if (v !== null) v.currentTime = seekTimeOf(times, frame);
  }, [src, times, frame]);

  const toggle = () => {
    const v = videoRef.current;
    if (v === null) return;
    if (v.paused) { v.playbackRate = speed; void v.play(); } else v.pause();
  };
  const setRate = (rate: number) => {
    setSpeed(rate);
    if (videoRef.current !== null) videoRef.current.playbackRate = rate;
  };
  const events = useMemo(() => [...result.events].sort((a, b) => a.frame - b.frame), [result.events]);
  const jumpEvent = (dir: 1 | -1) => {
    const next = dir === 1 ? events.find((e) => e.frame > frame) : [...events].reverse().find((e) => e.frame < frame);
    if (next) seek(next.frame);
  };
  const highlightBodies = useMemo<ReadonlySet<string>>(
    () => (selected !== null && engine !== null ? regionBodies(selected.region, selected.side, engine.anatomy.bodies.map((b) => b.name)) : NO_BODIES),
    [selected, engine],
  );
  /* the 3D scene follows the toggles and the selected finding or muscle */
  useEffect(() => {
    if (engine === null) return;
    engine.setLayers({ bones: layers.bones, muscles: layers.muscles, tendons: layers.tendons, ghosts: layers.ghosts });
    engine.setGroups(groups);
    engine.setHighlight(highlightBodies);
    engine.setSelected(picked?.index ?? null);
    engine.renderAll();
  }, [engine, layers.bones, layers.muscles, layers.tendons, layers.ghosts, groups, highlightBodies, picked]);
  /* ...and the video frame; while playing the engine reads the video clock every animation frame instead, so slow motion is fluid
     (the poses are blended between source frames) and not stepped */
  useEffect(() => {
    if (engine === null) return;
    (window as unknown as { __movementEngine?: unknown }).__movementEngine = engine;
    engine.playIntro();
  }, [engine]);
  useEffect(() => {
    if (engine === null) return;
    engine.setPulse(activePulse(result.events, frame));
    if (!playing) { engine.setFrame(frame); engine.renderAll(); }
  }, [engine, frame, playing, result.events]);
  useEffect(() => {
    if (engine === null) return undefined;
    engine.setFlowActive(playing);
    if (!playing) return undefined;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v !== null) {
        const f = Math.min(count - 1, Math.max(0, v.currentTime * result.video.fps));
        engine.setPulse(activePulse(result.events, f));
        engine.setFrame(f);
        engine.renderAll();
        /* optional slow motion around the events */
        if (slowEvents) v.playbackRate = nearEvent(result.events, f) ? Math.min(speed, 0.25) : speed;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, playing, count, result.video.fps, result.events, slowEvents, speed, videoRef]);
  const selectFlag = (flag: Flag) => {
    setSelected(flag);
    seek(flag.evidence.frame);
    stageRef.current?.scrollIntoView?.({ block: 'nearest', behavior: document.documentElement.dataset.motion === 'full' ? 'smooth' : 'auto' });
  };
  const button44 = { width: 44, height: 44 } as const;

  const videoShelf = (
      <Shelf id="video" title={t('review.video')} layout="board" stagger={false}
        controls={(
          <Stack direction="row" sx={{ gap: 0.75 }}>
          {engine !== null && style === 'anatomy3d' && (
            <Button onClick={() => setOrbit((o) => !o)} aria-pressed={orbit} startIcon={<ThreeDRotation />} variant={orbit ? 'contained' : 'outlined'} data-testid="orbit-toggle" sx={{ minHeight: 44, textTransform: 'none', fontWeight: 700 }}>
              {t('review.orbit')}
            </Button>
          )}
          <Button
            onClick={() => setDetail((d) => !d)}
            aria-pressed={detail}
            startIcon={<ZoomIn />}
            variant={detail ? 'contained' : 'outlined'}
            data-testid="detail-toggle"
            sx={{ minHeight: 44, textTransform: 'none', fontWeight: 700 }}
          >
            {t('review.detail')}
          </Button>
          </Stack>
        )}
      >
        <Box ref={stageRef} sx={{ p: { xs: 1, md: 1.5 }, scrollMarginTop: 8 }}>
          <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 0.75 }}>
            <Box role="group" aria-label={t('review.style')} sx={{ display: 'flex', gap: 0.5 }}>
              {(available ? (['anatomy3d', 'anatomy', 'wire'] as const) : (['anatomy', 'wire'] as const)).map((st) => (
                <Button
                  key={st}
                  size="small"
                  onClick={() => setStyle(st)}
                  aria-pressed={style === st}
                  variant={style === st ? 'contained' : 'outlined'}
                  sx={{ minHeight: 44, minWidth: 44, px: 1.75, textTransform: 'none', fontWeight: 700 }}
                >
                  {t(`review.style.${st}`)}
                </Button>
              ))}
            </Box>
          </Stack>
          <Box role="group" aria-label={t('review.layers')} sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: 1, mb: 0.5, scrollbarWidth: 'thin' }}>
            {LAYER_KEYS.filter((k) => (shownStyle === 'anatomy3d' || style === 'anatomy3d' ? D3_KEYS.has(k) : style === 'anatomy' ? ANATOMY2D_KEYS.has(k) : WIRE_KEYS.has(k))).map((k) => (
              <Button
                key={k}
                size="small"
                onClick={() => setLayers((cur) => ({ ...cur, [k]: !cur[k] }))}
                aria-pressed={layers[k]}
                variant={layers[k] ? 'contained' : 'outlined'}
                sx={{ minHeight: 44, minWidth: 44, px: 1.5, flexShrink: 0, textTransform: 'none', fontWeight: 600, borderRadius: 999 }}
              >
                {t(`review.layer.${k}`)}
              </Button>
            ))}
          </Box>
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: orbitOpen && !phone ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', alignItems: 'start' }}>
          <VideoStage
            src={src ?? null}
            result={result}
            frame={frame}
            highlight={highlight}
            layers={layers}
            style={shownStyle}
            detail={detail}
            engine={engine}
            onPick={setPicked}
            videoRef={videoRef}
            onFrame={setFrame}
            onPlayingChange={setPlaying}
          />
          {orbitOpen && engine !== null && <Anatomy3DPanel engine={engine} />}
          </Box>
          <Stack direction="row" sx={{ alignItems: 'center', mt: 1, flexWrap: 'wrap', columnGap: 0.5 }}>
            <IconButton sx={button44} onClick={() => jumpEvent(-1)} aria-label={t('review.prev_event')}><SkipPrevious /></IconButton>
            <IconButton sx={button44} onClick={() => seek(frame - 1)} aria-label={t('review.prev_frame')}><NavigateBefore /></IconButton>
            <IconButton sx={(th) => ({ ...button44, bgcolor: th.palette.primary.main, color: th.palette.primary.contrastText, '&:hover': { bgcolor: th.palette.primary.dark } })} onClick={toggle} aria-label={playing ? t('review.pause') : t('review.play')}>
              {playing ? <Pause /> : <PlayArrow />}
            </IconButton>
            <IconButton sx={button44} onClick={() => seek(frame + 1)} aria-label={t('review.next_frame')}><NavigateNext /></IconButton>
            <IconButton sx={button44} onClick={() => jumpEvent(1)} aria-label={t('review.next_event')}><SkipNext /></IconButton>
            <Typography data-testid="frame-label" sx={{ ml: 'auto', pl: 1, fontSize: 13, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
              {t('review.frame', { n: frame + 1, total: count })} · {clock(frame / result.video.fps)}
            </Typography>
          </Stack>
          {style !== 'wire' && layers.muscles && <Typography variant="caption" data-testid="muscle-note" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>{t(style === 'anatomy3d' ? 'review.muscle_note3d' : 'review.muscle_note')}</Typography>}
          {style === 'anatomy3d' && status === 'loading' && <Typography variant="caption" role="status" data-testid="anatomy-loading" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>{t('review.anatomy_loading')}</Typography>}
          {style === 'anatomy3d' && status === 'failed' && <Typography variant="caption" role="status" sx={{ display: 'block', color: 'error.main', mt: 0.5 }}>{t('review.anatomy_failed')}</Typography>}
          {shownStyle === 'anatomy3d' && (
            <Box sx={{ mt: 0.5 }}>
              <Typography variant="body2" role="status" data-testid="muscle-info" sx={{ minHeight: 40, fontWeight: picked ? 700 : 400, color: picked ? 'text.primary' : 'text.secondary' }}>
                {picked
                  ? t('review.muscle_info', { name: picked.label, length: Math.round(picked.relativeLength * 100), activity: Math.round(picked.contraction * 100) })
                  : t('review.muscle_hint')}
              </Typography>
              {layers.muscles && (
                <Box role="group" aria-label={t('review.groups')} sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: 0.5 }}>
                  {MUSCLE_GROUPS.map((g) => (
                    <Button
                      key={g}
                      size="small"
                      aria-pressed={groups.has(g)}
                      variant={groups.has(g) ? 'contained' : 'outlined'}
                      onClick={() => setGroups((cur) => { const n = new Set(cur); if (n.has(g)) n.delete(g); else n.add(g); return n; })}
                      sx={{ minHeight: 44, minWidth: 44, px: 1.5, flexShrink: 0, textTransform: 'none', borderRadius: 999 }}
                    >
                      {t(`review.group.${g}`)}
                    </Button>
                  ))}
                </Box>
              )}
            </Box>
          )}
          <Scrubber count={count} frame={frame} fps={result.video.fps} events={events} showEvents={layers.events} onSeek={seek} />
          <Stack direction="row" role="group" aria-label={t('review.speed')} sx={{ gap: 0.5, mt: 0.5 }}>
            {SPEEDS.map((s) => (
              <Button key={s} size="small" onClick={() => setRate(s)} aria-pressed={speed === s} variant={speed === s ? 'contained' : 'text'} sx={{ minWidth: 44, minHeight: 44, textTransform: 'none' }}>
                {String(s).replace('.', ',')}×
              </Button>
            ))}
            <Button size="small" onClick={() => setSlowEvents((v) => !v)} aria-pressed={slowEvents} variant={slowEvents ? 'contained' : 'outlined'} data-testid="slow-events" sx={{ minHeight: 44, textTransform: 'none', borderRadius: 999, ml: 1 }}>
              {t('review.slow_events')}
            </Button>
          </Stack>
        </Box>
      </Shelf>
  );

  const curvesShelf = (
      <Shelf id="curves" title={t('review.curves')} hint={t('review.curves.hint')} layout="board" stagger={false} empty={Object.keys(result.curves).length === 0} emptyState={{ text: t('review.curves.empty') }}>
        <AngleCurves curves={result.curves} frame={frame} count={count} events={events} onSeek={seek} />
      </Shelf>
  );

  const scoreShelf = (
      <Shelf id="score" title={t('score.title')} layout="board" stagger={false}>
        <ScoreBlock clip={clip} />
      </Shelf>
  );
  const findingsShelf = (
      <Shelf id="findings" title={t('review.findings')} hint={t('review.findings.hint')} count={result.flags.length} layout="board" stagger={false} empty={result.flags.length === 0} emptyState={{ text: t('review.findings.empty') }}>
        <FlagList clip={clip} flags={result.flags} selectedId={selected?.id ?? null} lang={lang} onSelect={selectFlag} />
      </Shelf>
  );
  const metricsShelf = (
      <Shelf id="metrics" title={t('review.metrics')} hint={t('review.metrics.hint')} layout="board" stagger={false} empty={result.metrics.length === 0} emptyState={{ text: t('review.metrics.empty') }}>
        <MetricsTable metrics={result.metrics} onSeek={seek} />
      </Shelf>
  );
  const decisionShelf = (
      <Shelf id="decision" title={t('decision.title')} layout="board" stagger={false}>
        <DecisionPanel clip={clip} onSubmit={submitDecision} failed={decide.isError} />
      </Shelf>
  );

  const gap = { xs: 3, md: 3.5 };
  const column = (...items: React.ReactNode[]) => <Stack spacing={gap} sx={{ minWidth: 0 }}>{items.map((item, i) => <Fragment key={i}>{item}</Fragment>)}</Stack>;

  return (
    <Stack spacing={2}>
    {qaWarnings.map((w) => (
      <Alert key={w.code} severity="warning" role="alert" data-testid="qa-warning">{warningText(w.code, t, result)}</Alert>
    ))}
    <Box
      data-testid="review"
      sx={{ display: 'grid', gap: { xs: 3, md: 3.5 }, gridTemplateColumns: phone ? 'minmax(0, 1fr)' : device === 'tablet' ? 'minmax(0, 1.25fr) minmax(280px, 1fr)' : 'minmax(0, 1.6fr) minmax(340px, 1fr)', alignItems: 'start' }}
    >
      {phone ? column(videoShelf, scoreShelf, findingsShelf, curvesShelf, metricsShelf, decisionShelf) : <>{column(videoShelf, curvesShelf)}{column(scoreShelf, findingsShelf, metricsShelf, decisionShelf)}</>}
    </Box>
    <Snackbar open={pending !== null} message={t('decision.pending')} data-testid="decision-undo" action={<Button color="inherit" onClick={undoDecision} sx={{ minHeight: 44 }}>{t('action.undo')}</Button>} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} sx={{ bottom: { xs: 88, md: 24 } }} />
    </Stack>
  );
}
