import { AxiosError } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { withWakeUp } from './wakeUpRetry';

const noAnswer = () => new AxiosError('timeout of 20000ms exceeded', 'ECONNABORTED');
const refused = (status: number) =>
  new AxiosError('refused', 'ERR_BAD_REQUEST', undefined, undefined, { status, data: {} } as never);

/* A clock the test moves by hand, so no real waiting happens. */
const clock = () => {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => { t += ms; } };
};

describe('withWakeUp: a sleeping server is waited for, a refusal is not', () => {
  it('returns the answer at once when the server is awake', async () => {
    const waiting = vi.fn();
    await expect(withWakeUp(async () => 'ok', waiting, clock())).resolves.toBe('ok');
    expect(waiting).toHaveBeenLastCalledWith(false);
    expect(waiting).not.toHaveBeenCalledWith(true);
  });

  it('keeps trying while nobody answers, says it is waiting, and succeeds when the server wakes', async () => {
    const waiting = vi.fn();
    const attempt = vi.fn()
      .mockRejectedValueOnce(noAnswer())
      .mockRejectedValueOnce(refused(503))
      .mockResolvedValueOnce('signed in');
    await expect(withWakeUp(attempt, waiting, clock())).resolves.toBe('signed in');
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(waiting).toHaveBeenCalledWith(true);
    expect(waiting).toHaveBeenLastCalledWith(false);
  });

  it('does not repeat a real refusal: a wrong password (400/401) and an application error (500) come back at once', async () => {
    for (const status of [400, 401, 500]) {
      const attempt = vi.fn().mockRejectedValue(refused(status));
      await expect(withWakeUp(attempt, vi.fn(), clock())).rejects.toMatchObject({ response: { status } });
      expect(attempt).toHaveBeenCalledTimes(1);
    }
  });

  it('gives up after the ceiling and rethrows the last "nobody answered"', async () => {
    const waiting = vi.fn();
    const attempt = vi.fn().mockRejectedValue(noAnswer());
    await expect(withWakeUp(attempt, waiting, { ...clock(), maxWaitMs: 20_000, pauseMs: 5_000 })).rejects.toMatchObject({ code: 'ECONNABORTED' });
    expect(attempt.mock.calls.length).toBeGreaterThan(1);
    expect(attempt.mock.calls.length).toBeLessThan(10);
    expect(waiting).toHaveBeenLastCalledWith(false);
  });
});
