import { BookingApiError } from '../../api/apiError';

/**
 * Contract 3.2: show the server's own message where the table says so, a fixed
 * sentence everywhere else, and the raw exception text never.
 */
export function errorText(error: unknown, t: (key: string) => string): string {
  if (error instanceof BookingApiError) {
    return error.serverMessage ?? t(error.i18nKey);
  }
  return t('booking.errors.server');
}
