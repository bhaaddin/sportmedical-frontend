import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlannerStage } from './PlannerStage';
import { usePlannerMetrics } from './PlannerMetrics';

/*
 * The stage observes its host: whatever box the host has (a window resize, browser zoom, the shell's menu ...) is what the
 * stage is fitted into - W' x H' published as CSS variables and in the context, frame = the host, no band left over.
 */

let room = { width: 2000, height: 941 };
let observed: (() => void) | null = null;

class FakeResizeObserver {
  constructor(callback: () => void) {
    observed = callback;
  }
  observe() {}
  disconnect() {
    observed = null;
  }
  unobserve() {}
}

beforeEach(() => {
  room = { width: 2000, height: 941 };
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) => {
    const cs = real(el, pseudo);
    if (!(el instanceof HTMLElement) || el.dataset.testid !== 'planner-root') return cs;
    return new Proxy(cs, {
      get(target, prop) {
        if (prop === 'width') return `${room.width}px`;
        if (prop === 'height') return `${room.height}px`;
        const value = Reflect.get(target, prop, target) as unknown;
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
      },
    });
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function Probe() {
  const { stage } = usePlannerMetrics();
  return <i data-testid="probe" data-w={stage.width.toFixed(2)} data-h={stage.height.toFixed(2)} data-s={stage.scale.toFixed(4)} />;
}

const root = () => document.querySelector<HTMLElement>('[data-testid=planner-root]')!;
const frame = () => document.getElementById('screen-frame')!;
const dash = () => document.getElementById('dashboard')!;

describe('PlannerStage fills the room it measures', () => {
  it('a wide room: the stage is as wide as the room, as tall as the file, the frame IS the room', () => {
    render(<PlannerStage layout="desktop"><Probe /></PlannerStage>);
    expect(root().style.getPropertyValue('--stage-w')).toBe('2000px');
    expect(root().style.getPropertyValue('--stage-h')).toBe('941px');
    expect(root().dataset.scale).toBe('1.0000');
    expect(frame().style.width).toBe('2000px');
    expect(frame().style.height).toBe('941px');
    expect(dash().style.width).toBe('2000px');
    expect(dash().style.height).toBe('941px');
    expect(dash().style.transform).toBe('scale(1)');
    expect(document.querySelector<HTMLElement>('[data-testid=probe]')!.dataset.w).toBe('2000.00');
  });

  it('at the file\'s aspect ratio it is exactly the file: 1672 x 941', () => {
    room = { width: 1672, height: 941 };
    render(<PlannerStage layout="desktop"><Probe /></PlannerStage>);
    expect(root().style.getPropertyValue('--stage-w')).toBe('1672px');
    expect(root().style.getPropertyValue('--stage-h')).toBe('941px');
    expect(root().dataset.scale).toBe('1.0000');
  });

  it('re-measures when the host changes: a taller, narrower room heightens the stage and scales it down', () => {
    render(<PlannerStage layout="desktop"><Probe /></PlannerStage>);
    expect(observed).not.toBeNull();
    room = { width: 1252, height: 1000 }; // width is the limit now
    act(() => observed!());
    const s = 1252 / 1672;
    expect(root().dataset.scale).toBe(s.toFixed(4));
    expect(Number.parseFloat(root().style.getPropertyValue('--stage-w'))).toBeCloseTo(1672, 6);
    expect(Number.parseFloat(root().style.getPropertyValue('--stage-h'))).toBeCloseTo(1000 / s, 6);
    expect(frame().style.width).toBe('1252px');
    expect(frame().style.height).toBe('1000px');
    expect(Number.parseFloat(dash().style.height) * s).toBeCloseTo(1000, 6);
    expect(document.querySelector<HTMLElement>('[data-testid=probe]')!.dataset.h).toBe((1000 / s).toFixed(2));
    // and back: the stage never keeps a size the room no longer has
    room = { width: 2560, height: 1440 };
    act(() => observed!());
    expect(frame().style.width).toBe('2560px');
    expect(frame().style.height).toBe('1440px');
    expect(Number.parseFloat(dash().style.width) * (2560 / 1672 < 1440 / 941 ? 2560 / 1672 : 1440 / 941)).toBeCloseTo(2560, 5);
  });

  it('an unmeasurable host (jsdom, hidden) is the file\'s stage, a fixed scale is the file at that scale', () => {
    room = { width: 0, height: 0 };
    const { unmount } = render(<PlannerStage layout="desktop"><Probe /></PlannerStage>);
    expect(dash().style.width).toBe('1672px');
    expect(dash().style.height).toBe('941px');
    unmount();
    render(<PlannerStage layout="desktop" scale={0.5}><Probe /></PlannerStage>);
    expect(frame().style.width).toBe('836px');
    expect(dash().style.width).toBe('1672px');
    expect(dash().style.transform).toBe('scale(0.5)');
  });

  it('tablet and phone are not fluid: no stage size, no transform, no variables', () => {
    render(<PlannerStage layout="tablet"><Probe /></PlannerStage>);
    expect(root().style.getPropertyValue('--stage-w')).toBe('');
    expect(dash().style.transform).toBe('');
    expect(frame().style.width).toBe('');
  });
});
