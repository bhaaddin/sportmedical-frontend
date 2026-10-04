import { AxiosError } from 'axios';
import { BookingApiError } from './apiError';

/**
 * Permanent delete of a služba or a činnost (`DELETE ...?permanent=true`).
 *
 * The row is removed only when nothing references it. Otherwise the server
 * answers 409 `{ code: "service.in_use" | "activity.in_use", message, usage }`
 * and changes nothing. The screens need the counts to say *what* hangs off it
 * and to offer archiving instead, so this keeps `usage` where `toBookingError`
 * would keep only the message.
 */
export const IN_USE_CODES = ['service.in_use', 'activity.in_use'] as const;

export interface DeleteUsage {
  appointments: number;
  clubOrders: number;
  clubBlocks: number;
  priceItems: number;
  calendars: number;
  activities: number;
}

const USAGE_KEYS: readonly (keyof DeleteUsage)[] = [
  'appointments', 'clubOrders', 'clubBlocks', 'priceItems', 'calendars', 'activities',
];

export class InUseError extends BookingApiError {
  readonly code: string;
  readonly usage: DeleteUsage;
  constructor(code: string, message: string | undefined, usage: DeleteUsage) {
    super('conflict', 409, message);
    this.name = 'InUseError';
    this.code = code;
    this.usage = usage;
  }
}

/** Structural on purpose: a screen test may replace the api modules, never this one. */
export function isInUse(error: unknown): error is InUseError {
  return error instanceof BookingApiError
    && typeof (error as unknown as { code?: unknown }).code === 'string'
    && (error as unknown as { code: string }).code.endsWith('.in_use');
}

function readUsage(raw: unknown): DeleteUsage {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const usage = {} as DeleteUsage;
  for (const key of USAGE_KEYS) {
    const value = source[key];
    usage[key] = typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }
  return usage;
}

/** Returns the in-use refusal as such, or `null` so the caller can fall through to its own mapping. */
export function toInUseError(error: unknown): InUseError | null {
  if (!(error instanceof AxiosError) || error.response?.status !== 409) return null;
  const data = error.response.data as { code?: unknown; message?: unknown; usage?: unknown } | undefined;
  if (typeof data?.code !== 'string' || !data.code.endsWith('.in_use')) return null;
  const message = typeof data.message === 'string' && data.message.trim() !== '' ? data.message : undefined;
  return new InUseError(data.code, message, readUsage(data.usage));
}
