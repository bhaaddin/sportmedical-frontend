import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('../../api/client', () => ({ default: { get: (...a: unknown[]) => get(...a) } }));

const { fetchAllAppointments, fetchPatientAppointments, ALL_APPOINTMENTS_KEY } = await import('./appointmentsSource');

beforeEach(() => {
  get.mockReset();
});

describe('fetchAllAppointments', () => {
  it('asks for the whole list as before when no patient is named', async () => {
    get.mockResolvedValue({ data: [{ id: 'a' }] });
    await expect(fetchAllAppointments()).resolves.toHaveLength(1);
    expect(get).toHaveBeenCalledWith('/api/scheduling/appointments', undefined);
  });

  it('names the patient so a newer server filters in the database', async () => {
    get.mockResolvedValue({ data: [{ id: 'a', patientId: 'p1' }] });
    await fetchAllAppointments('p1');
    expect(get).toHaveBeenCalledWith('/api/scheduling/appointments', { params: { patientId: 'p1' } });
  });

  it('an older server ignores the parameter and sends everybody: the rows come through for the caller to filter', async () => {
    get.mockResolvedValue({
      data: [
        { id: 'a', patientId: 'p1' },
        { id: 'b', patientId: 'p2' },
      ],
    });
    await expect(fetchAllAppointments('p1')).resolves.toHaveLength(2);
  });
});

describe('fetchPatientAppointments', () => {
  it('an older server answers everybody: the answer is also kept as the clinic list, the next patient asks nothing', async () => {
    const qc = new QueryClient();
    get.mockResolvedValue({ data: [{ id: 'a', patientId: 'p1' }, { id: 'b', patientId: 'p2' }] });
    await expect(fetchPatientAppointments(qc, 'p1')).resolves.toEqual([{ id: 'a', patientId: 'p1' }]);
    expect(qc.getQueryData(ALL_APPOINTMENTS_KEY)).toHaveLength(2);
    await expect(fetchPatientAppointments(qc, 'p2')).resolves.toEqual([{ id: 'b', patientId: 'p2' }]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('a narrowed answer is not stored as the clinic list', async () => {
    const qc = new QueryClient();
    get.mockResolvedValue({ data: [{ id: 'a', patientId: 'p1' }] });
    await fetchPatientAppointments(qc, 'p1');
    expect(qc.getQueryData(ALL_APPOINTMENTS_KEY)).toBeUndefined();
  });
});
