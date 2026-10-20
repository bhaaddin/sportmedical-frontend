import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MOTION_STORAGE_KEY, resetMotionStoreForTests } from './preference';
import type { MotionPreference } from './preference';

/* ── a stand-in for the lazily loaded `motion` library, so the primitives can be observed ── */
const fake = vi.hoisted(() => {
  const state = { loaded: true, loads: 0 };
  const done = () => Promise.resolve();
  const animate = vi.fn((target: unknown, _kf?: unknown, options?: { onUpdate?: (n: number) => void; onComplete?: () => void }) => {
    if (typeof target === 'number') {
      options?.onUpdate?.(Math.round(_kf as number) / 2);
      options?.onComplete?.();
      return { stop: vi.fn(), then: (fn: () => void) => Promise.resolve().then(fn) };
    }
    return done();
  });
  const inViewCallbacks: (() => void)[] = [];
  const inView = vi.fn((_el: unknown, cb: () => void) => {
    inViewCallbacks.push(cb);
    return vi.fn();
  });
  const api = { animate, inView, stagger: vi.fn((step: number) => ({ stagger: step })) };
  return { state, api, inViewCallbacks };
});

vi.mock('./engine', () => ({
  loadMotion: vi.fn(() => {
    fake.state.loads += 1;
    return Promise.resolve(fake.api);
  }),
  motionIfLoaded: vi.fn(() => (fake.state.loaded ? fake.api : null)),
  warmMotion: vi.fn(),
  canObserve: () => true,
  resetEngineForTests: vi.fn(),
}));
vi.mock('../utils/afterFirstPaint', () => ({ afterFirstPaint: () => Promise.resolve() }));

import { Reveal, Stagger } from './Reveal';
import { PopIn, PresenceList, mergeEntries } from './Presence';
import { CountUp } from './CountUp';
import { PageTransition } from './PageTransition';
import { PressScale } from './PressScale';
import { Magnetic, Tilt } from './Magnetic';
import { Parallax } from './Parallax';
import { KineticLines, LightWords } from './KineticText';

function setMode(mode: MotionPreference | null) {
  window.localStorage.clear();
  if (mode !== null) window.localStorage.setItem(MOTION_STORAGE_KEY, mode);
  resetMotionStoreForTests();
}

/** Lets the dynamic-import promise chains of the primitives run. */
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

const rect = (top: number) => ({ top, bottom: top + 100, left: 0, right: 100, width: 100, height: 100, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;

beforeEach(() => {
  fake.state.loaded = true;
  fake.state.loads = 0;
  fake.api.animate.mockClear();
  fake.api.inView.mockClear();
  fake.inViewCallbacks.length = 0;
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 800 });
  window.matchMedia = ((query: string) => ({
    matches: query.includes('hover: hover') || query.includes('pointer: fine'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => rect(2000));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
  resetMotionStoreForTests();
});

describe('Reveal / Stagger', () => {
  it("'vypnuto': never loads the library and never writes a style", async () => {
    setMode('vypnuto');
    render(<Reveal data-testid="r">hello</Reveal>);
    await flush();
    const el = screen.getByTestId('r');
    expect(fake.state.loads).toBe(0);
    expect(el.getAttribute('style')).toBeNull();
    expect(fake.api.animate).not.toHaveBeenCalled();
  });

  it("'plné': hides what is below the fold, then animates it in when it enters the view, then cleans up", async () => {
    setMode('plné');
    render(<Reveal data-testid="r" variant="rise">hello</Reveal>);
    await flush();
    const el = screen.getByTestId('r');
    expect(el.style.opacity).toBe('0');
    expect(el.style.transform).toContain('translateY');
    expect(fake.api.inView).toHaveBeenCalledTimes(1);
    await act(async () => { fake.inViewCallbacks[0](); });
    expect(fake.api.animate).toHaveBeenCalledTimes(1);
    await flush();
    expect(el.style.opacity).toBe('');
    expect(el.style.transform).toBe('');
  });

  it("'omezené': a fade only - no transform is ever written", async () => {
    setMode('omezené');
    render(<Reveal data-testid="r" variant="left" as="section">hello</Reveal>);
    await flush();
    const el = screen.getByTestId('r');
    expect(el.style.opacity).toBe('0');
    expect(el.style.transform).toBe('');
    await act(async () => { fake.inViewCallbacks[0](); });
    const keyframes = fake.api.animate.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(keyframes)).toEqual(['opacity']);
  });

  it('leaves whatever is already in view alone (no flash)', async () => {
    setMode('plné');
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => rect(120));
    render(<Reveal data-testid="r">hello</Reveal>);
    await flush();
    expect(screen.getByTestId('r').getAttribute('style')).toBeNull();
    expect(fake.api.inView).not.toHaveBeenCalled();
  });

  it('Stagger animates the children one after another and not the container', async () => {
    setMode('plné');
    render(
      <Stagger as="ul" data-testid="s" step={0.1}>
        <li>a</li>
        <li>b</li>
        <li>c</li>
      </Stagger>,
    );
    await flush();
    const items = screen.getByTestId('s').querySelectorAll('li');
    items.forEach((li) => expect(li.style.opacity).toBe('0'));
    expect(screen.getByTestId('s').style.opacity).toBe('');
    await act(async () => { fake.inViewCallbacks[0](); });
    expect((fake.api.animate.mock.calls[0][0] as HTMLElement[]).length).toBe(3);
    expect(fake.api.stagger).toHaveBeenCalledWith(0.1);
  });

  it("Stagger under 'vypnuto' writes nothing", async () => {
    setMode('vypnuto');
    render(<Stagger as="ul" data-testid="s"><li>a</li><li>b</li></Stagger>);
    await flush();
    screen.getByTestId('s').querySelectorAll('li').forEach((li) => expect(li.getAttribute('style')).toBeNull());
  });
});

describe('PopIn', () => {
  it("'plné': springs in from the pointer's origin and out again, then unmounts", async () => {
    setMode('plné');
    const exited = vi.fn();
    const { rerender } = render(<PopIn open origin={{ x: 10, y: 20 }} onExited={exited}><span data-testid="c">x</span></PopIn>);
    await flush();
    const kf = fake.api.animate.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(kf).sort()).toEqual(['opacity', 'scale']);
    expect((screen.getByTestId('c').parentElement as HTMLElement).style.transformOrigin).toContain('px');
    rerender(<PopIn open={false} origin={{ x: 10, y: 20 }} onExited={exited}><span data-testid="c">x</span></PopIn>);
    await flush();
    expect(fake.api.animate).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('c')).toBeNull();
    expect(exited).toHaveBeenCalled();
  });

  it("'omezené' fades without scale; 'vypnuto' neither animates nor waits to unmount", async () => {
    setMode('omezené');
    render(<PopIn open><span>x</span></PopIn>);
    await flush();
    expect(Object.keys(fake.api.animate.mock.calls[0][1] as object)).toEqual(['opacity']);
    cleanup();
    fake.api.animate.mockClear();
    setMode('vypnuto');
    const { rerender } = render(<PopIn open><span data-testid="c">x</span></PopIn>);
    await flush();
    rerender(<PopIn open={false}><span data-testid="c">x</span></PopIn>);
    await flush();
    expect(fake.api.animate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('c')).toBeNull();
  });
});

