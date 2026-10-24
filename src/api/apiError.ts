import { AxiosError } from 'axios';
import { wordedServerMessage } from './schedulingMessages';

/**
 * Maps a failed request onto the booking contract's error table (3.2).
 *
 * Two rules from the contract shape this file:
 *  - never show the raw exception text to the user;
 *  - never log a response body, because it may carry a birth number or an
 *    insurance number (6.7). Nothing here writes to the console.
 */

export type BookingErrorKind =
  | 'validation'   // 400 - show the server message, mark the field
  | 'forbidden'    // 403 - the caller has no right to this calendar
  | 'notFound'     // 404
  | 'conflict'     // 409 - not an error, a normal outcome; see 6.3
  | 'domainRule'   // 422 - keep the form filled in
  | 'rateLimited'  // 429
  | 'server'       // 500 and anything else
  | 'offline';     // the request never reached a server

export class BookingApiError extends Error {
  readonly kind: BookingErrorKind;
  readonly status: number | undefined;
  /** The backend's own user-facing text. Present only where 3.2 says to show it. */
  readonly serverMessage: string | undefined;
  /** Stage 2: the stable problem code of the answer (`worker.busy`, `lunch.overlaps_booking`, ...), when it carries one. */
  readonly code: string | undefined;
  /** Stage 2: the structured detail object of the answer (`worker.busy` names the clashing booking); never shown raw. */
  readonly details: unknown;

  constructor(kind: BookingErrorKind, status: number | undefined, serverMessage?: string, extra?: { code?: string | undefined; details?: unknown }) {
    super(kind);
    this.name = 'BookingApiError';
    this.kind = kind;
    this.status = status;
    this.serverMessage = serverMessage;
    this.code = extra?.code;
    this.details = extra?.details;
  }

  /** True when the slot was taken between loading the offer and submitting. */
  get isConflict(): boolean {
    return this.kind === 'conflict';
  }

  /** i18n key for the text to show when there is no server message to show. */
  get i18nKey(): string {
    return `booking.errors.${this.kind}`;
  }
}

interface ApiResultEnvelope {
  success?: boolean;
  message?: string;
  data?: unknown;
}

/** The `code` / `details` of an `ApiResult` problem body (both optional; nothing else of the body is kept). */
function readProblem(payload: unknown): { code: string | undefined; details: unknown } {
  if (payload === null || typeof payload !== 'object') return { code: undefined, details: undefined };
  const p = payload as { code?: unknown; details?: unknown };
  return { code: typeof p.code === 'string' && p.code !== '' ? p.code : undefined, details: p.details };
}

function readServerMessage(payload: unknown): string | undefined {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as ApiResultEnvelope).message;
    /* A rule's code ("scheduling.…") is worded in Czech, never shown as it is. */
    if (typeof message === 'string' && message.trim() !== '') return wordedServerMessage(message);
  }
  return undefined;
}

const KIND_BY_STATUS: Record<number, BookingErrorKind> = {
  400: 'validation',
  403: 'forbidden',
  404: 'notFound',
  409: 'conflict',
  412: 'conflict',
  422: 'domainRule',
  429: 'rateLimited',
};

/** Normalises anything thrown by axios or zod into a `BookingApiError`. */
export function toBookingError(error: unknown): BookingApiError {
  if (error instanceof BookingApiError) return error;

  if (error instanceof AxiosError) {
    const status = error.response?.status;
    if (status === undefined) return new BookingApiError('offline', undefined);

    const kind = KIND_BY_STATUS[status] ?? 'server';
    // 3.2 shows the server's message only for the two input-shaped failures.
    /*
     * 3.2 shows the server's own message for the input-shaped failures, and for
     * a conflict too. A 409 used to mean one thing - someone took the slot -
     * and the screen could say so from a fixed sentence. It now also refuses a
     * cancellation of an appointment that already happened, so a fixed sentence
     * would tell the operator their slot was taken when it was not. The server
     * says which it is; the fixed wording stays as the fallback.
     */
    const showsServerMessage =
      kind === 'validation' || kind === 'domainRule' || kind === 'conflict';
    return new BookingApiError(
      kind,
      status,
      showsServerMessage ? readServerMessage(error.response?.data) : undefined,
      readProblem(error.response?.data),
    );
  }

  // A schema mismatch is our bug, not the user's; it must not leak its detail.
  return new BookingApiError('server', undefined);
}
