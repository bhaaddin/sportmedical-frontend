/*
 * Media upload (contract C5): the client-side file check, the tolerant parsing of the answer,
 * the multipart request and the sentences for every way an upload can fail.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

const { post, del } = vi.hoisted(() => ({ post: vi.fn(), del: vi.fn() }));
vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>();
  const client = { post, delete: del };
  return { ...actual, default: client, client };
});

import {
  MEDIA_RULES, acceptFor, deleteMedia, formatBytes, mediaFailureOf, parseMediaAsset, uploadMedia, validateMediaFile,
} from './media';

const refused = (status: number | undefined, data?: unknown) =>
  new AxiosError('x', 'ERR', undefined, undefined, status === undefined ? undefined : ({ status, data } as never));

beforeEach(() => {
  post.mockReset();
  del.mockReset();
});

describe('validateMediaFile', () => {
  const jpg = { name: 'hero.jpg', type: 'image/jpeg', size: 2_000_000 };

  it('accepts a normal photo and a normal video', () => {
    expect(validateMediaFile(jpg, 'image')).toBeNull();
    expect(validateMediaFile({ name: 'klip.mp4', type: 'video/mp4', size: 50_000_000 }, 'video')).toBeNull();
  });

  it('refuses a file of the wrong kind, naming what is expected', () => {
    expect(validateMediaFile({ name: 'smlouva.pdf', type: 'application/pdf', size: 1000 }, 'image')).toBe(
      'Soubor „smlouva.pdf“ sem nepatří. Tady má být fotka ve formátu JPG, PNG, WebP nebo AVIF.',
    );
    expect(validateMediaFile(jpg, 'video')).toContain('video ve formátu MP4, WebM nebo MOV');
  });

  it('falls back on the extension when the browser gives no type', () => {
    expect(validateMediaFile({ name: 'klip.MOV', type: '', size: 1000 }, 'video')).toBeNull();
    expect(validateMediaFile({ name: 'klip', type: '', size: 1000 }, 'video')).not.toBeNull();
  });

  it('refuses an empty file and one over the limit, with the sizes in Czech', () => {
    expect(validateMediaFile({ ...jpg, size: 0 }, 'image')).toBe('Soubor „hero.jpg“ je prázdný.');
    expect(validateMediaFile({ ...jpg, size: 16 * 1024 * 1024 }, 'image')).toBe(
      'Soubor „hero.jpg“ má 16,0 MB, fotka může mít nejvýš 15,0 MB.',
    );
    expect(validateMediaFile({ name: 'k.mp4', type: 'video/mp4', size: MEDIA_RULES.video.maxBytes + 1 }, 'video')).toContain('video může mít nejvýš');
  });
});

describe('helpers', () => {
  it('offers the file input the types of the slot, by MIME and by extension', () => {
    expect(acceptFor('image')).toContain('image/webp');
    expect(acceptFor('image')).toContain('.jpg');
    expect(acceptFor('video')).toContain('video/mp4');
    expect(acceptFor('video')).not.toContain('image/');
  });

  it('writes sizes with a decimal comma and a non-breaking space', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 kB');
    expect(formatBytes(3.4 * 1024 * 1024)).toBe('3,4 MB');
  });
});

describe('parseMediaAsset', () => {
  it('reads the contract shape and ignores unknown keys', () => {
    expect(parseMediaAsset({ assetId: 'a1', url: 'https://x/y.jpg', kind: 'image', width: 1600, height: 900, bytes: 10, contentType: 'image/jpeg', extra: 1 })).toEqual({
      assetId: 'a1', url: 'https://x/y.jpg', kind: 'image', width: 1600, height: 900, bytes: 10, contentType: 'image/jpeg',
    });
  });

  it('is tolerant: numeric id, null fields, kind taken from the content type, the shared envelope', () => {
    expect(parseMediaAsset({ success: true, data: { assetId: 7, url: 'https://x/v.mp4', posterUrl: 'https://x/p.jpg', width: null, contentType: 'video/mp4' } })).toEqual({
      assetId: '7', url: 'https://x/v.mp4', posterUrl: 'https://x/p.jpg', kind: 'video', contentType: 'video/mp4',
    });
  });

  it('returns null for an answer that is not an asset', () => {
    expect(parseMediaAsset({ message: 'hm' })).toBeNull();
    expect(parseMediaAsset(null)).toBeNull();
  });
});

describe('uploadMedia', () => {
  it('posts multipart with the file and the slot key, reports progress, and parses the asset', async () => {
    post.mockImplementation(async (_url: string, _body: unknown, config: { onUploadProgress: (e: { loaded: number; total: number }) => void }) => {
      config.onUploadProgress({ loaded: 25, total: 100 });
      return { data: { assetId: 'a1', url: 'https://x/y.jpg', kind: 'image' } };
    });
    const progress = vi.fn();
    const file = new File(['abc'], 'hero.jpg', { type: 'image/jpeg' });

    const asset = await uploadMedia(file, { slotKey: 'landing.hero.photo1', onProgress: progress });

    expect(asset.assetId).toBe('a1');
    expect(progress).toHaveBeenCalledWith(25);
    const [url, form, config] = post.mock.calls[0] as [string, FormData, { headers: Record<string, string>; timeout: number }];
    expect(url).toBe('/api/v1/media');
    expect(form.get('file')).toBe(file);
    expect(form.get('slotKey')).toBe('landing.hero.photo1');
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
    expect(config.timeout).toBeGreaterThan(60_000);
  });

  it('throws when the answer is not an asset', async () => {
    post.mockResolvedValue({ data: {} });
    await expect(uploadMedia(new File(['a'], 'a.jpg', { type: 'image/jpeg' }))).rejects.toThrow('unexpected');
  });

  it('deletes an asset by id', async () => {
    del.mockResolvedValue({ data: {} });
    await deleteMedia('a/1');
    expect(del).toHaveBeenCalledWith('/api/v1/media/a%2F1');
  });
});

describe('mediaFailureOf', () => {
  it('503 with the server sentence = storage not configured', () => {
    expect(mediaFailureOf(refused(503, { message: 'Úložiště médií není nastavené.' }))).toEqual({
      kind: 'notConfigured', message: 'Úložiště médií není nastavené.',
    });
  });

  it('503 without a sentence is the proxy saying the server is down, not a missing setting', () => {
    expect(mediaFailureOf(refused(503)).kind).toBe('offline');
  });

  it('maps the other statuses to a kind and a sentence', () => {
    expect(mediaFailureOf(refused(413)).kind).toBe('tooLarge');
    expect(mediaFailureOf(refused(415)).kind).toBe('unsupported');
    expect(mediaFailureOf(refused(400, { message: 'Soubor je poškozený.' }))).toEqual({ kind: 'invalid', message: 'Soubor je poškozený.' });
    expect(mediaFailureOf(refused(403)).message).toContain('oprávnění');
    expect(mediaFailureOf(refused(500)).kind).toBe('other');
    expect(mediaFailureOf(refused(undefined)).kind).toBe('offline');
    expect(mediaFailureOf(new Error('boom')).message).not.toContain('boom');
  });
});
