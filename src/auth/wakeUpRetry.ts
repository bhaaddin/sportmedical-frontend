import { isUnreachable } from '../api/client';

/*
 * A server that sleeps. The live API runs on a plan that puts it to sleep after a quarter of an hour of nobody using
 * it, and the first request after that is answered only when it has woken up - about a minute. The client gives up on
 * one request after 20 s, so the first sign-in of the morning used to end in "Server neodpovídá" and the person had
 * to press the button again.
 *
 * This keeps asking, with a short pause, for as long as the answer is "nobody answered" (no response, a timeout, or
 * the proxy's 502/503/504), up to a ceiling; a real refusal (wrong password, 4xx, 5xx from the app itself) is
 * returned at once. It is only used where repeating is safe - the sign-in, which changes nothing until it succeeds.
 */

/** How long to keep waiting for a sleeping server in total, counting the attempts themselves. */
export const WAKE_UP_MAX_WAIT_MS = 100_000;
/** The pause between two attempts (an attempt itself already takes up to the request timeout). */
export const WAKE_UP_PAUSE_MS = 4_000;

export interface WakeUpOptions {
  maxWaitMs?: number;
  pauseMs?: number;
  /** Tests only. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs `attempt`; while the server does not answer, tells `onWaiting(true)` and tries again. Resolves with the first
 * answer, rejects with the last error once the ceiling is passed or the error is a real refusal.
 */
export async function withWakeUp<T>(
  attempt: () => Promise<T>,
  onWaiting: (waiting: boolean) => void,
  options: WakeUpOptions = {},
): Promise<T> {
  const { maxWaitMs = WAKE_UP_MAX_WAIT_MS, pauseMs = WAKE_UP_PAUSE_MS, now = Date.now, sleep = realSleep } = options;
  const started = now();

  for (;;) {
    try {
      const result = await attempt();
      onWaiting(false);
      return result;
    } catch (error) {
      if (!isUnreachable(error) || now() - started >= maxWaitMs) {
        onWaiting(false);
        throw error;
      }
      onWaiting(true);
      await sleep(pauseMs);
    }
  }
}
