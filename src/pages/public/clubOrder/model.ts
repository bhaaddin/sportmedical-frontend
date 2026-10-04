import type {
  ActivitySeat, ClubPaymentMethod, OrderDraft, OrderForm, OrderRange, SubmitInput,
} from '../../../api/publicClubOrder';

/* The form's own state and the pure rules around it. No wording and no price here:
   texts are slots, every number comes from the server's answers. */

export interface TermRow {
  id: number;
  date: string;
  from: string;
  to: string;
}

export interface ContactState {
  name: string;
  phone: string;
  email: string;
}

export interface OrderState {
  serviceId: string | null;
  seats: Record<string, number>;
  terms: TermRow[];
  payment: ClubPaymentMethod | null;
  contact: ContactState;
  note: string;
}

let rowCounter = 0;
export const newTerm = (patch: Partial<TermRow> = {}): TermRow => ({ id: ++rowCounter, date: '', from: '', to: '', ...patch });

/** Today in the clinic's calendar, yyyy-MM-dd. */
export const todayPrague = (): string => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' });

export const MAX_SEATS = 999;

export function emptyState(): OrderState {
  return { serviceId: null, seats: {}, terms: [newTerm()], payment: null, contact: { name: '', phone: '', email: '' }, note: '' };
}

/** A worker's prefill: only what still exists in the offer is kept. */
export function stateFromDraft(draft: OrderDraft | null, form: OrderForm): OrderState {
  const state = emptyState();
  if (draft === null) return state;
  const service = form.services.find((s) => s.serviceId === draft.serviceId) ?? null;
  state.serviceId = service?.serviceId ?? null;
  if (service !== null) {
    for (const seat of draft.activitySeats ?? []) {
      if (service.activities.some((a) => a.activityId === seat.activityId) && seat.seats > 0) state.seats[seat.activityId] = Math.min(MAX_SEATS, seat.seats);
    }
  }
  const terms = (draft.ranges ?? []).map((r) => newTerm({ date: r.fromDate ?? '', from: r.dailyFrom?.slice(0, 5) ?? '', to: r.dailyTo?.slice(0, 5) ?? '' }));
  if (terms.length > 0) state.terms = terms;
  state.payment = draft.paymentMethod !== null && form.paymentMethods.includes(draft.paymentMethod) ? draft.paymentMethod : null;
  state.contact = { name: draft.contact?.name ?? '', phone: draft.contact?.phone ?? '', email: draft.contact?.email ?? '' };
  state.note = draft.note ?? '';
  return state;
}

export const activitySeatsOf = (seats: Record<string, number>): ActivitySeat[] =>
  Object.entries(seats).filter(([, n]) => n > 0).map(([activityId, n]) => ({ activityId, seats: n }));

/** Why a term row is not acceptable; null when it is. */
export function termProblem(row: TermRow, today: string): string | null {
  if (row.date === '') return 'Vyberte datum.';
  if (row.date < today) return 'Datum už je v minulosti.';
  if (row.from === '' || row.to === '') return 'Vyplňte čas od i do.';
  if (row.to <= row.from) return 'Čas „do“ musí být po čase „od“.';
  return null;
}

export const digitsOnly = (text: string): string => text.replace(/\D/g, '');
export const emailLooksValid = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export function contactProblems(c: ContactState): { name: string | null; phone: string | null; email: string | null } {
  return {
    name: c.name.trim() === '' ? 'Vyplňte jméno.' : null,
    phone: digitsOnly(c.phone).length < 9 ? 'Vyplňte telefon.' : null,
    email: emailLooksValid(c.email) ? null : 'Vyplňte e-mail ve tvaru jmeno@domena.cz.',
  };
}

export function isValid(state: OrderState, today: string): boolean {
  if (state.serviceId === null || activitySeatsOf(state.seats).length === 0) return false;
  if (state.terms.length === 0 || state.terms.some((t) => termProblem(t, today) !== null)) return false;
  if (state.payment === null) return false;
  const c = contactProblems(state.contact);
  return c.name === null && c.phone === null && c.email === null;
}

export const rangesOf = (terms: TermRow[]): OrderRange[] =>
  terms.map((t) => ({ fromDate: t.date, toDate: t.date, dailyFrom: t.from, dailyTo: t.to }));

export function submitPayload(state: OrderState): SubmitInput {
  const note = state.note.trim();
  return {
    serviceId: state.serviceId ?? '',
    activitySeats: activitySeatsOf(state.seats),
    ranges: rangesOf(state.terms),
    paymentMethod: state.payment ?? 'ClubInvoice',
    contact: { name: state.contact.name.trim(), phone: state.contact.phone.trim(), email: state.contact.email.trim() },
    ...(note !== '' ? { note } : {}),
  };
}

/** "90" → "01:30". */
export function hhmm(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export const czk = (amount: number): string => `${amount.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} Kč`;

export type FieldKey = 'serviceId' | 'activitySeats' | 'ranges' | 'paymentMethod' | 'name' | 'phone' | 'email' | 'note' | 'other';

/** Sorts the server's `{ field: [messages] }` into the form's fields; whatever fits none goes to 'other'. */
export function sortFieldErrors(errors: Record<string, string[]>): Partial<Record<FieldKey, string[]>> {
  const out: Partial<Record<FieldKey, string[]>> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const k = key.toLowerCase();
    let target: FieldKey = 'other';
    if (k.includes('serviceid')) target = 'serviceId';
    else if (k.includes('activityseat') || k.includes('seats') || k.includes('players')) target = 'activitySeats';
    else if (k.includes('range') || k.includes('term')) target = 'ranges';
    else if (k.includes('payment')) target = 'paymentMethod';
    else if (k.includes('name')) target = 'name';
    else if (k.includes('phone')) target = 'phone';
    else if (k.includes('email')) target = 'email';
    else if (k.includes('note')) target = 'note';
    out[target] = [...(out[target] ?? []), ...messages];
  }
  return out;
}
