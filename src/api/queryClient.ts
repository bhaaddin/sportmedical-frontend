/* ══════════════════════════════════════════════════════════════
   THE QUERY CACHE AND ITS DEFAULTS

   Queries are reads (GET), and a read may be repeated safely, so a query that
   got no answer or a server-side failure is tried again a few times with a
   growing pause. A refusal (4xx) is an answer and is never retried: asking
   again gets the same "no". Mutations are writes and are never retried
   automatically - a payment or a booking sent twice is worse than one that
   failed and says so.

   When the server comes back after the "Server je nedostupný" banner, every
   query on screen is refetched, so nothing shown is left from before the gap.
   ══════════════════════════════════════════════════════════════ */
import { QueryClient } from '@tanstack/react-query';
import { isUnreachable } from './client';
import { connection } from './connection';

/** How many times a failed read is tried again. */
export const QUERY_RETRIES = 3;

/**
 * Whether a failed read is worth trying again: no answer at all, or the
 * server failing (5xx, 408, 429). Never a 4xx refusal.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= QUERY_RETRIES) return false;
  if (isUnreachable(error)) return true;

  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === undefined) return false;

  return status >= 500 || status === 408 || status === 429;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
        refetchOnReconnect: true,
        /*
         * Coming back to the tab after a phone call shows current data. A
         * screen whose reads are expensive turns this off for itself.
         */
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export const queryClient = createQueryClient();

/* The server answered again after a gap: reload everything on screen. */
connection.onRecovered(() => {
  void queryClient.invalidateQueries();
});
