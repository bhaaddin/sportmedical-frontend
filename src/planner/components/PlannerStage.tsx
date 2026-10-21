/*
 * The design stage, scaled AND stretched to fill its container (the owner's rule of 18. 10. 2026: no dead band at
 * any side, at any window size, at any browser zoom).
 *
 * The prototype's `scaleToFit()` is
 *
 *     ratio = min(containerWidth / 1672, containerHeight / 941)
 *     #screen-frame  -> width/height = design size * ratio
 *     #dashboard     -> transform: scale(ratio), origin 0 0   (stays 1672 x 941 inside)
 *
 * which letterboxes whenever the container's aspect ratio differs. Here the ratio is the same, but the stage's LOGICAL
 * size follows the room (see `PlannerMetrics.tsx`, `fitStage`):
 *
 *     W' = containerW / ratio (>= 1672)      H' = containerH / ratio (>= 941)
 *     #screen-frame  -> exactly the container
 *     #dashboard     -> width W', height H', transform: scale(ratio)    (--stage-w / --stage-h = W' / H')
 *
 * and `planner.fluid.css` anchors the panels with those variables. At the file's aspect ratio W' x H' is exactly
 * 1672 x 941 and nothing differs from the file. The container is observed with a ResizeObserver (window resize, browser
 * zoom, the shell's menu, dev tools, ...) so the sizes are computed from what is really there, never assumed.
 *
 * Everything inside is laid out in DESIGN pixels, so panels use the CSS of the
 * prototype unchanged. The scale is published through context:
 *
 *   - client (screen) distances must be divided by `scale` before they are used as
 *     design pixels (`toDesign`); ratios of a measured rect (`pointerCoords`,
 *     `proposalForMove`) need no correction because numerator and denominator scale alike;
 *   - `stageEl` is the `#dashboard` element, the target for portals of stage-level layers;
 *   - `stageWidth` / `stageHeight` are W' / H' (`PlannerMetrics.tsx` has the board's own size).
 *
 * Three layouts, picked from `useDevice()` (or forced with `layout`):
 *
 *   desktop  (>= 1280)  the stage above, fluid
 *   tablet   (768-1279) no stage: `#dashboard` is an ordinary column the panels reflow in
 *   phone    (<= 767)   the same, one column, sheets instead of side panels
 *
 * Below 1280 the scale is 1 (nothing is drawn in design pixels any more), `#screen-frame` and
 * `#dashboard` carry no size or transform, and `planner.compact.css` lays the panels out from
 * `.sm-planner[data-layout="tablet" | "phone"]`. Only `data-layout="desktop"` is fluid.
 */
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useDevice } from '../../layout/useDevice';
import '../styles/planner.css';
import '../styles/planner.extras.css';
import '../styles/planner.fx.css';
import '../styles/planner.compact.css';
import '../styles/planner.fluid.css';
import { Icons } from './Icons';
import { DESIGN_STAGE, PlannerMetricsProvider, STAGE_HEIGHT, STAGE_WIDTH, fitStage, type StageFit } from './PlannerMetrics';

export { STAGE_HEIGHT, STAGE_WIDTH, fitStage };

/** What the planner looks like at a width: the file's stage or one of the two reflowed layouts. */
export type PlannerLayout = 'desktop' | 'tablet' | 'phone';

/** `scaleToFit` maths (the ratio only). A container without size (jsdom, hidden) falls back to 1. */
export function fitScale(containerWidth: number, containerHeight: number): number {
  return fitStage(containerWidth, containerHeight).scale;
}

export interface StageContextValue {
  /** client px per design px (always 1 in the tablet / phone layouts) */
  scale: number;
  /** The stage's logical size in design px (>= 1672 x 941, exactly that at the file's aspect ratio). */
  stageWidth: number;
  stageHeight: number;
  /** tablet or phone: no design stage, the panels reflow */
  compact: boolean;
  layout: PlannerLayout;
  /** The `#dashboard` element (null until mounted). */
  stageEl: HTMLElement | null;
  /** Convert a distance measured in screen pixels to design pixels. */
  toDesign: (clientPx: number) => number;
}

const StageContext = createContext<StageContextValue | null>(null);

export function useStage(): StageContextValue {
  const value = useContext(StageContext);
  if (!value) throw new Error('useStage() needs a <PlannerStage>.');
  return value;
}

/** Just the scale. */
export const usePlannerScale = (): number => useStage().scale;

export interface PlannerStageProps {
  children: ReactNode;
  /**
   * Force the reflowed (tablet) layout on a desktop-wide window. Superseded by `layout`; kept so a caller that
   * only wants "not the stage" still can.
   */
  compact?: boolean;
  /** Force a layout (tests, screenshots). Default: `useDevice()`. */
  layout?: PlannerLayout;
  /** Fixed scale (tests, screenshots) of the desktop stage, at the file's 1672 x 941. Default: fit AND fill the container. */
  scale?: number;
  className?: string;
}

