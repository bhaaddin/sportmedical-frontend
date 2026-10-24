/*
 * "Vyžaduje pozornost" - what needs a person today, as pure functions over data the application already reads.
 *
 * No AI, no new endpoint, no guessing: each rule reads one list an existing api module returns and says, in words,
 * what is wrong and WHERE it is fixed. Every item carries an `EntityRef` or a plain target, so the card is a link to the
 * place that fixes it. A rule whose input is `null` (not asked yet, or the person may not see it) produces nothing - it
 * never claims "all is well" for something nobody looked at.
 *
 *   overdueInvoices     Fakturace: issued or part-paid, due before today, money still owed        (billing.manage)
 *   paperworkToday      today's standing appointments whose paperwork is not ready                (day list)
 *   expiringDocuments   a patient's document that stops covering a booking within its warning days (checkRequired)
 *   clubInquiries       club orders a club has submitted (`Requested`) and nobody has answered     (club orders)
 *   intakeReviews       registrations waiting for a person to match or register them              (patients.register)
 *   failedMessages      the outgoing queue's failed count                                         (settings.clinic.manage)
 */
import type { DayAppointment } from '../../api/bookingContracts';
import { statusTally } from '../../api/bookingContracts';
import type { Invoice } from '../../api/billing';
import { isOverdue } from '../../pages/billing/invoiceView';
import { formatCzk } from '../../components/booking/grid/appointmentPrice';
import { addDaysToDateOnly, formatDateOnly, formatPragueTime, pragueDateKey } from '../../utils/time';
import { entityTarget, type EntityRef } from './entities';

/* ───────────────────────────── inputs (structural: only what each rule reads) ───────────────────────────── */

export type InvoiceLike = Invoice;

export interface ClubOrderLike {
  id: string;
  clubId: string;
  clubName: string;
  status: string;
  totalSeats: number;
  submittedAtUtc: string | null;
}

export interface IntakeLike {
  intakeId: string;
  referenceNumber: string;
  givenName: string;
  familyName: string;
  submittedAtUtc: string;
}

/** A document that is about to stop covering a booking: one row of a patient's `/check`, with who it is about. */
export interface ExpiringLike {
  patientId: string;
  patientName: string;
  /** The template's name: "Výpis ze zdravotní dokumentace". */
  documentName: string;
  /** Date-only, the last day it is valid. */
  validUntil: string;
}

export interface AttentionInput {
  now: Date;
  invoices?: readonly InvoiceLike[] | null;
  /** Today's appointments (the day list). */
  todayAppointments?: readonly DayAppointment[] | null;
  /** Patient names by id, for the appointments' rows. Unknown ids are shown without a name, never as an id. */
  patientNames?: Readonly<Record<string, string>>;
  expiring?: readonly ExpiringLike[] | null;
  clubOrders?: readonly ClubOrderLike[] | null;
  intake?: readonly IntakeLike[] | null;
  /** The outgoing queue's failed count (`GET /api/system/health`, `outbox.failed`). */
  failedMessages?: number | null;
}

/* ───────────────────────────── outputs ───────────────────────────── */

export type AttentionId =
  | 'overdueInvoices'
  | 'paperworkToday'
  | 'expiringDocuments'
  | 'clubInquiries'
  | 'intakeReviews'
  | 'failedMessages'
  /* Settings screens' own attention cards (Phase 2, S-5): built by the screen's model from what that screen reads. */
  | 'systemProblems'
  | 'scheduleProblems'
  | 'offerProblems';

export type Severity = 'high' | 'medium' | 'low';

export interface AttentionItem {
  id: string;
  title: string;
  /** The one line that says what is wrong. */
  detail: string;
  /** Where it is fixed. */
  to: string;
  state?: Record<string, unknown>;
  /** The thing it is about, when it is one of the clinic's entities (draws a connected chip). */
  entity?: EntityRef;
}

export interface AttentionGroup {
  id: AttentionId;
  severity: Severity;
  title: string;
  /** How many things (not how many shown). */
  count: number;
  /** The first few, most urgent first. */
  items: AttentionItem[];
  /** One more sentence for the card's foot: what the total is, how old the oldest is. */
  summary: string;
  /** The button of the card: what it does and where it goes. */
  action: { label: string; to: string; state?: Record<string, unknown> };
}

/** How many items one group carries; the rest are one click away behind `action`. */
export const ITEMS_PER_GROUP = 5;

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/* ───────────────────────────── helpers ───────────────────────────── */

export const formatMoney = formatCzk;

const plural = (n: number, one: string, few: string, many: string): string => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);

/** Whole days from `from` to `to`, both date-only (Prague days; DST never shifts a date key). */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/* ───────────────────────────── the rules ───────────────────────────── */

