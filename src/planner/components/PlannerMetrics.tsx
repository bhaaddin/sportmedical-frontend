/*
 * PlannerMetrics - what the planner measured of the room it was given.
 *
 * The file draws a 1672 x 941 picture. The owner's rule (18. 10. 2026): the desktop stage uses ALL the room the page has,
 * in both directions, at every size, and computes it from what is really there - never from a viewport assumption. So:
 *
 *   stage    `fitStage(containerW, containerH)`: the stage is still laid out in "design pixels" (the file's CSS), but
 *            its logical size grows with the room:
 *
 *                s  = min(containerW / 1672, containerH / 941)        client px per design px
 *                W' = containerW / s   (>= 1672)                      the stage's logical width
 *                H' = containerH / s   (>= 941)                       the stage's logical height
 *
 *            Exactly 1672 x 941 when the room has the file's aspect ratio. `planner.fluid.css` anchors the panels with
 *            `--stage-w` / `--stage-h` (= W' / H'), so the extra width / height is shared out instead of left empty.
 *   board    the week board's own size in design pixels (`useBoardMetrics`): the timeline height (hour rows =
 *            height / 12 hours), the day columns = (width - hour column) / 7. The model, the cards, the now line, the
 *            overlays and the drag maths read this instead of the file's 455 px / 1094 px.
 *   deck     how many činnost cards fit the deck (`deckVisibleCount`).
 *
 * Every value defaults to the FILE's number (`DESIGN_*`), so a context-free render (jsdom, the golden tests that pin the
 * prototype's ~700 answers) is the file exactly.
 */
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode, type RefObject } from 'react';

/** The file's stage. */
export const STAGE_WIDTH = 1672;
export const STAGE_HEIGHT = 941;

/** The file's 07:00-19:00 timeline (`TIMELINE_HEIGHT`) and the standard-ordering layout's (455 + the 174 px deck's room). */
export const DESIGN_TIMELINE_HEIGHT = 455;
/** `#day-board` / `#hour-column` of the file (planner.css: `.hour-column{width:58px}`, board 1094 px). */
export const DESIGN_HOUR_COLUMN = 58;
export const DESIGN_DAY_BOARD_WIDTH = 1094;

export interface StageFit {
  /** client px per design px */
  scale: number;
  /** the stage's logical size in design px (>= 1672 x 941) */
  width: number;
  height: number;
}

export const DESIGN_STAGE: StageFit = { scale: 1, width: STAGE_WIDTH, height: STAGE_HEIGHT };

/** `scaleToFit` maths. A container without size (jsdom, hidden) is the file's stage. */
export function fitStage(containerWidth: number, containerHeight: number): StageFit {
  if (!(containerWidth > 0) || !(containerHeight > 0)) return DESIGN_STAGE;
  const scale = Math.min(containerWidth / STAGE_WIDTH, containerHeight / STAGE_HEIGHT);
  return { scale, width: containerWidth / scale, height: containerHeight / scale };
}

export interface BoardMetrics {
  /** `#board-body` width (hour column + 7 days), design px */
  bodyWidth: number;
  /** width of the hour column, design px */
  hourColumn: number;
  /** `#day-board` width = bodyWidth - hourColumn */
  width: number;
  /** one day column = width / 7 */
  dayWidth: number;
  /** the visible timeline height (`#board-body` height), design px: 12 hours = this */
  height: number;
  /** true once the board was really measured (false = the file's numbers) */
  measured: boolean;
}

export function boardMetricsOf(bodyWidth: number, bodyHeight: number, hourColumn = DESIGN_HOUR_COLUMN): BoardMetrics {
  const hour = hourColumn >= 0 ? hourColumn : DESIGN_HOUR_COLUMN;
  const width = Math.max(1, bodyWidth - hour);
  return { bodyWidth, hourColumn: hour, width, dayWidth: width / 7, height: bodyHeight, measured: true };
}