/** What the container measured to: the room itself and the stage fitted into it. */
interface Fitted extends StageFit {
  containerWidth: number;
  containerHeight: number;
}

const NOT_MEASURED: Fitted = { ...DESIGN_STAGE, containerWidth: STAGE_WIDTH, containerHeight: STAGE_HEIGHT };

const sameFit = (a: Fitted, b: Fitted): boolean =>
  Math.abs(a.containerWidth - b.containerWidth) < 0.01 && Math.abs(a.containerHeight - b.containerHeight) < 0.01;

export function PlannerStage({ children, compact = false, layout: forced, scale: fixedScale, className }: PlannerStageProps) {
  const device = useDevice();
  const layout: PlannerLayout = forced ?? (compact && device === 'desktop' ? 'tablet' : device);
  const isCompact = layout !== 'desktop';
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState<Fitted>(NOT_MEASURED);
  const [stageEl, setStageEl] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || isCompact || fixedScale !== undefined) return undefined;
    let frame = 0;
    const measure = () => {
      /* The host's own box: layout pixels, not affected by the stage's transform (the host is not inside it). */
      const cs = getComputedStyle(host);
      const width = parseFloat(cs.width);
      const height = parseFloat(cs.height);
      const w = Number.isFinite(width) && width > 0 ? width : host.getBoundingClientRect().width;
      const h = Number.isFinite(height) && height > 0 ? height : host.getBoundingClientRect().height;
      const fit = fitStage(w, h);
      const next: Fitted = { ...fit, containerWidth: w > 0 && h > 0 ? w : STAGE_WIDTH, containerHeight: w > 0 && h > 0 ? h : STAGE_HEIGHT };
      setMeasured((prev) => (sameFit(prev, next) ? prev : next));
    };
    const queue = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(host);
    /* Belt and braces: a window resize, a zoom (devicePixelRatio) or a visual-viewport change re-measures too. */
    window.addEventListener('resize', queue);
    window.visualViewport?.addEventListener('resize', queue);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', queue);
      window.visualViewport?.removeEventListener('resize', queue);
    };
  }, [fixedScale, isCompact]);

  const fit: Fitted = isCompact
    ? { scale: 1, width: STAGE_WIDTH, height: STAGE_HEIGHT, containerWidth: STAGE_WIDTH, containerHeight: STAGE_HEIGHT }
    : fixedScale !== undefined
      ? {
          scale: fixedScale,
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          containerWidth: STAGE_WIDTH * fixedScale,
          containerHeight: STAGE_HEIGHT * fixedScale,
        }
      : measured;
  const scale = fit.scale;
  const stageFit = useMemo<StageFit>(() => ({ scale: fit.scale, width: fit.width, height: fit.height }), [fit.scale, fit.width, fit.height]);
  const setStage = useCallback((el: HTMLDivElement | null) => setStageEl(el), []);
  const value = useMemo<StageContextValue>(
    () => ({
      scale,
      stageWidth: stageFit.width,
      stageHeight: stageFit.height,
      compact: isCompact,
      layout,
      stageEl,
      toDesign: (px: number) => px / scale,
    }),
    [scale, stageFit.width, stageFit.height, isCompact, layout, stageEl],
  );

  const rootStyle = isCompact
    ? undefined
    : ({ '--stage-w': `${stageFit.width}px`, '--stage-h': `${stageFit.height}px`, '--stage-scale': scale } as CSSProperties);

  return (
    <div
      ref={hostRef}
      className={`sm-planner${isCompact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}
      data-testid="planner-root"
      data-layout={layout}
      data-scale={scale.toFixed(4)}
      data-stage-w={stageFit.width.toFixed(2)}
      data-stage-h={stageFit.height.toFixed(2)}
      style={rootStyle}
    >
      <Icons />
      <div
        id="screen-frame"
        role="main"
        aria-label="SportMedical klubový rezervační systém"
        style={isCompact ? undefined : { width: fit.containerWidth, height: fit.containerHeight }}
        data-testid="planner-frame"
      >
        <div
          id="dashboard"
          ref={setStage}
          className="live-mode"
          style={isCompact ? undefined : { width: stageFit.width, height: stageFit.height, transform: `scale(${scale})` }}
          data-testid="planner-stage"
        >
          <StageContext.Provider value={value}>
            <PlannerMetricsProvider stage={stageFit}>{children}</PlannerMetricsProvider>
          </StageContext.Provider>
        </div>
      </div>
    </div>
  );
}
