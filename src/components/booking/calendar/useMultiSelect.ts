import { useCallback, useMemo, useRef, useState } from "react";
import type { DateOnly } from "../../../utils/time";
import { isPastPicked, sameSpot, type NewPicked, type PickedRange } from "./multiSelect";

export interface MultiSelectApi {
  items: PickedRange[];
  /** Touch: every tap or long press adds a place, until switched off. */
  touchMode: boolean;
  setTouchMode: (on: boolean) => void;
  add: (item: NewPicked) => void;
  remove: (id: string) => void;
  clear: () => void;
  /** A press with Ctrl, ⌘ or Shift held, or any press while the touch toggle is on. */
  isAdditive: (event?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) => boolean;
  isPast: (item: PickedRange) => boolean;
  /** The marked days that fall on this day: `past` ones are drawn muted. */
  dayState: (day: DateOnly) => "active" | "past" | null;
}

export function useMultiSelect(today: DateOnly): MultiSelectApi {
  const [items, setItems] = useState<PickedRange[]>([]);
  const [touchMode, setTouchMode] = useState(false);
  const counter = useRef(0);

  const add = useCallback((item: NewPicked) => {
    setItems((current) => {
      if (current.some((c) => sameSpot(c, item))) return current;
      counter.current += 1;
      return [...current, { ...item, id: `pick-${counter.current}` } as PickedRange];
    });
  }, []);
  const remove = useCallback((id: string) => setItems((current) => current.filter((c) => c.id !== id)), []);
  const clear = useCallback(() => setItems((current) => (current.length === 0 ? current : [])), []);

  return useMemo(
    () => ({
      items,
      touchMode,
      setTouchMode,
      add,
      remove,
      clear,
      isAdditive: (event) => touchMode || Boolean(event?.ctrlKey || event?.metaKey || event?.shiftKey),
      isPast: (item) => isPastPicked(item, today),
      dayState: (day) => {
        let state: "active" | "past" | null = null;
        for (const item of items) {
          if (item.kind !== "days" || day < item.from || day > item.to) continue;
          if (!isPastPicked(item, today)) return "active";
          state = "past";
        }
        return state;
      },
    }),
    [items, touchMode, add, remove, clear, today],
  );
}
