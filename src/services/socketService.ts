/* ══════════════════════════════════════════════════════════════
   REAL-TIME SERVICE
   Singleton over the SignalR hub at /hubs/notifications.
   The hub sends one message, `notificationsChanged`; this relays it
   and says when the connection came back after a gap.
   ══════════════════════════════════════════════════════════════ */

/*
 * This opened a raw `new WebSocket(url)` and SignalR refused every one of them.
 *
 * SignalR is not a plain socket. It requires `POST …/negotiate`, then a socket
 * carrying the `connectionToken` that answer returns as `?id=`, then a protocol
 * handshake frame. A raw socket skips all three and is rejected before any
 * message is exchanged, whatever the authentication does.
 *
 * The mistake was diagnosed a day earlier - in a throwaway test of mine, which
 * failed for exactly this reason and which I described at the time as "a raw
 * WebSocket without the connectionToken, which SignalR always refuses". It did
 * not occur to me to look for the same thing in this file. `@microsoft/signalr`
 * was in package.json the whole time, unused.
 *
 * It took two lanes two days to find, because the failure splits: `negotiate`
 * is an ordinary request and succeeded, while the upgrade failed - which reads
 * like a transport problem and sent both lanes hunting through proxy config.
 * The other half was real and is fixed on the server: the hub read its token
 * only from the `Authorization` header, and a browser cannot put a header on a
 * WebSocket, so SignalR sends it as `?access_token=`.
 *
 * Three rules the owner asked for, and where each one lives here:
 *
 *   1. The list from the server is the truth; this is only the fast path. The
 *      bell reloads from `/api/notifications` - nothing here is the record.
 *   2. After every reconnect, ask again. `onreconnected` emits CONNECTED, and
 *      the bell treats that as "refetch", because a gap in the socket is
 *      exactly when something was missed.
 *   3. When the socket will not run, fall back to asking on a timer. Handled by
 *      the bell rather than here: the worst that may happen is "a minute late",
 *      never "not at all".
 */
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';

type EventCallback = (data: any) => void;

interface SocketConfig {
  url: string;
}

/*
 * The only messages there are. The server sends `notificationsChanged` and
 * nothing else; `connected` is this side's own, fired on start and again after
 * a reconnect.
 */
export const SOCKET_EVENTS = {
  NOTIFICATIONS_CHANGED: 'notificationsChanged',
  CONNECTED: 'connected',
} as const;

type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

/*
 * How long to wait before reconnect attempt `n` (0-based): 1 s, 2 s, 4 s, 8 s,
 * 16 s, then every 30 s, with up to a second of jitter so a clinic's worth of
 * screens does not come back in the same millisecond after a restart.
 *
 * It never gives up. The client's default stops after four tries (~42 s), and
 * a server restart that took a minute left the bell deaf until somebody
 * reloaded the page.
 */
export function reconnectDelayMs(attempt: number, jitter: number = Math.random()): number {
  const base = Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt));
  return base + Math.floor(jitter * 1_000);
}

class SocketService {
  private connection: HubConnection | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private starting: Promise<void> | null = null;
  /* Set by stop(): a signed-out browser must not keep knocking. */
  private stopped = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private startAttempt = 0;

  private config: SocketConfig = { url: '' };

  /* ── Initialize ── */
  init(config: Partial<SocketConfig> = {}) {
    this.config = { ...this.config, ...config };
    if (!this.config.url) {
      /*
       * A path, not a ws:// URL. The SignalR client negotiates over HTTP first
       * and picks the transport itself, so handing it `ws://` would leave it
       * nothing to POST to. Relative keeps it on the dev proxy as well.
       *
       * When the API lives on another origin (frontend on Vercel, API on
       * Fly/Render), the same env var the HTTP client uses points the hub at
       * it. Empty in dev, so the relative path and the proxy still apply.
       */
      const apiBase = import.meta.env.VITE_API_BASE_URL || '';
      this.config.url = `${apiBase}/hubs/notifications`;
    }
  }

