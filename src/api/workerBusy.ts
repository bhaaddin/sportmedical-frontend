/*
 * Stage 2, R4 - "one person does one thing at a time": the refusal `worker.busy` (HTTP 409) and what the desk is told about it.
 *
 * Contract (stage2-contract.md): the answer carries `code: "worker.busy"` and `details` with the clashing commitment -
 * `conflictKind` ("appointment" | "clubBlock"), `calendarName`, `activityName`, `startUtc` / `endUtc`, `overridable`. A club block names
 * its činnosti, never a player. `403 worker.busy.override_forbidden` answers an override by someone who may not make one.
 *
 * Nothing here ever shows the server's raw text of an unknown shape; the Czech sentence is built from the structured fields. (Read by
 * hand, not with a schema: this file is in the planner's first load and a detail object of five strings needs no library.)
 */
import { BookingApiError } from './apiError';
import { pragueDateKey } from '../utils/time';

export const WORKER_BUSY = 'worker.busy';
export const WORKER_BUSY_OVERRIDE_FORBIDDEN = 'worker.busy.override_forbidden';

export interface WorkerBusyDetails {
  conflictKind: 'appointment' | 'clubBlock';
  conflictId: string | null;
  calendarId: string | null;
  calendarName: string | null;
  activityName: string | null;
  startUtc: string | null;
  endUtc: string | null;
  workerUserId: string | null;
  overridable: boolean;
  conflictCount: number | null;
}

export interface WorkerBusy {
  details: WorkerBusyDetails;
  /** The refusal came back with `overridable: true` - an owner / administrator may retry with a reason. */
  overridable: boolean;
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

function readDetails(raw: unknown): WorkerBusyDetails {
  const r = (raw !== null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    conflictKind: r.conflictKind === 'clubBlock' ? 'clubBlock' : 'appointment',
    conflictId: text(r.conflictId),
    calendarId: text(r.calendarId),
    calendarName: text(r.calendarName),
    activityName: text(r.activityName),
    startUtc: text(r.startUtc),
    endUtc: text(r.endUtc),
    workerUserId: text(r.workerUserId),
    overridable: r.overridable === true,
    conflictCount: typeof r.conflictCount === 'number' && Number.isInteger(r.conflictCount) ? r.conflictCount : null,
  };
}

/** Is this the `worker.busy` refusal? (409 + code; an unusable detail still counts - the clash is real, the text is generic.) */
export function workerBusyOf(error: unknown): WorkerBusy | null {
  if (!(error instanceof BookingApiError) || error.code !== WORKER_BUSY) return null;
  const details = readDetails(error.details);
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
