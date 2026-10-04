import { AxiosError } from 'axios';
import { BookingApiError, toBookingError } from './apiError';

/**
 * Etapa 4, D9: creating or renaming a služba (or a činnost inside one service) to a
 * name that already exists answers 409 `{ code: "service.duplicate", message }`.
 * `toBookingError` keeps only the message; the screens need to know it is *this*
 * refusal so they can pin it to the name field instead of a generic alert.
 */
export const DUPLICATE_NAME_CODE = 'service.duplicate';

export class DuplicateNameError extends BookingApiError {
  readonly code = DUPLICATE_NAME_CODE;
  constructor(message: string | undefined) {
    super('conflict', 409, message);
    this.name = 'DuplicateNameError';
  }
}

/** Like `toBookingError`, but recognises the duplicate-name refusal. */
export function toNamedError(error: unknown): BookingApiError {
  if (error instanceof AxiosError && error.response?.status === 409) {
    const data = error.response.data as { code?: unknown; message?: unknown } | undefined;
    if (data?.code === DUPLICATE_NAME_CODE) {
      const message = typeof data.message === 'string' && data.message.trim() !== '' ? data.message : undefined;
      return new DuplicateNameError(message);
    }
  }
  return toBookingError(error);
}

/** Structural on purpose: a screen test may replace the api module, never this one. */
export function isDuplicateName(error: unknown): error is DuplicateNameError {
  return error instanceof BookingApiError && (error as { code?: unknown }).code === DUPLICATE_NAME_CODE;
}
