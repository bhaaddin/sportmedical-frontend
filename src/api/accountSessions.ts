/*
 * Moje relace (Můj účet a zabezpečení): where this account is signed in, and signing out the others.
 *
 *   GET  /api/v1/account/sessions                   [{ id, createdAt, lastSeenAt|null, device|null, current }]
 *   POST /api/v1/account/sessions/{id}/revoke
 *   POST /api/v1/account/sessions/revoke-others
 *
 * A server without these routes answers 404 / 405: `readSessions` then gives null and the card is not drawn.
 */
import { z } from 'zod';
import { client } from './client';
import { isRouteMissing } from './securityPolicy';

export const accountSessionSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  lastSeenAt: z.string().nullable().optional().transform((v) => v ?? null),
  device: z.string().nullable().optional().transform((v) => v ?? null),
  current: z.boolean(),
});
export type AccountSession = z.infer<typeof accountSessionSchema>;

const unwrap = (data: unknown): unknown =>
  data !== null && typeof data === 'object' && !Array.isArray(data) && 'value' in data ? (data as { value: unknown }).value : data;

export const ACCOUNT_SESSIONS_QUERY_KEY = ['account', 'sessions'] as const;

export async function readSessions(): Promise<AccountSession[] | null> {
  try {
    const { data } = await client.get('/api/v1/account/sessions');
    const parsed = z.array(accountSessionSchema).safeParse(unwrap(data));
    return parsed.success ? parsed.data : null;
  } catch (error) {
    if (isRouteMissing(error)) return null;
    throw error;
  }
}

export async function revokeSession(id: string): Promise<void> {
  await client.post(`/api/v1/account/sessions/${encodeURIComponent(id)}/revoke`);
}

export async function revokeOtherSessions(): Promise<void> {
  await client.post('/api/v1/account/sessions/revoke-others');
}
