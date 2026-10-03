/*
 * What other screens hand to Fakturace through `navigate('/billing', { state })`
 * and how it becomes the first lines of the new document - no React, so each
 * rule can be broken in a test.
 *
 *  - { patientId, appointmentId, activityId }  from a visit: the patient is
 *    preselected, the visit is tied to the invoice, and the činnost's
 *    price-list item is the first line (the činnost only points at the item,
 *    the price lives in the ceník).
 *  - { clubId, partnerOrderId }  from a club: the club pays, and the order's
 *    činnosti become lines - "12× Komplexní prohlídka" is twelve of them.
 *  - { invoiceId }  from a link to an existing document: scroll to it.
 *
 * Anything that is not a non-empty string is ignored, so a stale or foreign
 * `state` can never put rubbish in the form.
 */
import type { Activity } from '../../api/bookingContracts';

export interface BillingNavState {
  patientId?: string;
  appointmentId?: string;
  activityId?: string;
  clubId?: string;
  partnerOrderId?: string;
  invoiceId?: string;
}

/** One line of the document being drawn up: a price-list item and how many. */
export interface DraftLine {
  serviceId: string;
  quantity: number;
}

const KEYS: (keyof BillingNavState)[] = [
  'patientId', 'appointmentId', 'activityId', 'clubId', 'partnerOrderId', 'invoiceId',
];

export function readNavState(raw: unknown): BillingNavState {
  const out: BillingNavState = {};
  if (raw === null || typeof raw !== 'object') return out;
  for (const key of KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim() !== '') out[key] = value;
  }
  return out;
}

/** True when there is anything to act on, i.e. the page should do more than list. */
export function hasPrefill(state: BillingNavState): boolean {
  return KEYS.some((key) => state[key] !== undefined);
}

/** Adds `quantity` of an item to the lines, merging into a line already there. */
export function addLine(lines: DraftLine[], serviceId: string, quantity = 1): DraftLine[] {
  if (quantity < 1) return lines;
  if (lines.some((l) => l.serviceId === serviceId)) {
    return lines.map((l) => (l.serviceId === serviceId ? { ...l, quantity: l.quantity + quantity } : l));
  }
  return [...lines, { serviceId, quantity }];
}

/**
 * The lines an order or a visit stands for: each činnost through its
 * price-list item, in order. A činnost with no price-list item has no price
 * and is skipped - the caller says so rather than inventing a line.
 */
export function linesFromActivities(
  wanted: { activityId: string; count: number }[],
  activities: Pick<Activity, 'id' | 'serviceItemId'>[],
): { lines: DraftLine[]; unpriced: number } {
  let lines: DraftLine[] = [];
  let unpriced = 0;
  for (const { activityId, count } of wanted) {
    const itemId = activities.find((a) => a.id === activityId)?.serviceItemId ?? null;
    if (itemId === null) {
      unpriced += 1;
      continue;
    }
    lines = addLine(lines, itemId, count);
  }
  return { lines, unpriced };
}