export function overdueInvoices(input: AttentionInput): AttentionGroup | null {
  if (input.invoices == null) return null;
  const today = pragueDateKey(input.now);
  const late = input.invoices
    /* The very rule Fakturace's "Po splatnosti" filter uses, so the card and that screen count the same invoices. */
    .filter((i) => isOverdue(i, input.now))
    .map((i) => ({ invoice: i, days: daysBetween(pragueDateKey(i.dueDateUtc), today) }))
    /* The longest overdue first, then the biggest debt. */
    .sort((a, b) => b.days - a.days || b.invoice.remainingCzk - a.invoice.remainingCzk);
  if (late.length === 0) return null;
  const owed = late.reduce((sum, row) => sum + row.invoice.remainingCzk, 0);
  return {
    id: 'overdueInvoices',
    severity: 'high',
    title: 'Faktury po splatnosti',
    count: late.length,
    items: late.slice(0, ITEMS_PER_GROUP).map(({ invoice, days }) => {
      const who = invoice.clubName ?? invoice.recipientName ?? invoice.patientName ?? '';
      const target = entityTarget({ kind: 'invoice', id: invoice.id });
      return {
        id: `invoice-${invoice.id}`,
        title: `Faktura ${invoice.invoiceNumber}`,
        detail: `${who === '' ? '' : `${who} · `}po splatnosti ${days} ${plural(days, 'den', 'dny', 'dní')} · zbývá ${formatMoney(invoice.remainingCzk)}`,
        to: target.to,
        state: target.state,
        entity: { kind: 'invoice', id: invoice.id, label: invoice.invoiceNumber },
      };
    }),
    summary: `Celkem ${formatMoney(owed)} k zaplacení; nejstarší je ${late[0].days} ${plural(late[0].days, 'den', 'dny', 'dní')} po termínu.`,
    action: { label: 'Otevřít fakturaci', to: '/billing' },
  };
}

/** The words for what a booking's paperwork still misses, in the order a desk fixes them. */
export const PAPERWORK_WORDS: Record<string, string> = {
  registration_incomplete: 'dokončená registrace',
  questionnaire_missing: 'dotazník',
  questionnaire_expired: 'dotazník (propadl)',
  report_missing: 'výpis',
  consent_missing: 'souhlas',
};

const PAPERWORK_ORDER = ['registration_incomplete', 'questionnaire_missing', 'questionnaire_expired', 'report_missing', 'consent_missing'];

export function paperworkWords(missing: readonly string[]): string {
  const known = PAPERWORK_ORDER.filter((code) => missing.includes(code)).map((code) => PAPERWORK_WORDS[code]);
  const unknown = missing.some((code) => !(code in PAPERWORK_WORDS));
  return [...known, ...(unknown || known.length === 0 ? ['podklady'] : [])].join(', ');
}

export function paperworkToday(input: AttentionInput): AttentionGroup | null {
  if (input.todayAppointments == null) return null;
  const names = input.patientNames ?? {};
  /* What the day's plocha always counted: booked (Scheduled, Confirmed) and in the waiting room (CheckedIn). */
  const open = input.todayAppointments
    .filter((a) => (statusTally(a.status) === 'booked' || a.status === 2) && a.paperwork !== null && !a.paperwork.ready)
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  if (open.length === 0) return null;
  return {
    id: 'paperworkToday',
    severity: 'high',
    title: 'Dnes bez podkladů',
    count: open.length,
    items: open.slice(0, ITEMS_PER_GROUP).map((a) => {
      const missing = a.paperwork?.missing ?? [];
      const name = a.patientName ?? names[a.patientId] ?? '';
      /* A missing document or consent is fixed on the patient's card; a missing questionnaire on the booking. */
      const onCard = missing.some((code) => code === 'report_missing' || code === 'consent_missing');
      const to = onCard && a.patientId !== ''
        ? `${entityTarget({ kind: 'patient', id: a.patientId }).to}/dokumenty`
        : entityTarget({ kind: 'appointment', id: a.id, calendarId: a.calendarId ?? undefined }).to;
      return {
        id: `appointment-${a.id}`,
        title: name === '' ? `Termín v ${formatPragueTime(a.startUtc)}` : name,
        detail: `${formatPragueTime(a.startUtc)} · ${a.activityName} · chybí ${paperworkWords(missing)}`,
        to,
        entity: a.patientId !== '' && name !== '' ? { kind: 'patient', id: a.patientId, label: name } : undefined,
      };
    }),
    summary: `Dnešní termíny, u kterých pacient ještě nedodal všechno potřebné.`,
    action: { label: 'Dnešní přehled', to: '/dnes' },
  };
}

export function expiringDocuments(input: AttentionInput): AttentionGroup | null {
  if (input.expiring == null) return null;
  const today = pragueDateKey(input.now);
  const rows = input.expiring
    .filter((e) => e.validUntil >= today)
    .map((e) => ({ e, left: daysBetween(today, e.validUntil) }))
    .sort((a, b) => a.left - b.left);
  if (rows.length === 0) return null;
  return {
    id: 'expiringDocuments',
    severity: 'low',
    title: 'Brzy skončí platnost dokladu',
    count: rows.length,
    items: rows.slice(0, ITEMS_PER_GROUP).map(({ e, left }) => ({
      id: `doc-${e.patientId}-${e.documentName}`,
      title: e.patientName,
      detail: `${e.documentName} platí do ${formatDateOnly(e.validUntil)}${left === 0 ? ' (dnes)' : ` (za ${left} ${plural(left, 'den', 'dny', 'dní')})`}`,
      to: `${entityTarget({ kind: 'patient', id: e.patientId }).to}/dokumenty`,
      entity: { kind: 'patient', id: e.patientId, label: e.patientName },
    })),
    summary: 'Doklady dnešních pacientů, které brzy přestanou krýt jejich termín. Teď je levné je obnovit.',
    action: { label: 'Otevřít pacienty', to: '/patients' },
  };
}

