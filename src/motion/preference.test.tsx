import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MOTION_ATTR,
  MOTION_MODES,
  MOTION_STORAGE_KEY,
  allowanceFor,
  parseMotionPreference,
  resetMotionStoreForTests,
  resolveMotion,
  setMotionPreference,
} from './preference';
import { useMotionPreference } from './useMotionPreference';

/** A matchMedia that answers the reduce-motion query with `reduce` and lets a test flip it. */
function mockMedia(initial: boolean) {
  let reduce = initial;
  const listeners = new Set<() => void>();
  window.matchMedia = ((query: string) => ({
    media: query,
    get matches() {
      return query.includes('prefers-reduced-motion') ? reduce : false;
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return {
    flip(next: boolean) {
      reduce = next;
      listeners.forEach((fn) => fn());
    },
  };
}

function Probe() {
  const state = useMotionPreference();
  return <output data-testid="p">{`${state.mode}|${state.cinematic}|${state.micro}|${state.fades}|${state.reduced}|${state.off}`}</output>;
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-motion');
  resetMotionStoreForTests();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('parseMotionPreference / resolveMotion', () => {
  it('accepts the three states and nothing else', () => {
    for (const mode of MOTION_MODES) expect(parseMotionPreference(mode)).toBe(mode);
    for (const junk of ['full', 'PLNÉ', 'plne', '', ' vypnuto', 'null', null, undefined, 3, {}, ['vypnuto']]) expect(parseMotionPreference(junk)).toBeNull();
  });

  it('a stored choice wins over the system; nothing stored follows the system', () => {
    expect(resolveMotion(null, false)).toBe('plné');
    expect(resolveMotion(null, true)).toBe('vypnuto');
    expect(resolveMotion('plné', true)).toBe('plné');
    expect(resolveMotion('omezené', false)).toBe('omezené');
    expect(resolveMotion('vypnuto', false)).toBe('vypnuto');
  });

  it('allows travel only in the full state and nothing at all when off', () => {
    expect(allowanceFor('plné')).toEqual({ fades: true, micro: true, cinematic: true });
    expect(allowanceFor('omezené')).toEqual({ fades: true, micro: true, cinematic: false });
    expect(allowanceFor('vypnuto')).toEqual({ fades: false, micro: false, cinematic: false });
  });
});

describe('useMotionPreference', () => {
  it('follows the operating system when nothing is stored (reduce -> off, else full)', () => {
    mockMedia(true);
    render(<Probe />);
    expect(screen.getByTestId('p').textContent).toBe('vypnuto|false|false|false|true|true');
    expect(document.documentElement.getAttribute('data-motion')).toBe('off');
    cleanup();
    resetMotionStoreForTests();
    mockMedia(false);
    render(<Probe />);
    expect(screen.getByTestId('p').textContent).toBe('plné|true|true|true|false|false');
    expect(document.documentElement.getAttribute('data-motion')).toBe('full');
  });

  it('uses the stored value over the system, in both directions', () => {
    mockMedia(true);
    window.localStorage.setItem(MOTION_STORAGE_KEY, 'plné');
    render(<Probe />);
    expect(screen.getByTestId('p').textContent?.startsWith('plné|true')).toBe(true);
    cleanup();
    resetMotionStoreForTests();
    mockMedia(false);
    window.localStorage.setItem(MOTION_STORAGE_KEY, 'omezené');
    render(<Probe />);
    expect(screen.getByTestId('p').textContent).toBe('omezené|false|true|true|true|false');
    expect(document.documentElement.getAttribute('data-motion')).toBe('reduced');
  });

  it('treats a junk stored value as nothing stored', () => {
    mockMedia(false);
    window.localStorage.setItem(MOTION_STORAGE_KEY, 'zrychleno');
    render(<Probe />);
    expect(screen.getByTestId('p').textContent?.startsWith('plné')).toBe(true);
    cleanup();
    resetMotionStoreForTests();
    mockMedia(true);
    render(<Probe />);
    expect(screen.getByTestId('p').textContent?.startsWith('vypnuto')).toBe(true);
  });

  it('applies a choice at once, stores it, and mirrors it on <html>', () => {
    mockMedia(false);
    render(<Probe />);
    act(() => setMotionPreference('vypnuto'));
    expect(screen.getByTestId('p').textContent?.startsWith('vypnuto')).toBe(true);
    expect(window.localStorage.getItem(MOTION_STORAGE_KEY)).toBe('vypnuto');
    expect(document.documentElement.getAttribute('data-motion')).toBe('off');
    act(() => setMotionPreference(null));
    expect(window.localStorage.getItem(MOTION_STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId('p').textContent?.startsWith('plné')).toBe(true);
  });

  it('follows another tab (storage event) and a change of the system setting', () => {
    const media = mockMedia(false);
    render(<Probe />);
    act(() => {
      window.localStorage.setItem(MOTION_STORAGE_KEY, 'omezené');
      window.dispatchEvent(new StorageEvent('storage', { key: MOTION_STORAGE_KEY, newValue: 'omezené' }));
    });
    expect(screen.getByTestId('p').textContent?.startsWith('omezené')).toBe(true);
    act(() => {
      window.localStorage.removeItem(MOTION_STORAGE_KEY);
      window.dispatchEvent(new StorageEvent('storage', { key: MOTION_STORAGE_KEY, newValue: null }));
    });
    expect(screen.getByTestId('p').textContent?.startsWith('plné')).toBe(true);
    act(() => media.flip(true));
    expect(screen.getByTestId('p').textContent?.startsWith('vypnuto')).toBe(true);
  });

  it('keeps a choice for the visit when the browser refuses storage', () => {
    mockMedia(false);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    render(<Probe />);
    act(() => setMotionPreference('vypnuto'));
    expect(screen.getByTestId('p').textContent?.startsWith('vypnuto')).toBe(true);
  });
});

/* The inline script in index.html sets <html data-motion> before the first paint. It must agree with resolveMotion(). */
describe('the pre-paint script in index.html', () => {
  const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
  const script = /<script data-sm-motion>([\s\S]*?)<\/script>/.exec(html)?.[1];

  it('exists in the template (so every prerendered page carries it)', () => {
    expect(script).toBeTruthy();
  });

  it.each([
    [null, false],
    [null, true],
    ['plné', false],
    ['plné', true],
    ['omezené', false],
    ['omezené', true],
    ['vypnuto', false],
    ['vypnuto', true],
    ['rychle', false],
    ['rychle', true],
  ])('stored %s, system reduce %s -> the same state as resolveMotion', (stored, osReduce) => {
    mockMedia(osReduce);
    window.localStorage.clear();
    if (stored !== null) window.localStorage.setItem(MOTION_STORAGE_KEY, stored);
    document.documentElement.removeAttribute('data-motion');
    new Function(script!)();
    const expected = MOTION_ATTR[resolveMotion(parseMotionPreference(stored), osReduce)];
    expect(document.documentElement.getAttribute('data-motion')).toBe(expected);
  });

  it('still answers when storage and matchMedia both throw (defaults to full)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    window.matchMedia = (() => {
      throw new Error('no media');
    }) as unknown as typeof window.matchMedia;
    document.documentElement.removeAttribute('data-motion');
    new Function(script!)();
    expect(document.documentElement.getAttribute('data-motion')).toBe('full');
  });
});
