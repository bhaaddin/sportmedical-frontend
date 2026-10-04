import type {
  ActivitySeat, ClubPaymentMethod, OrderDraft, OrderForm, OrderRange, SubmitInput,
} from '../../../api/publicClubOrder';

/* The form's own state and the pure rules around it. No wording and no price here:
   texts are slots, every number comes from the server's answers. */

/** The wanted term: "od–do" (the end is optional = one day) and a free note about the preferred time of day. */
export interface TermState {
  from: string;
  to: string;
  preferred: string;
}

export interface ContactState {
  name: string;
  phone: string;
  email: string;
}

export interface OrderState {
  serviceId: string | null;
  seats: Record<string, number>;
  term: TermState;
  payment: ClubPaymentMethod | null;
  contact: ContactState;
  note: string;
}

/** Today in the clinic's calendar, yyyy-MM-dd. */
export const todayPrague = (): string => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' });

export const MAX_SEATS = 999;

export function emptyState(): OrderState {
  return { serviceId: null, seats: {}, term: { from: '', to: '', preferred: '' }, payment: null, contact: { name: '', phone: '', email: '' }, note: '' };
}

/** A worker's prefill: only what still exists in the offer is kept. A single service is chosen for the club. */
export function stateFromDraft(draft: OrderDraft | null, form: OrderForm): OrderState {
  const state = emptyState();
  if (form.services.length === 1) state.serviceId = form.services[0].serviceId;
  if (draft === null) return state;
  const service = form.services.find((s) => s.serviceId === draft.serviceId) ?? null;
  if (service !== null) state.serviceId = service.serviceId;
  const active = form.services.find((s) => s.serviceId === state.serviceId) ?? null;
  if (active !== null) {
    for (const seat of draft.activitySeats ?? []) {
      if (active.activities.some((a) => a.activityId === seat.activityId) && seat.seats > 0) state.seats[seat.activityId] = Math.min(MAX_SEATS, seat.seats);
    }
  }
  const range = (draft.ranges ?? [])[0];
  if (range !== undefined) {
    const window = range.dailyFrom && range.dailyTo ? `${range.dailyFrom.slice(0, 5)}–${range.dailyTo.slice(0, 5)}` : '';
    state.term = { from: range.fromDate ?? '', to: range.toDate && range.toDate !== range.fromDate ? range.toDate : '', preferred: window };
  }
  state.payment = draft.paymentMethod !== null && form.paymentMethods.includes(draft.paymentMethod) ? draft.paymentMethod : null;
  state.contact = { name: draft.contact?.name ?? '', phone: draft.contact?.phone ?? '', email: draft.contact?.email ?? '' };
  state.note = draft.note ?? '';
  return state;
}

export const activitySeatsOf = (seats: Record<string, number>): ActivitySeat[] =>
  Object.entries(seats).filter(([, n]) => n > 0).map(([activityId, n]) => ({ activityId, seats: n }));

/** Why the term is not acceptable; null when it is. */
export function termProblem(term: TermState, today: string): string | null {
  if (term.from === '') return 'Vyberte, odkdy se vám termín hodí.';
  if (term.from < today) return 'Datum už je v minulosti.';
  if (term.to !== '' && term.to < term.from) return 'Konec termínu musí být po začátku.';
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
  if (state.payment === null) return false;
  if (state.serviceId === null || activitySeatsOf(state.seats).length === 0) return false;
  if (termProblem(state.term, today) !== null) return false;
  const c = contactProblems(state.contact);
  return c.name === null && c.phone === null && c.email === null;
}

export const rangesOf = (term: TermState): OrderRange[] => [{ fromDate: term.from, toDate: term.to === '' ? term.from : term.to }];

/** "2099-03-04" → "4. 3. 2099". */
export function czDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return y && m && d ? `${d}. ${m}. ${y}` : iso;
}

/** "4. 3. 2099 – 6. 3. 2099" or one day; with the preferred time of day when given. */
export function termText(term: TermState): string {
  const range = term.to === '' || term.to === term.from ? czDate(term.from) : `${czDate(term.from)} – ${czDate(term.to)}`;
  const pref = term.preferred.trim();
  return pref === '' ? range : `${range}, preferovaný čas: ${pref}`;
}

/** The preferred time of day has no field in the contract, so it travels at the head of the note. */
export function noteOf(state: OrderState): string {
  const pref = state.term.preferred.trim();
  const note = state.note.trim();
  return [pref === '' ? '' : `Preferovaný čas: ${pref}`, note].filter((x) => x !== '').join('\n');
}

export function submitPayload(state: OrderState): SubmitInput {
  const note = noteOf(state);
  return {
    serviceId: state.serviceId ?? '',
    activitySeats: activitySeatsOf(state.seats),
    ranges: rangesOf(state.term),
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
