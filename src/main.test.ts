/*
 * main.tsx picks the bundle by the address: a public page → the public site (hydrated), everything
 * else → the application, and an old /web address is sent to its new place.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mountWeb = vi.fn();
const mountApp = vi.fn();
vi.mock('./web/entry-client', () => ({ mountWeb }));
vi.mock('./web/appEntry', () => ({ mountApp }));
vi.mock('./styles/reset.css', () => ({}));

const realLocation = window.location;

function openAt(pathname: string, search = '', hash = ''): { replace: ReturnType<typeof vi.fn> } {
  const replace = vi.fn();
  Object.defineProperty(window, 'location', { configurable: true, value: { pathname, search, hash, replace } });
  return { replace };
}

async function boot(): Promise<void> {
  vi.resetModules();
  await import('./main');
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  mountWeb.mockReset();
  mountApp.mockReset();
  document.body.innerHTML = '<div id="root"></div>';
});
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
});

describe('main.tsx', () => {
  it.each(['/', '/sluzby', '/prohlidky', '/diagnostika', '/inbody', '/cenik', '/dokumenty', '/kontakt', '/o-nas', '/kluby'])(
    '%s opens the public site',
    async (path) => {
      openAt(path);
      await boot();
      expect(mountWeb).toHaveBeenCalledTimes(1);
      expect(mountApp).not.toHaveBeenCalled();
    },
  );

  it.each(['/login', '/prehled', '/patients', '/clubs', '/objednat', '/portal', '/klub/abc', '/nastaveni/cenik', '/nastaveni/sluzby', '/neexistuje'])(
    '%s opens the application (the staff portal is behind the sign-in, the rest are patient app pages)',
    async (path) => {
      openAt(path);
      await boot();
      expect(mountApp).toHaveBeenCalledTimes(1);
      expect(mountWeb).not.toHaveBeenCalled();
    },
  );

  it('sends an old /web address to its new place and mounts nothing', async () => {
    const { replace } = openAt('/web/sluzby', '?x=1', '#a');
    await boot();
    expect(replace).toHaveBeenCalledWith('/sluzby?x=1#a');
    expect(mountWeb).not.toHaveBeenCalled();
    expect(mountApp).not.toHaveBeenCalled();
  });

  it('sends /web to the landing page', async () => {
    const { replace } = openAt('/web');
    await boot();
    expect(replace).toHaveBeenCalledWith('/');
  });
});
