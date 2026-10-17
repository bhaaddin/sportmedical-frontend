/*
 * A dialog's body and footer are rendered as siblings by the dialog frame, so state both need (busy, the
 * athletes a 409 listed, the ticked acknowledgement) lives in a tiny store that the dialog resets when it
 * opens. One store per dialog kind, created once at module load.
 */
import { useEffect, useSyncExternalStore } from 'react';

export interface FlowStore<T> {
  get: () => T;
  set: (patch: Partial<T>) => void;
  reset: () => void;
  subscribe: (listener: () => void) => () => void;
}

export function createFlowStore<T extends object>(initial: T): FlowStore<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  const emit = () => { for (const l of [...listeners]) l(); };
  return {
    get: () => state,
    set: (patch) => { state = { ...state, ...patch }; emit(); },
    reset: () => { state = initial; emit(); },
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
  };
}

/** Read the store; `resetOnMount` clears it when the dialog opens (call it in the BODY only). */
export function useFlow<T extends object>(store: FlowStore<T>, resetOnMount = false): T {
  useEffect(() => {
    if (resetOnMount) store.reset();
    return () => { if (resetOnMount) store.reset(); };
  }, [store, resetOnMount]);
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
