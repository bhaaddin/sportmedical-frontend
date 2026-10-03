/* ══════════════════════════════════════════════════════════════
   MEDIA UPLOAD  (contract C5)

     POST   /api/v1/media            multipart `file`, optional `slotKey`
              → { assetId, url, posterUrl?, kind, width, height, bytes, contentType }
     DELETE /api/v1/media/{assetId}
     503 { message: "Úložiště médií není nastavené." } while no storage is configured.

   The server resizes images and transcodes videos (IMediaStore → Cloudinary);
   the browser only checks type and size first, so a wrong file is refused with a
   sentence before a minute of upload is wasted. The limits below are ours
   (the contract names none): generous enough for a phone photo and a short clip.
   ══════════════════════════════════════════════════════════════ */

import axios from 'axios';
import { z } from 'zod';
import client from './client';

export type MediaKind = 'image' | 'video';

const optStr = z.string().nullish().transform((value) => (value === null || value === undefined || value === '' ? undefined : value));
const optNum = z.number().nullish().transform((value) => (value === null || value === undefined || !Number.isFinite(value) ? undefined : value));

/** Tolerant: unknown keys are dropped, optional fields may be missing or null. */
export const mediaAssetSchema = z.object({
  assetId: z.union([z.string(), z.number()]).transform(String),
  url: z.string().min(1),
  posterUrl: optStr,
  kind: z.string().nullish(),
  width: optNum,
  height: optNum,
  bytes: optNum,
  contentType: optStr,
});

export interface MediaAsset {
  assetId: string;
  url: string;
  posterUrl?: string;
  kind: MediaKind;
  width?: number;
  height?: number;
  bytes?: number;
  contentType?: string;
}

export function parseMediaAsset(raw: unknown): MediaAsset | null {
  const body = raw !== null && typeof raw === 'object' && 'data' in raw && 'success' in raw ? (raw as { data: unknown }).data : raw;
  const parsed = mediaAssetSchema.safeParse(body);
  if (!parsed.success) return null;
  const { kind, contentType, ...rest } = parsed.data;
  const resolved: MediaKind = kind === 'video' || kind === 'image' ? kind : contentType?.startsWith('video/') ? 'video' : 'image';
  const asset: MediaAsset = { assetId: rest.assetId, url: rest.url, kind: resolved };
  if (rest.posterUrl !== undefined) asset.posterUrl = rest.posterUrl;
  if (rest.width !== undefined) asset.width = rest.width;
  if (rest.height !== undefined) asset.height = rest.height;
  if (rest.bytes !== undefined) asset.bytes = rest.bytes;
  if (contentType !== undefined) asset.contentType = contentType;
  return asset;
}

/* ── What the browser checks before it uploads ── */

const MB = 1024 * 1024;

export const MEDIA_RULES: Record<MediaKind, { types: readonly string[]; extensions: readonly string[]; label: string; noun: string; maxBytes: number }> = {
  image: {
    types: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
    label: 'JPG, PNG, WebP nebo AVIF',
    noun: 'fotka',
    maxBytes: 15 * MB,
  },
  video: {
    types: ['video/mp4', 'video/webm', 'video/quicktime'],
    extensions: ['mp4', 'webm', 'mov'],
    label: 'MP4, WebM nebo MOV',
    noun: 'video',
    maxBytes: 200 * MB,
  },
};

/** The `accept` attribute of the file input for a slot of this kind. */
export function acceptFor(kind: MediaKind): string {
  const rules = MEDIA_RULES[kind];
  return [...rules.types, ...rules.extensions.map((ext) => `.${ext}`)].join(',');
}

/** "3,4 MB" — Czech decimal comma, a non-breaking space before the unit. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / MB).toFixed(1).replace('.', ',')} MB`;
}

/** null = fine; otherwise the sentence to show the person. */
export function validateMediaFile(file: { name: string; type: string; size: number }, kind: MediaKind): string | null {
  const rules = MEDIA_RULES[kind];
  const extension = file.name.includes('.') ? (file.name.split('.').pop() ?? '').toLowerCase() : '';
  const typeOk = file.type !== '' ? rules.types.includes(file.type.toLowerCase()) : rules.extensions.includes(extension);
  if (!typeOk) {
    return `Soubor „${file.name}“ sem nepatří. Tady má být ${rules.noun} ve formátu ${rules.label}.`;
  }
  if (file.size <= 0) return `Soubor „${file.name}“ je prázdný.`;
  if (file.size > rules.maxBytes) {
    return `Soubor „${file.name}“ má ${formatBytes(file.size)}, ${rules.noun} může mít nejvýš ${formatBytes(rules.maxBytes)}.`;
  }
  return null;
}

/* ── Calls ── */

export const MEDIA_STORAGE_MISSING = 'Úložiště médií není nastavené.';

export interface UploadOptions {
  slotKey?: string;
  /** 0–100. */
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/** A video can take minutes on a phone's upload; the client's 20 s default would cut it. */
const UPLOAD_TIMEOUT_MS = 10 * 60_000;

export async function uploadMedia(file: File, options: UploadOptions = {}): Promise<MediaAsset> {
  const form = new FormData();
  form.append('file', file);
  if (options.slotKey !== undefined) form.append('slotKey', options.slotKey);
  const res = await client.post<unknown>('/api/v1/media', form, {
    // The client defaults to JSON; multipart must be left to the browser to add its boundary.
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: UPLOAD_TIMEOUT_MS,
    signal: options.signal,
    onUploadProgress: (event) => {
      if (options.onProgress !== undefined && event.total !== undefined && event.total > 0) {
        options.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    },
  });
  const asset = parseMediaAsset(res.data);
  if (asset === null) throw new Error('media: unexpected response');
  return asset;
}

export async function deleteMedia(assetId: string): Promise<void> {
  await client.delete(`/api/v1/media/${encodeURIComponent(assetId)}`);
}

/* ── What went wrong, in words ── */

export type MediaFailureKind = 'notConfigured' | 'tooLarge' | 'unsupported' | 'invalid' | 'offline' | 'other';

export interface MediaFailure {
  kind: MediaFailureKind;
  message: string;
}

const serverMessage = (error: unknown): string | undefined => {
  if (!axios.isAxiosError(error)) return undefined;
  const message = (error.response?.data as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' && message.trim() !== '' ? message : undefined;
};

export function mediaFailureOf(error: unknown): MediaFailure {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const message = serverMessage(error);
    if (status === undefined) {
      return { kind: 'offline', message: 'Server neodpovídá. Zkontrolujte připojení a zkuste to znovu.' };
    }
    if (status === 503 && message !== undefined) return { kind: 'notConfigured', message };
    if (status === 503) return { kind: 'offline', message: 'Server je dočasně nedostupný. Zkuste to za chvíli.' };
    if (status === 413) return { kind: 'tooLarge', message: message ?? 'Soubor je pro server příliš velký.' };
    if (status === 415) return { kind: 'unsupported', message: message ?? 'Server tento typ souboru nepřijímá.' };
    if (status === 400 || status === 422) return { kind: 'invalid', message: message ?? 'Server soubor odmítl.' };
    if (status === 403) return { kind: 'other', message: 'K nahrávání médií nemáte oprávnění.' };
    return { kind: 'other', message: message ?? 'Soubor se nepodařilo nahrát. Zkuste to prosím znovu.' };
  }
  return { kind: 'other', message: 'Soubor se nepodařilo nahrát. Zkuste to prosím znovu.' };
}
