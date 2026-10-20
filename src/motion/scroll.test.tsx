import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MOTION_STORAGE_KEY, resetMotionStoreForTests } from './preference';
import type { MotionPreference } from './preference';

const fake = vi.hoisted(() => {
  const revert = vi.fn();
  const mmRevert = vi.fn();
  const gsap = {
    context: vi.fn((fn: () => void) => {
      fn();
      return { revert };
    }),
    matchMedia: vi.fn(() => ({ add: vi.fn(), revert: mmRevert })),
  };
  const ScrollTrigger = { refresh: vi.fn(), update: vi.fn() };
  const lenis = { ctor: vi.fn(), destroy: vi.fn(), on: vi.fn(() => () => undefined) };
  return { revert, mmRevert, gsap, ScrollTrigger, lenis };
});

vi.mock('./gsapVendor', () => ({ gsap: fake.gsap, ScrollTrigger: fake.ScrollTrigger }));
vi.mock('lenis', () => ({
  default: class {
    constructor(options: unknown) {
      fake.lenis.ctor(options);
    }
    on = fake.lenis.on;
    destroy = fake.lenis.destroy;
  },
}));
vi.mock('../utils/afterFirstPaint', () => ({ afterFirstPaint: () => Promise.resolve() }));
vi.mock('./idle', () => ({ afterFirstPaintPlus: () => Promise.resolve(), STAGE: { scenes: 0, smoothScroll: 0, shaders: 0 } }));

import { ScrollScene } from './ScrollScene';
import { LenisProvider } from './LenisProvider';

function setMode(mode: MotionPreference | null) {
  window.localStorage.clear();
  if (mode !== null) window.localStorage.setItem(MOTION_STORAGE_KEY, mode);
  resetMotionStoreForTests();
}
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

function media(finePointer: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('hover: hover') ? finePointer : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.clearAllMocks();
  media(true);
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  resetMotionStoreForTests();
});

describe('ScrollScene', () => {
  it("does nothing - not even loading the scene - unless the setting is 'plné'", async () => {
    for (const mode of ['omezené', 'vypnuto'] as const) {
      setMode(mode);
      const loader = vi.fn(() => Promise.resolve({ default: vi.fn() }));
      const { unmount } = render(<ScrollScene scene={loader} data-testid="s">x</ScrollScene>);
      await flush();
      expect(loader).not.toHaveBeenCalled();
      expect(screen.getByTestId('s').hasAttribute('data-scene')).toBe(false);
      unmount();
    }
    expect(fake.gsap.context).not.toHaveBeenCalled();
  });

  it("runs the scene after the first paint under 'plné', marks the root, and reverts everything on unmount", async () => {
    setMode('plné');
    const scene = vi.fn();
    const { unmount } = render(<ScrollScene scene={() => Promise.resolve({ default: scene })} data-testid="s">x</ScrollScene>);
    expect(scene).not.toHaveBeenCalled(); // the first render is the plain page
    await flush();
    expect(scene).toHaveBeenCalledTimes(1);
    const context = scene.mock.calls[0][0];
    expect(context.root).toBe(screen.getByTestId('s'));
    expect(context.gsap).toBe(fake.gsap);
    expect(screen.getByTestId('s').getAttribute('data-scene')).toBe('ready');
    unmount();
    expect(fake.revert).toHaveBeenCalled();
    expect(fake.mmRevert).toHaveBeenCalled();
  });

  it('rebuilds when the route key changes', async () => {
    setMode('plné');
    const scene = vi.fn();
    const loader = () => Promise.resolve({ default: scene });
    const { rerender } = render(<ScrollScene scene={loader} sceneKey="/">x</ScrollScene>);
    await flush();
    rerender(<ScrollScene scene={loader} sceneKey="/cenik">x</ScrollScene>);
    await flush();
    expect(scene).toHaveBeenCalledTimes(2);
    expect(fake.revert).toHaveBeenCalledTimes(1);
  });

  it('leaves the page as it was, marked failed, when a scene throws', async () => {
    setMode('plné');
    render(<ScrollScene scene={() => Promise.reject(new Error('chunk failed'))} data-testid="s">x</ScrollScene>);
    await flush();
    expect(screen.getByTestId('s').getAttribute('data-scene')).toBe('failed');
  });
});

describe('LenisProvider', () => {
  it("starts smooth scroll under 'plné' with a mouse, and stops it on unmount", async () => {
    setMode('plné');
    const { unmount } = render(<LenisProvider />);
    await flush();
    await flush();
    expect(fake.lenis.ctor).toHaveBeenCalledTimes(1);
    unmount();
    expect(fake.lenis.destroy).toHaveBeenCalled();
  });

  it("never starts on a touch screen, nor under 'omezené' or 'vypnuto'", async () => {
    setMode('plné');
    media(false);
    const touch = render(<LenisProvider />);
    await flush();
    await flush();
    expect(fake.lenis.ctor).not.toHaveBeenCalled();
    touch.unmount();
    media(true);
    for (const mode of ['omezené', 'vypnuto'] as const) {
      setMode(mode);
      const view = render(<LenisProvider />);
      await flush();
      await flush();
      expect(fake.lenis.ctor).not.toHaveBeenCalled();
      view.unmount();
    }
  });
});
