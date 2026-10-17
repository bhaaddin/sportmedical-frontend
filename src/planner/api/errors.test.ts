import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { BookingApiError } from '../../api/apiError';
import { ClubBlockError } from '../../api/clubBlocks';
import { ClubOrderError } from '../../api/clubOrders';
import { PlannerWriteError } from '../data/PlannerDataSource';
import { toWriteError } from './errors';

const axios = (status: number | undefined, data?: unknown) =>
  new AxiosError('x', 'ERR', undefined, undefined, status === undefined ? undefined : ({ status, data } as never));

describe('toWriteError', () => {
  it('keeps a PlannerWriteError as it is', () => {
    const e = new PlannerWriteError('stale', 'Termín se změnil.');
    expect(toWriteError(e)).toBe(e);
  });

  it('BookingApiError: kind -> code, the server text where it is shown, 412 = stale', () => {
    expect(toWriteError(new BookingApiError('validation', 400, 'Špatný čas.'))).toMatchObject({ code: 'validation', message: 'Špatný čas.' });
    expect(toWriteError(new BookingApiError('domainRule', 422, 'Pravidlo.'))).toMatchObject({ code: 'validation', message: 'Pravidlo.' });
    expect(toWriteError(new BookingApiError('conflict', 409))).toMatchObject({ code: 'conflict', message: expect.stringContaining('obsadil') });
    expect(toWriteError(new BookingApiError('forbidden', 403))).toMatchObject({ code: 'forbidden', message: 'K této akci nemáte oprávnění.' });
    expect(toWriteError(new BookingApiError('notFound', 404))).toMatchObject({ code: 'notFound' });
    expect(toWriteError(new BookingApiError('offline', undefined))).toMatchObject({ code: 'network' });
    expect(toWriteError(new BookingApiError('server', 412))).toMatchObject({ code: 'stale' });
    expect(toWriteError(new BookingApiError('rateLimited', 429))).toMatchObject({ code: 'unknown', message: expect.stringContaining('Příliš mnoho') });
    expect(toWriteError(new BookingApiError('server', 500))).toMatchObject({ code: 'unknown' });
  });

  it('ClubOrderError: 409 carries the athletes, 400 the field sentence', () => {
    const conflict = toWriteError(new ClubOrderError('Dotkne se sportovců.', 409, 'x', [{ name: 'Jan', activityName: 'Prohlídka', reason: 'activity_removed_from_window' }]));
    expect(conflict).toMatchObject({ code: 'conflict', affectedAthletes: [{ name: 'Jan', activityName: 'Prohlídka', reason: 'activity_removed_from_window' }] });
    expect(toWriteError(new ClubOrderError('', 400, undefined, [], { ranges: ['Zadejte termín.'] }))).toMatchObject({ code: 'validation', message: 'Zadejte termín.' });
    expect(toWriteError(new ClubOrderError('Nemáte právo.', 403))).toMatchObject({ code: 'forbidden', message: 'Nemáte právo.' });
  });

  it('ClubBlockError and raw axios errors map by status; no answer at all is a network error', () => {
    expect(toWriteError(new ClubBlockError('Blok už neexistuje.', 404))).toMatchObject({ code: 'notFound' });
    expect(toWriteError(axios(409, { message: 'Obsazeno.' }))).toMatchObject({ code: 'conflict', message: 'Obsazeno.' });
    expect(toWriteError(axios(412))).toMatchObject({ code: 'stale' });
    expect(toWriteError(axios(undefined))).toMatchObject({ code: 'network', message: expect.stringContaining('Server neodpovídá') });
  });

  it('anything else is unknown with the caller\'s Czech fallback', () => {
    expect(toWriteError(new Error('boom'), 'Nepodařilo se.')).toMatchObject({ code: 'unknown', message: 'Nepodařilo se.' });
  });
});
