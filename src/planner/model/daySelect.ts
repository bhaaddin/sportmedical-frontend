/*
 * Marking days in the month: the state machine behind the old calendar's "Ctrl-drag several days" and "block whole
 * days" - pure, so the rules are tested as rules and the month only wires pointers to it.
 *
 *   idle ──begin──▶ dragging ──finish (2+ days)──▶ chosen   (the popover: book, block, hand to a club order)
 *                              ├─ finish (1 day) ──▶ idle     (a plain click: the day opens)
 *                              └─ finish, additive ─▶ a PLACE is added to the marked ones
 *   idle ──tap──▶ waiting ──tap──▶ chosen                    ("Vybrat od–do": touch has no drag with a modifier key)
 *
 * A plain press starts over (the marked places are dropped); a press with Ctrl, ⌘ or Shift - or any press while the
 * touch toggle "Vybrat víc dnů" is on - keeps them and adds one more place, even if it is a single day.
 */
import { addDaysToDateOnly } from '../../utils/time';
import { dayCount, orderRange, type DayRange } from '../../components/booking/calendar/model';
import { isPastPicked, type PickedDays } from '../../components/booking/calendar/multiSelect';
import type { IsoDate } from './types';

export type DayPlace = PickedDays;

/** A finished plain pick; `x` / `y` is where the pointer was let go (the popover opens beside it). */
export interface DayChoice extends DayRange {
  x: number;
  y: number;
}

export interface DaySelectState {
  anchor: IsoDate | null;
  current: IsoDate | null;
  /** A pointer is down and travelling (or a first day was tapped and the last is awaited). */
  dragging: boolean;
  /** The pick under way was started with a modifier key / the touch toggle: it ends as a place, not a choice. */
  additive: boolean;
  chosen: DayChoice | null;
  places: DayPlace[];
  nextId: number;
  /** Touch: tap the first day, then the last. */
  tapMode: boolean;
  /** Touch: every tap or drag adds one more place. */
  additiveMode: boolean;
}

export const INITIAL_DAY_SELECT: DaySelectState = {
  anchor: null,
  current: null,
  dragging: false,
  additive: false,
  chosen: null,
  places: [],
  nextId: 1,
  tapMode: false,
  additiveMode: false,
};

export type DaySelectAction =
  | { type: 'begin'; day: IsoDate; additive: boolean }
  | { type: 'enter'; day: IsoDate }
  | { type: 'finish'; x: number; y: number }
  | { type: 'tap'; day: IsoDate; x: number; y: number }
  | { type: 'setTapMode'; on: boolean }
  | { type: 'setAdditiveMode'; on: boolean }
  | { type: 'remove'; id: string }
  | { type: 'dismissChosen' }
  | { type: 'clear' };

const idle = (state: DaySelectState): DaySelectState => ({ ...state, anchor: null, current: null, dragging: false, additive: false });

/** Adds a place unless exactly that place is marked already. */
export function addPlace(state: DaySelectState, range: DayRange): DaySelectState {
  if (state.places.some((p) => p.from === range.from && p.to === range.to)) return idle(state);
  const place: DayPlace = { id: `day-${state.nextId}`, kind: 'days', from: range.from, to: range.to };
  return { ...idle(state), places: [...state.places, place], nextId: state.nextId + 1 };
}

export function daySelectReducer(state: DaySelectState, action: DaySelectAction): DaySelectState {
  switch (action.type) {
    case 'begin': {
      /* A plain press starts over; an additive one keeps what is marked. */
      const kept = action.additive ? state.places : [];
      return { ...state, places: kept, anchor: action.day, current: action.day, dragging: true, additive: action.additive, chosen: null };
    }
    case 'enter':
      return state.dragging && state.current !== action.day ? { ...state, current: action.day } : state;
    case 'finish': {
      if (!state.dragging) return state;
      const { anchor, current } = state;
      if (anchor === null || current === null) return idle(state);
      if (state.additive) return addPlace(state, orderRange(anchor, current));
      if (anchor === current) return idle(state);
      return { ...idle(state), chosen: { ...orderRange(anchor, current), x: action.x, y: action.y } };
    }
    case 'tap': {
      if (!state.tapMode) {
        /* The several-days toggle without "od–do": a tap marks that one day. */
        return state.additiveMode ? addPlace(state, { from: action.day, to: action.day }) : state;
      }
      if (state.anchor === null || state.chosen !== null) {
        return { ...state, chosen: null, anchor: action.day, current: action.day, dragging: false, additive: state.additiveMode };
      }
      if (state.anchor === action.day) return idle(state);
      const range = orderRange(state.anchor, action.day);
      if (state.additiveMode) return addPlace(state, range);
      return { ...idle(state), chosen: { ...range, x: action.x, y: action.y } };
    }
    case 'setTapMode':
      return { ...idle(state), chosen: null, tapMode: action.on };
    case 'setAdditiveMode':
      return { ...state, additiveMode: action.on };
    case 'remove':
      return { ...state, places: state.places.filter((p) => p.id !== action.id) };
    case 'dismissChosen':
      return state.chosen === null ? state : { ...state, chosen: null };
    case 'clear':
      return { ...INITIAL_DAY_SELECT, nextId: state.nextId, tapMode: state.tapMode, additiveMode: state.additiveMode };
  }
}

/** The run of days to light up right now: the choice awaiting its popover, or the drag / first tap in progress. */
export function highlightOf(state: DaySelectState): DayRange | null {
  if (state.chosen) return { from: state.chosen.from, to: state.chosen.to };
  return state.anchor !== null && state.current !== null ? orderRange(state.anchor, state.current) : null;
}

/** Whether a day lies in a marked place; places that began before today read "past" and are drawn muted. */
export function placeStateOf(day: IsoDate, places: readonly DayPlace[], today: IsoDate): 'active' | 'past' | null {
  let state: 'active' | 'past' | null = null;
  for (const place of places) {
    if (day < place.from || day > place.to) continue;
    if (!isPastPicked(place, today)) return 'active';
    state = 'past';
  }
  return state;
}

/**
 * What blocking a place may do: days from today on. A place wholly in the past blocks nothing (null); one that
 * began in the past starts today - the past cannot be blocked, and nobody asked to.
 */
export function blockableRange(range: DayRange, today: IsoDate): DayRange | null {
  if (range.to < today) return null;
  return { from: range.from < today ? today : range.from, to: range.to };
}

/** The ranges a block dialog works on: past ones trimmed or dropped, sorted, overlapping and touching ones joined. */
export function blockableRanges(places: readonly DayRange[], today: IsoDate): DayRange[] {
  const ranges = places
    .map((p) => blockableRange(p, today))
    .filter((r): r is DayRange => r !== null)
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  const out: DayRange[] = [];
  for (const r of ranges) {
    const last = out[out.length - 1];
    if (last && r.from <= addDaysToDateOnly(last.to, 1)) {
      if (r.to > last.to) last.to = r.to;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

/** How many days the ranges cover together. */
export const daysIn = (ranges: readonly DayRange[]): number => ranges.reduce((sum, r) => sum + dayCount(r), 0);

