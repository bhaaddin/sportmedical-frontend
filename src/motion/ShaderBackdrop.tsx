/* ══════════════════════════════════════════════════════════════
   SHADER BACKDROP - a slow WebGL field (mesh gradient / swirl / halftone) behind a dark band, tinted by an accent.

   @paper-design/shaders-react, loaded after the first paint. Three states:
     - always there, from the server: a static CSS gradient in the same colours (the fallback, and what is shown
       before the shader arrives, with 'vypnuto', without WebGL, or in a browser that blocks it);
     - 'plné':    the shader runs, paused while the band is off-screen or the tab is hidden;
     - 'omezené': the shader draws ONE still frame (speed 0), nothing moves.
   The accent is a prop (the public site's orange, or the staff app's chosen colour in the lab); the palette around
   it is derived, so a new accent needs no new design.
   ══════════════════════════════════════════════════════════════ */

import { Component, useEffect, useRef, useState } from 'react';
import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { STAGE, afterFirstPaintPlus } from './idle';
import { useMotionPreference } from './useMotionPreference';
import type { ShaderBackdropInnerProps, ShaderKind } from './ShaderBackdropInner';

export type { ShaderKind } from './ShaderBackdropInner';

function parse(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0xf0912e;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Linear mix of two #rrggbb colours, t = 0..1. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`;
}

/** The palette around an accent on a dark base: deep, accent shades, a glint. */
export function paletteFor(accent: string, base = '#0E1013'): { base: string; deep: string; mid: string; accent: string; glint: string } {
  return {
    base,
    deep: mix(base, accent, 0.18),
    mid: mix(base, accent, 0.5),
    accent,
    glint: mix(accent, '#ffffff', 0.35),
  };
}

/** The CSS fallback: the same colours as a still gradient. */
export function fallbackBackground(accent: string, base = '#0E1013'): string {
  const p = paletteFor(accent, base);
  return [
    `radial-gradient(60% 70% at 78% 18%, ${p.mid}66 0%, transparent 62%)`,
    `radial-gradient(48% 60% at 12% 92%, ${p.deep} 0%, transparent 70%)`,
    `radial-gradient(40% 50% at 92% 88%, ${p.accent}33 0%, transparent 70%)`,
    p.base,
  ].join(', ');
}

/** WebGL can be drawn in this browser (a headless one, a blocked GPU, a very old phone: no). */
export function webglAvailable(): boolean {
  if (typeof document === 'undefined' || typeof WebGLRenderingContext === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** A shader that fails while drawing must not take the page down: the CSS fallback underneath simply stays. */
class Contain extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export interface ShaderBackdropProps {
  kind?: ShaderKind;
  /** The accent colour the field is tinted with. */
  accent?: string;
  base?: string;
  /** 0..1, how visible the shader is over the base. */
  opacity?: number;
  className?: string;
  style?: CSSProperties;
}

export function ShaderBackdrop({ kind = 'mesh', accent = '#F0912E', base = '#0E1013', opacity = 1, className, style }: ShaderBackdropProps) {
  const { mode } = useMotionPreference();
  const hostRef = useRef<HTMLDivElement>(null);
  const [Inner, setInner] = useState<ComponentType<ShaderBackdropInnerProps> | null>(null);
  const [onScreen, setOnScreen] = useState(false);
  /* A band far down the page does not start its WebGL context (and download the shader code) until it is nearly in view. */
  const [near, setNear] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);

  // Load the shader code only when it will be drawn.
  useEffect(() => {
    if (mode === 'vypnuto' || !near || !webglAvailable()) return undefined;
    let cancelled = false;
    void afterFirstPaintPlus(STAGE.shaders).then(async () => {
      try {
        const module = await import('./ShaderBackdropInner');
        if (!cancelled) setInner(() => module.default);
      } catch {
        /* the CSS fallback stays */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mode, near]);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      setOnScreen(entry.isIntersecting);
      if (entry.isIntersecting) setNear(true);
    }, { rootMargin: '5% 0px' });
    const early = new IntersectionObserver(([entry]) => entry.isIntersecting && setNear(true), { rootMargin: '60% 0px' });
    observer.observe(host);
    early.observe(host);
    const onVisibility = () => setTabVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      early.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const moving = mode === 'plné' && onScreen && tabVisible;
  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      data-sm-shader={Inner !== null && mode !== 'vypnuto' ? 'on' : 'fallback'}
      className={className}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', background: fallbackBackground(accent, base), ...style }}
    >
      {Inner !== null && mode !== 'vypnuto' && (
        <div style={{ position: 'absolute', inset: 0, opacity, transition: 'opacity 900ms ease' }}>
          <Contain>
            <Inner kind={kind} palette={paletteFor(accent, base)} accent={accent} moving={moving} />
          </Contain>
        </div>
      )}
    </div>
  );
}
