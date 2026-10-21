/*
 * The planner's own little event bus for movement: what happened on the board, told to whoever draws it, so the
 * motion belongs to the ACTION (a slot lands where it was placed, a pick ripples across its days, a refusal shakes)
 * and never to a re-render. Nothing here delays or changes data; it only carries "this just happened".
 *
 * The motion kit decides how much of it plays (plné / omezené / vypnuto) through `html[data-motion]`, which
 * `planner.fx.css` keys on; this file knows nothing about it.
 */
import { useSyncExternalStore } from 'react';

type Listener = () => void;

interface FxState {
  /** Wall-clock of the last write to the draft (a slot placed, a day picked, an undo). */
  wroteAt: number;
  /** Bumped by every refusal (over the limit, a past day, a closed day, a fulfilled činnost). */
  refusals: number;
  /** The days of the last month pick, in the order they were taken (the ripple runs along them). */
  picked: { token: number; at: number; dates: readonly string[] };
}

let state: FxState = { wroteAt: 0, refusals: 0, picked: { token: 0, at: 0, dates: [] } };
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());
const set = (next: Partial<FxState>) => {
  state = { ...state, ...next };
  emit();
};

export const planFx = {
  /** A slot / a day was written into the draft: cards that appear within `FRESH_MS` are the new ones. */
  wrote: () => set({ wroteAt: Date.now() }),
  /** The desk asked for more than the plan may hold: shake, gently, with the message that is already on screen. */
  refuse: () => set({ refusals: state.refusals + 1 }),
  /** The days a month pick took, for the ripple. */
  picked: (dates: readonly string[]) => set({ wroteAt: Date.now(), picked: { token: state.picked.token + 1, at: Date.now(), dates: [...dates] } }),
  get: (): FxState => state,
  subscribe: (l: Listener): (() => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** A card that mounts this soon after a write is the one the write made. */
export const FRESH_MS = 1200;

const useFx = <T,>(pick: (s: FxState) => T): T => useSyncExternalStore(planFx.subscribe, () => pick(planFx.get()), () => pick(planFx.get()));

export const useRefusals = (): number => useFx((s) => s.refusals);
export const usePickedDays = (): FxState['picked'] => useFx((s) => s.picked);

/** True when this component mounted right after a write (read once, at mount). */
export function wasJustWritten(): boolean {
  return Date.now() - planFx.get().wroteAt < FRESH_MS;
}
