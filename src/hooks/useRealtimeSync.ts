/* ══════════════════════════════════════════════════════════════
   REAL-TIME SYNC HOOK
   Connects to the socketService, listens for calendar/billing
   events, and updates the Zustand store instantly.
   Handles race conditions (dragging = pause incoming updates).
   ══════════════════════════════════════════════════════════════ */
import { useEffect, useRef, useCallback, useState } from 'react';
import { socketService, SOCKET_EVENTS } from '../services/socketService';

interface SyncState {
  connected: boolean;
  lastSyncAt: number | null;
  reconnecting: boolean;
}

interface OptimisticAction<T> {
  id: string;
  previousState: T;
  timestamp: number;
}

/**
 * Hook that connects to the WebSocket and listens for real-time events.
 * When a calendar:slot_updated event arrives, the store is updated instantly.
 *
 * @param options.enabled - Whether to start listening (default: true)
 * @param options.onSlotCreated - Callback when a slot is created remotely
 * @param options.onSlotUpdated - Callback when a slot is updated remotely
 * @param options.onSlotDeleted - Callback when a slot is deleted remotely
 * @param options.onClaimUpdated - Callback when a billing claim is updated
 * @param options.onForceLogout - Callback when admin forces logout
 * @param options.onMaintenanceMode - Callback when system enters maintenance
 */
export function useRealtimeSync(options: {
  enabled?: boolean;
  onSlotCreated?: (data: any) => void;
  onSlotUpdated?: (data: any) => void;
  onSlotDeleted?: (data: any) => void;
  onClaimUpdated?: (data: any) => void;
  onForceLogout?: () => void;
  onMaintenanceMode?: (data: { enabled: boolean; message?: string }) => void;
  /**
   * Called when the socket comes back after dropping. Separate from
   * `onSlotCreated` and friends on purpose: nothing announces what happened
   * during a gap, so whoever cares has to go and ask rather than wait to be
   * told.
   */
  onReconnected?: () => void;
} = {}) {
  const { enabled = true } = options;
  const [syncState, setSyncState] = useState<SyncState>({
    connected: false,
    lastSyncAt: null,
    reconnecting: false,
  });
  const isDraggingRef = useRef(false);
  const pausedEventsRef = useRef<any[]>([]);

  /* ── Mark dragging state (pause incoming updates for that slot) ── */
  const setDragging = useCallback((dragging: boolean) => {
    isDraggingRef.current = dragging;
    if (!dragging && pausedEventsRef.current.length > 0) {
      // Process paused events after drag ends
      pausedEventsRef.current.forEach((evt) => {
        if (options.onSlotUpdated) options.onSlotUpdated(evt);
      });
      pausedEventsRef.current = [];
    }
  }, [options.onSlotUpdated]);

  useEffect(() => {
    if (!enabled) return;

    /* Initialize if not already connected */
    socketService.init();
    socketService.connect();

    const unsubscribers: (() => void)[] = [];

    /* ── Connection events ── */
    unsubscribers.push(
      socketService.on(SOCKET_EVENTS.CONNECTED, (data?: { afterGap?: boolean }) => {
        setSyncState((s) => ({ ...s, connected: true, reconnecting: false }));
        if (data?.afterGap) options.onReconnected?.();
      }),
    );
    unsubscribers.push(
      socketService.on(SOCKET_EVENTS.DISCONNECTED, () => {
        setSyncState((s) => ({ ...s, connected: false }));
      }),
    );
    unsubscribers.push(
      socketService.on(SOCKET_EVENTS.RECONNECTING, () => {
        setSyncState((s) => ({ ...s, reconnecting: true }));
      }),
    );

    /* ── Calendar events ── */
    unsubscribers.push(
      socketService.on(SOCKET_EVENTS.CALENDAR_SLOT_CREATED, (data) => {
        setSyncState((s) => ({ ...s, lastSyncAt: Date.now() }));
        options.onSlotCreated?.(data);
      }),
    );
    unsubscribers.push(
      socketService.on(SOCKET_EVENTS.CALENDAR_SLOT_UPDATED, (data) => {
        setSyncState((s) => ({ ...s, lastSyncAt: Date.now() }));
        if (isDraggingRef.current) {
          pausedEventsRef.current.push(data);
        } else {
          options.onSlotUpdated?.(data);
        }
      }),
    );
    unsubscribers.push(
      socketService.on(SOCKET_EVENTS.CALENDAR_SLOT_DELETED, (data) => {
        setSyncState((s) => ({ ...s, lastSyncAt: Date.now() }));
        options.onSlotDeleted?.(data);
      }),
    );

    /* ── Billing events ── */
    unsubscribers.push(
      socketService.on(SOCKET_EVENTS.BILLING_CLAIM_UPDATED, (data) => {
        options.onClaimUpdated?.(data);
      }),
    );

    /* ── Admin events ── */
    unsubscribers.push(
      socketService.on(SOCKET_EVENTS.ADMIN_FORCE_LOGOUT, () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        options.onForceLogout?.();
        window.location.href = '/login';
      }),
    );
    unsubscribers.push(
      socketService.on(SOCKET_EVENTS.ADMIN_MAINTENANCE_MODE, (data) => {
        options.onMaintenanceMode?.(data);
      }),
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...syncState,
    setDragging,
  };
}

/**
 * Optimistic UI hook for batch operations.
 * Updates the UI immediately, then rolls back on error.
 *
 * @example
 * const { executeOptimistic } = useOptimisticUpdate();
 * const handleSave = async () => {
 *   await executeOptimistic({
 *     items: selectedRows,
 *     apiCall: (item) => billingApi.submitClaim(item.id),
 *     onOptimistic: (item) => updateRowStatus(item.id, 'pending'),
 *     onRollback: (item) => updateRowStatus(item.id, 'error'),
 *     onSuccess: () => toast.success('Claims submitted'),
 *     onError: (failed) => toast.error(`${failed.length} claims failed`),
 *   });
 * };
 */
export function useOptimisticUpdate<T>() {
  const pendingRef = useRef<Map<string, OptimisticAction<T>>>(new Map());

  const executeOptimistic = useCallback(
    async (options: {
      items: T[];
      getKey: (item: T) => string;
      apiCall: (item: T) => Promise<any>;
      onOptimistic: (item: T) => void;
      onRollback: (item: T) => void;
      onSuccess?: (succeeded: T[]) => void;
      onError?: (failed: T[], errors: Error[]) => void;
    }) => {
      const { items, getKey, apiCall, onOptimistic, onRollback, onSuccess, onError } = options;

      const succeeded: T[] = [];
      const failed: T[] = [];
      const errors: Error[] = [];

      /* Optimistic: update UI immediately */
      items.forEach((item) => {
        pendingRef.current.set(getKey(item), {
          id: getKey(item),
          previousState: item,
          timestamp: Date.now(),
        });
        onOptimistic(item);
      });

      /* Send requests concurrently */
      const results = await Promise.allSettled(items.map((item) => apiCall(item)));

      results.forEach((result, i) => {
        const item = items[i];
        const key = getKey(item);
        if (result.status === 'fulfilled') {
          succeeded.push(item);
          pendingRef.current.delete(key);
        } else {
          failed.push(item);
          errors.push(result.reason);
          pendingRef.current.delete(key);
          onRollback(item);
        }
      });

      if (failed.length === 0) {
        onSuccess?.(succeeded);
      } else {
        onError?.(failed, errors);
      }

      return { succeeded, failed, errors };
    },
    [],
  );

  return { executeOptimistic };
}
