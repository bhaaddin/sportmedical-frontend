/*
 * Shelf - a titled section of a page: a header (title, a count, an optional filter or sort, "Zobrazit vše") over a row,
 * a grid or a list of cards, standing on the shelf's rail. It is the unit every staff page is built from.
 *
 * It owns the four states so no page draws its own:
 *   loading  skeleton cards of the SAME size as the real ones (nothing moves when the data arrives)
 *   error    a sentence and "Zkusit znovu" (role="alert"; a retry, never a dead end)
 *   empty    a sentence and the NEXT ACTION ("Objednat termín"), never just "Žádná data"
 *   ready    the cards; the first time a shelf has anything the cards arrive one after another (src/motion/useRowStagger,
 *            full motion only, never replayed by a refetch or a filter)
 *
 * Layouts: `row` scrolls sideways with snap and fades at the edge it continues past (phone: the next card peeks in),
 * `grid` wraps by the card's minimum width, `list` is one glass board of rows for dense data (it may scroll inside).
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Skeleton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ArrowForward } from '@mui/icons-material';
import { useRowStagger } from '../../motion/useRowStagger';
import { useIsPhone } from '../../layout/useDevice';
import { SoftCard } from '../../components/ui/SoftCard';
import { CARD_RADIUS, MUTED_SX, TARGET_SX, railSx, toneOf, type ShelfTone } from './shelfStyle';

export interface ShelfAction {
  label: string;
  /** A link ... */
  to?: string;
  state?: Record<string, unknown>;
  /** ... or a handler. */
  onClick?: () => void;
}

export interface ShelfProps {
  /** A stable name: `data-shelf`, heading id, and what tests and the docs call this shelf. */
  id: string;
  title: string;
  /** One quiet line under the title. */
  hint?: string;
  /** How many there are in all (not how many are drawn). Shown as a pill; `undefined` draws none. */
  count?: number;
  countTone?: ShelfTone;
  layout?: 'row' | 'grid' | 'list';
  loading?: boolean;
  /** `true`, or the sentence to show. */
  error?: boolean | string;
  onRetry?: () => void;
  /** Nothing to show: draws `emptyState` instead of the children. */
  empty?: boolean;
  emptyState?: { text: string; action?: ShelfAction };
  viewAll?: { to: string; state?: Record<string, unknown>; label?: string };
  /** A filter or a sort, right-aligned in the header. */
  controls?: ReactNode;
  /** How many skeleton cards while loading. */
  skeletons?: number;
  /** Minimum card width in `row` and `grid` (px); a phone's row uses 84 % of the screen, at most 300. */
  minCardWidth?: number;
  /** The skeleton card's height (px). */
  cardHeight?: number;
  /** `list`: the board's highest point before it scrolls inside (CSS length). */
  maxHeight?: string | number;
  /** Turn the first-load cascade off (a shelf that is always on screen with its data already there). */
  stagger?: boolean;
  children?: ReactNode;
}

function ActionButton({ action, variant = 'outlined' }: { action: ShelfAction; variant?: 'outlined' | 'contained' | 'text' }) {
  const common = { variant, size: 'small' as const, sx: { ...TARGET_SX, alignSelf: 'flex-start' } };
  return action.to !== undefined ? (
    <Button component={RouterLink} to={action.to} state={action.state} {...common}>{action.label}</Button>
  ) : (
    <Button onClick={action.onClick} {...common}>{action.label}</Button>
  );
}

/** Does a sideways row continue past an edge? Drives the fade so a cut-off card says "there is more". */
function useScrollEdges(ref: React.RefObject<HTMLElement | null>, watch: unknown) {
  const [edges, setEdges] = useState({ start: false, end: false });
  useEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    const read = () => {
      const start = el.scrollLeft > 2;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    read();
    el.addEventListener('scroll', read, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', read);
      ro?.disconnect();
    };
  }, [ref, watch]);
  return edges;
}

