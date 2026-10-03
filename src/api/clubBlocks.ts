import client from './client';
import { AxiosError } from 'axios';

/*
 * Club blocks - Etapa 2 contract C4 (`docs/etapa2/BRIEF.md`).
 *
 * A block holds a stretch of the calendars for one club: the chosen činnosti on
 * the chosen calendars between two dates, coloured with the club, and the
 * athletes fill it as they register through the club link. Shortening or
 * cancelling it frees the slots again.
 *
 *   POST   /api/v1/club-blocks                 create
 *   GET    /api/v1/club-blocks?from&to&clubId&status
 *   GET    /api/v1/club-blocks/{id}
 *   PUT    /api/v1/club-blocks/{id}            shorten / extend / edit
 *   DELETE /api/v1/club-blocks/{id}?cancelAthletes=true|false
 *   POST   /api/v1/club-blocks/calculate       the calculator
 *
 * Every answer is read leniently (`toBlock`, `toCalculation`): the screens
 * must not white-screen over a field the server adds or leaves out, and a
 * number that is missing is "unknown", never zero.
 *
 * Why not `toBookingError`: a 409 here carries the list of athletes the change
 * would hit, and the shared mapper keeps only the message. `ClubBlockError`
 * keeps the body's useful parts - the message, the field sentences and the
 * affected athletes - and nothing else (a body may carry personal data; it is
 * never logged).
 */

export type ClubBlockStatus = 'Active' | 'Cancelled';

/** One athlete who took a place inside the block. Optional on the detail read. */
export interface ClubBlockAthlete {
  id: string;
  name: string;
  activityName: string;
  startUtc: string | null;
  /** False while the questionnaire or a required document is missing. */
  ready: boolean;
}

export interface ClubBlockView {
  id: string;
  clubId: string;
  clubName: string;
  /** Derived from the club by the server, stable per club. */
  colorHex: string | null;
  name: string | null;
  calendarIds: string[];
  activityIds: string[];
  fromDate: string;
  toDate: string;
  dailyFrom: string | null;
  dailyTo: string | null;
  playerCount: number;
  seats: number;
  registered: number;
  status: ClubBlockStatus;
  registrationToken: string | null;
  registrationUrl: string | null;
  note: string | null;
  createdAtUtc: string | null;
  /** Only the detail read (`GET /{id}`) lists them; the list read leaves it out. */
  athletes: ClubBlockAthlete[] | null;
}

export interface ClubBlockInput {
  clubId: string;
  name?: string | null;
  calendarIds: string[];
  activityIds: string[];
  fromDate: string;
  toDate: string;
  dailyFrom?: string | null;
  dailyTo?: string | null;
  playerCount: number;
  note?: string | null;
}

/** What `PUT` may change: shorten or extend, the headcount, the note, the daily window. */
export interface ClubBlockUpdate {
  fromDate: string;
  toDate: string;
  playerCount?: number;
  note?: string | null;
  dailyFrom?: string | null;
  dailyTo?: string | null;
}

export interface ClubBlockListParams {
  from?: string;
  to?: string;
  clubId?: string;
  status?: ClubBlockStatus;
}

export interface CalculationInput {
  playerCount: number;
  activityIds: string[];
  calendarIds: string[];
  fromDate?: string;
}

export interface DayOpen {
  date: string;
  openMinutes: number;
}

export interface Calculation {
  minutesPerPlayer: number;
  parallelCapacity: number;
  neededMinutes: number;
  dailyOpenMinutes: number;
  suggestedDays: number;
  suggestedFrom: string | null;
  suggestedTo: string | null;
  /** False when the need does not fit into the booking horizon. Absent means "fits". */
  fitsHorizon: boolean;
  /** When the server sends the warning threshold with the answer. */
  minimumPlayers: number | null;
  perDay: DayOpen[];
}

/** An athlete a shortening or a cancellation would hit. */
export interface ClubBlockConflict {
  name: string;
  activityName: string | null;
  startUtc: string | null;
}

/* ── Reading ── */

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object';
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const dateOnly = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 10) : '');
const hhmm = (v: unknown): string | null => (typeof v === 'string' && v.length >= 5 ? v.slice(0, 5) : null);