describe('PresenceList', () => {
  it('keeps a removed entry (leaving) in its old place', () => {
    const a = { key: 'a', item: 'A', leaving: false };
    const b = { key: 'b', item: 'B', leaving: false };
    const c = { key: 'c', item: 'C', leaving: false };
    const merged = mergeEntries([a, b, c], ['A', 'C'], (x) => x.toLowerCase());
    expect(merged.map((e) => `${e.key}${e.leaving ? '*' : ''}`)).toEqual(['a', 'b*', 'c']);
    expect(mergeEntries([a], ['A', 'Z'], (x) => x.toLowerCase()).map((e) => e.key)).toEqual(['a', 'z']);
  });

  it("removes at once under 'vypnuto'", async () => {
    setMode('vypnuto');
    const render1 = (items: string[]) => <PresenceList items={items} getKey={(x) => x} render={(x) => <span>{x}</span>} />;
    const { rerender } = render(render1(['a', 'b']));
    rerender(render1(['a']));
    await flush();
    expect(screen.queryByText('b')).toBeNull();
    expect(screen.getByText('a')).toBeTruthy();
  });

  it("collapses a removed entry before dropping it under 'plné'", async () => {
    setMode('plné');
    const render1 = (items: string[]) => <PresenceList items={items} getKey={(x) => x} render={(x) => <span>{x}</span>} />;
    const { rerender } = render(render1(['a', 'b']));
    rerender(render1(['a']));
    await flush();
    await flush();
    expect(fake.api.animate).toHaveBeenCalled();
    expect(screen.queryByText('b')).toBeNull();
  });
});

describe('CountUp', () => {
  it('shows the final number in every state but the full one', async () => {
    for (const mode of ['omezené', 'vypnuto'] as const) {
      setMode(mode);
      const { unmount } = render(<CountUp value={1234} />);
      await flush();
      expect(document.body.textContent).toContain('1 234');
      expect(fake.api.animate).not.toHaveBeenCalled();
      unmount();
    }
  });

  it("'plné': starts at 0, counts when it comes into view, ends on the value; a later value shows at once", async () => {
    setMode('plné');
    const { rerender, container } = render(<CountUp value={80} format={(n) => `${Math.round(n)} x`} />);
    expect(container.textContent).toBe('0 x');
    await act(async () => { fake.inViewCallbacks[0](); });
    expect(container.textContent).toBe('80 x');
    rerender(<CountUp value={95} format={(n) => `${Math.round(n)} x`} />);
    expect(container.textContent).toBe('95 x');
  });

  it('does not park a figure at 0 when the library is not loaded yet', async () => {
    setMode('plné');
    fake.state.loaded = false;
    const { container } = render(<CountUp value={80} format={(n) => `${Math.round(n)} x`} />);
    expect(container.textContent).toBe('80 x');
  });
});

