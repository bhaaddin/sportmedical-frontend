/* Before and after, side by side in 3D: two sessions' skeletons play together, lined up on their first initial contact. */
import { useEffect, useRef, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { PlayArrow, Pause } from '@mui/icons-material';
import type { ClipDetail } from '../../api/movement';
import { useMoveT } from '../i18n';
import { Anatomy3DPanel } from './Anatomy3DPanel';
import { alignOffset } from './anatomyMath';
import { useAnatomyEngine } from './useAnatomyEngine';

export function Compare3D({ before, after }: { before: ClipDetail; after: ClipDetail }) {
  const { t } = useMoveT();
  const a = useAnatomyEngine(before.clipId, before.result?.anatomy?.available === true);
  const b = useAnatomyEngine(after.clipId, after.result?.anatomy?.available === true);
  const offset = alignOffset(before.result?.events ?? [], after.result?.events ?? []);
  const framesA = a.engine?.anatomy.frames ?? 0;
  const framesB = b.engine?.anatomy.frames ?? 0;
  const fps = a.engine?.anatomy.fps ?? 60;
  /* the shared clock runs on clip A; B follows with the alignment offset, clamped to its own length */
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.5);
  const frameRef = useRef(0);
  frameRef.current = frame;

  useEffect(() => {
    if (!a.engine || !b.engine) return;
    const fa = Math.min(framesA - 1, Math.max(0, frame));
    const fb = Math.min(framesB - 1, Math.max(0, frame + offset));
    a.engine.setFrame(fa);
    b.engine.setFrame(fb);
    a.engine.renderAll();
    b.engine.renderAll();
  }, [a.engine, b.engine, frame, offset, framesA, framesB]);

  useEffect(() => {
    if (!playing || framesA === 0) return undefined;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = frameRef.current + ((now - last) / 1000) * fps * speed;
      last = now;
      setFrame(next >= framesA - 1 ? 0 : next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, framesA, fps, speed]);

  if (a.status === 'failed' || b.status === 'failed') return <Typography variant="body2" role="status">{t('review.anatomy_failed')}</Typography>;
  if (!a.engine || !b.engine) return <Typography variant="body2" role="status" data-testid="compare3d-loading">{t('review.anatomy_loading')}</Typography>;

  return (
    <Stack spacing={1} data-testid="compare3d">
      <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2, minmax(0,1fr))' } }}>
        <Box><Typography variant="caption" sx={{ fontWeight: 700 }}>{t('timeline.compare.before')}</Typography><Anatomy3DPanel engine={a.engine} /></Box>
        <Box><Typography variant="caption" sx={{ fontWeight: 700 }}>{t('timeline.compare.after')}</Typography><Anatomy3DPanel engine={b.engine} /></Box>
      </Box>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
        <Button variant="contained" onClick={() => setPlaying((p) => !p)} startIcon={playing ? <Pause /> : <PlayArrow />} sx={{ minHeight: 44 }}>
          {playing ? t('review.pause') : t('review.play')}
        </Button>
        <Box component="input" type="range" aria-label={t('review.scrubber')} min={0} max={Math.max(1, framesA - 1)} step={0.1} value={Math.min(frame, framesA - 1)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setPlaying(false); setFrame(Number(e.target.value)); }} sx={{ flex: 1, minWidth: 0, height: 44, accentColor: 'var(--mui-palette-primary-main)' }} />
        {[0.25, 0.5, 1].map((s) => (
          <Button key={s} size="small" aria-pressed={speed === s} variant={speed === s ? 'contained' : 'text'} onClick={() => setSpeed(s)} sx={{ minWidth: 44, minHeight: 44, textTransform: 'none' }}>{String(s).replace('.', ',')}×</Button>
        ))}
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('timeline.compare3d.hint')}</Typography>
    </Stack>
  );
}
