import { canChangeStatus } from "../../api/bookingContracts";
import type { AvailabilitySlot } from "../../api/bookingContracts";
import { pragueWallClockToInstant, type DateOnly } from "../../utils/time";
import type { ChipTone } from "../ui";

/*
 * The arithmetic behind the appointment detail and its edit mode (board
 * screens 12 and 13), kept apart from the markup so it can be tested without
 * a DOM: which chip tone a status gets, how the header dates are worded, what
 * an edit actually changes, and whether a typed start is one the server
 * offered.
 */

const PRAGUE_TZ = "Europe/Prague";

/** The status codes of 4.5, named where they are used. */
export const STATUS = {
  scheduled: 0,
  confirmed: 1,
  checkedIn: 2,
  completed: 3,
  cancelled: 4,
  noShow: 5,
} as const;

/** The board's tones: expected is green, absent is red, finished is grey. */
export function statusTone(status: number): ChipTone {
  switch (status) {
    case STATUS.scheduled:
    case STATUS.confirmed:
    case STATUS.checkedIn:
      return "green";
    case STATUS.noShow:
      return "red";
    default:
      return "grey";
  }
}

/** 4.5: `source` 0 is the desk, 1 the public web, 2 a club. */
export function sourceLabel(source: number | null): string {
  switch (source) {
    case 0:
      return "Recepce";
    case 1:
      return "Web";
    case 2:
      return "Klub";
    default:
      return "—";
  }
}

const longDate = new Intl.DateTimeFormat("cs-CZ", {
  timeZone: PRAGUE_TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortWeekday = new Intl.DateTimeFormat("cs-CZ", {
  timeZone: PRAGUE_TZ,
  weekday: "short",
});

const numericDate = new Intl.DateTimeFormat("cs-CZ", {
  timeZone: PRAGUE_TZ,
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const wallClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: PRAGUE_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const wallDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: PRAGUE_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function asDate(instant: Date | string): Date {
  return typeof instant === "string" ? new Date(instant) : instant;
}

/** "Pondělí 26. října 2026" - the board's header line, capitalised. */
export function formatLongPragueDate(instant: Date | string): string {
  const text = longDate.format(asDate(instant));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Po 26. 10. 2026, 09:30" - the edit header's subtitle. */
export function formatShortPragueDateTime(instant: Date | string): string {
  const date = asDate(instant);
  const weekday = shortWeekday.format(date).replace(/\.$/, "");
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${cap} ${numericDate.format(date)}, ${formatWallClock(date)}`;
}

/** "09:30" - always two digits, as a `<input type="time">` wants it. */
export function formatWallClock(instant: Date | string): string {
  return wallClock.format(asDate(instant));
}

/** "2026-10-26" - the Prague date, as a `<input type="date">` wants it. */
export function pragueWallDate(instant: Date | string): DateOnly {
  return wallDate.format(asDate(instant));
}

/** Whole minutes between two instants; never negative. */
export function durationMinutes(startUtc: string, endUtc: string): number {
  const ms = new Date(endUtc).getTime() - new Date(startUtc).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

/** "1 600 Kč", the board's money. */
export function formatCzk(amount: number): string {
  return `${new Intl.NumberFormat("cs-CZ").format(amount)} Kč`;
}

/** "BK" for Bohumil Komárek; one letter for one word; "?" for nothing. */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return `${first}${last}`.toUpperCase();
}

/**
 * The statuses the STAV select may offer: the current one, plus every one the
 * transition table allows from it - except cancelling, which is its own
 * button with its own reason (5.8), never a value in a dropdown.
 */
export function reachableStatuses(from: number): number[] {
  const out = [from];
  for (const to of [0, 1, 2, 3, 5]) {
    if (to !== from && canChangeStatus(from, to)) out.push(to);
  }
  return out;
}

export interface EditDraft {
  date: DateOnly;
  /** "HH:mm", Prague wall clock. */
  time: string;
  status: number;
}

export interface EditPlan {
  /** The new start as a UTC instant, or null when the time did not change. */
  startUtc: string | null;
  /** The new status code, or null when it did not change. */
  status: number | null;
}

/** The draft the edit form opens with: exactly what the appointment is now. */
export function draftFrom(appointment: { startUtc: string; status: number }): EditDraft {
  return {
    date: pragueWallDate(appointment.startUtc),
    time: formatWallClock(appointment.startUtc),
    status: appointment.status,
  };
}

/**
 * What saving a draft would write. Each change is its own call on the server
 * (`/time`, `/status`), so the plan says which of the two are needed; both
 * null means "Uložit změny" has nothing to do and stays disabled.
 */
export function planEdit(
  original: { startUtc: string; status: number },
  draft: EditDraft,
): EditPlan {
  /* A half-typed field is not a move; the instant helper would throw on it. */
  const wellFormed = /^\d{4}-\d{2}-\d{2}$/.test(draft.date) && /^\d{2}:\d{2}$/.test(draft.time);
  const wanted = wellFormed ? pragueWallClockToInstant(draft.date, draft.time) : null;
  const sameTime =
    wanted === null ||
    Number.isNaN(wanted.getTime()) ||
    wanted.toISOString() === new Date(original.startUtc).toISOString();
  return {
    startUtc: sameTime || wanted === null ? null : wanted.toISOString(),
    status: draft.status === original.status ? null : draft.status,
  };
}

/** 6.1: a start is free only if the server listed it. */
export function isOfferedStart(slots: AvailabilitySlot[] | undefined, startUtc: string): boolean {
  if (!slots) return false;
  const wanted = new Date(startUtc).getTime();
  return slots.some((slot) => new Date(slot.startUtc).getTime() === wanted);
}