export const DESIGN_BOARD: BoardMetrics = {
  bodyWidth: DESIGN_DAY_BOARD_WIDTH + DESIGN_HOUR_COLUMN,
  hourColumn: DESIGN_HOUR_COLUMN,
  width: DESIGN_DAY_BOARD_WIDTH,
  dayWidth: DESIGN_DAY_BOARD_WIDTH / 7,
  height: DESIGN_TIMELINE_HEIGHT,
  measured: false,
};

/**
 * A činnost card of the deck at the file's size: (viewport 652.4 - 2 x 12 padding - 9 gap) / 2 = 309.7 px, gap 9
 * (planner.css v29: `.adaptive-card-track{gap:9px}`, `.adaptive-card-viewport{padding:9px 12px 11px}`).
 */
export const DECK_CARD_WIDTH = 309.7;
export const DECK_CARD_GAP = 9;
/** The file shows two cards at a time; a deck that has the room shows every card that fits (R9). */
export const DECK_MIN_VISIBLE = 2;
/**
 * The narrowest a činnost card may be drawn on the desktop stage (design px; the file's own card is 309.7). A strip that
 * is 640 design px wide - the club planner at 1440 px, beside the summary card - holds THREE of them, which the file's
 * width did not (owner, 21. 10. 2026: "only 2 of 3 cards visible").
 */
export const DECK_MIN_CARD_WIDTH = 200;
/** The narrowest card of the compact strip (phone / tablet, CSS px) and its gap - the phone's two cards are 167 px wide. */
export const COMPACT_MIN_CARD_WIDTH = 160;
export const COMPACT_CARD_GAP = 8;

/** Cards that fit a deck viewport whose content (inside the padding) is `contentWidth` design px wide: every one that is at least the minimum wide. */
export function deckVisibleCount(contentWidth: number): number {
  if (!(contentWidth > 0)) return DECK_MIN_VISIBLE;
  const fit = Math.floor((contentWidth + DECK_CARD_GAP + 0.5) / (DECK_MIN_CARD_WIDTH + DECK_CARD_GAP));
  return Math.max(DECK_MIN_VISIBLE, fit);
}

/** The same for the compact strip: 2 on a phone (346 px), 4 on a tablet (756 px). */
export function compactVisibleCount(contentWidth: number): number {
  if (!(contentWidth > 0)) return DECK_MIN_VISIBLE;
  return Math.max(DECK_MIN_VISIBLE, Math.floor((contentWidth + COMPACT_CARD_GAP + 0.5) / (COMPACT_MIN_CARD_WIDTH + COMPACT_CARD_GAP)));
}

/**
 * Card columns the deck's track is divided into: the cards that fit (`deckVisibleCount`), but never more columns than there
 * are cards - owner, 18. 10. 2026: "never leave a piece of a side open, it should use it". One činnost takes the whole
 * deck, two share it, and only a deck with more cards than fit keeps the file's fixed-width cards and scrolls.
 * `planner.fluid.css`: card width = (100% - (n - 1) x 9px) / n.
 */
export function deckColumns(visible: number, quantity: number): number {
  return Math.max(1, Math.min(Math.max(1, Math.floor(visible)), Math.floor(quantity)));
}

export interface PlannerMetrics {
  stage: StageFit;
  board: BoardMetrics;
  deckVisible: number;
}

export const DESIGN_METRICS: PlannerMetrics = { stage: DESIGN_STAGE, board: DESIGN_BOARD, deckVisible: DECK_MIN_VISIBLE };

interface MetricsContextValue {
  metrics: PlannerMetrics;
  publishBoard: (board: BoardMetrics) => void;
  publishDeck: (visible: number) => void;
}

const MetricsContext = createContext<MetricsContextValue | null>(null);

const sameBoard = (a: BoardMetrics, b: BoardMetrics): boolean =>
  Math.abs(a.bodyWidth - b.bodyWidth) < 0.01 &&
  Math.abs(a.height - b.height) < 0.01 &&
  Math.abs(a.hourColumn - b.hourColumn) < 0.01 &&
  a.measured === b.measured;

