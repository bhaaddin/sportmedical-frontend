/*
 * Optional: show one frame of the chosen clip and let staff click the two ends of the 1 m floor marker. The distance is
 * measured in NATIVE video pixels (lib/marker.ts undoes the letterbox of the displayed picture) and sent as `markerPx`.
 */
import { useEffect, useRef, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { containRect } from '../lib/overlay';
import { clickToVideoPx, markerPixelLength, markerPlausible, type PxPoint } from '../lib/marker';
import { useMoveT } from '../i18n';

export function MarkerPicker({ frame, onChange }: {
  frame: { url: string; width: number; height: number };
  onChange: (markerPx: number | undefined) => void;
}) {
  const { t } = useMoveT();
  const theme = useTheme();
  const boxRef = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<PxPoint[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

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

  const rect = containRect(size.w, size.h, frame.width, frame.height);
  const length = points.length === 2 ? markerPixelLength(points[0], points[1]) : null;
  const plausible = length !== null && markerPlausible(length, frame.width, frame.height);

  useEffect(() => { onChange(plausible ? length! : undefined); }, [plausible, length, onChange]);

  const click = (e: React.MouseEvent) => {
    const b = boxRef.current!.getBoundingClientRect();
    const p = clickToVideoPx(rect, frame.width, frame.height, e.clientX - b.left, e.clientY - b.top);
    if (p === null) return;
    setPoints((cur) => (cur.length >= 2 ? [p] : [...cur, p]));
  };
  const css = (p: PxPoint) => ({ x: rect.x + p.x * rect.scale, y: rect.y + p.y * rect.scale });
  const ink = theme.palette.warning.main;

  return (
    <Stack spacing={1} data-testid="marker-picker">
      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{t('marker.title')}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('marker.hint')}</Typography>
      <Box
        ref={boxRef}
        onClick={click}
        role="img"
        aria-label={t('marker.title')}
        sx={{ position: 'relative', width: '100%', aspectRatio: `${frame.width} / ${frame.height}`, maxHeight: 320, bgcolor: 'common.black', borderRadius: 2, overflow: 'hidden', cursor: 'crosshair' }}
      >
        <Box component="img" src={frame.url} alt="" draggable={false} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }} />
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden>
          {points.length === 2 && <line x1={css(points[0]).x} y1={css(points[0]).y} x2={css(points[1]).x} y2={css(points[1]).y} stroke={ink} strokeWidth={2} />}
          {points.map((p, i) => <circle key={i} cx={css(p).x} cy={css(p).y} r={6} fill="none" strokeWidth={2.5} stroke={ink} />)}
        </svg>
      </Box>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography data-testid="marker-result" role="status" sx={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
          {length === null ? t(points.length === 1 ? 'marker.second' : 'marker.first') : plausible ? t('marker.result', { px: String(length).replace('.', ',') }) : t('marker.too_short')}
        </Typography>
        <Button onClick={() => setPoints([])} disabled={points.length === 0} sx={{ minHeight: 44, textTransform: 'none' }}>{t('marker.reset')}</Button>
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('marker.skip')}</Typography>
    </Stack>
  );
}
