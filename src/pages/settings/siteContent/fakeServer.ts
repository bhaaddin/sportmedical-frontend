/* ══════════════════════════════════════════════════════════════
   A SMALL IN-MEMORY SERVER FOR THE TESTS OF THESE SCREENS

   Stands in for `src/api/client.ts` (the axios instance): the tests mock that
   module with `fakeClient`, so the real API modules — URL building, zod parsing,
   error mapping — run unchanged against it. It speaks the C5 contract: the admin
   site-content, media upload, media-storage settings and the change history.

   Test-only. Nothing in the application imports this file.
   ══════════════════════════════════════════════════════════════ */

import { AxiosError } from 'axios';

type Json = Record<string, unknown>;

export interface FakeCall {
  method: 'get' | 'post' | 'put' | 'delete';
  url: string;
  body: unknown;
}

interface Failure {
  method: string;
  /** Substring of the URL. */
  url: string;
  status: number;
  data: unknown;
  /** How many requests it applies to (default: once). */
  times: number;
}

export interface FakeState {
  slots: Record<string, Json>;
  partners: Json[];
  faq: Json[];
  mediaStorage: { provider: string; enabled: boolean; cloudName: string; apiKey: string; hasSecret: boolean; uploadPreset: string };
  /** What the next upload answers. */
  nextAsset: Json;
  assets: Record<string, Json>;
  calls: FakeCall[];
  failures: Failure[];
  counter: number;
}

const fresh = (): FakeState => ({
  slots: {},
  partners: [],
  faq: [],
  mediaStorage: { provider: 'cloudinary', enabled: false, cloudName: '', apiKey: '', hasSecret: false, uploadPreset: '' },
  nextAsset: {
    assetId: 'asset-1',
    url: 'https://res.cloudinary.com/demo/image/upload/v1/hero.jpg',
    kind: 'image',
    width: 1600,
    height: 900,
    bytes: 420_000,
    contentType: 'image/jpeg',
  },
  assets: {},
  calls: [],
  failures: [],
  counter: 0,
});

export const server = {
  state: fresh(),
  reset(): void {
    this.state = fresh();
  },
  /** Make the next `times` matching requests fail with `status`. */
  fail(method: FakeCall['method'], url: string, status: number, data: unknown = {}, times = 1): void {
    this.state.failures.push({ method, url, status, data, times });
  },
  /** Calls made so far, optionally only those of one method / URL part. */
  calls(method?: FakeCall['method'], url?: string): FakeCall[] {
    return this.state.calls.filter((c) => (method === undefined || c.method === method) && (url === undefined || c.url.includes(url)));
  },
};

const refused = (status: number, data: unknown) =>
  new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, { status, data, statusText: '', headers: {}, config: {} } as never);

const stamp = (slot: Json): Json => ({ ...slot, updatedAtUtc: '2026-10-03T12:05:00Z', updatedBy: 'Jana Nováková' });