function toAthlete(raw: unknown, index: number): ClubBlockAthlete | null {
  if (!isRecord(raw)) return null;
  const name = str(raw.name) ?? str(raw.patientName) ?? str(raw.athleteName);
  if (name === null) return null;
  const paperwork = isRecord(raw.paperwork) ? raw.paperwork : null;
  return {
    id: str(raw.id) ?? str(raw.appointmentId) ?? `athlete-${index}`,
    name,
    activityName: str(raw.activityName) ?? '',
    startUtc: str(raw.startUtc),
    ready: typeof raw.ready === 'boolean' ? raw.ready : paperwork !== null ? paperwork.ready !== false : true,
  };
}

export function toBlock(raw: unknown): ClubBlockView {
  const r = isRecord(raw) ? raw : {};
  const status = typeof r.status === 'string' && r.status.toLowerCase().startsWith('cancel') ? 'Cancelled' : 'Active';
  const athletes = Array.isArray(r.athletes)
    ? r.athletes.map(toAthlete).filter((a): a is ClubBlockAthlete => a !== null)
    : null;
  return {
    id: str(r.id) ?? '',
    clubId: str(r.clubId) ?? '',
    clubName: str(r.clubName) ?? '',
    colorHex: str(r.colorHex),
    name: str(r.name),
    calendarIds: strings(r.calendarIds),
    activityIds: strings(r.activityIds),
    fromDate: dateOnly(r.fromDate),
    toDate: dateOnly(r.toDate),
    dailyFrom: hhmm(r.dailyFrom),
    dailyTo: hhmm(r.dailyTo),
    playerCount: num(r.playerCount),
    seats: num(r.seats, num(r.playerCount)),
    registered: num(r.registered),
    status,
    registrationToken: str(r.registrationToken),
    registrationUrl: str(r.registrationUrl),
    note: str(r.note),
    createdAtUtc: str(r.createdAtUtc),
    athletes,
  };
}

const asList = (data: unknown): unknown[] => {
  if (Array.isArray(data)) return data;
  if (isRecord(data)) {
    const inner = data.items ?? data.value ?? data.blocks;
    if (Array.isArray(inner)) return inner;
  }
  return [];
};

export function toCalculation(raw: unknown): Calculation {
  const r = isRecord(raw) ? raw : {};
  const perDay = Array.isArray(r.perDay)
    ? r.perDay
        .filter(isRecord)
        .map((d) => ({ date: dateOnly(d.date), openMinutes: num(d.openMinutes) }))
        .filter((d) => d.date !== '')
    : [];
  return {
    minutesPerPlayer: num(r.minutesPerPlayer),
    parallelCapacity: Math.max(1, num(r.parallelCapacity, 1)),
    neededMinutes: num(r.neededMinutes),
    dailyOpenMinutes: num(r.dailyOpenMinutes),
    suggestedDays: num(r.suggestedDays),
    suggestedFrom: str(r.suggestedFrom) ? dateOnly(r.suggestedFrom) : null,
    suggestedTo: str(r.suggestedTo) ? dateOnly(r.suggestedTo) : null,
    fitsHorizon: r.fitsHorizon !== false,
    minimumPlayers: typeof r.minimumPlayers === 'number' ? r.minimumPlayers : null,
    perDay,
  };
}

/* ── Errors ── */

/**
 * A refused club-block call. `conflicts` is filled by a 409 that names the
 * athletes the change would hit; `fields` by a 400's per-field sentences.
 */
export class ClubBlockError extends Error {
  readonly status: number | undefined;
  readonly conflicts: ClubBlockConflict[];
  readonly fields: Record<string, string>;

  constructor(message: string, status: number | undefined, conflicts: ClubBlockConflict[] = [], fields: Record<string, string> = {}) {
    super(message);
    this.name = 'ClubBlockError';
    this.status = status;
    this.conflicts = conflicts;
    this.fields = fields;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }
}

const FALLBACK_BY_STATUS: Record<number, string> = {
  400: 'Zadané údaje nejsou v pořádku.',
  403: 'K této akci nemáte oprávnění.',
  404: 'Blok už neexistuje.',
  409: 'Změna se dotkne už registrovaných sportovců.',
};

function conflictsOf(data: unknown): ClubBlockConflict[] {
  if (!isRecord(data)) return [];
  const list = data.affected ?? data.athletes ?? data.conflicts ?? data.appointments ?? data.affectedAthletes;
  if (!Array.isArray(list)) return [];
  return list
    .filter(isRecord)
    .map((a) => ({
      name: str(a.name) ?? str(a.patientName) ?? str(a.athleteName) ?? 'Sportovec',
      activityName: str(a.activityName),
      startUtc: str(a.startUtc),
    }));
}