export function PlannerMetricsProvider({ stage, children }: { stage: StageFit; children: ReactNode }) {
  const [board, setBoard] = useState<BoardMetrics>(DESIGN_BOARD);
  const [deckVisible, setDeckVisible] = useState<number>(DECK_MIN_VISIBLE);
  const publishBoard = useCallback((next: BoardMetrics) => setBoard((prev) => (sameBoard(prev, next) ? prev : next)), []);
  const publishDeck = useCallback((next: number) => setDeckVisible((prev) => (prev === next ? prev : next)), []);
  const value = useMemo<MetricsContextValue>(
    () => ({ metrics: { stage, board, deckVisible }, publishBoard, publishDeck }),
    [stage, board, deckVisible, publishBoard, publishDeck],
  );
  return <MetricsContext.Provider value={value}>{children}</MetricsContext.Provider>;
}

/** The measured metrics, or the FILE's numbers outside a stage (tests). */
export function usePlannerMetrics(): PlannerMetrics {
  return useContext(MetricsContext)?.metrics ?? DESIGN_METRICS;
}

/** Layout size of an element in its own (design) pixels: unaffected by the stage's transform. */
function layoutSize(el: HTMLElement): { width: number; height: number } {
  const cs = getComputedStyle(el);
  const px = (v: string) => (v.endsWith('px') ? parseFloat(v) : NaN);
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const w = px(cs.width);
  const h = px(cs.height);
  // `width` / `height` are the content box under `box-sizing: content-box` and the border box otherwise.
  const border = cs.boxSizing === 'border-box';
  return {
    width: Number.isFinite(w) ? (border ? w : w + padX) : el.clientWidth,
    height: Number.isFinite(h) ? (border ? h : h + padY) : el.clientHeight,
  };
}

/**
 * Measures the week board (`#board-body`, the flex row of the hour column and the seven days) with a ResizeObserver and
 * publishes it. Without a measurable box (jsdom) it keeps the file's numbers. Pass `enabled=false` to skip (nothing to
 * measure while a view without the week board is shown).
 */
export function useBoardMetrics(bodyRef: RefObject<HTMLElement | null>, enabled = true): BoardMetrics {
  const ctx = useContext(MetricsContext);
  const publish = ctx?.publishBoard;
  const [local, setLocal] = useState<BoardMetrics>(DESIGN_BOARD);
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body || !enabled) return undefined;
    const measure = () => {
      const { width, height } = layoutSize(body);
      if (!(width > 0) || !(height > 0)) return;
      const hour = body.querySelector<HTMLElement>('.hour-column');
      const hourWidth = hour ? layoutSize(hour).width : DESIGN_HOUR_COLUMN;
      const next = boardMetricsOf(width, height, hourWidth > 0 ? hourWidth : DESIGN_HOUR_COLUMN);
      setLocal((prev) => (sameBoard(prev, next) ? prev : next));
      publish?.(next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, [bodyRef, enabled, publish]);
  return local;
}

/**
 * The deck's viewport padding (planner.css v29) the card width is measured inside. How many činnost cards fit is a count from
 * the strip's width alone (`deckVisibleCount` on the desktop stage, `compactVisibleCount` on the phone / tablet strip); the
 * cards are then drawn from that count (`--deck-n` / `--deck-nc`), so nothing depends on a card that is already drawn.
 * `quantity` re-measures when the cards change.
 */
export function useDeckVisible(viewportRef: RefObject<HTMLElement | null>, quantity = 0): number {
  const ctx = useContext(MetricsContext);
  const publish = ctx?.publishDeck;
  const [local, setLocal] = useState<number>(DECK_MIN_VISIBLE);
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return undefined;
    const measure = () => {
      const cs = getComputedStyle(vp);
      const px = (v: string) => parseFloat(v);
      const w = px(cs.width);
      if (!(w > 0)) return;
      const border = cs.boxSizing === 'border-box';
      const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const content = border ? w - pad : w;
      /* a count from the width alone: the card is drawn from the count (`--deck-n`), never the other way round */
      const next = vp.closest('.is-compact') ? compactVisibleCount(content) : deckVisibleCount(content);
      setLocal(next);
      publish?.(next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(vp);
    return () => observer.disconnect();
  }, [viewportRef, publish, quantity]);
  return local;
}
