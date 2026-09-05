/* ══════════════════════════════════════════════════════════════
   WEBSOCKET SERVICE
   Singleton service for real-time communication.
   Features: auto-reconnect, exponential backoff, JWT auth,
   event channels, heartbeat ping/pong.
   ══════════════════════════════════════════════════════════════ */

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
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private isConnecting = false;
  private isManualClose = false;

  private config: SocketConfig = {
    url: '',
    maxReconnectAttempts: 10,
    initialReconnectDelay: 1000,
    maxReconnectDelay: 30000,
    heartbeatInterval: 30000,
  };

  /* ── Initialize ── */
  init(config: Partial<SocketConfig> = {}) {
    this.config = { ...this.config, ...config };
    if (!this.config.url) {
      const base = import.meta.env.VITE_API_BASE_URL || window.location.origin;
      this.config.url = base.replace(/^http/, 'ws') + '/hubs/notifications';
    }
  }

  /* ── Connect ── */
  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) return;
    this.isManualClose = false;
    this.isConnecting = true;

    try {
      const token = localStorage.getItem('token');
      const url = token
        ? `${this.config.url}?access_token=${token}`
        : this.config.url;

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit(SOCKET_EVENTS.CONNECTED, { timestamp: Date.now() });
        console.log('[SocketService] Connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'pong') return; // heartbeat response
          this.emit(msg.event || msg.type, msg.data ?? msg);
        } catch {
          // Non-JSON message, emit raw
          this.emit('raw', event.data);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnecting = false;
        this.stopHeartbeat();
        this.emit(SOCKET_EVENTS.DISCONNECTED, { code: event.code, reason: event.reason });
        console.log('[SocketService] Disconnected', event.code);

        if (!this.isManualClose) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('[SocketService] Error:', error);
        this.isConnecting = false;
      };
    } catch (err) {
      console.error('[SocketService] Connection failed:', err);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /* ── Disconnect ── */
  disconnect() {
    this.isManualClose = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }

  /* ── Send message ── */
  send(event: string, data?: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }));
    }
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

  /* ── Reconnect with exponential backoff ── */
  private scheduleReconnect() {
    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts ?? 10)) {
      console.warn('[SocketService] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(
      (this.config.initialReconnectDelay ?? 1000) * Math.pow(2, this.reconnectAttempts),
      this.config.maxReconnectDelay ?? 30000,
    );

    this.reconnectAttempts++;
    this.emit(SOCKET_EVENTS.RECONNECTING, {
      attempt: this.reconnectAttempts,
      nextInMs: delay,
    });

    console.log(`[SocketService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /* ── Heartbeat ── */
  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, this.config.heartbeatInterval ?? 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /* ── Connection status ── */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get connectionState(): string {
    switch (this.ws?.readyState) {
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'closed';
      default:
        return 'disconnected';
    }
  }
}

/* ── Singleton ── */
export const socketService = new SocketService();
export default socketService;
