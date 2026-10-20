import { afterEach, describe, expect, it } from 'vitest';
import { canAnimate, loadMotion, motionIfLoaded, resetEngineForTests } from './engine';

const settled = (promise: Promise<unknown>) => Promise.race([promise.then(() => 'loaded'), new Promise((resolve) => setTimeout(() => resolve('never'), 60))]);

afterEach(() => {
  delete (Element.prototype as unknown as { animate?: unknown }).animate;
  resetEngineForTests();
});

describe('the lazy handle on motion', () => {
  it('does nothing where the browser cannot run Web Animations (jsdom, a very old browser): the promise never settles, so nothing is armed', async () => {
    expect(canAnimate()).toBe(false);
    expect(await settled(loadMotion())).toBe('never');
    expect(motionIfLoaded()).toBeNull();
  });

  it('loads the three functions the kit uses once Web Animations exist', async () => {
    (Element.prototype as unknown as { animate: () => void }).animate = () => undefined;
    expect(canAnimate()).toBe(true);
    expect(motionIfLoaded()).toBeNull(); // not before it has been asked for
    const api = await loadMotion();
    expect(typeof api.animate).toBe('function');
    expect(typeof api.inView).toBe('function');
    expect(typeof api.stagger).toBe('function');
    expect(motionIfLoaded()).toBe(api);
    expect(await loadMotion()).toBe(api); // one download, however many askers
  });
});
