/*
 * Stage 2, R4 - "one person does one thing at a time": the refusal `worker.busy` (HTTP 409) and what the desk is told about it.
 *
 * Contract (stage2-contract.md): the answer carries `code: "worker.busy"` and `details` with the clashing commitment -
 * `conflictKind` ("appointment" | "clubBlock"), `calendarName`, `activityName`, `startUtc` / `endUtc`, `overridable`. A club block names
 * its činnosti, never a player. `403 worker.busy.override_forbidden` answers an override by someone who may not make one.
 *
 * Nothing here ever shows the server's raw text of an unknown shape; the Czech sentence is built from the structured fields.
 */
import { z } from 'zod';
import { BookingApiError } from './apiError';
import { pragueDateKey } from '../utils/time';

export const WORKER_BUSY = 'worker.busy';
export const WORKER_BUSY_OVERRIDE_FORBIDDEN = 'worker.busy.override_forbidden';

const detailsSchema = z.object({
  conflictKind: z.enum(['appointment', 'clubBlock']).catch('appointment'),
  conflictId: z.string().nullish().transform((v) => v ?? null),
  calendarId: z.string().nullish().transform((v) => v ?? null),
  calendarName: z.string().nullish().transform((v) => v ?? null),
  activityName: z.string().nullish().transform((v) => v ?? null),
  startUtc: z.string().nullish().transform((v) => v ?? null),
  endUtc: z.string().nullish().transform((v) => v ?? null),
  workerUserId: z.string().nullish().transform((v) => v ?? null),
  overridable: z.boolean().nullish().transform((v) => v === true),
  conflictCount: z.number().int().nullish().transform((v) => v ?? null),
});
export type WorkerBusyDetails = z.infer<typeof detailsSchema>;

export interface WorkerBusy {
  details: WorkerBusyDetails;
  /** The refusal came back with `overridable: true` - an owner / administrator may retry with a reason. */
  overridable: boolean;
}

/** Is this the `worker.busy` refusal? (409 + code; an unparsable detail still counts - the clash is real, the text is generic.) */
export function workerBusyOf(error: unknown): WorkerBusy | null {
  if (!(error instanceof BookingApiError) || error.code !== WORKER_BUSY) return null;
  const parsed = detailsSchema.safeParse(error.details ?? {});
  const details = parsed.success ? parsed.data : detailsSchema.parse({});
  return { details, overridable: details.overridable };
}

/** `403 worker.busy.override_forbidden`: the override was sent by somebody who may not make it. */
export const isOverrideForbidden = (error: unknown): boolean => error instanceof BookingApiError && error.code === WORKER_BUSY_OVERRIDE_FORBIDDEN;

const clock = (utc: string | null): string | null => {
  if (!utc) return null;
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('cs-CZ', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Prague' }).format(d);
};

/** "09:00–09:45" / null. */
export function busyRange(details: Pick<WorkerBusyDetails, 'startUtc' | 'endUtc'>): string | null {
  const a = clock(details.startUtc);
  const b = clock(details.endUtc);
  return a && b ? `${a}–${b}` : a;
}

/** The sentence the desk reads, with the clashing booking named (calendar, činnost, time - never a patient). */
export function workerBusyMessage(busy: WorkerBusy): string {
  const d = busy.details;
  const what = d.conflictKind === 'clubBlock' ? `blokace klubu${d.activityName ? ` (${d.activityName})` : ''}` : d.activityName ?? 'jiná rezervace';
  const where = d.calendarName ? ` v kalendáři ${d.calendarName}` : '';
  const when = busyRange(d);
  const day = d.startUtc ? pragueDateKey(d.startUtc) : null;
  const dayText = day ? `${Number(day.slice(8, 10))}. ${Number(day.slice(5, 7))}. ` : '';
  const more = d.conflictCount !== null && d.conflictCount > 1 ? ` Překrývá se ${d.conflictCount} termínů, uveden je první.` : '';
  return `Pracovník je v tuto dobu zaneprázdněn: ${what}${where}${when ? `, ${dayText}${when}` : ''}.${more}`;
}

export const WORKER_BUSY_TEXT = {
  title: 'Pracovník je zaneprázdněn',
  override: 'Přesto potvrdit (správce)',
  overrideReason: 'Důvod výjimky',
  overrideHint: 'Výjimku smí udělat jen správce. Důvod se zapíše do historie rezervace.',
  forbidden: 'Přepsat zaneprázdněného pracovníka smí jen správce.',
  publicNote: 'Pracovník je v tuto dobu zaneprázdněn.',
} as const;