export function clubInquiries(input: AttentionInput): AttentionGroup | null {
  if (input.clubOrders == null) return null;
  const waiting = input.clubOrders
    .filter((o) => o.status === 'Requested')
    .sort((a, b) => (a.submittedAtUtc ?? '').localeCompare(b.submittedAtUtc ?? ''));
  if (waiting.length === 0) return null;
  const today = pragueDateKey(input.now);
  const oldest = waiting[0].submittedAtUtc;
  const age = oldest === null ? null : daysBetween(pragueDateKey(oldest), today);
  return {
    id: 'clubInquiries',
    severity: 'medium',
    title: 'Poptávky klubů',
    count: waiting.length,
    items: waiting.slice(0, ITEMS_PER_GROUP).map((o) => {
      const target = entityTarget({ kind: 'order', id: o.id });
      return {
        id: `order-${o.id}`,
        title: o.clubName,
        detail: `${o.totalSeats} ${plural(o.totalSeats, 'místo', 'místa', 'míst')}${o.submittedAtUtc === null ? '' : ` · odesláno ${formatDateOnly(pragueDateKey(o.submittedAtUtc))}`}`,
        to: target.to,
        state: target.state,
        entity: { kind: 'club', id: o.clubId, label: o.clubName },
      };
    }),
    summary: age === null || age < 1 ? 'Klub odeslal poptávku a čeká na odpověď.' : `Nejstarší čeká ${age} ${plural(age, 'den', 'dny', 'dní')}.`,
    action: { label: 'Objednávky klubů', to: '/clubs/objednavky' },
  };
}

export function intakeReviews(input: AttentionInput): AttentionGroup | null {
  if (input.intake == null) return null;
  const waiting = [...input.intake].sort((a, b) => a.submittedAtUtc.localeCompare(b.submittedAtUtc));
  if (waiting.length === 0) return null;
  const today = pragueDateKey(input.now);
  const age = daysBetween(pragueDateKey(waiting[0].submittedAtUtc), today);
  return {
    id: 'intakeReviews',
    severity: 'medium',
    title: 'Registrace ke kontrole',
    count: waiting.length,
    items: waiting.slice(0, ITEMS_PER_GROUP).map((i) => ({
      id: `intake-${i.intakeId}`,
      title: `${i.givenName} ${i.familyName}`.trim() || i.referenceNumber,
      detail: `Odesláno ${formatDateOnly(pragueDateKey(i.submittedAtUtc))} · ${i.referenceNumber}`,
      to: '/intake-review',
    })),
    summary: age < 1 ? 'Nové registrace čekají, až je někdo spáruje s kartou nebo zaregistruje.' : `Nejstarší čeká ${age} ${plural(age, 'den', 'dny', 'dní')}.`,
    action: { label: 'Zkontrolovat registrace', to: '/intake-review' },
  };
}

export function failedMessages(input: AttentionInput): AttentionGroup | null {
  const failed = input.failedMessages;
  if (typeof failed !== 'number' || !Number.isFinite(failed) || failed <= 0) return null;
  return {
    id: 'failedMessages',
    severity: 'medium',
    title: 'Neodeslané zprávy',
    count: failed,
    items: [
      {
        id: 'outbox-failed',
        title: `${failed} ${plural(failed, 'zpráva', 'zprávy', 'zpráv')} se nepodařilo odeslat`,
        detail: 'Pacient nebo klub o ní nemusí vědět. Příčinu ukáže Zdraví systému.',
        to: '/system-health',
      },
    ],
    summary: 'Připomínky a potvrzení, které odchozí fronta nedoručila.',
    action: { label: 'Zdraví systému', to: '/system-health' },
  };
}

/* ───────────────────────────── the shelf ───────────────────────────── */

/** Every group that has something in it, most urgent first (severity, then how many). */
export function attentionGroups(input: AttentionInput): AttentionGroup[] {
  const groups = [overdueInvoices, paperworkToday, expiringDocuments, clubInquiries, intakeReviews, failedMessages]
    .map((rule) => rule(input))
    .filter((g): g is AttentionGroup => g !== null);
  return groups.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.count - a.count);
}

/** The headline number: how many things in all need somebody. */
export const attentionTotal = (groups: readonly AttentionGroup[]): number => groups.reduce((sum, g) => sum + g.count, 0);

/** The window the expiring-documents rule asks about: the patients of today's bookings, at most this many calls. */
export const EXPIRING_PATIENT_LIMIT = 10;

/** The day after `today`, for callers that need "tomorrow" without a second date library. */
export const tomorrowOf = (today: string): string => addDaysToDateOnly(today, 1);
