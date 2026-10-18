import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function load() {
  vi.resetModules();
  return await import('./prefetchRoutes');
}

let calls: [string, boolean | undefined][];
beforeEach(() => {
  calls = [];
  window.__smPrefetch = (path, portal) => void calls.push([path, portal]);
  document.body.innerHTML = '';
});
afterEach(() => {
  delete window.__smPrefetch;
  vi.useRealTimers();
});

describe('likelyNext', () => {
  it('expects the overview after the sign-in page, and the calendar after the overview', async () => {
    const { likelyNext } = await load();
    expect(likelyNext('/login')[0]).toEqual({ path: '/prehled', portal: true });
    expect(likelyNext('/prehled').map((n) => n.path)).toContain('/planovani');
    expect(likelyNext('/clubs').map((n) => n.path)).toEqual(['/planovani']);
  });
  it('guesses nothing for a screen it does not know, and never an address with a patient or a club in it', async () => {
    const { likelyNext } = await load();
    expect(likelyNext('/settings')).toEqual([]);
    for (const path of ['/login', '/prehled', '/planovani', '/clubs', '/patients']) {
      for (const next of likelyNext(path)) expect(next.path).not.toMatch(/[0-9a-f]{8}-/);
    }
  });
});

describe('prefetchScreen', () => {
  it('asks once per address', async () => {
    const { prefetchScreen } = await load();
    prefetchScreen('/planovani');
    prefetchScreen('/planovani');
    prefetchScreen('/clubs');
    expect(calls).toEqual([['/planovani', false], ['/clubs', false]]);
  });
  it('is a no-op when the page has no list of files (the dev server, a test)', async () => {
    delete window.__smPrefetch;
    const { prefetchScreen } = await load();
    expect(() => prefetchScreen('/planovani')).not.toThrow();
  });
  it('never lets a failing hint become an error', async () => {
    window.__smPrefetch = () => {
      throw new Error('boom');
    };
    const { prefetchScreen } = await load();
    expect(() => prefetchScreen('/planovani')).not.toThrow();
  });
});

describe('internalPath', () => {
  const anchor = (html: string) => {
    document.body.innerHTML = html;
    return document.querySelector('a') as HTMLAnchorElement;
  };
  it('reads the address of a link inside the site, without query or hash', async () => {
    const { internalPath } = await load();
    expect(internalPath(anchor('<a href="/clubs?x=1#top">x</a>'))).toBe('/clubs');
  });
  it('ignores another site, a protocol-relative address, a new tab and a plain fragment', async () => {
    const { internalPath } = await load();
    expect(internalPath(anchor('<a href="https://example.test/">x</a>'))).toBeNull();
    expect(internalPath(anchor('<a href="//example.test/x">x</a>'))).toBeNull();
    expect(internalPath(anchor('<a href="/clubs" target="_blank">x</a>'))).toBeNull();
    expect(internalPath(anchor('<a href="#top">x</a>'))).toBeNull();
  });
});

describe('connectionAllowsPrefetch', () => {
  const setConnection = (value: unknown) => Object.defineProperty(navigator, 'connection', { value, configurable: true });
  afterEach(() => setConnection(undefined));
  it('is on by default and off for save-data and 2g', async () => {
    const { connectionAllowsPrefetch } = await load();
    setConnection(undefined);
    expect(connectionAllowsPrefetch()).toBe(true);
    setConnection({ effectiveType: '4g' });
    expect(connectionAllowsPrefetch()).toBe(true);
    setConnection({ saveData: true, effectiveType: '4g' });
    expect(connectionAllowsPrefetch()).toBe(false);
    setConnection({ effectiveType: 'slow-2g' });
    expect(connectionAllowsPrefetch()).toBe(false);
    setConnection({ effectiveType: '2g' });
    expect(connectionAllowsPrefetch()).toBe(false);
  });
});

describe('startPrefetching', () => {
  it('fetches the link the pointer arrives on, and stops listening when told to', async () => {
    const { startPrefetching } = await load();
    document.body.innerHTML = '<nav><a href="/planovani"><span id="inner">Kalendář</span></a></nav>';
    const stop = startPrefetching('/zzz');
    document.getElementById('inner')!.dispatchEvent(new Event('pointerover', { bubbles: true }));
    expect(calls).toEqual([['/planovani', false]]);
    stop();
    document.getElementById('inner')!.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(calls).toHaveLength(1);
  });

  it('fetches the likely next screens only after the page is quiet (grace period), not at once', async () => {
    vi.useFakeTimers();
    const { startPrefetching, PREFETCH_GRACE_MS } = await load();
    const stop = startPrefetching('/prehled');
    await vi.advanceTimersByTimeAsync(500);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(PREFETCH_GRACE_MS + 5_000);
    expect(calls.map((c) => c[0])).toEqual(['/planovani', '/clubs', '/patients']);
    stop();
  });

  it('does nothing on a connection told to save data', async () => {
    Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
    const { startPrefetching } = await load();
    document.body.innerHTML = '<a href="/planovani">x</a>';
    const stop = startPrefetching('/prehled');
    document.querySelector('a')!.dispatchEvent(new Event('pointerover', { bubbles: true }));
    expect(calls).toHaveLength(0);
    stop();
    Object.defineProperty(navigator, 'connection', { value: undefined, configurable: true });
  });
});
