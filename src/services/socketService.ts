/* ══════════════════════════════════════════════════════════════
   REAL-TIME SERVICE
   Singleton over the SignalR hub at /hubs/notifications.
   Same surface as before: init / connect / on / off / send.
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
  maxReconnectAttempts?: number;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;
  heartbeatInterval?: number;
}

/* ── Event channel names ── */
export const SOCKET_EVENTS = {
  /* Calendar */
  CALENDAR_SLOT_CREATED: 'calendar:slot_created',
  CALENDAR_SLOT_UPDATED: 'calendar:slot_updated',
  CALENDAR_SLOT_DELETED: 'calendar:slot_deleted',
  CALENDAR_LOCKOUT_CREATED: 'calendar:lockout_created',
  CALENDAR_LOCKOUT_DELETED: 'calendar:lockout_deleted',

  /* Billing */
  BILLING_CLAIM_UPDATED: 'billing:claim_updated',
  BILLING_CLAIM_SUBMITTED: 'billing:claim_submitted',
  BILLING_BATCH_COMPLETE: 'billing:batch_complete',

  /* Admin */
  ADMIN_FORCE_LOGOUT: 'admin:force_logout',
  ADMIN_MAINTENANCE_MODE: 'admin:maintenance_mode',

  /* System */
  SYSTEM_HEALTH_UPDATE: 'system:health_update',
  SYSTEM_SESSION_UPDATE: 'system:session_update',

  /* Audit */
  AUDIT_NEW_ENTRY: 'audit:new_entry',

  /* Connection */
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
} as const;

type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

class SocketService {
  private connection: HubConnection | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private isManualClose = false;
  private starting: Promise<void> | null = null;

  private config: SocketConfig = { url: '' };

  /* ── Initialize ── */
  init(config: Partial<SocketConfig> = {}) {
    this.config = { ...this.config, ...config };
    if (!this.config.url) {
      /*
       * A path, not a ws:// URL. The SignalR client negotiates over HTTP first
       * and picks the transport itself, so handing it `ws://` would leave it
       * nothing to POST to. Relative keeps it on the dev proxy as well.
       */
      this.config.url = '/hubs/notifications';
    }
  }

  /* ── Connect ── */
  connect() {
    if (this.connection?.state === HubConnectionState.Connected) return;
    if (this.starting) return;
    this.isManualClose = false;
    if (!this.config.url) this.init();

    const connection = new HubConnectionBuilder()
      .withUrl(this.config.url, {
        /* Read per attempt, not captured once: after a re-login the old token
           would otherwise be retried until the attempts ran out. */
        accessTokenFactory: () => localStorage.getItem('token') ?? '',
      })
      /* The client's own backoff, rather than a hand-rolled one. It also falls
         back to another transport when WebSocket cannot be established. */
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    connection.onreconnecting(() => {
      this.emit(SOCKET_EVENTS.RECONNECTING, { timestamp: Date.now() });
    });

    /* Rule 2: a reconnect means there is a gap, and whoever listens has to go
       and look rather than assume nothing happened inside it. */
    connection.onreconnected(() => {
      this.emit(SOCKET_EVENTS.CONNECTED, { timestamp: Date.now(), afterGap: true });
    });

    connection.onclose(() => {
      this.emit(SOCKET_EVENTS.DISCONNECTED, { timestamp: Date.now() });
    });

    /*
     * Server-sent hub messages. `notification` is what the bell listens for;
     * the rest of SOCKET_EVENTS is forwarded verbatim so existing listeners
     * keep working if and when the hub starts sending those names.
     */
    connection.on('notification', (payload: unknown) => {
      this.emit('notification', payload);
    });
    for (const name of Object.values(SOCKET_EVENTS)) {
      if (name === SOCKET_EVENTS.CONNECTED || name === SOCKET_EVENTS.DISCONNECTED
          || name === SOCKET_EVENTS.RECONNECTING) continue;
      connection.on(name, (payload: unknown) => this.emit(name, payload));
    }

    this.connection = connection;
    this.starting = connection
      .start()
      .then(() => {
        this.emit(SOCKET_EVENTS.CONNECTED, { timestamp: Date.now() });
      })
      .catch((err: unknown) => {
        /*
         * Not fatal and not silent. The bell polls when this does not come up,
         * so a failure here costs freshness, never correctness - but it is said
         * out loud so nobody debugging an un-ringing bell has to guess.
         */
        console.warn('[SocketService] hub unavailable, falling back to polling:', err);
        this.emit(SOCKET_EVENTS.DISCONNECTED, { timestamp: Date.now(), failedToStart: true });
      })
      .finally(() => {
        this.starting = null;
      });
  }

  /* ── Disconnect ── */
  disconnect() {
    this.isManualClose = true;
    const connection = this.connection;
    this.connection = null;
    void connection?.stop();
  }

  /* ── Send message ── */
  send(event: string, data?: any) {
    if (this.connection?.state !== HubConnectionState.Connected) return;
    /* Unknown hub methods reject; a real-time nicety must not surface as an
       unhandled rejection in a clinic. */
    void this.connection.invoke(event, data).catch(() => {});
  }

  /* ── Subscribe to event ── */
  on(event: SocketEventName | string, callback: EventCallback): () => void {
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

  /* ── Unsubscribe ── */
  off(event: string, callback?: EventCallback) {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
    } else {
      this.listeners.delete(event);
    }
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

  /* ── Connection status ── */
  get isConnected(): boolean {
    return this.connection?.state === HubConnectionState.Connected;
  }

  get connectionState(): string {
    switch (this.connection?.state) {
      case HubConnectionState.Connected:
        return 'connected';
      case HubConnectionState.Connecting:
        return 'connecting';
      case HubConnectionState.Reconnecting:
        return 'reconnecting';
      case HubConnectionState.Disconnecting:
        return 'closing';
      default:
        return this.isManualClose ? 'disconnected' : 'closed';
    }
  }
}

/* ── Singleton ── */
export const socketService = new SocketService();
export default socketService;
