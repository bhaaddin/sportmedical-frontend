import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { render } from './entry-server';
import { normalizeBootstrap } from './data';
import { TEST_PRICE_LIST } from './testUtils';
import { mountWeb } from './entry-client';

vi.mock('./http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./http')>();
  // The server went to sleep right after the build: every refresh fails.
  return { ...actual, webHttp: { get: () => Promise.reject(new Error('Network Error')) } };
});

/* The prerendered HTML must be adopted by the browser, not thrown away: hydration with the
   embedded snapshot must produce no mismatch, and the page stays interactive afterwards. */

let errors: ReturnType<typeof vi.spyOn>;
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

beforeEach(() => {
  errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  errors.mockRestore();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete window.__SM_WEB__;
});

describe('hydrating a prerendered page', () => {
  it.each(['/', '/cenik', '/kluby'])('adopts the server HTML of %s without a mismatch', async (path) => {
    const data = normalizeBootstrap({ priceList: TEST_PRICE_LIST }, 1);
    const result = render(path, data);

    // What the browser has when the prerendered file arrives.
    document.head.insertAdjacentHTML('beforeend', result.styles);
    document.body.innerHTML = '<div id="root" data-prerendered="1"></div>';
    const container = document.getElementById('root') as HTMLElement;
    container.innerHTML = result.html;
    window.__SM_WEB__ = result.data;
    window.history.pushState({}, '', path);
    const before = container.innerHTML;

    await act(async () => { mountWeb(container); });

    const mismatches = errors.mock.calls.filter((call: unknown[]) => /hydrat|did not match|mismatch/i.test(String(call[0])));
    expect(mismatches).toEqual([]);
    // The same DOM is still there (adopted, not rebuilt from nothing)...
    expect(container.querySelector('h1')).not.toBeNull();
    expect(container.innerHTML).toBe(before);
  });

  it('shows the snapshot prices after hydration even though the refresh failed', async () => {
    const data = normalizeBootstrap({ priceList: TEST_PRICE_LIST }, 1);
    const result = render('/', data);
    document.body.innerHTML = '<div id="root" data-prerendered="1"></div>';
    const container = document.getElementById('root') as HTMLElement;
    container.innerHTML = result.html;
    window.__SM_WEB__ = result.data;
    window.history.pushState({}, '', '/');

    await act(async () => { mountWeb(container); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });

    expect(container.textContent).toMatch(/1\s234\sKč/);
  });

  it('renders from scratch when the page was not prerendered (the dev server)', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById('root') as HTMLElement;
    window.history.pushState({}, '', '/kontakt');
    await act(async () => { mountWeb(container); });
    expect(container.querySelector('h1')?.textContent).toBe('Kontakt');
    expect(document.title).toContain('Kontakt');
  });
});
