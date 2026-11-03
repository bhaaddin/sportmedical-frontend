/* Angle curves in plain SVG, with a playhead that follows the video and a click/drag that seeks it. */
import { useMemo, useRef } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { MoveEvent } from '../../api/movement';
import { clampFrame, frameAtRatio, ratioOfFrame } from '../lib/frames';
import { curvePath, extentOf, groupCurves } from '../lib/curves';
import { useMoveT, type MoveKey } from '../i18n';

const W = 600;
const H = 100;

function Chart({ base, keys, curves, frame, count, events, onSeek }: {
  base: string;
  keys: string[];
  curves: Record<string, readonly (number | null)[]>;
  frame: number;
  count: number;
  events: readonly MoveEvent[];
  onSeek: (frame: number) => void;
}) {
  const { t } = useMoveT();
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const series = keys.map((k) => curves[k]);
  const extent = useMemo(() => extentOf(series), [series]);
  const paths = useMemo(() => keys.map((k) => ({ key: k, d: curvePath(curves[k], W, H, extent) })), [keys, curves, extent]);
  const label = t(`curve.${base}` as MoveKey);
  const seekAt = (x: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (r && r.width > 0) onSeek(frameAtRatio((x - r.left) / r.width, count));
  };
  const x = ratioOfFrame(frame, count) * 100;

  return (
    <Box data-testid={`curve-${base}`}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5, columnGap: 2, flexWrap: 'wrap' }}>
        <Typography component="h3" sx={{ fontSize: 14, fontWeight: 700 }}>{label}</Typography>
        <Stack direction="row" spacing={1.5} sx={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          {keys.map((k) => {
            const side = k.endsWith('_L') ? 'L' : k.endsWith('_R') ? 'R' : null;
            const v = curves[k][clampFrame(frame, count)];
            return (
              <Box key={k} component="span" sx={(theme) => ({ color: side === 'R' ? theme.palette.info.main : theme.palette.primary.main, fontWeight: 600 })}>
                {side ? `${t(`side.short.${side}`)} ` : ''}{v === null || v === undefined ? '–' : `${Math.round(v)}°`}
              </Box>
            );
          })}
        </Stack>
      </Stack>
      <Box
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, count - 1)}
        aria-valuenow={frame}
        onPointerDown={(e) => { drag.current = true; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); seekAt(e.clientX); }}
        onPointerMove={(e) => { if (drag.current) seekAt(e.clientX); }}
        onPointerUp={() => { drag.current = false; }}
        onPointerCancel={() => { drag.current = false; }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') onSeek(clampFrame(frame + (e.shiftKey ? 10 : 1), count));
          else if (e.key === 'ArrowLeft') onSeek(clampFrame(frame - (e.shiftKey ? 10 : 1), count));
          else return;
          e.preventDefault();
        }}
        sx={(theme) => ({
          position: 'relative', height: { xs: 96, md: 84 }, cursor: 'crosshair', touchAction: 'pan-y', borderRadius: 1,
          bgcolor: alpha(theme.palette.text.primary, 0.04), border: `1px solid ${theme.palette.divider}`,
          '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
        })}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="100%" aria-hidden style={{ display: 'block' }}>
          {events.map((e, i) => (
            <line key={i} x1={ratioOfFrame(e.frame, count) * W} x2={ratioOfFrame(e.frame, count) * W} y1={0} y2={H} stroke="currentColor" strokeOpacity={0.18} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          ))}
          {paths.map((p) => (
            <Box
              key={p.key}
              component="path"
              d={p.d}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              sx={(theme) => ({ stroke: p.key.endsWith('_R') ? theme.palette.info.main : theme.palette.primary.main })}
            />
          ))}
        </svg>
        <Box
          aria-hidden
          sx={(theme) => ({ position: 'absolute', top: 0, bottom: 0, left: `${x}%`, width: 2, ml: '-1px', bgcolor: theme.palette.text.primary, pointerEvents: 'none' })}
        />
      </Box>
    </Box>
  );
}

export function AngleCurves({ curves, frame, count, events, onSeek }: {
  curves: Record<string, readonly (number | null)[]>;
  frame: number;
  count: number;
  events: readonly MoveEvent[];
  onSeek: (frame: number) => void;
}) {
  const groups = useMemo(() => groupCurves(curves), [curves]);
  return (
    <Stack spacing={2} sx={{ p: { xs: 1.5, md: 2 } }}>
      {groups.map((g) => (
        <Chart key={g.base} base={g.base} keys={g.keys} curves={curves} frame={frame} count={count} events={events} onSeek={onSeek} />
      ))}
    </Stack>
  );
}
