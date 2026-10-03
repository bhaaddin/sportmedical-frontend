import { canChangeStatus } from "../../api/bookingContracts";
import type { AppointmentPaymentState, AvailabilitySlot } from "../../api/bookingContracts";
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

/* ── Podklady k této prohlídce (3. 10. 2026) ── */

/**
 * The owner's rule: when a patient is in the system, the top of the detail
 * shows every protocol the doctor requires for THIS visit, each with its
 * state - and when a later examination needs another document, that one is
 * asked for too. Nothing here decides what is required; it reads three answers
 * the server already gives and words them:
 *
 *   - `paperwork.missing` on the appointment (4.5 v29/v30): the registry's
 *     verdict on the registration and the questionnaire, plus `report_missing`
 *     when the service's document rule is not met;
 *   - `questionnaireRequirement` on the činnost (4.3): whether a questionnaire
 *     is asked for at all, so "nothing missing" can be told from "not wanted";
 *   - `/api/documents/patient/{id}/check`, filtered to this appointment: one
 *     row per document the service's rules ask for, with the server's standing.
 *
 * `paperwork === null` means the registry could not answer (see
 * `paperworkSchema`), and that is drawn as "Nelze ověřit", never as fine.
 */
export type PaperworkState = "ok" | "missing" | "notRequired" | "unknown";

export type PaperworkAction = "completionLink" | "documents";

export interface PaperworkRow {
  key: string;
  label: string;
  state: PaperworkState;
  /** The second line: why, or until when. */
  detail?: string;
  /** The one thing the desk can do about a missing row today. */
  action?: PaperworkAction;
}

export const PAPERWORK_STATE_LABEL: Record<PaperworkState, string> = {
  ok: "V pořádku",
  missing: "Chybí",
  notRequired: "Nevyžaduje se",
  unknown: "Nelze ověřit",
};

export const PAPERWORK_STATE_TONE: Record<PaperworkState, ChipTone> = {
  ok: "green",
  missing: "beige",
  notRequired: "grey",
  unknown: "grey",
};

/** The server's reason codes this section knows how to word. */
export const PAPERWORK_CODE = {
  registrationIncomplete: "registration_incomplete",
  questionnaireMissing: "questionnaire_missing",
  questionnaireExpired: "questionnaire_expired",
  reportMissing: "report_missing",
} as const;

/** One document the service's rules ask of this appointment, as `/check` reports it. */
export interface PaperworkDocument {
  templateId: string;
  templateName: string;
  serviceName: string;
  standing: string;
  validUntil?: string | null;
}

export interface PaperworkInput {
  paperwork: { ready: boolean; missing: readonly string[] } | null;
  /** From the činnost; `null` while the activity is not known. */
  questionnaireRequirement: "NotAsked" | "Optional" | "Required" | null;
  /** The rows of `/check` for this appointment; `null` when that read failed or is pending. */
  documents: readonly PaperworkDocument[] | null;
  formatDate: (iso: string) => string;
}

const joinDetail = (...parts: (string | undefined)[]): string | undefined =>
  parts.filter(Boolean).join(" · ") || undefined;

