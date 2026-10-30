/*
 * The same hand-over other screens give the calendar by router state, spelled in the address so it can be copied,
 * bookmarked and opened in a new tab (NET-12):
 *
 *   /planovani?patient=ID&new=1            -> { newAppointment, patientId }   book this patient on the next free time
 *   /planovani?patient=ID&new=1&activity=ID  (+ service=ID) the činnost / služba already chosen
 *   /planovani?date=yyyy-MM-dd             -> { date }
 *
 * Router state wins when both are present (the state path stays the fallback). A patient id is an opaque id, never a
 * name or a number.
 */
export type CalendarHandoff = Record<string, unknown>;

/** A number that is stable for one history entry, so "handled once per entry" works for an address too. */
function keyNumber(key: string): number {
  let hash = 7;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) % 2_147_483_647;
  return hash + 1;
}

const ID = /^[A-Za-z0-9-]{1,64}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function handoffFromSearch(search: string, state: unknown, key: string): CalendarHandoff | null {
  const params = new URLSearchParams(search);
  const fromAddress: CalendarHandoff = {};
  const patient = params.get('patient') ?? '';
  const activity = params.get('activity') ?? '';
  const service = params.get('service') ?? '';
  const date = params.get('date') ?? '';
  if (params.get('new') === '1') fromAddress.newAppointment = keyNumber(key);
  if (ID.test(patient)) fromAddress.patientId = patient;
  if (ID.test(activity)) fromAddress.activityId = activity;
  if (ID.test(service)) fromAddress.serviceId = service;
  if (DAY.test(date)) fromAddress.date = date;
  const own = state !== null && typeof state === 'object' ? (state as CalendarHandoff) : null;
  if (Object.keys(fromAddress).length === 0) return own;
  return { ...fromAddress, ...(own ?? {}) };
}
