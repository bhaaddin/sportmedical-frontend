/* ══════════════════════════════════════════════════════════════
   REAL-TIME SYNC HOOK
   Connects to the socketService and relays the two things it can
   say: "the notifications changed" and "the connection came back
   after a gap". Both mean the same thing to a listener - go and
   ask the server again.
   ══════════════════════════════════════════════════════════════ */
import { useEffect } from 'react';
import { socketService, SOCKET_EVENTS } from '../services/socketService';

/**
 * Hook that connects to the hub and listens for its nudges.
 *
 * @param options.enabled - Whether to start listening (default: true)
 */
export function useRealtimeSync(options: {
  enabled?: boolean;
  /**
   * Called when the socket comes back after dropping. Nothing announces what
   * happened during a gap, so whoever cares has to go and ask rather than
   * wait to be told.
   */
  onReconnected?: () => void;
  /**
   * The hub's "look again" nudge. Carries nothing on purpose, so this takes no
   * argument: the only correct response is to reload from the server.
   */
  onNotificationsChanged?: () => void;
} = {}): void {
  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    /* Initialize if not already connected */
    socketService.init();
    socketService.connect();

    const unsubscribers: (() => void)[] = [
      socketService.on(SOCKET_EVENTS.NOTIFICATIONS_CHANGED, () => {
        options.onNotificationsChanged?.();
      }),
      socketService.on(SOCKET_EVENTS.CONNECTED, (data?: { afterGap?: boolean }) => {
        if (data?.afterGap) options.onReconnected?.();
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