export function Shelf({
  id, title, hint, count, countTone = 'primary', layout = 'row', loading = false, error = false, onRetry, empty = false, emptyState,
  viewAll, controls, skeletons = 3, minCardWidth = 232, cardHeight = 132, maxHeight, stagger = true, children,
}: ShelfProps) {
  const headingId = useId();
  const phone = useIsPhone();
  const bodyRef = useRef<HTMLDivElement>(null);
  const failed = error !== false;
  const showEmpty = !loading && !failed && empty;
  const ready = !loading && !failed && !empty;
  const state = loading ? 'loading' : failed ? 'error' : showEmpty ? 'empty' : 'ready';

  useRowStagger(bodyRef, stagger && ready && layout !== 'list');
  const edges = useScrollEdges(bodyRef, `${layout}-${state}`);

  const cardWidth = phone ? 'min(84vw, 300px)' : `${minCardWidth}px`;
  const sizing: Record<string, unknown> =
    layout === 'row'
      ? {
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          overscrollBehaviorX: 'contain',
          scrollSnapType: 'x proximity',
          scrollPaddingInline: phone ? '16px' : 0,
          /* The first card's shadow and a focus ring are not clipped by the scroller. */
          py: '4px',
          px: phone ? '16px' : '4px',
          mx: phone ? '-16px' : '-4px',
          scrollbarWidth: 'thin',
          '& > *': { flex: `0 0 ${cardWidth}`, scrollSnapAlign: 'start' },
          ...(edges.end || edges.start
            ? { maskImage: `linear-gradient(to right, ${edges.start ? 'transparent 0, #000 28px' : '#000 0'}, ${edges.end ? '#000 calc(100% - 44px), transparent 100%' : '#000 100%'})` }
            : {}),
        }
      : layout === 'grid'
        ? { display: 'grid', gap: '12px', gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minCardWidth}px), 1fr))` }
        : {};

  const skeletonCards = Array.from({ length: skeletons }, (_, i) => (
    <Skeleton key={i} variant="rounded" height={cardHeight} sx={{ borderRadius: `${CARD_RADIUS}px`, ...(layout === 'row' ? { minWidth: cardWidth } : {}) }} />
  ));

  return (
    <Box component="section" aria-labelledby={headingId} data-shelf={id} data-state={state} sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, minHeight: { xs: 44, md: 32 }, flexWrap: 'wrap', rowGap: 0.5 }}>
        <Typography id={headingId} component="h2" sx={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.3 }}>
          {title}
        </Typography>
        {count !== undefined && (
          <Box
            component="span"
            aria-label={`Počet: ${count}`}
            sx={(t) => {
              const c = toneOf(t, count > 0 ? countTone : 'grey');
              return {
                fontSize: 12, fontWeight: 700, lineHeight: 1, px: 0.9, py: 0.45, borderRadius: 999, fontVariantNumeric: 'tabular-nums',
                color: c.fg, bgcolor: c.bg, boxShadow: `inset 0 0 0 1px ${alpha(c.line, 0.9)}`,
              };
            }}
          >
            {count}
          </Box>
        )}
        {hint !== undefined && (
          <Typography variant="body2" sx={{ ...MUTED_SX, fontSize: 13, display: { xs: 'none', sm: 'block' } }}>{hint}</Typography>
        )}
        <Box sx={{ flex: 1 }} />
        {controls}
        {viewAll !== undefined && (
          <Button
            component={RouterLink}
            to={viewAll.to}
            state={viewAll.state}
            size="small"
            endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
            aria-label={`${viewAll.label ?? 'Zobrazit vše'}: ${title}`}
            sx={{ ...TARGET_SX, px: 1, fontSize: 13, fontWeight: 600 }}
          >
            {viewAll.label ?? 'Zobrazit vše'}
          </Button>
        )}
      </Box>

      {state === 'loading' && (
        <Box aria-busy="true" aria-label={`${title}: načítám`} sx={layout === 'row' ? { ...sizing, maskImage: 'none' } : sizing}>
          {layout === 'list' ? (
            <SoftCard sx={{ p: 1.5 }}><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /></SoftCard>
          ) : (
            skeletonCards
          )}
        </Box>
      )}

      {state === 'error' && (
        <SoftCard role="alert" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', borderRadius: `${CARD_RADIUS}px` }}>
          <Typography sx={{ flex: '1 1 220px', fontSize: 14 }}>
            {typeof error === 'string' ? error : `Polici „${title}“ se nepodařilo načíst.`}
          </Typography>
          {onRetry !== undefined && <Button variant="outlined" size="small" onClick={onRetry} sx={TARGET_SX}>Zkusit znovu</Button>}
        </SoftCard>
      )}

      {state === 'empty' && (
        <SoftCard tone="muted" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', borderRadius: `${CARD_RADIUS}px`, borderStyle: 'dashed' }}>
          <Typography sx={{ ...MUTED_SX, flex: '1 1 220px', fontSize: 14 }}>
            {emptyState?.text ?? 'Zatím tu nic není.'}
          </Typography>
          {emptyState?.action !== undefined && <ActionButton action={emptyState.action} />}
        </SoftCard>
      )}

      {state === 'ready' && (
        layout === 'list' ? (
          <SoftCard
            role="list"
            aria-label={title}
            sx={{ p: 0.5, borderRadius: `${CARD_RADIUS}px`, overflowY: 'auto', overscrollBehavior: 'contain', ...(maxHeight !== undefined ? { maxHeight } : {}) }}
          >
            {children}
          </SoftCard>
        ) : (
          <>
            <Box ref={bodyRef} role="list" aria-label={title} sx={sizing}>{children}</Box>
            <Box aria-hidden sx={(t) => ({ ...(railSx(t) as object), mt: layout === 'row' ? 0.5 : 1.25 })} />
          </>
        )
      )}
    </Box>
  );
}

export default Shelf;
