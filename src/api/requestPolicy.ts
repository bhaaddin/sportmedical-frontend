/* ══════════════════════════════════════════════════════════════
   HOW READS TREAT THE SERVER

   Three rules for GET requests, installed on the one HTTP client:

   1. ONE IDENTICAL READ AT A TIME. When a second caller asks for exactly the
      same URL while the first is still on its way - or got its answer less
      than a second ago (two bells asking for the notifications, a screen and
      its dialog asking for the activities one render apart) - it shares the
      first answer instead of sending a second request. Every caller still
      gets its own copy of the data. A write that starts or ends closes the
      sharing, so a read that begins after a write never joins a read that
      began before it. Feeds that are polled and nudged (notifications) are
      shared only while in flight, never after.

   2. A "TOO MANY REQUESTS" ANSWER IS WAITED OUT, NOT ARGUED WITH. The API
      allows a fixed number of calls a minute per session. A 429 on a read is
      tried again after the pause the server asked for (`Retry-After`; without
      one, a growing pause), at most twice, and while the pause lasts no other
      read leaves the browser - so the reads that were queued behind a burst
      do not become the next burst. A pause longer than we are willing to
      stand in front of a screen is not waited for: the 429 is handed to the
      screen as it always was.

   3. A WRITE TELLS THE CACHE. Whoever keeps a cache (the query client) can
      listen to `onWriteSucceeded` and mark what it holds as possibly stale.

   Writes are never retried and never shared.
   ══════════════════════════════════════════════════════════════ */
import axios, { type AxiosAdapter, type AxiosError, type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** How many times this read has already been tried again after a 429. */
    rateLimitRetries?: number;
  }
}

/** How often a read is tried again after a 429. */
export const RATE_LIMIT_RETRIES = 2;
/** The longest pause we wait in front of a screen; a longer `Retry-After` is handed to the screen. */
export const MAX_WAIT_MS = 10_000;
/** The longest pause imposed on every other read. */
export const MAX_PAUSE_MS = 15_000;
/** An answer that has just arrived still counts for an identical read asked this soon after. */
export const SHARE_GRACE_MS = 1_000;
/** First pause when the server did not say how long (doubled for the second try). */
export const FIRST_BACKOFF_MS = 1_000;

type WriteListener = (write: { method: string; url: string }) => void;
const writeListeners = new Set<WriteListener>();

/** Called after every write the server accepted (POST / PUT / PATCH / DELETE). */
export function onWriteSucceeded(listener: WriteListener): () => void {
  writeListeners.add(listener);
  return () => writeListeners.delete(listener);
}

/** Feeds that are polled and nudged by the live connection: shared only while in flight. */
const POLLED_FEED = /\/notifications(\/|\?|$)/;

const inFlight = new Map<string, Promise<AxiosResponse>>();
let pausedUntil = 0;

/** Test hook. */
export function resetRequestPolicyForTests(): void {
  inFlight.clear();
  pausedUntil = 0;
  writeListeners.clear();
}

/** Test hook. */
export function inFlightReadCount(): number {
  return inFlight.size;
}

/**
 * The pause a 429 asks for: seconds or a date in `Retry-After`; otherwise a growing pause.
 * `null` when the header gives a number we cannot read.
 */
export function retryDelayMs(retryAfter: unknown, attempt: number, now = Date.now()): number {
  if (typeof retryAfter === 'string' && retryAfter.trim() !== '') {
    const trimmed = retryAfter.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 1_000);
    const date = Date.parse(trimmed);
    if (!Number.isNaN(date)) return Math.max(0, date - now);
  }
  return FIRST_BACKOFF_MS * 2 ** attempt;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function isRead(config: { method?: string }): boolean {
  return (config.method ?? 'get').toLowerCase() === 'get';
}

/** Only plain JSON reads without a caller-supplied cancel signal are shared. */
function isShareable(config: InternalAxiosRequestConfig): boolean {
  if (!isRead(config) || config.signal) return false;
  const type = config.responseType;
  return type === undefined || type === 'json' || type === 'text';
}

function copyFor(config: InternalAxiosRequestConfig) {
  return (response: AxiosResponse): AxiosResponse => ({
    ...response,
    config,
    data: response.data !== null && typeof response.data === 'object' ? structuredClone(response.data) : response.data,
  });
}

export function installRequestPolicy(client: AxiosInstance): void {
  const underlying = (): AxiosAdapter => axios.getAdapter(client.defaults.adapter ?? axios.defaults.adapter);

  const sharingAdapter: AxiosAdapter = (config) => {
    const authorization = String(config.headers?.get?.('Authorization') ?? '');
    const key = `${client.getUri(config)}\n${authorization}`;
    const copy = copyFor(config);

    const running = inFlight.get(key);
    if (running) return running.then(copy);

    const started = underlying()(config);
    inFlight.set(key, started);
    const release = () => {
      if (inFlight.get(key) === started) inFlight.delete(key);
    };
    const polled = POLLED_FEED.test(config.url ?? '');
    started.then(
      () => (polled ? release() : void setTimeout(release, SHARE_GRACE_MS)),
      release,
    );
    return started.then(copy);
  };

  client.interceptors.request.use(async (config) => {
    if (!isRead(config)) {
      inFlight.clear();
      return config;
    }

    const wait = pausedUntil - Date.now();
    if (wait > 0) await sleep(wait + Math.random() * 400);

    if (isShareable(config)) config.adapter = sharingAdapter;
    return config;
  });

  client.interceptors.response.use(
    (response) => {
      if (!isRead(response.config)) {
        inFlight.clear();
        const write = { method: (response.config.method ?? '').toLowerCase(), url: response.config.url ?? '' };
        writeListeners.forEach((listener) => {
          try {
            listener(write);
          } catch (error) {
            console.error('[client] write listener failed:', error);
          }
        });
      }
      return response;
    },
    async (error: AxiosError) => {
      const config = error.config;
      if (!config) return Promise.reject(error);
      if (!isRead(config)) {
        inFlight.clear();
        return Promise.reject(error);
      }
      if (error.response?.status !== 429) return Promise.reject(error);

      const attempt = config.rateLimitRetries ?? 0;
      if (attempt >= RATE_LIMIT_RETRIES || config.signal?.aborted) return Promise.reject(error);

      const asked = retryDelayMs(error.response.headers?.['retry-after'], attempt);
      /* The server wants longer than a screen can stand: say no now, but still do not let the others pile on. */
      if (asked > MAX_WAIT_MS) {
        pausedUntil = Math.max(pausedUntil, Date.now() + Math.min(asked, MAX_PAUSE_MS));
        return Promise.reject(error);
      }

      pausedUntil = Math.max(pausedUntil, Date.now() + asked);
      await sleep(asked + Math.random() * 250);
      if (config.signal?.aborted) return Promise.reject(error);
      return client.request({ ...config, rateLimitRetries: attempt + 1 });
    },
  );
}