  /* ── Connect ── */
  connect() {
    this.stopped = false;
    if (this.connection?.state === HubConnectionState.Connected) return;
    if (this.connection?.state === HubConnectionState.Reconnecting) return;
    if (this.starting) return;
    /* Nobody signed in, nobody to authenticate as. */
    if (!localStorage.getItem('token')) return;
    if (!this.config.url) this.init();

    const connection = new HubConnectionBuilder()
      .withUrl(this.config.url, {
        /* Read per attempt, not captured once: after a re-login the old token
           would otherwise be retried until the attempts ran out. */
        accessTokenFactory: () => localStorage.getItem('token') ?? '',
      })
      /* The client's own backoff, rather than a hand-rolled one. It also falls
         back to another transport when WebSocket cannot be established. */
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (context) => reconnectDelayMs(context.previousRetryCount),
      })
      .configureLogging(LogLevel.Warning)
      .build();

    /* Rule 2: a reconnect means there is a gap, and whoever listens has to go
       and look rather than assume nothing happened inside it. */
    connection.onreconnected(() => {
      this.emit(SOCKET_EVENTS.CONNECTED, { timestamp: Date.now(), afterGap: true });
    });

    /*
     * `notificationsChanged` is the name the hub actually sends, and it is
     * deliberately empty. It is not a notification - it is the sentence "look
     * again". Whoever receives it reloads the list; nothing is rendered from
     * the message itself.
     *
     * That design is worth keeping straight, because the obvious alternative
     * is worse: if the push carried the row, a screen could be assembled from
     * whichever messages happened to arrive - and that is always a subset. A
     * dropped connection, a laptop that slept, a proxy timeout, and the browser
     * shows a list nobody knows is incomplete. Carrying nothing makes the nudge
     * losable without consequence: the worst case is a notification arriving a
     * moment later, which the poll catches anyway.
     *
     * This side listened for `notification` instead, so the hub spoke and
     * nothing heard it. Three days of a bell that wrote its rows, delivered
     * them to the right person and rendered them - and never moved on its own.
     */
    connection.on(SOCKET_EVENTS.NOTIFICATIONS_CHANGED, () => {
      this.emit(SOCKET_EVENTS.NOTIFICATIONS_CHANGED, null);
    });

    /*
     * Closed for good - the first start failed, or the server refused a
     * reconnect (a token that expired meanwhile). Start again later with
     * whatever token is current then, unless this browser signed out.
     */
    connection.onclose(() => {
      if (this.connection === connection) this.connection = null;
      this.scheduleRestart();
    });

    this.connection = connection;
    this.starting = connection
      .start()
      .then(() => {
        this.startAttempt = 0;
        this.emit(SOCKET_EVENTS.CONNECTED, { timestamp: Date.now() });
      })
      .catch((err: unknown) => {
        if (this.connection === connection) this.connection = null;
        this.scheduleRestart();
        /*
         * Not fatal and not silent. The bell polls when this does not come up,
         * so a failure here costs freshness, never correctness - but it is said
         * out loud so nobody debugging an un-ringing bell has to guess.
         */
        console.warn('[SocketService] hub unavailable, falling back to polling:', err);
      })
      .finally(() => {
        this.starting = null;
      });
  }

  private scheduleRestart() {
    if (this.stopped || this.retryTimer !== null) return;
    const delay = reconnectDelayMs(this.startAttempt);
    this.startAttempt += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.stopped) this.connect();
    }, delay);
  }

  /**
   * Sign-out: close the hub and stop every retry. The next sign-in calls
   * connect() again with its own token.
   */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.startAttempt = 0;
    const connection = this.connection;
    this.connection = null;
    this.starting = null;
    if (connection) {
      try {
        await connection.stop();
      } catch {
        /* Already down; nothing to close. */
      }
    }
  }

  /* ── Subscribe to event ── */
  on(event: SocketEventName, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
      if (this.listeners.get(event)?.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  /* ── Emit to local listeners ── */
  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error(`[SocketService] Listener error for ${event}:`, err);
      }
    });
  }
}

/* ── Singleton ── */
export const socketService = new SocketService();
export default socketService;