describe('PageTransition', () => {
  const page = (key: string, personality?: 'staff' | 'site') => (
    <PageTransition routeKey={key} personality={personality}><span>page {key}</span></PageTransition>
  );

  it('never animates the first render, and a route change plays at most 180 ms for the staff', async () => {
    setMode('plné');
    const { rerender } = render(page('/a'));
    await flush();
    expect(fake.api.animate).not.toHaveBeenCalled();
    rerender(page('/b'));
    await flush();
    expect(fake.api.animate).toHaveBeenCalledTimes(1);
    const options = fake.api.animate.mock.calls[0][2] as { duration: number };
    expect(options.duration).toBeLessThanOrEqual(0.18);
  });

  it("is silent under 'vypnuto', a plain fade under 'omezené', longer on the public site", async () => {
    setMode('vypnuto');
    const { rerender } = render(page('/a'));
    rerender(page('/b'));
    await flush();
    expect(fake.api.animate).not.toHaveBeenCalled();
    cleanup();
    setMode('omezené');
    const second = render(page('/a'));
    second.rerender(page('/b'));
    await flush();
    expect(Object.keys(fake.api.animate.mock.calls[0][1] as object)).toEqual(['opacity']);
    cleanup();
    fake.api.animate.mockClear();
    setMode('plné');
    const third = render(page('/a', 'site'));
    third.rerender(page('/b', 'site'));
    await flush();
    expect((fake.api.animate.mock.calls[0][2] as { duration: number }).duration).toBeGreaterThan(0.18);
  });
});

describe('PressScale', () => {
  it('is a plain element with the sm-press class (the depth is the --sm-press variable, 1 when off)', () => {
    render(<PressScale data-testid="p" className="x" type="button">go</PressScale>);
    const el = screen.getByTestId('p');
    expect(el.tagName).toBe('BUTTON');
    expect(el.className).toBe('sm-press x');
    expect(el.getAttribute('style')).toBeNull();
  });
});

describe('Magnetic / Tilt / Parallax', () => {
  it("write no transform under 'vypnuto' or 'omezené' however the pointer moves", async () => {
    for (const mode of ['vypnuto', 'omezené'] as const) {
      setMode(mode);
      const { unmount } = render(
        <div>
          <Tilt data-testid="t">card</Tilt>
          <Magnetic data-testid="m">btn</Magnetic>
          <Parallax className="p"><img alt="" data-testid="img" /></Parallax>
        </div>,
      );
      await flush();
      fireEvent.pointerMove(screen.getByTestId('t'), { clientX: 10, clientY: 10 });
      fireEvent.pointerMove(window, { clientX: 10, clientY: 10 });
      fireEvent.scroll(window);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      expect(screen.getByTestId('t').style.transform).toBe('');
      expect(screen.getByTestId('m').style.transform).toBe('');
      expect((screen.getByTestId('img').parentElement as HTMLElement).style.transform).toBe('');
      expect((screen.getByTestId('img').parentElement as HTMLElement).style.willChange).toBe('');
      unmount();
    }
  });

  it("Tilt leans toward the pointer under 'plné' with a mouse, and lies flat again on leave", async () => {
    setMode('plné');
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ ...rect(0), left: 0, width: 200, height: 100, right: 200 }) as DOMRect);
    render(<Tilt data-testid="t">card</Tilt>);
    await flush();
    const el = screen.getByTestId('t');
    fireEvent.pointerMove(el, { clientX: 190, clientY: 10 });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 60)); });
    expect(el.style.transform).toContain('rotateY');
    fireEvent.pointerLeave(el);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1500)); });
    expect(el.style.transform).toBe('');
  });
});

describe('KineticLines / LightWords', () => {
  it('splits words into masked spans with their order, keeping the text and the line breaks', () => {
    const { container } = render(<h1><KineticLines text={'Sportovní lékařské\nprohlídky\na diagnostika'} accentLast accent="#F0912E" /></h1>);
    const words = container.querySelectorAll('.sm-kt-i');
    expect(Array.from(words).map((w) => w.textContent)).toEqual(['Sportovní', 'lékařské', 'prohlídky', 'a', 'diagnostika']);
    expect(Array.from(words).map((w) => (w as HTMLElement).style.getPropertyValue('--i'))).toEqual(['0', '1', '2', '3', '4']);
    expect(container.querySelectorAll('br').length).toBe(2);
    expect(container.textContent).toBe('Sportovní lékařsképrohlídkya diagnostika');
    expect(container.querySelector('span[style*="color"]')?.textContent).toBe('a diagnostika');
  });

  it('LightWords gives every word a span', () => {
    const { container } = render(<p><LightWords text={'Pohyb je lék.\nDruhý řádek'} /></p>);
    expect(Array.from(container.querySelectorAll('.sm-lw')).map((w) => w.textContent)).toEqual(['Pohyb', 'je', 'lék.', 'Druhý', 'řádek']);
  });
});