function fieldsOf(data: unknown): Record<string, string> {
  if (!isRecord(data) || !isRecord(data.errors)) return {};
  const out: Record<string, string> = {};
  for (const [field, messages] of Object.entries(data.errors)) {
    if (Array.isArray(messages) && typeof messages[0] === 'string') out[field] = messages[0];
  }
  return out;
}

export function toClubBlockError(error: unknown): ClubBlockError {
  if (error instanceof ClubBlockError) return error;
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    if (status === undefined) return new ClubBlockError('Server neodpovídá. Zkuste to prosím znovu.', undefined);
    const data = error.response?.data;
    const message =
      isRecord(data) && typeof data.message === 'string' && data.message.trim() !== ''
        ? data.message
        : (FALLBACK_BY_STATUS[status] ?? 'Požadavek se nepodařilo dokončit.');
    return new ClubBlockError(message, status, conflictsOf(data), fieldsOf(data));
  }
  return new ClubBlockError('Požadavek se nepodařilo dokončit.', undefined);
}

async function request<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toClubBlockError(error);
  }
}

/* ── Calls ── */

const BASE = '/api/v1/club-blocks';

export const clubBlocksApi = {
  list: (params: ClubBlockListParams = {}): Promise<ClubBlockView[]> =>
    request(async () => {
      const res = await client.get(BASE, { params });
      return asList(res.data).map(toBlock);
    }),

  get: (id: string): Promise<ClubBlockView> =>
    request(async () => {
      const res = await client.get(`${BASE}/${id}`);
      return toBlock(res.data);
    }),

  create: (input: ClubBlockInput): Promise<ClubBlockView> =>
    request(async () => {
      const res = await client.post(BASE, input);
      return toBlock(res.data);
    }),

  /**
   * Shorten, extend or edit. A change that would hit registered athletes comes
   * back `409` with their list; sending it again with `cancelAthletes` is the
   * operator's confirmation, and those athletes' appointments are cancelled.
   * Sent both in the query and in the body, because the contract names the flag
   * only for `DELETE` and either place is then a safe reading.
   */
  update: (id: string, input: ClubBlockUpdate, options: { cancelAthletes?: boolean } = {}): Promise<ClubBlockView> =>
    request(async () => {
      const body = options.cancelAthletes ? { ...input, cancelAthletes: true } : input;
      const res = await client.put(`${BASE}/${id}`, body, {
        params: options.cancelAthletes ? { cancelAthletes: true } : undefined,
      });
      return toBlock(res.data);
    }),

  /** `409` while athletes are registered and `cancelAthletes` is not true. */
  cancel: (id: string, cancelAthletes: boolean): Promise<void> =>
    request(async () => {
      await client.delete(`${BASE}/${id}`, { params: { cancelAthletes } });
    }),

  calculate: (input: CalculationInput): Promise<Calculation> =>
    request(async () => {
      const res = await client.post(`${BASE}/calculate`, input);
      return toCalculation(res.data);
    }),
};

/* ── What the dialog's checkbox lists need from the activities ── */

/** A činnost as the block dialog lists it, with the colour the calendar draws it in. */
export interface BlockableActivity {
  id: string;
  name: string;
  durationMinutes: number;
  clinicServiceId: string | null;
  /** C1 `effectiveColorHex`; falls back to the older `color`, then to a neutral grey. */
  colorHex: string;
  parallelCapacity: number;
}

/**
 * The same `GET /api/activities` as `activitiesApi.list`, read on its own.
 * The shared reader validates with a schema that keeps only the fields it
 * knows, and `effectiveColorHex` (C1) is exactly the field this list is for.
 */
export async function fetchBlockableActivities(): Promise<BlockableActivity[]> {
  return request(async () => {
    const res = await client.get('/api/activities');
    const data = res.data;
    const list = Array.isArray(data) ? data : isRecord(data) && Array.isArray(data.activities) ? data.activities : [];
    return list
      .filter(isRecord)
      .filter((a) => a.isActive !== false)
      .map((a) => ({
        id: str(a.id) ?? '',
        name: str(a.name) ?? '',
        durationMinutes: num(a.durationMinutes),
        clinicServiceId: str(a.clinicServiceId),
        colorHex: str(a.effectiveColorHex) ?? str(a.colorHex) ?? str(a.color) ?? '#B3B9C0',
        parallelCapacity: Math.max(1, num(a.parallelCapacity, 1)),
      }))
      .filter((a) => a.id !== '');
  });
}

export default clubBlocksApi;
