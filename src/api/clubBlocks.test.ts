import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const del = vi.fn();
vi.mock('./client', () => ({ default: { get, post, put, delete: del }, client: { get, post, put, delete: del } }));

const { clubBlocksApi, ClubBlockError, toBlock, toCalculation, toClubBlockError, fetchBlockableActivities } = await import('./clubBlocks');

const refused = (status: number, data: unknown) => new AxiosError('x', 'ERR', undefined, undefined, { status, data } as never);

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
  del.mockReset();
});

describe('toBlock', () => {
  it('reads a block and keeps what the server did not send as unknown, never zero', () => {
    const block = toBlock({
      id: 'b-1', clubId: 'club-1', clubName: 'FK Slaný', colorHex: '#0D5C52', calendarIds: ['c-1'], activityIds: ['a-1'],
      fromDate: '2026-10-26T00:00:00', toDate: '2026-11-03', dailyFrom: '08:00:00', dailyTo: '16:00', playerCount: 120,
      seats: 120, registered: 4, status: 'Active', registrationToken: 'tok', registrationUrl: 'https://x/klub/tok', note: null,
    });
    expect(block).toMatchObject({
      fromDate: '2026-10-26', dailyFrom: '08:00', dailyTo: '16:00', status: 'Active', registered: 4, note: null, athletes: null,
      createdAtUtc: null, name: null,
    });
  });

  it('reads a cancelled block and the athletes of a detail answer', () => {
    const block = toBlock({
      id: 'b-1', status: 'Cancelled', playerCount: 10,
      athletes: [{ appointmentId: 'p1', patientName: 'Jan Novák', activityName: 'Prohlídka', startUtc: '2026-10-26T09:00:00Z', paperwork: { ready: false } }, { nothing: true }],
    });
    expect(block.status).toBe('Cancelled');
    expect(block.seats).toBe(10);
    expect(block.athletes).toEqual([{ id: 'p1', name: 'Jan Novák', activityName: 'Prohlídka', startUtc: '2026-10-26T09:00:00Z', ready: false }]);
  });
});

describe('toCalculation', () => {
  it('treats a missing fitsHorizon as fitting and a capacity below one as one', () => {
    const calc = toCalculation({ minutesPerPlayer: 60, parallelCapacity: 0, neededMinutes: 100, perDay: [{ date: '2026-10-26', openMinutes: 480 }, { openMinutes: 1 }] });
    expect(calc.fitsHorizon).toBe(true);
    expect(calc.parallelCapacity).toBe(1);
    expect(calc.perDay).toEqual([{ date: '2026-10-26', openMinutes: 480 }]);
    expect(toCalculation({ fitsHorizon: false }).fitsHorizon).toBe(false);
  });
});

describe('errors', () => {
  it('keeps a 409 body\'s message and the athletes it names', () => {
    const e = toClubBlockError(refused(409, { message: 'Dotkne se 2 sportovců.', affected: [{ name: 'Jan Novák', activityName: 'Prohlídka', startUtc: '2026-10-26T09:00:00Z' }, { patientName: 'Petr Malý' }] }));
    expect(e.isConflict).toBe(true);
    expect(e.message).toBe('Dotkne se 2 sportovců.');
    expect(e.conflicts).toEqual([
      { name: 'Jan Novák', activityName: 'Prohlídka', startUtc: '2026-10-26T09:00:00Z' },
      { name: 'Petr Malý', activityName: null, startUtc: null },
    ]);
  });

  it('keeps a 400\'s field sentences and says "offline" in Czech when nothing answered', () => {
    expect(toClubBlockError(refused(400, { message: 'Špatně', errors: { fromDate: ['Chybí začátek.'] } })).fields).toEqual({ fromDate: 'Chybí začátek.' });
    expect(toClubBlockError(new AxiosError('net')).message).toMatch(/Server neodpovídá/);
    expect(toClubBlockError(new Error('x'))).toBeInstanceOf(ClubBlockError);
  });
});

describe('calls', () => {
  it('lists, gets, creates and calculates against the contract paths', async () => {
    get.mockResolvedValueOnce({ data: [{ id: 'b-1' }] });
    expect(await clubBlocksApi.list({ clubId: 'club-1', status: 'Active' })).toHaveLength(1);
    expect(get).toHaveBeenCalledWith('/api/v1/club-blocks', { params: { clubId: 'club-1', status: 'Active' } });

    get.mockResolvedValueOnce({ data: { id: 'b-1' } });
    await clubBlocksApi.get('b-1');
    expect(get).toHaveBeenLastCalledWith('/api/v1/club-blocks/b-1');

    post.mockResolvedValueOnce({ data: { id: 'b-2' } });
    const input = { clubId: 'c', calendarIds: ['c-1'], activityIds: ['a-1'], fromDate: '2026-10-26', toDate: '2026-10-27', playerCount: 10 };
    expect((await clubBlocksApi.create(input)).id).toBe('b-2');
    expect(post).toHaveBeenLastCalledWith('/api/v1/club-blocks', input);

    post.mockResolvedValueOnce({ data: { neededMinutes: 5 } });
    await clubBlocksApi.calculate({ playerCount: 1, activityIds: ['a'], calendarIds: ['c'] });
    expect(post).toHaveBeenLastCalledWith('/api/v1/club-blocks/calculate', { playerCount: 1, activityIds: ['a'], calendarIds: ['c'] });
  });

  it('sends the confirmation of an update and the cancel flag', async () => {
    put.mockResolvedValue({ data: { id: 'b-1' } });
    await clubBlocksApi.update('b-1', { fromDate: 'a', toDate: 'b' });
    expect(put).toHaveBeenLastCalledWith('/api/v1/club-blocks/b-1', { fromDate: 'a', toDate: 'b' }, { params: undefined });
    await clubBlocksApi.update('b-1', { fromDate: 'a', toDate: 'b' }, { cancelAthletes: true });
    expect(put).toHaveBeenLastCalledWith('/api/v1/club-blocks/b-1', { fromDate: 'a', toDate: 'b', cancelAthletes: true }, { params: { cancelAthletes: true } });

    del.mockResolvedValue({});
    await clubBlocksApi.cancel('b-1', true);
    expect(del).toHaveBeenCalledWith('/api/v1/club-blocks/b-1', { params: { cancelAthletes: true } });
  });

  it('throws a ClubBlockError carrying the 409 athletes', async () => {
    del.mockRejectedValue(refused(409, { message: 'Registrovaní sportovci.', athletes: [{ name: 'Jan' }] }));
    await expect(clubBlocksApi.cancel('b-1', false)).rejects.toMatchObject({ status: 409, conflicts: [{ name: 'Jan' }] });
  });
});

describe('fetchBlockableActivities', () => {
  it('reads effectiveColorHex, falling back to color, and drops inactive ones', async () => {
    get.mockResolvedValue({
      data: {
        activities: [
          { id: 'a-1', name: 'Základní', durationMinutes: 30, isActive: true, effectiveColorHex: '#112233', color: '#000000', parallelCapacity: 2, clinicServiceId: 's-1' },
          { id: 'a-2', name: 'Spiro', durationMinutes: 60, isActive: true, color: '#445566' },
          { id: 'a-3', name: 'Starý', isActive: false },
        ],
      },
    });
    const list = await fetchBlockableActivities();
    expect(list.map((a) => [a.id, a.colorHex, a.parallelCapacity])).toEqual([['a-1', '#112233', 2], ['a-2', '#445566', 1]]);
  });
});
