import type { ChipTone } from "../../ui";

/*
 * The small arithmetic of the quick registration (Etapa 2, decision 7,
 * contract C2): how the deadline is worded, how much of it is left, and what
 * the completion link is when the server did not send a full address.
 *
 * Nothing here knows how long the deadline is. The server computes
 * `registrationDeadlineUtc` from its `expiryHours` setting; a literal "24
 * hodin" anywhere on screen would be wrong the day the clinic changes it.
 */

const PRAGUE_TZ = "Europe/Prague";

const PARTS = new Intl.DateTimeFormat("cs-CZ", {
  timeZone: PRAGUE_TZ,
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** `4. 10. 2026 14:30` - the deadline the way the desk reads it out, Prague time. */
export function formatDeadline(instant: string | Date): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(
    PARTS.formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return `${parts.day}. ${parts.month}. ${parts.year} ${parts.hour}:${parts.minute}`;
}

/** The sentence under the new reservation. */
export function deadlineSentence(instant: string | Date): string {
  return `Pacient má čas na dokončení registrace do ${formatDeadline(instant)}`;
}

/** Below this the chip turns red: the patient is about to lose the slot. */
export const URGENT_MS = 3 * 60 * 60 * 1000;

export interface DeadlineView {
  /** `zbývá 21 h`, `zbývá 35 min`, or `lhůta vypršela`. */
  remaining: string;
  tone: ChipTone;
  expired: boolean;
}

/**
 * How much of the deadline is left. Hours are rounded up, so "zbývá 21 h"
 * never promises less time than there is; under an hour it counts minutes.
 * Under three hours the tone is red, otherwise beige.
 */
export function deadlineView(deadlineUtc: string, now: Date): DeadlineView {
  const left = new Date(deadlineUtc).getTime() - now.getTime();
  if (Number.isNaN(left)) return { remaining: "", tone: "beige", expired: false };
  if (left <= 0) return { remaining: "lhůta vypršela", tone: "red", expired: true };
  const minutes = Math.ceil(left / 60_000);
  const remaining =
    minutes < 60 ? `zbývá ${minutes} min` : `zbývá ${Math.ceil(minutes / 60)} h`;
  return { remaining, tone: left < URGENT_MS ? "red" : "beige", expired: false };
}

/** `Čeká na dokončení registrace · zbývá 21 h` - the chip's words. */
export function pendingChipText(view: DeadlineView): string {
  return view.expired
    ? "Čeká na dokončení registrace · lhůta vypršela"
    : `Čeká na dokončení registrace · ${view.remaining}`;
}

/**
 * The completion link as a full address. The server sends `url` when it knows
 * the public site; otherwise the token and the app's own origin build it. The
 * token is the only thing in the path - nothing personal ever is.
 */
export function completionUrl(
  link: { url: string | null; token: string },
  origin: string,
): string {
  const url = link.url?.trim() ?? "";
  if (url === "") return `${origin}/dokonceni/${link.token}`;
  // The server answers a relative path when it does not know the public address; a path alone
  // cannot be pasted into a message, so it gets the app's own origin.
  return url.startsWith("/") ? `${origin}${url}` : url;
}
