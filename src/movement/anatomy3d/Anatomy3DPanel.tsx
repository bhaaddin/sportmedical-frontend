/* The free-rotating 3D view of the anatomy, beside or under the video: orbit with the mouse or a finger, presets, synced to the frame. */
import { useEffect, useRef } from 'react';
import { Box, Button, Stack } from '@mui/material';
import { useMoveT, type MoveKey } from '../i18n';
import type { AnatomyEngine, AnatomyView } from './engine';

const PRESETS = ['video', 'opposite', 'left', 'right'] as const;

export function Anatomy3DPanel({ engine }: { engine: AnatomyEngine }) {
  const { t } = useMoveT();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<AnatomyView | null>(null);

  useEffect(() => {
    if (canvas.current === null || wrap.current === null) return undefined;
    const v = engine.createView(canvas.current, 'orbit');
    view.current = v;
    void v.attachControls();
    const fit = () => {
      if (wrap.current === null) return;
      v.setSize(wrap.current.clientWidth, wrap.current.clientHeight, window.devicePixelRatio || 1);
      v.render();
    };
    fit();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(fit); ro.observe(wrap.current); }
    return () => { ro?.disconnect(); v.dispose(); view.current = null; };
  }, [engine]);

  return (
    <Stack spacing={0.75} data-testid="anatomy-orbit">
      <Box
        ref={wrap}
        sx={{ position: 'relative', width: '100%', aspectRatio: { xs: '4 / 5', md: '1 / 1' }, maxHeight: { md: '66dvh' }, bgcolor: 'common.black', borderRadius: 2, overflow: 'hidden', touchAction: 'none' }}
      >
        <canvas ref={canvas} data-testid="anatomy-orbit-canvas" aria-label={t('review.orbit')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </Box>
      <Stack direction="row" role="group" aria-label={t('review.presets')} sx={{ gap: 0.75, overflowX: 'auto', pb: 0.5 }}>
        {PRESETS.map((p) => (
          <Button key={p} size="small" variant="outlined" onClick={() => view.current?.preset(p)} sx={{ minHeight: 44, minWidth: 44, flexShrink: 0, textTransform: 'none', borderRadius: 999 }}>
            {t(`review.preset.${p}` as MoveKey)}
          </Button>
        ))}
      </Stack>
    </Stack>
  );
}
