/* ══════════════════════════════════════════════════════════════
   THE SIGNAL - the one drawing the home page is built around: a measurement trace that starts as a flat line under
   the hero, and is drawn across the pinned "Na čem měříme" sequence as the visitor scrolls (one beat per device).

   Pure SVG, decorative (aria-hidden). Drawn complete in the markup: scroll scenes only animate stroke-dashoffset
   (`pathLength=1`), so without script, or with motion off, the whole trace simply shows.
   ══════════════════════════════════════════════════════════════ */

import type { CSSProperties } from 'react';

export interface SignalGeometry {
  d: string;
  /** The R peak of each beat: where a device node sits. */
  peaks: { x: number; y: number }[];
  width: number;
  height: number;
}

/** One complex of the trace, 94 units wide, R peak 44 units from its start. `a` scales the amplitude. */
function complex(startX: number, base: number, a: number): { d: string; peak: { x: number; y: number } } {
  const r = 78 * a;
  return {
    d: ` H${startX} q 9 ${(-13 * a).toFixed(1)} 18 0 h 12 l 6 ${(9 * a).toFixed(1)} l 8 ${(-(r + 9 * a)).toFixed(1)} l 8 ${(r + 9 * a + 12 * a).toFixed(1)} l 6 ${(-12 * a).toFixed(1)} h 8 q 14 ${(-24 * a).toFixed(1)} 28 0`,
    peak: { x: startX + 44, y: base - r },
  };
}

/** The trace for `fractions` (where along the width each beat is) and `amplitudes` (how tall each one is). */
export function buildSignal(
  fractions: readonly number[] = [0.15, 0.39, 0.63, 0.87],
  amplitudes: readonly number[] = [0.5, 0.78, 1, 0.82],
  width = 1200,
  height = 150,
): SignalGeometry {
  const base = height - 40;
  let d = `M0 ${base}`;
  const peaks: { x: number; y: number }[] = [];
  fractions.forEach((fraction, index) => {
    const part = complex(Math.round(width * fraction) - 44, base, amplitudes[index] ?? 1);
    d += part.d;
    peaks.push(part.peak);
  });
  d += ` H${width}`;
  return { d, peaks, width, height };
}

export const SIGNAL = buildSignal();

export interface SignalLineProps {
  /** Show the nodes (the four device markers) and the moving dot. */
  nodes?: boolean;
  /** Stroke colours: the faint baseline and the trace. */
  baseColor?: string;
  traceColor?: string;
  className?: string;
  style?: CSSProperties;
  /** Marks the elements scenes look for. */
  scene?: boolean;
  /** A thin strip (px high) stretched over the full width instead of the proportional drawing: the hero's hairline. */
  strip?: number;
}

export function SignalLine({ nodes = true, baseColor = 'rgba(240,145,46,0.22)', traceColor = '#F0912E', className, style, scene = false, strip }: SignalLineProps) {
  const { d, peaks, width, height } = SIGNAL;
  if (strip !== undefined) {
    return (
      <svg className={className} style={{ display: 'block', width: '100%', height: strip, ...style }} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d={d} fill="none" stroke={traceColor} strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={0.9} />
      </svg>
    );
  }
  return (
    <svg
      className={className}
      style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible', ...style }}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} fill="none" stroke={baseColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <path
        data-sm={scene ? 'trace' : undefined}
        d={d}
        fill="none"
        stroke={traceColor}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={0}
      />
      {nodes &&
        peaks.map((peak, index) => (
          <circle key={index} data-sm={scene ? 'node' : undefined} cx={peak.x} cy={peak.y} r={7} fill="#0E1013" stroke={traceColor} strokeWidth={3} />
        ))}
      {nodes && scene && <circle data-sm="dot" cx={0} cy={height - 40} r={5} fill={traceColor} opacity={0} />}
    </svg>
  );
}
