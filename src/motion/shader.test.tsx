import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MOTION_STORAGE_KEY, resetMotionStoreForTests } from './preference';
import type { MotionPreference } from './preference';

const fake = vi.hoisted(() => ({ props: [] as { kind: string; moving: boolean; accent: string }[] }));
vi.mock('./ShaderBackdropInner', () => ({
  default: (props: { kind: string; moving: boolean; accent: string }) => {
    fake.props.push(props);
    return <canvas data-testid="shader" />;
  },
}));
vi.mock('../utils/afterFirstPaint', () => ({ afterFirstPaint: () => Promise.resolve() }));
vi.mock('./idle', () => ({ afterFirstPaintPlus: () => Promise.resolve(), STAGE: { scenes: 0, smoothScroll: 0, shaders: 0 } }));

import { ShaderBackdrop, fallbackBackground, mix, paletteFor, webglAvailable } from './ShaderBackdrop';

function setMode(mode: MotionPreference | null) {
  window.localStorage.clear();
  if (mode !== null) window.localStorage.setItem(MOTION_STORAGE_KEY, mode);
  resetMotionStoreForTests();
}
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

/** An IntersectionObserver the test controls: `reveal()` reports every observed element as intersecting. */
const observers: { cb: (entries: { isIntersecting: boolean }[]) => void }[] = [];
function stubEnvironment({ webgl }: { webgl: boolean }) {
  observers.length = 0;
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
      observers.push({ cb });
    }
    observe() {}
    disconnect() {}
  });
  if (webgl) {
    vi.stubGlobal('WebGLRenderingContext', class {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
  } else {
    vi.stubGlobal('WebGLRenderingContext', undefined);
  }
}
const reveal = () => act(async () => { observers.forEach((o) => o.cb([{ isIntersecting: true }])); });

beforeEach(() => { fake.props.length = 0; });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  resetMotionStoreForTests();
});

describe('ShaderBackdrop', () => {
  it('always draws the CSS fallback in the same colours, from the server render on', () => {
    stubEnvironment({ webgl: true });
    setMode('plné');
    render(<ShaderBackdrop accent="#F0912E" />);
    const host = document.querySelector('[data-sm-shader]') as HTMLElement;
    expect(host.getAttribute('data-sm-shader')).toBe('fallback');
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.style.background).toContain('radial-gradient');
    expect(fallbackBackground('#F0912E')).toContain('#F0912E33');
  });

  it("starts the shader only when WebGL exists and the band is nearly in view; runs it under 'plné' and draws one still under 'omezené'", async () => {
    stubEnvironment({ webgl: true });
    setMode('plné');
    render(<ShaderBackdrop kind="swirl" accent="#0D5C52" />);
    await flush();
    expect(screen.queryByTestId('shader')).toBeNull(); // not near yet: no WebGL context, no download
    await reveal();
    await flush();
    expect(screen.getByTestId('shader')).toBeTruthy();
    expect(fake.props.at(-1)).toMatchObject({ kind: 'swirl', moving: true, accent: '#0D5C52' });
    cleanup();
    fake.props.length = 0;
    setMode('omezené');
    render(<ShaderBackdrop />);
    await reveal();
    await flush();
    expect(fake.props.at(-1)?.moving).toBe(false);
  });

  it("never loads the shader under 'vypnuto', nor without WebGL", async () => {
    stubEnvironment({ webgl: true });
    setMode('vypnuto');
    render(<ShaderBackdrop />);
    await reveal();
    await flush();
    expect(screen.queryByTestId('shader')).toBeNull();
    cleanup();
    stubEnvironment({ webgl: false });
    setMode('plné');
    render(<ShaderBackdrop />);
    await reveal();
    await flush();
    expect(screen.queryByTestId('shader')).toBeNull();
    expect(webglAvailable()).toBe(false);
  });

  it('derives a palette from the accent and mixes colours linearly', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#102030', '#102030', 0.7)).toBe('#102030');
    const palette = paletteFor('#EA580C', '#0E1013');
    expect(palette.accent).toBe('#EA580C');
    expect(palette.base).toBe('#0E1013');
    expect(palette.glint).not.toBe(palette.accent);
  });
});
