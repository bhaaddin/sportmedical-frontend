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
 * Desktop (>= 1280 px) is the only layout for now; `compact` is the hook point
 * for the phone / tablet layouts that come later (it only sets a class and a flag).
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
import '../styles/planner.css';
import '../styles/planner.extras.css';
import { Icons } from './Icons';

export const STAGE_WIDTH = 1672;
export const STAGE_HEIGHT = 941;

/** `scaleToFit` maths. A container without size (jsdom, hidden) falls back to 1. */
export function fitScale(containerWidth: number, containerHeight: number): number {
  if (!(containerWidth > 0) || !(containerHeight > 0)) return 1;
  return Math.min(containerWidth / STAGE_WIDTH, containerHeight / STAGE_HEIGHT);
}

export interface StageContextValue {
  /** client px per design px */
  scale: number;
  compact: boolean;
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
  /** Hook point for the later phone / tablet layouts. */
  compact?: boolean;
  /** Fixed scale (tests, screenshots). Default: fit the container. */
  scale?: number;
  className?: string;
}

export function PlannerStage({ children, compact = false, scale: fixedScale, className }: PlannerStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState(1);
  const [stageEl, setStageEl] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || fixedScale !== undefined) return undefined;
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
  }, [fixedScale]);

  const scale = fixedScale ?? measured;
  const setStage = useCallback((el: HTMLDivElement | null) => setStageEl(el), []);
  const value = useMemo<StageContextValue>(
    () => ({ scale, compact, stageEl, toDesign: (px: number) => px / scale }),
    [scale, compact, stageEl],
  );

  return (
    <div
      ref={hostRef}
      className={`sm-planner${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}
      data-testid="planner-root"
      data-scale={scale.toFixed(4)}
    >
      <Icons />
      <div
        id="screen-frame"
        role="main"
        aria-label="SportMedical klubový rezervační systém"
        style={{ width: STAGE_WIDTH * scale, height: STAGE_HEIGHT * scale }}
        data-testid="planner-frame"
      >
        <div
          id="dashboard"
          ref={setStage}
          className="live-mode"
          style={{ transform: `scale(${scale})` }}
          data-testid="planner-stage"
        >
          <StageContext.Provider value={value}>{children}</StageContext.Provider>
        </div>
      </div>
    </div>
  );
}
