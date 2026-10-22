import { describe, expect, it } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';
import { BookingApiError, toBookingError } from './apiError';
import { WORKER_BUSY, WORKER_BUSY_OVERRIDE_FORBIDDEN, busyRange, isOverrideForbidden, workerBusyMessage, workerBusyOf } from './workerBusy';

const axiosError = (status: number, data: unknown) =>
  new AxiosError('x', 'ERR', undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never } as AxiosResponse);

const body = {
  success: false,
  code: WORKER_BUSY,
  message: 'Pracovník je v tuto dobu zaneprázdněn (Ordinace 1, Spiroergometrie, 09:00-09:45).',
  details: {
    conflictKind: 'appointment', conflictId: 'x', calendarId: 'c', calendarName: 'Diagnostika', activityName: 'Spiroergometrie',
    startUtc: '2026-10-26T08:00:00Z', endUtc: '2026-10-26T08:45:00Z', workerUserId: 'u', overridable: true,
  },
};

describe('R4: worker.busy', () => {
  it('toBookingError keeps the stable code and the details of an answer (nothing else of the body)', () => {
    const e = toBookingError(axiosError(409, body));
    expect(e.kind).toBe('conflict');
    expect(e.code).toBe('worker.busy');
    expect((e.details as { calendarName: string }).calendarName).toBe('Diagnostika');
    expect(toBookingError(axiosError(500, 'oops')).code).toBeUndefined();
  });

  it('reads the clash and builds the Czech sentence from the structured fields (late October is CET: 08:00Z = 09:00)', () => {
    const busy = workerBusyOf(toBookingError(axiosError(409, body)))!;
    expect(busy.overridable).toBe(true);
    expect(busyRange(busy.details)).toBe('09:00–09:45');
    expect(workerBusyMessage(busy)).toBe('Pracovník je v tuto dobu zaneprázdněn: Spiroergometrie v kalendáři Diagnostika, 26. 10. 09:00–09:45.');
  });

  it('a club block is named by its činnosti; a batch says how many windows clash', () => {
    const e = toBookingError(axiosError(409, { ...body, details: { ...body.details, conflictKind: 'clubBlock', activityName: 'Základní prohlídka, VO2max', conflictCount: 3, overridable: false } }));
    const busy = workerBusyOf(e)!;
    expect(busy.overridable).toBe(false);
    expect(workerBusyMessage(busy)).toContain('blokace klubu (Základní prohlídka, VO2max)');
    expect(workerBusyMessage(busy)).toContain('Překrývá se 3 termínů');
  });

  it('an answer without usable details is still a clash, with a generic sentence', () => {
    const busy = workerBusyOf(toBookingError(axiosError(409, { code: WORKER_BUSY, message: 'x' })))!;
    expect(workerBusyMessage(busy)).toBe('Pracovník je v tuto dobu zaneprázdněn: jiná rezervace.');
  });

  it('anything else is not worker.busy; the override refusal is recognised', () => {
    expect(workerBusyOf(new BookingApiError('conflict', 409, 'Tento čas už je obsazený.'))).toBeNull();
    expect(workerBusyOf(new Error('x'))).toBeNull();
    const forbidden = toBookingError(axiosError(403, { code: WORKER_BUSY_OVERRIDE_FORBIDDEN, message: 'Přepsat zaneprázdněného pracovníka smí jen správce.' }));
    expect(isOverrideForbidden(forbidden)).toBe(true);
    expect(isOverrideForbidden(toBookingError(axiosError(403, {})))).toBe(false);
  });
});
