/* ══════════════════════════════════════════════════════════════
   THE QUERY CACHE AND ITS DEFAULTS

   Queries are reads (GET), and a read may be repeated safely, so a query that
   got no answer or a server-side failure is tried again a few times with a
   growing pause. A refusal (4xx) is an answer and is never retried: asking
   again gets the same "no". A 429 is the exception that proves the rule - the
   HTTP client itself waits out the pause the server asked for (see
   requestPolicy.ts), so the query layer never adds a second round of retries
   on top of it. Mutations are writes and are never retried automatically - a
   payment or a booking sent twice is worse than one that failed and says so.

   HOW LONG AN ANSWER COUNTS AS CURRENT
     - ordinary data           30 s    (opening a screen again, going back and
                                        forward, switching a filter and back
                                        costs nothing inside this window)
     - reference data          5 min   (calendars, činnosti, služby, settings,
                                        documents rules, working hours and the
                                        day-by-day preview of them - things
                                        that change when somebody edits them;
                                        every such edit marks them stale)
     - public holidays         10 min
   An answer is kept 30 minutes after the last screen stopped using it, so
   leaving a screen and coming back shows it at once.

   WHAT MAKES CACHED DATA STALE BEFORE ITS TIME
     - the screens' own invalidations (invalidateClubWorld, 'day-range', ...),
     - ANY write the server accepted: everything that is not reference data is
       marked stale, and reference data too unless the write was an ordinary
       booking / patient / order write. Marking does not fetch; the next screen
       that uses the data asks again, exactly as it did before the cache lived
       longer than a moment.
     - signing in, which empties the cache (a different person may come).

   When the server comes back after the "Server je nedostupný" banner, every
   query on screen is refetched, so nothing shown is left from before the gap.
   ══════════════════════════════════════════════════════════════ */
import { QueryClient, type QueryKey } from '@tanstack/react-query';
import { isUnreachable } from './client';
import { connection } from './connection';
import { onWriteSucceeded } from './requestPolicy';
import { warmForPath } from './warmStart';

/** How many times a failed read is tried again. */
export const QUERY_RETRIES = 3;

/** Ordinary data counts as current for this long. */
export const DEFAULT_STALE_MS = 30 * 1000;
/** Reference data (what the clinic configures) counts as current for this long. */
export const REFERENCE_STALE_MS = 5 * 60 * 1000;
/** Public holidays hardly ever change. */
export const HOLIDAYS_STALE_MS = 10 * 60 * 1000;
/** The older partner orders (one list per calendar) change rarely. */
export const PARTNER_ORDERS_STALE_MS = 2 * 60 * 1000;
/** How long an answer nobody is using is kept. */
export const CACHE_KEEP_MS = 30 * 60 * 1000;

/**
 * Whether a failed read is worth trying again: no answer at all, or the
 * server failing (5xx, 408). Never a 4xx refusal - and not a 429 either: the
 * HTTP client has already waited and tried again by the time one gets here.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= QUERY_RETRIES) return false;
  if (isUnreachable(error)) return true;

  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === undefined) return false;

  return status >= 500 || status === 408;
}

/** The first element of every query key that holds what the clinic configures. */
export const REFERENCE_KEYS = [
  'calendars',
  'activities',
  'clinic-services',
  'services',
  'club-block-activities',
  'club-block-services',
  'club-order-services',
  'public-clinic',
  'settings',
  'cenik',
  'document-templates',
  'document-requirements',
  'questionnaire-definitions',
  'questionnaire-default',
  'email-templates',
  'periods',
  'working-hours',
  'calendar-working-days',
  'calendar-access',
  /* Hours, workers and closures of each day: they follow the rota, not the bookings. */
  'grid-preview',
  'preview',
  'overview-preview',
] as const;

/** The first element of every query key whose answer changes while people work: kept honest on focus. */
export const LIVE_KEYS = [
  'day-range',
  'day-summary',
  'blocks',
  'club-blocks',
  'club-order',
  'club-orders',
  'partner-orders',
  'availability',
  'planner',
] as const;

const isReferenceKey = (key: QueryKey): boolean => (REFERENCE_KEYS as readonly unknown[]).includes(key[0]);

/** A POST that only asks (availability, a price, a calculation, a preview): nothing changed, so nothing goes stale. */
const READ_ONLY_POST = /\/(availability|price-quote|calculate|preview|notifications|second-factor)(\/|$|\?)/;

/** An ordinary booking / patient / order write: it cannot change what the clinic has configured. */
const ORDINARY_WRITE =
  /\/(appointments|patients|club-orders|club-blocks|partner-orders|notifications|billing|cashier|diagnostics|media|accounting|clubs|blocks|session)(\/|$|\?)|\/documents\/(?!templates|requirements)/;

/** Marks cached data stale after a write, without fetching anything. */
export function markStaleAfterWrite(client: QueryClient, write: { method: string; url: string }): void {
  if (READ_ONLY_POST.test(write.url)) return;

  /* A different person may sign in next: nothing of the previous one stays. */
  if (/\/api\/v1\/session\/?$/.test(write.url) && write.method === 'post') {
    client.clear();
    return;
  }

  const touchesReference = !ORDINARY_WRITE.test(write.url);
  void client.invalidateQueries({
    predicate: (query) => touchesReference || !isReferenceKey(query.queryKey),
    refetchType: 'none',
  });
}

export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
        refetchOnReconnect: true,
        staleTime: DEFAULT_STALE_MS,
        gcTime: CACHE_KEEP_MS,
        /*
         * Coming back to the tab refetches only what is live (see LIVE_KEYS) and only when it is older than its
         * staleTime. Everything else is asked again when a screen needs it.
         */
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  for (const key of REFERENCE_KEYS) {
    client.setQueryDefaults([key], { staleTime: REFERENCE_STALE_MS });
  }
  client.setQueryDefaults(['holidays'], { staleTime: HOLIDAYS_STALE_MS });
  for (const key of LIVE_KEYS) {
    client.setQueryDefaults([key], { refetchOnWindowFocus: true });
  }
  /* Free slots are the one answer another person can change under the desk's hands: always asked when a dialog opens. */
  client.setQueryDefaults(['availability'], { staleTime: 0, refetchOnWindowFocus: true });
  /* Older, rarely edited: the clubs' partner orders. */
  client.setQueryDefaults(['partner-orders'], { staleTime: PARTNER_ORDERS_STALE_MS, refetchOnWindowFocus: true });

  return client;
}

export const queryClient = createQueryClient();

/* A write was accepted: what is cached may no longer be true. */
onWriteSucceeded((write) => markStaleAfterWrite(queryClient, write));

/* Opened straight on a calendar or club screen: start its reference reads while its code is still arriving. */
if (typeof window !== 'undefined') warmForPath(queryClient, window.location.pathname, window.location.search, window.history.state);

/* The server answered again after a gap: reload everything on screen. */
connection.onRecovered(() => {
  void queryClient.invalidateQueries();
});