function route(method: FakeCall['method'], url: string, body: unknown, config: { onUploadProgress?: (e: { loaded: number; total: number }) => void } | undefined): unknown {
  const s = server.state;
  const path = url.replace(/^https?:\/\/[^/]+/, '');

  if (method === 'get' && path === '/api/v1/site-content') {
    return { version: 'v1', slots: s.slots, partners: s.partners, faq: s.faq };
  }

  const slot = /^\/api\/v1\/site-content\/slots\/([^/]+)$/.exec(path);
  if (slot !== null) {
    const key = decodeURIComponent(slot[1]);
    if (method === 'delete') {
      delete s.slots[key];
      return {};
    }
    if (method === 'put') {
      const input = body as { text?: string; alt?: string; assetId?: string };
      const current = s.slots[key] ?? { kind: input.text !== undefined ? 'text' : 'image' };
      let next: Json = { ...current };
      if (input.text !== undefined) next = { ...next, kind: 'text', text: input.text };
      if (input.alt !== undefined) next = { ...next, alt: input.alt };
      if (input.assetId !== undefined) {
        const asset = s.assets[input.assetId] ?? s.nextAsset;
        next = { ...next, kind: asset.kind, mediaUrl: asset.url, posterUrl: asset.posterUrl, width: asset.width, height: asset.height, assetId: input.assetId };
      }
      s.slots[key] = stamp(next);
      return s.slots[key];
    }
  }

  const list = /^\/api\/v1\/site-content\/(partners|faq)(?:\/([^/]+))?$/.exec(path);
  if (list !== null) {
    const rows = list[1] === 'partners' ? s.partners : s.faq;
    const id = list[2] === undefined ? undefined : decodeURIComponent(list[2]);
    if (method === 'post') {
      s.counter += 1;
      const row = { id: `${list[1]}-${s.counter}`, ...(body as Json) };
      rows.push(row);
      return row;
    }
    if (id !== undefined && method === 'put') {
      const index = rows.findIndex((r) => r.id === id);
      if (index < 0) throw refused(404, { message: 'Nenalezeno.' });
      rows[index] = { ...rows[index], ...(body as Json) };
      // A logo is written as an asset id; the read side shows its URL.
      const assetId = (body as Json).logoAssetId;
      if (typeof assetId === 'string') rows[index].logoUrl = (s.assets[assetId] ?? s.nextAsset).url;
      if ((body as Json).logoAssetId === null) delete rows[index].logoUrl;
      return rows[index];
    }
    if (id !== undefined && method === 'delete') {
      const index = rows.findIndex((r) => r.id === id);
      if (index >= 0) rows.splice(index, 1);
      return {};
    }
  }

  if (method === 'post' && path === '/api/v1/media') {
    const form = body as FormData;
    const file = form.get('file') as File | null;
    if (file === null) throw refused(400, { message: 'Chybí soubor.' });
    config?.onUploadProgress?.({ loaded: 50, total: 100 });
    config?.onUploadProgress?.({ loaded: 100, total: 100 });
    const asset: Json = { ...s.nextAsset, contentType: file.type };
    s.assets[String(asset.assetId)] = asset;
    return asset;
  }
  if (method === 'delete' && path.startsWith('/api/v1/media/')) return {};

  if (path === '/api/v1/settings/media-storage') {
    if (method === 'get') return s.mediaStorage;
    if (method === 'put') {
      const input = body as { apiSecret?: string } & Partial<FakeState['mediaStorage']>;
      const { apiSecret, ...rest } = input;
      s.mediaStorage = { ...s.mediaStorage, ...rest, hasSecret: s.mediaStorage.hasSecret || (apiSecret !== undefined && apiSecret !== '') } as FakeState['mediaStorage'];
      return s.mediaStorage;
    }
  }

  if (method === 'get' && path === '/api/v1/settings/changes') return { items: [], total: 0 };

  throw refused(404, { message: `No fake route for ${method.toUpperCase()} ${path}` });
}

async function handle(method: FakeCall['method'], url: string, body?: unknown, config?: Parameters<typeof route>[3]): Promise<{ data: unknown }> {
  server.state.calls.push({ method, url, body });
  const failure = server.state.failures.find((f) => f.method === method && url.includes(f.url) && f.times > 0);
  if (failure !== undefined) {
    failure.times -= 1;
    throw refused(failure.status, failure.data);
  }
  // Round-trip through JSON so the screen never shares object identity with the "server".
  return { data: JSON.parse(JSON.stringify(route(method, url, body, config) ?? {})) };
}

/** What `vi.mock('…/api/client')` returns as both the default and the named export. */
export const fakeClient = {
  get: (url: string, config?: Parameters<typeof route>[3]) => handle('get', url, undefined, config),
  post: (url: string, body?: unknown, config?: Parameters<typeof route>[3]) => handle('post', url, body, config),
  put: (url: string, body?: unknown, config?: Parameters<typeof route>[3]) => handle('put', url, body, config),
  delete: (url: string, config?: Parameters<typeof route>[3]) => handle('delete', url, undefined, config),
};
