import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('../../api/client', () => ({ default: { get: (...a: unknown[]) => get(...a) } }));

const { fetchAllAppointments } = await import('./appointmentsSource');

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