export function paperworkRows(input: PaperworkInput): PaperworkRow[] {
  const { paperwork, questionnaireRequirement, documents, formatDate } = input;
  const missing = new Set(paperwork?.missing ?? []);
  const rows: PaperworkRow[] = [];

  /* 1. The registration itself. */
  if (missing.has(PAPERWORK_CODE.registrationIncomplete)) {
    rows.push({
      key: "registration",
      label: "Dokončená registrace",
      state: "missing",
      detail: "pacient zatím nedokončil registraci přes odkaz",
      action: "completionLink",
    });
  } else {
    rows.push({
      key: "registration",
      label: "Dokončená registrace",
      state: paperwork === null ? "unknown" : "ok",
    });
  }

  /* 2. The questionnaire - wanted or not is the činnost's setting. */
  if (missing.has(PAPERWORK_CODE.questionnaireMissing)) {
    rows.push({
      key: "questionnaire",
      label: "Vstupní dotazník",
      state: "missing",
      detail: "pacient dotazník zatím nevyplnil",
      action: "completionLink",
    });
  } else if (missing.has(PAPERWORK_CODE.questionnaireExpired)) {
    rows.push({
      key: "questionnaire",
      label: "Vstupní dotazník",
      state: "missing",
      detail: "vyplněný dotazník je starší než 2 roky",
      action: "completionLink",
    });
  } else if (questionnaireRequirement === "NotAsked") {
    rows.push({
      key: "questionnaire",
      label: "Vstupní dotazník",
      state: "notRequired",
      detail: "tato činnost dotazník nevyžaduje",
    });
  } else if (paperwork === null) {
    rows.push({ key: "questionnaire", label: "Vstupní dotazník", state: "unknown" });
  } else {
    rows.push({
      key: "questionnaire",
      label: "Vstupní dotazník",
      state: "ok",
      detail: questionnaireRequirement === "Optional" ? "nepovinný u této činnosti" : undefined,
    });
  }

  /* 3. Documents, one row each, in the server's standing. */
  if (documents !== null && documents.length > 0) {
    for (const doc of documents) {
      const by = doc.serviceName.trim() !== "" ? `vyžaduje služba ${doc.serviceName}` : undefined;
      const until = doc.validUntil ? `platí do ${formatDate(doc.validUntil)}` : undefined;
      const key = `doc-${doc.templateId}`;
      switch (doc.standing) {
        case "Valid":
          rows.push({ key, label: doc.templateName, state: "ok", detail: joinDetail(by, until) });
          break;
        case "ExpiringSoon":
          rows.push({
            key,
            label: doc.templateName,
            state: "ok",
            detail: joinDetail(by, until, "brzy vyprší"),
            action: "documents",
          });
          break;
        case "Expired":
          rows.push({
            key,
            label: doc.templateName,
            state: "missing",
            detail: joinDetail(
              by,
              doc.validUntil ? `platnost skončila ${formatDate(doc.validUntil)}` : "platnost skončila",
            ),
            action: "documents",
          });
          break;
        default:
          /* `Missing`, and any standing this screen has not met: needs attention, never fine. */
          rows.push({
            key,
            label: doc.templateName,
            state: "missing",
            detail: joinDetail(by, "nic není doloženo"),
            action: "documents",
          });
      }
    }
  } else if (missing.has(PAPERWORK_CODE.reportMissing)) {
    /* The registry says a report is wanted and the document list cannot name it. */
    rows.push({
      key: "report",
      label: "Výpis od předchozího lékaře",
      state: "missing",
      detail: "vyžaduje služba této prohlídky",
      action: "documents",
    });
  } else if (documents === null) {
    rows.push({
      key: "documents",
      label: "Lékařské dokumenty",
      state: "unknown",
      detail: "seznam požadovaných dokumentů se nepodařilo načíst",
    });
  } else {
    rows.push({
      key: "documents",
      label: "Lékařské dokumenty",
      state: "notRequired",
      detail: "tato služba žádný dokument nevyžaduje",
    });
  }

  /* 4. A reason this screen does not know is shown, never dropped. */
  const known = Object.values(PAPERWORK_CODE) as string[];
  for (const code of missing) {
    if (!known.includes(code)) {
      rows.push({ key: `unknown-${code}`, label: `Neznámý požadavek (${code})`, state: "missing" });
    }
  }

  return rows;
}

/**
 * PLATBA in the board's words and tones (G3, 3. 10. 2026). The server's four
 * states; anything it has not named yet reads as "no invoice", in grey.
 */
export function paymentView(state: AppointmentPaymentState | null | undefined): { label: string; tone: ChipTone } {
  switch (state) {
    case "paid":
      return { label: "Zaplaceno", tone: "green" };
    case "partial":
      return { label: "Částečně zaplaceno", tone: "beige" };
    case "unpaid":
      return { label: "Nezaplaceno", tone: "red" };
    default:
      return { label: "Bez dokladu", tone: "grey" };
  }
}

/** "2 chybí" / "vše v pořádku" / "nelze ověřit" - the section's one-line summary. */
export function paperworkSummary(rows: readonly PaperworkRow[]): { text: string; tone: ChipTone } {
  const missing = rows.filter((r) => r.state === "missing").length;
  if (missing > 0) {
    return { text: missing === 1 ? "1 chybí" : `${missing} chybí`, tone: "beige" };
  }
  if (rows.some((r) => r.state === "unknown")) return { text: "nelze ověřit", tone: "grey" };
  return { text: "vše v pořádku", tone: "green" };
}
