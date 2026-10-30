import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { fetchPatientScreen, resetScreensForTests, seedOverviewScreen } from './screens';

const get = vi.fn();
vi.mock('./client', () => ({
  default: { get: (...a: unknown[]) => get(...a) },
  client: { get: (...a: unknown[]) => get(...a) },
}));

beforeEach(() => {
  get.mockReset();
  resetScreensForTests();
});

describe('patient screen', () => {
  it('gives the sections that arrived and leaves out the failed ones', async () => {
    get.mockResolvedValue({
      data: {
        patientId: 'p1',
        sections: {
          patient: { data: { id: 'p1', firstName: 'ZZ', lastName: 'test', phone: null } },
          profile: { data: { contactsJson: '[]' } },
          documents: { error: { code: 'access.denied', message: 'x' } },
          documentCheck: { data: { allRequiredPresent: true, requirements: [] } },
          clubs: { data: [{ memberId: 'm', clubId: 'c', clubName: 'ZZ test FC', isActive: true }] },
        },
      },
    });
    const screen = await fetchPatientScreen('p1');
    expect(screen.patient?.firstName).toBe('ZZ');
    expect('phone' in (screen.patient ?? {})).toBe(false);
    expect(screen.documents).toBeUndefined();
    expect(screen.documentCheck?.allRequiredPresent).toBe(true);
    expect(screen.clubs?.[0].clubName).toBe('ZZ test FC');
  });

  it('remembers a server without the route and does not ask again', async () => {
    get.mockRejectedValue({ response: { status: 404 } });
    expect(await fetchPatientScreen('p1')).toEqual({});
    expect(await fetchPatientScreen('p1')).toEqual({});
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('does not remember a refusal of the whole screen', async () => {
    get.mockRejectedValue({ response: { status: 403, data: { code: 'patients.not_in_your_calendars' } } });
    await fetchPatientScreen('p1');
    await fetchPatientScreen('p1');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('ignores a patient section for another id', async () => {
    get.mockResolvedValue({ data: { sections: { patient: { data: { id: 'other' } } } } });
    expect((await fetchPatientScreen('p1')).patient).toBeUndefined();
  });
});

describe('overview screen', () => {
  const range = { from: '2026-10-26', to: '2026-11-01', today: '2026-10-30' };

  it('seeds the week and the patients, and survives a bad section', async () => {
    get.mockResolvedValue({
      data: { sections: { week: { data: [] }, patients: { data: { p1: { id: 'p1', firstName: 'ZZ', lastName: 'test' } } }, clubOrders: { error: { code: 'access.denied' } } } },
    });
    const qc = new QueryClient();
    expect(await seedOverviewScreen(qc, range, { weekKey: ['overview', 'week', range.from], mayViewPatients: true })).toBe(true);
    expect(qc.getQueryData(['overview', 'week', range.from])).toEqual([]);
    expect(qc.getQueryData(['patient', 'p1'])).toMatchObject({ firstName: 'ZZ' });
    expect(qc.getQueryData(['shelf', 'club-orders', 'Requested'])).toBeUndefined();
  });

  it('does not touch patient keys without patients.view', async () => {
    get.mockResolvedValue({ data: { sections: { week: { data: [] }, patients: { data: { p1: { id: 'p1' } } } } } });
    const qc = new QueryClient();
    await seedOverviewScreen(qc, range, { weekKey: ['w'], mayViewPatients: false });
    expect(qc.getQueryData(['patient', 'p1'])).toBeUndefined();
  });

  it('falls back quietly on 404', async () => {
    get.mockRejectedValue({ response: { status: 404 } });
    expect(await seedOverviewScreen(new QueryClient(), range, { weekKey: ['w'], mayViewPatients: true })).toBe(false);
  });
});
