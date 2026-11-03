/* The scrubber: a slider over the frames with a tick for every event (left leg above the line, right below). */
import { useRef } from 'react';
import { Box } from '@mui/material';
import { alpha, type Theme } from '@mui/material/styles';
import type { MoveEvent } from '../../api/movement';
import { clampFrame, clock, frameAtRatio, ratioOfFrame } from '../lib/frames';
import { useMoveT } from '../i18n';

export const eventColor = (theme: Theme, type: MoveEvent['type']): string => {
  switch (type) {
    case 'foot_strike': return theme.palette.primary.main;
    case 'initial_contact': return theme.palette.success.main;
    case 'toe_off': return theme.palette.warning.main;
    default: return theme.palette.info.main;
  }
};

export function Scrubber({ count, frame, fps, events, showEvents, onSeek }: {
  count: number;
  frame: number;
  fps: number;
  events: readonly MoveEvent[];
  showEvents: boolean;
  onSeek: (frame: number) => void;
}) {
  const { t } = useMoveT();
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const seekAt = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    onSeek(frameAtRatio((clientX - rect.left) / rect.width, count));
  };

  return (
    <Box
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={t('review.scrubber')}
      aria-valuemin={0}
      aria-valuemax={Math.max(0, count - 1)}
      aria-valuenow={frame}
      aria-valuetext={`${t('review.frame', { n: frame + 1, total: count })}, ${clock(frame / fps)}`}
      onPointerDown={(e) => { dragging.current = true; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); seekAt(e.clientX); }}
      onPointerMove={(e) => { if (dragging.current) seekAt(e.clientX); }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onSeek(clampFrame(frame + step, count));
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onSeek(clampFrame(frame - step, count));
        else if (e.key === 'Home') onSeek(0);
        else if (e.key === 'End') onSeek(count - 1);
        else return;
        e.preventDefault();
      }}
      data-testid="scrubber"
      sx={(theme) => ({
        position: 'relative', height: 44, cursor: 'pointer', touchAction: 'none', borderRadius: 1,
        '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
      })}
    >
      <Box sx={(theme) => ({ position: 'absolute', left: 0, right: 0, top: '50%', height: 6, mt: '-3px', borderRadius: 3, bgcolor: alpha(theme.palette.text.primary, 0.16) })}>
        <Box sx={(theme) => ({ height: '100%', width: `${ratioOfFrame(frame, count) * 100}%`, borderRadius: 3, bgcolor: theme.palette.primary.main })} />
      </Box>
      {showEvents && events.map((e, i) => (
        <Box
          key={`${e.type}-${e.side}-${e.frame}-${i}`}
          aria-hidden
          title={`${t(`event.${e.type}`)}${e.side ? ` ${t(`side.short.${e.side}`)}` : ''} · ${e.frame + 1}`}
          data-event={e.type}
          sx={(theme) => ({
            position: 'absolute', left: `${ratioOfFrame(e.frame, count) * 100}%`, width: 3, ml: '-1.5px', borderRadius: 1,
            bgcolor: eventColor(theme, e.type), pointerEvents: 'none',
            ...(e.side === 'L' ? { top: 4, height: 16 } : e.side === 'R' ? { bottom: 4, height: 16 } : { top: 8, bottom: 8 }),
          })}
        />
      ))}
      <Box
        aria-hidden
        sx={(theme) => ({
          position: 'absolute', top: '50%', left: `${ratioOfFrame(frame, count) * 100}%`, width: 18, height: 18, mt: '-9px', ml: '-9px',
          borderRadius: '50%', bgcolor: theme.palette.primary.main, border: `3px solid ${theme.palette.background.paper}`, boxShadow: 1,
        })}
      />
    </Box>
  );
}
