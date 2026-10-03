/*
 * What other screens hand to Fakturace through `navigate('/billing', { state })`
 * and how it becomes the first lines of the new document - no React, so each
 * rule can be broken in a test.
 *
 *  - { patientId, appointmentId, activityId }  from a visit: a document for a
 *    person - the patient is preselected, the visit is tied to the invoice and
 *    the činnost is the first line (its price comes from the ceník, which the
 *    server reads when it quotes).
 *  - { clubId, partnerOrderId }  from a club's order: a document for the team,
 *    and the order's činnosti become lines - "12× Komplexní prohlídka" is twelve.
 *  - { clubId, clubBlockId, headcount }  from the club page: a document for the
 *    team, the headcount filled in, and the block's činnosti as the lines.
 *  - { invoiceId }  from a link to an existing document: scroll to it.
 *
 * Anything that is not a non-empty string (a positive whole number for the
 * headcount) is ignored, so a stale or foreign `state` can never put rubbish in
 * the form.
 */
import type { Activity } from '../../api/bookingContracts';
import type { RecipientType } from '../../api/billing';

export interface BillingNavState {
  patientId?: string;
  appointmentId?: string;
  activityId?: string;
  clubId?: string;
  partnerOrderId?: string;
  clubBlockId?: string;
  invoiceId?: string;
  headcount?: number;
}

/** One line of the document being drawn up: a činnost and how many. */
export interface DraftLine {
  activityId: string;
  quantity: number;
}

const STRING_KEYS = [
  'patientId', 'appointmentId', 'activityId', 'clubId', 'partnerOrderId', 'clubBlockId', 'invoiceId',
] as const;

export function readNavState(raw: unknown): BillingNavState {
  const out: BillingNavState = {};
  if (raw === null || typeof raw !== 'object') return out;
  const source = raw as Record<string, unknown>;
  for (const key of STRING_KEYS) {
    const value = source[key];
    if (typeof value === 'string' && value.trim() !== '') out[key] = value;
  }
  const given = source.headcount;
  if (typeof given === 'number' || (typeof given === 'string' && given.trim() !== '')) {
    const headcount = Number(given);
    if (Number.isInteger(headcount) && headcount >= 1) out.headcount = headcount;
  }
  return out;
}

/** True when there is anything to act on, i.e. the page should do more than list. */
export function hasPrefill(state: BillingNavState): boolean {
  return STRING_KEYS.some((key) => state[key] !== undefined) || state.headcount !== undefined;
}

/** True when the state asks for a new document (not merely to scroll to one). */
export function wantsNewInvoice(state: BillingNavState): boolean {
  return state.patientId !== undefined || state.clubId !== undefined || state.appointmentId !== undefined
    || state.activityId !== undefined || state.partnerOrderId !== undefined || state.clubBlockId !== undefined;
}

/** A club makes it a team's document; a visit or a patient, a person's. */
export function recipientTypeFromState(state: BillingNavState): RecipientType {
  return state.clubId !== undefined || state.clubBlockId !== undefined || state.partnerOrderId !== undefined
    ? 'Team'
    : 'Person';
}

/** Adds `quantity` of a činnost to the lines, merging into a line already there. */
export function addLine(lines: DraftLine[], activityId: string, quantity = 1): DraftLine[] {
  if (quantity < 1) return lines;
  if (lines.some((l) => l.activityId === activityId)) {
    return lines.map((l) => (l.activityId === activityId ? { ...l, quantity: l.quantity + quantity } : l));
  }
  return [...lines, { activityId, quantity }];
}

/**
 * The lines an order, a block or a visit stands for: each činnost that exists
 * and has a price in the ceník, in order. A činnost with no price-list item has
 * no price and is skipped - the caller says so rather than inventing a line.
 */
export function linesFromActivities(
  wanted: { activityId: string; count: number }[],
  activities: Pick<Activity, 'id' | 'priceCzk'>[],
): { lines: DraftLine[]; unpriced: number } {
  let lines: DraftLine[] = [];
  let unpriced = 0;
  for (const { activityId, count } of wanted) {
    const price = activities.find((a) => a.id === activityId)?.priceCzk ?? null;
    if (price === null) {
      unpriced += 1;
      continue;
    }
    lines = addLine(lines, activityId, count);
  }
  return { lines, unpriced };
}
