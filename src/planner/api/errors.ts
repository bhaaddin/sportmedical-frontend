/*
 * Any failure of the application's API clients -> a `PlannerWriteError` with a Czech message the desk can read.
 *
 *   BookingApiError   (appointments, calendars)   kind -> code, the server's own text where the contract shows it
 *   ClubOrderError    (club orders)               409 + athletes -> 'conflict' carrying the athletes
 *   ClubBlockError    (club blocks)               same
 *   AxiosError / anything else                    by HTTP status; no answer at all = 'network'
 *
 * 412 (the appointment changed since it was read) is 'stale'. Nothing here logs a response body: it can carry
 * names of people.
 */
import { AxiosError } from 'axios';
import { BookingApiError } from '../../api/apiError';
import { ClubBlockError } from '../../api/clubBlocks';
import { ClubOrderError } from '../../api/clubOrders';
import { PlannerWriteError, type AffectedAthlete, type PlannerWriteErrorCode } from '../data/PlannerDataSource';

const TEXT = {
  validation: 'Zadané údaje nejsou v pořádku.',
  forbidden: 'K této akci nemáte oprávnění.',
  notFound: 'Záznam už neexistuje.',
  conflict: 'Termín mezitím obsadil někdo jiný nebo se změnil. Zkontrolujte kalendář a zkuste to znovu.',
  stale: 'Termín se mezitím změnil. Otevřete jej znovu pro aktuální kontrolu.',
  network: 'Server neodpovídá. Zkuste to prosím znovu.',
  rateLimited: 'Příliš mnoho požadavků najednou. Zkuste to za chvíli.',
  unknown: 'Požadavek se nepodařilo dokončit.',
} as const;

const byStatus = (status: number | undefined): PlannerWriteErrorCode => {
  switch (status) {
    case undefined:
      return 'network';
    case 400:
    case 422:
      return 'validation';
    case 403:
      return 'forbidden';
    case 404:
      return 'notFound';
    case 409:
      return 'conflict';
    case 412:
      return 'stale';
    default:
      return 'unknown';
  }
};

const textFor = (code: PlannerWriteErrorCode, status?: number): string => {
  if (status === 429) return TEXT.rateLimited;
  return TEXT[code === 'notFound' ? 'notFound' : code] ?? TEXT.unknown;
};

const clean = (s: string | undefined | null): string | null => (typeof s === 'string' && s.trim() !== '' ? s.trim() : null);

/** `fallback` is used when nothing better is known (e.g. an unexpected exception). */
export function toWriteError(error: unknown, fallback: string = TEXT.unknown): PlannerWriteError {
  if (error instanceof PlannerWriteError) return error;

  if (error instanceof ClubOrderError) {
    const code = byStatus(error.status);
    const athletes: AffectedAthlete[] = error.affectedAthletes.map((a) => ({
      name: a.name,
      activityName: a.activityName ?? null,
      reason: a.reason ?? null,
    }));
    const field = Object.values(error.fieldErrors).flat()[0];
    return new PlannerWriteError(code, clean(error.message) ?? clean(field) ?? textFor(code, error.status), athletes);
  }

  if (error instanceof ClubBlockError) {
    const code = byStatus(error.status);
    const athletes: AffectedAthlete[] = error.conflicts.map((a) => ({ name: a.name, activityName: a.activityName || null }));
    return new PlannerWriteError(code, clean(error.message) ?? textFor(code, error.status), athletes);
  }

  if (error instanceof BookingApiError) {
    if (error.status === 412) return new PlannerWriteError('stale', TEXT.stale);
    const code: PlannerWriteErrorCode =
      error.kind === 'validation' || error.kind === 'domainRule'
        ? 'validation'
        : error.kind === 'forbidden'
          ? 'forbidden'
          : error.kind === 'notFound'
            ? 'notFound'
            : error.kind === 'conflict'
              ? 'conflict'
              : error.kind === 'offline'
                ? 'network'
                : 'unknown';
    return new PlannerWriteError(code, clean(error.serverMessage) ?? (error.kind === 'rateLimited' ? TEXT.rateLimited : textFor(code, error.status)));
  }

  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const code = byStatus(status);
    const data = error.response?.data as { message?: unknown } | undefined;
    const message = typeof data?.message === 'string' ? clean(data.message) : null;
    return new PlannerWriteError(code, message ?? textFor(code, status));
  }

  return new PlannerWriteError('unknown', fallback);
}
