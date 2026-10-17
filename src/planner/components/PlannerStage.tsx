/*
 * The 1672 x 941 design stage, scaled to fit its container.
 *
 * Port of the prototype's `scaleToFit()`:
 *
 *     ratio = min(containerWidth / 1672, containerHeight / 941)
 *     #screen-frame  -> width/height = design size * ratio
 *     #dashboard     -> transform: scale(ratio), origin 0 0   (stays 1672 x 941 inside)
 *
 * Everything inside is laid out in DESIGN pixels, so panels use the CSS of the
 * prototype unchanged. The scale is published through context:
 *
 *   - client (screen) distances must be divided by `scale` before they are used as
 *     design pixels (`toDesign`); ratios of a measured rect (`pointerCoords`,
 *     `proposalForMove`) need no correction because numerator and denominator scale alike;
 *   - `stageEl` is the `#dashboard` element, the target for portals of stage-level layers.
 *
 * Three layouts, picked from `useDevice()` (or forced with `layout`):
 *
 *   desktop  (>= 1280)  the stage above, exactly as the file draws it
 *   tablet   (768-1279) no stage: `#dashboard` is an ordinary column the panels reflow in
 *   phone    (<= 767)   the same, one column, sheets instead of side panels
 *
 * Below 1280 the scale is 1 (nothing is drawn in design pixels any more), `#screen-frame` and
 * `#dashboard` carry no size or transform, and `planner.compact.css` lays the panels out from
 * `.sm-planner[data-layout="tablet" | "phone"]`.
 */
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useDevice } from '../../layout/useDevice';
import '../styles/planner.css';
import '../styles/planner.extras.css';
import '../styles/planner.compact.css';
import { Icons } from './Icons';

/** What the planner looks like at a width: the file's stage or one of the two reflowed layouts. */
export type PlannerLayout = 'desktop' | 'tablet' | 'phone';

export const STAGE_WIDTH = 1672;
export const STAGE_HEIGHT = 941;

/** `scaleToFit` maths. A container without size (jsdom, hidden) falls back to 1. */
export function fitScale(containerWidth: number, containerHeight: number): number {
  if (!(containerWidth > 0) || !(containerHeight > 0)) return 1;
  return Math.min(containerWidth / STAGE_WIDTH, containerHeight / STAGE_HEIGHT);
}

export interface StageContextValue {
  /** client px per design px (always 1 in the tablet / phone layouts) */
  scale: number;
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
  /** Fixed scale (tests, screenshots) of the desktop stage. Default: fit the container. */
  scale?: number;
  className?: string;
}

export function PlannerStage({ children, compact = false, layout: forced, scale: fixedScale, className }: PlannerStageProps) {
  const device = useDevice();
  const layout: PlannerLayout = forced ?? (compact && device === 'desktop' ? 'tablet' : device);
  const isCompact = layout !== 'desktop';
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState(1);
  const [stageEl, setStageEl] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || isCompact || fixedScale !== undefined) return undefined;
    const measure = () => {
      const rect = host.getBoundingClientRect();
      setMeasured(fitScale(rect.width, rect.height));
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(host);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [fixedScale, isCompact]);

  const scale = isCompact ? 1 : (fixedScale ?? measured);
  const setStage = useCallback((el: HTMLDivElement | null) => setStageEl(el), []);
  const value = useMemo<StageContextValue>(
    () => ({ scale, compact: isCompact, layout, stageEl, toDesign: (px: number) => px / scale }),
    [scale, isCompact, layout, stageEl],
  );

  return (
    <div
      ref={hostRef}
      className={`sm-planner${isCompact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}
      data-testid="planner-root"
      data-layout={layout}
      data-scale={scale.toFixed(4)}
    >
      <Icons />
      <div
        id="screen-frame"
        role="main"
        aria-label="SportMedical klubový rezervační systém"
        style={isCompact ? undefined : { width: STAGE_WIDTH * scale, height: STAGE_HEIGHT * scale }}
        data-testid="planner-frame"
      >
        <div
          id="dashboard"
          ref={setStage}
          className="live-mode"
          style={isCompact ? undefined : { transform: `scale(${scale})` }}
          data-testid="planner-stage"
        >
          <StageContext.Provider value={value}>{children}</StageContext.Provider>
        </div>
      </div>
    </div>
  );
}
