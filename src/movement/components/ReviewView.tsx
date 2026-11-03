/*
 * The review: the video with the skeleton over it, a scrubber with the events, the findings, the angle curves, the left-right
 * table and the clinician's decision. One piece of state ties them: the frame. The video reports it (video -> frame), and the
 * scrubber, a chart, a finding or a metric sets it (anything -> video.currentTime).
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, IconButton, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { Pause, PlayArrow, SkipNext, SkipPrevious, NavigateBefore, NavigateNext } from '@mui/icons-material';
import { Shelf } from '../../ui/shelf';
import { useDevice } from '../../layout/useDevice';
import { getClipVideo, type ClipDetail, type Flag } from '../../api/movement';
import { clampFrame, clock, seekTimeOf } from '../lib/frames';
import { jointIndexesForFlag } from '../lib/joints';
import { useMoveT } from '../i18n';
import { VideoStage, type Layers } from './VideoStage';
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

const SPEEDS = [0.25, 0.5, 1] as const;

export function ReviewView({ clip, videoSrc }: { clip: ClipDetail; videoSrc?: string | null }) {
  const { t, lang } = useMoveT();
  const device = useDevice();
  const phone = device === 'phone';
  const result = clip.result!;
  const count = result.skeleton.times.length;
  const times = result.skeleton.times;
  const fetched = useClipVideoSrc(clip.clipId);
  const src = videoSrc === undefined ? fetched : videoSrc;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(() => result.flags[0]?.evidence.frame ?? 0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [layers, setLayers] = useState<Layers>({ skeleton: true, angles: true, events: true });
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
  const selectFlag = (flag: Flag) => {
    setSelected(flag);
    seek(flag.evidence.frame);
    stageRef.current?.scrollIntoView?.({ block: 'nearest', behavior: document.documentElement.dataset.motion === 'full' ? 'smooth' : 'auto' });
  };
  const layerValue = (Object.keys(layers) as (keyof Layers)[]).filter((k) => layers[k]);
  const button44 = { width: 44, height: 44 } as const;

  const videoShelf = (
      <Shelf id="video" title={t('review.video')} layout="board" stagger={false}
        controls={(
          <ToggleButtonGroup
            size="small"
            aria-label={t('review.layers')}
            value={layerValue}
            onChange={(_, v: (keyof Layers)[]) => setLayers({ skeleton: v.includes('skeleton'), angles: v.includes('angles'), events: v.includes('events') })}
          >
            {(['skeleton', 'angles', 'events'] as const).map((k) => (
              <ToggleButton key={k} value={k} sx={{ minHeight: 44, minWidth: 44, px: 1.5, textTransform: 'none', fontWeight: 600 }}>{t(`review.layer.${k}`)}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
      >
        <Box ref={stageRef} sx={{ p: { xs: 1, md: 1.5 }, scrollMarginTop: 8 }}>
          <VideoStage
            src={src ?? null}
            result={result}
            frame={frame}
            highlight={highlight}
            layers={layers}
            videoRef={videoRef}
            onFrame={setFrame}
            onPlayingChange={setPlaying}
          />
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
          <Scrubber count={count} frame={frame} fps={result.video.fps} events={events} showEvents={layers.events} onSeek={seek} />
          <Stack direction="row" role="group" aria-label={t('review.speed')} sx={{ gap: 0.5, mt: 0.5 }}>
            {SPEEDS.map((s) => (
              <Button key={s} size="small" onClick={() => setRate(s)} aria-pressed={speed === s} variant={speed === s ? 'contained' : 'text'} sx={{ minWidth: 44, minHeight: 44, textTransform: 'none' }}>
                {String(s).replace('.', ',')}×
              </Button>
            ))}
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
        <FlagList flags={result.flags} selectedId={selected?.id ?? null} lang={lang} onSelect={selectFlag} />
      </Shelf>
  );
  const metricsShelf = (
      <Shelf id="metrics" title={t('review.metrics')} hint={t('review.metrics.hint')} layout="board" stagger={false} empty={result.metrics.length === 0} emptyState={{ text: t('review.metrics.empty') }}>
        <MetricsTable metrics={result.metrics} onSeek={seek} />
      </Shelf>
  );
  const decisionShelf = (
      <Shelf id="decision" title={t('decision.title')} layout="board" stagger={false}>
        <DecisionPanel clip={clip} />
      </Shelf>
  );

  const gap = { xs: 3, md: 3.5 };
  const column = (...items: React.ReactNode[]) => <Stack spacing={gap} sx={{ minWidth: 0 }}>{items.map((item, i) => <Fragment key={i}>{item}</Fragment>)}</Stack>;

  return (
    <Box
      data-testid="review"
      sx={{ display: 'grid', gap: { xs: 3, md: 3.5 }, gridTemplateColumns: phone ? 'minmax(0, 1fr)' : device === 'tablet' ? 'minmax(0, 1.25fr) minmax(280px, 1fr)' : 'minmax(0, 1.6fr) minmax(340px, 1fr)', alignItems: 'start' }}
    >
      {phone ? column(videoShelf, scoreShelf, findingsShelf, curvesShelf, metricsShelf, decisionShelf) : <>{column(videoShelf, curvesShelf)}{column(scoreShelf, findingsShelf, metricsShelf, decisionShelf)}</>}
    </Box>
  );
}
