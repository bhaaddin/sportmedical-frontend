/*
 * Bezpečnostní pravidla (Administrace): what the owner switches on to protect the administration. ALL OFF by default.
 *
 *   GET / PUT /api/v1/settings/security-policy   settings.clinic.manage
 *   GET / POST /api/v1/session/reconfirm         "Potvrďte, že jste to vy" - see src/auth/adminChallenge.ts
 *
 * The server side is built in parallel and may not be there yet: a 404 / 405 without a problem code means "this server has
 * no such route" and the screen is simply not offered (`isRouteMissing`, the same rule as `isLunchRouteMissing`).
 */
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { client } from './client';
import { problemCodeOf } from '../auth/adminChallenge';

export const securityPolicySchema = z.object({
  reconfirmForAdmin: z.boolean(),
  reconfirmMinutes: z.number().int().min(1).max(1440),
  requireTwoFactorForAdmins: z.boolean(),
  adminIdleLock: z.boolean(),
  adminIdleLockMinutes: z.number().int().min(1).max(1440),
});

export type SecurityPolicy = z.infer<typeof securityPolicySchema>;

/** Everything off; the numbers are what the switches use when first turned on. */
export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  reconfirmForAdmin: false,
  reconfirmMinutes: 15,
  requireTwoFactorForAdmins: false,
  adminIdleLock: false,
  adminIdleLockMinutes: 10,
};

/** The server has no such route (an older build): 404 / 405 on a route that cannot exist, not a "not found" the app means. */
export function isRouteMissing(error: unknown): boolean {
  const res = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  if (res === undefined) return false;
  return res.status === 405 || (res.status === 404 && problemCodeOf(res.data) === undefined);
}

const unwrap = (data: unknown): unknown =>
  data !== null && typeof data === 'object' && 'value' in data ? (data as { value: unknown }).value : data;

/** The policy, or null when this server does not have the route (or does not let this person read it). */
export async function readSecurityPolicy(): Promise<SecurityPolicy | null> {
  try {
    const { data } = await client.get('/api/v1/settings/security-policy');
    const parsed = securityPolicySchema.safeParse(unwrap(data));
    return parsed.success ? parsed.data : null;
  } catch (error) {
    if (isRouteMissing(error) || (error as { response?: { status?: number } }).response?.status === 403) return null;
    throw error;
  }
}

export async function saveSecurityPolicy(policy: SecurityPolicy): Promise<SecurityPolicy> {
  const { data } = await client.put('/api/v1/settings/security-policy', securityPolicySchema.parse(policy));
  const parsed = securityPolicySchema.safeParse(unwrap(data));
  return parsed.success ? parsed.data : policy;
}

export const SECURITY_POLICY_QUERY_KEY = ['settings', 'security-policy'] as const;

/** The policy for the gate and the screen; `policy` is null while unknown, missing or not readable. */
export function useSecurityPolicy(enabled: boolean): { policy: SecurityPolicy | null; loaded: boolean } {
  const query = useQuery({
    queryKey: SECURITY_POLICY_QUERY_KEY,
    queryFn: readSecurityPolicy,
    enabled,
    staleTime: 60_000,
    retry: false,
  });
  return { policy: query.data ?? null, loaded: !enabled || query.isFetched };
}

/* ── the confirmation window ── */

const confirmationSchema = z.object({
  confirmedAt: z.string().nullable(),
  validUntil: z.string().nullable(),
});
export type ReconfirmState = z.infer<typeof confirmationSchema>;

export const RECONFIRM_QUERY_KEY = ['session', 'reconfirm'] as const;

/** Until when the last confirmation holds; null values when never confirmed or the server has no such route. */
export async function readReconfirm(): Promise<ReconfirmState> {
  try {
    const { data } = await client.get('/api/v1/session/reconfirm');
    const parsed = confirmationSchema.safeParse(unwrap(data));
    return parsed.success ? parsed.data : { confirmedAt: null, validUntil: null };
  } catch (error) {
    if (isRouteMissing(error)) return { confirmedAt: null, validUntil: null };
    throw error;
  }
}

/** Never logged, never kept: the password and the code go out in this one request. */
export async function postReconfirm(input: { password: string; code: string | null }): Promise<ReconfirmState> {
  const { data } = await client.post('/api/v1/session/reconfirm', { password: input.password, code: input.code });
  const parsed = confirmationSchema.safeParse(unwrap(data));
  if (!parsed.success) throw new Error('unexpected reconfirm answer');
  return parsed.data;
}

/** True while the last confirmation still holds. */
export function isConfirmed(state: ReconfirmState | null | undefined, now = Date.now()): boolean {
  if (state === null || state === undefined || state.validUntil === null) return false;
  const until = Date.parse(state.validUntil);
  return Number.isFinite(until) && until > now;
}
