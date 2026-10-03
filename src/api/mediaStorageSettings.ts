/* ══════════════════════════════════════════════════════════════
   MEDIA STORAGE SETTINGS  (contract C5)

     GET/PUT /api/v1/settings/media-storage
       { provider: "cloudinary", enabled, cloudName, apiKey,
         apiSecret? (write-only; a read says only `hasSecret`), uploadPreset? }

   The secret is protected at rest by the server and never comes back. There is
   no "test connection" endpoint in the contract, so none is called here.
   ══════════════════════════════════════════════════════════════ */

import { z } from 'zod';
import client from './client';

export const MEDIA_STORAGE_QUERY_KEY = ['settings', 'media-storage'] as const;

const text = z.string().nullish().transform((value) => value ?? '');
const flag = z.boolean().nullish().transform((value) => value === true);

export const mediaStorageSchema = z.object({
  provider: text,
  enabled: flag,
  cloudName: text,
  apiKey: text,
  hasSecret: flag,
  uploadPreset: text,
});

export interface MediaStorageSettings {
  provider: string;
  enabled: boolean;
  cloudName: string;
  apiKey: string;
  hasSecret: boolean;
  uploadPreset: string;
}

export interface MediaStorageUpdate {
  provider: 'cloudinary';
  enabled: boolean;
  cloudName: string;
  apiKey: string;
  /** Only when somebody typed one. Leaving it out keeps the stored secret. */
  apiSecret?: string;
  uploadPreset: string;
}

export function parseMediaStorage(raw: unknown): MediaStorageSettings {
  const body = raw !== null && typeof raw === 'object' && 'value' in raw ? (raw as { value: unknown }).value : raw;
  const parsed = mediaStorageSchema.safeParse(body);
  if (!parsed.success) throw new Error('media-storage: unexpected response');
  return { ...parsed.data, provider: parsed.data.provider === '' ? 'cloudinary' : parsed.data.provider };
}

export const mediaStorageApi = {
  get: async (): Promise<MediaStorageSettings> => {
    const res = await client.get<unknown>('/api/v1/settings/media-storage');
    return parseMediaStorage(res.data);
  },
  put: async (body: MediaStorageUpdate): Promise<MediaStorageSettings> => {
    const res = await client.put<unknown>('/api/v1/settings/media-storage', body);
    return parseMediaStorage(res.data);
  },
};

/** What the screen calls "Nastaveno": switched on, with a cloud name and a stored secret. */
export function isMediaStorageReady(settings: Pick<MediaStorageSettings, 'enabled' | 'cloudName' | 'hasSecret'>): boolean {
  return settings.enabled && settings.cloudName.trim() !== '' && settings.hasSecret;
}
