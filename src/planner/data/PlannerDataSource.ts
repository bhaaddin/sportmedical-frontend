/*
 * What the planner UI depends on - and nothing else.
 *
 * Everything the prototype keeps in `state` / localStorage becomes a READ or a
 * WRITE here. The UI never imports an API client: it gets a `PlannerDataSource`
 * through `PlannerDataProvider`. Two implementations exist / are planned:
 *
 *   DemoDataSource  in-memory, seeded from the prototype's fixtures (tests, /planner-lab)
 *   ApiDataSource   (PL-F) the real API: sessions are built from appointments
 *                   (`src/api/appointments.ts`) + club blocks (`clubBlocks.ts`)
 *                   grouped by činnost / calendar / time; slot length, colour,
 *                   price and parallel capacity come from the činnost
 *                   (`bookingContracts.ts` Activity) and the služba colour
 *                   (`clinicServices.ts`); hours, lunch and closed days from
 *                   `workingHours.ts` / `holidays.ts`; colours of closed days
 *                   and lunch from `displaySettings.ts`; club header from
 *                   `clubs.ts`; the order from `clubOrders.ts` (seats per činnost).
 *
 * Contract:
 *   - every method is async and may reject; writes reject with `PlannerWriteError`
 *     carrying a CZECH message the desk can read as-is;
 *   - reads are cheap to repeat (react-query caches them under `plannerKeys`);
 *   - after ANY successful write the source calls its subscribers, which makes the
 *     provider invalidate the reads - a source that cannot push simply never calls them;
 *   - the model (`../model`) does the planning arithmetic; a source validates again
 *     on the server side and reports conflicts as `PlannerWriteError('conflict' | 'stale')`.
 */
import type {
  ClockTime,
  ClubProfile,
  DayBudget,
  DayMark,
  DayMarkColors,
  IntervalInput,
  IsoDate,
  PlannerCategory,
  PlannerContext,
  PlannerOrder,
  PlannerSession,
  PlanningWindow,
  SessionId,
} from '../model';
import { DEFAULT_WINDOW } from '../model';

/** Inclusive range of days. */
export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

/** Slowly changing settings: the catalogue of činnosti and the board's frame. */
export interface PlannerCatalogue {
  /** The clinic's own name for e-mails / signatures (setting, never a literal). */
  clinicName: string;
  categories: PlannerCategory[];
  /** Planning window of the board, default 07:00 - 19:00. */
  window: PlanningWindow;
  /** Colours of closed days and the lunch break (display settings). */
  dayMarkColors: DayMarkColors;
  /** The club's unfilled places open to the public this many days before a term. */
  releaseDaysBefore: number;
  /** Real sources: the clinic's setting is 'never' (club settings: releaseUnusedDaysBefore = null); `releaseDaysBefore` is then 0. */
  releaseNever?: boolean;
  /** What this source can do; the UI hides controls for missing capabilities. */
  capabilities: PlannerCapabilities;
}

export interface PlannerCapabilities {
  /** "+ Klub" / "+ Jednotlivec" / "Simulovat uvolnění" in the reservation drawer (demo only). */
  simulateBookings: boolean;
  /** The club logo can be changed. */
  logoUpload: boolean;
  /** `publishForm` creates a real link. */
  realPublish: boolean;
  /* ---- real sources (PL-F). Absent = not known; the UI treats `undefined` as allowed. ---- */
  /** The signed-in user may book (`bookings.create`). */
  canBook?: boolean;
  /** ... may move / change / block bookings (`bookings.edit`). */
  canEditBookings?: boolean;
  /** ... may create / confirm / change club orders (`bookings.create` + `bookings.edit`). */
  canPlanClubs?: boolean;
  /** What the board plans: a club order (the order command, the cards) or plain standard booking. */
  mode?: 'club' | 'standard';
}

/** A calendar (column of the real grid) the planner works on; the board opens booking dialogs for one of them. */
export interface PlannerCalendar {
  id: string;
  name: string;
  /** `#RRGGBB` */
  color: string;
  clinicServiceId: string | null;
  /** The step of the calendar's own grid in minutes. */
  stepMinutes: number;
}

export type PlannerWriteErrorCode =
  | 'validation' // the rule the model also checks (overlap, remaining seats, window)
  | 'conflict' //   someone else booked / planned the same time
  | 'stale' //      the term changed since it was read (optimistic concurrency)
  | 'notFound'
  | 'forbidden'
  | 'network'
  | 'unknown';

/**
 * An athlete who is already registered in a term that a change would touch (club planning:
 * the 409 of `clubOrdersApi.update`). `reason` is the server's machine reason, free text here.
 */
export interface AffectedAthlete {
  name: string;
  activityName?: string | null;
  reason?: string | null;
}

/** Rejection of every write. `message` is Czech and shown to the desk. */
export class PlannerWriteError extends Error {
  code: PlannerWriteErrorCode;
  /**
   * Set with code 'conflict' when the change would cancel registered athletes: the desk lists them and may
   * repeat the same write with `cancelAffectedAthletes: true` - never silently.
   */
  affectedAthletes: AffectedAthlete[];
  constructor(code: PlannerWriteErrorCode, message: string, affectedAthletes: AffectedAthlete[] = []) {
    super(message);
    this.name = 'PlannerWriteError';
    this.code = code;
    this.affectedAthletes = affectedAthletes;
  }
}

/** Opaque handle for "↶ Vrátit změnu"; null = this write cannot be undone. */
export type UndoToken = string | null;

export interface CreateIntervalResult {
  /** The term that now covers the new slots (new or merged). */
  session: PlannerSession;
  /** Terms absorbed into `session`. */
  removedIds: SessionId[];
  mergedCount: number;
  /** The činnost is fully planned after this step. */
  complete: boolean;
  undoToken: UndoToken;
}

export interface TermChange {
  date: IsoDate;
  start: ClockTime;
  end: ClockTime;
}

export interface MoveIntervalInput extends TermChange {
  id: SessionId;
  /** Real sources, a booking of a patient: tell the patient about the move (absent = the server's own rule, which is yes). */
  notifyPatient?: boolean;
  /** Real sources, a booking: the reason the desk typed when moving it outside the working hours. */
  overrideReason?: string;
  /** `PlannerSession.version` read with the term; rejects with 'stale' when it moved on. */
  expectedVersion?: string | null;
  /** The desk confirmed that the registered athletes of the term are cancelled (see `PlannerWriteError.affectedAthletes`). */
  cancelAffectedAthletes?: boolean;
}

export interface ResizeIntervalInput {
  id: SessionId;
  edge: 'top' | 'bottom';
  /** New start / end after the edge was pulled. */
  start: ClockTime;
  end: ClockTime;
  /** Slots added. */
  added: number;
  expectedVersion?: string | null;
  cancelAffectedAthletes?: boolean;
}

export interface UpdateIntervalInput {
  id: SessionId;
  date: IsoDate;
  categoryId: string;
  start: ClockTime;
  end: ClockTime;
  capacity: number;
  expectedVersion?: string | null;
  cancelAffectedAthletes?: boolean;
}

export interface TermWriteResult {
  session: PlannerSession;
  undoToken: UndoToken;
  /** How many people the change touches (for the "oznámení" line of the toast). */
  notified: { clubLinkUpdated: boolean; individuals: number };
}

export interface FinishPlanOptions {
  /** The desk confirmed (after the 409 list in `PlannerWriteError.affectedAthletes`) that registered athletes are cancelled. */
  cancelAffectedAthletes?: boolean;
  /** The desk saw the club already has a live order and chose to create this one anyway (a separate order). */
  skipDuplicateCheck?: boolean;
}

export interface FinishPlanResult {
  /** The plan was marked ready. */
  ready: boolean;
  /** Real sources: the order that was created / changed / confirmed by this write. */
  orderId?: string;
  /** Real sources: the code the desk reads out ("KO-1A2B3C4D"). */
  orderCode?: string;
  /** Real sources: how many windows (ranges) the order holds now. */
  windows?: number;
}

export interface PublishFormResult {
  /** Private link of the club form; null when the source only previews. */
  url: string | null;
  /** `true` once something was generated (the dialog switches from "Vygenerovat" to "Obnovit"). */
  generated: boolean;
}

export interface PlannerDataSource {
  /** Stable id of the source, part of every query key ('demo' | 'api'). */
  readonly id: string;

  /* ------------------------------ reads ------------------------------ */
  getCatalogue(): Promise<PlannerCatalogue>;
  /** The order being planned: seats per činnost, baseline, display order. */
  getOrder(): Promise<PlannerOrder>;
  /** Header strip + profile dialog. */
  getClubProfile(): Promise<ClubProfile>;
  /** The SHARED calendar (club + public terms) for a range of days. */
  listSessions(range: DateRange): Promise<PlannerSession[]>;
  /** Every club term of the order, on any date (agenda, totals, summary). */
  listOrderSessions(): Promise<PlannerSession[]>;
  /** Holiday / closed / lunch / working hours per day of the range. */
  listDayMarks(range: DateRange): Promise<DayMark[]>;
  /** Reference day capacity for the mini-calendar fill. */
  getDayBudget(): Promise<DayBudget>;
  /** Real sources: the calendars the board works on (ids for the booking dialogs). Absent = the source has none. */
  getCalendars?(): Promise<PlannerCalendar[]>;

  /* ------------------------------ writes ------------------------------ */
  /** Drop a činnost into the calendar: validate, merge with adjacent safe blocks, store. */
  createInterval(input: IntervalInput): Promise<CreateIntervalResult>;
  /**
   * Several drops at once (a month pick of whole days): one read of the calendar, one check against the need, ONE undo
   * step for all of them. All or nothing - a refused drop leaves the draft untouched. Absent: the caller drops one by one.
   */
  createIntervals?(inputs: readonly IntervalInput[]): Promise<{ created: number; complete: boolean; mergedCount: number; undoToken: UndoToken | null }>;
  /** The "Vytvořit termín" dialog: a term from explicit start and end. */
  createTerm(input: { date: IsoDate; categoryId: string; start: ClockTime; end: ClockTime }): Promise<CreateIntervalResult>;
  moveInterval(input: MoveIntervalInput): Promise<TermWriteResult>;
  resizeInterval(input: ResizeIntervalInput): Promise<TermWriteResult>;
  /** Smart editor: date, činnost, time and capacity at once. */
  updateInterval(input: UpdateIntervalInput): Promise<TermWriteResult>;
  deleteInterval(id: SessionId): Promise<{ undoToken: UndoToken }>;
  /** Revert the write that produced `token` (Ctrl+Z / "↶ Zpět"). */
  undo(token: string): Promise<void>;
  /**
   * Real sources: does the draft differ from what the server holds (or does the order still wait to be confirmed)?
   * `false` = nothing to save. Absent = the source cannot tell; the dialogs then rely on the figures alone.
   */
  hasUnsavedChanges?(): boolean;
  /** "Označit plán jako připravený". */
  finishPlan(options?: FinishPlanOptions): Promise<FinishPlanResult>;
  /** "Vygenerovat" the private club form link. */
  publishForm(): Promise<PublishFormResult>;
  /** Save any subset of the club header / profile. */
  saveClubProfile(patch: Partial<Omit<ClubProfile, 'logoUrl'>>): Promise<ClubProfile>;
  /** Upload / replace the club logo; returns the profile with the new `logoUrl`. */
  saveLogo(file: Blob): Promise<ClubProfile>;
  /** Settings dialog: reference day capacity in minutes. */
  saveDayBudget(defaultMinutes: number): Promise<DayBudget>;

  /* ------------------------ demo-only simulation ------------------------ */
  /** Only when `capabilities.simulateBookings`. */
  addBooking?(id: SessionId, kind: 'club' | 'public'): Promise<{ message: string }>;
  releaseDay?(date: IsoDate): Promise<{ message: string }>;

  /** Notify on every change made through this source (own writes, or pushes). Returns unsubscribe. */
  subscribe?(listener: () => void): () => void;
}

/* -------------------------------------------------------------------------- */
/* react-query keys                                                            */
/* -------------------------------------------------------------------------- */

export const plannerKeys = {
  all: (sourceId: string) => ['planner', sourceId] as const,
  catalogue: (sourceId: string) => ['planner', sourceId, 'catalogue'] as const,
  order: (sourceId: string) => ['planner', sourceId, 'order'] as const,
  profile: (sourceId: string) => ['planner', sourceId, 'profile'] as const,
  sessions: (sourceId: string, range: DateRange) => ['planner', sourceId, 'sessions', range.from, range.to] as const,
  orderSessions: (sourceId: string) => ['planner', sourceId, 'orderSessions'] as const,
  dayMarks: (sourceId: string, range: DateRange) => ['planner', sourceId, 'dayMarks', range.from, range.to] as const,
  dayBudget: (sourceId: string) => ['planner', sourceId, 'dayBudget'] as const,
};

/* -------------------------------------------------------------------------- */
/* Putting the reads together                                                  */
/* -------------------------------------------------------------------------- */

/** Merge session lists by id (later lists win), keeping a stable chronological order. */
export function mergeSessions(...lists: ReadonlyArray<readonly PlannerSession[]>): PlannerSession[] {
  const byId = new Map<SessionId, PlannerSession>();
  for (const list of lists) for (const s of list) byId.set(s.id, s);
  return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}

/**
 * The `PlannerContext` the pure model needs, from the reads. `today` is passed in
 * so tests (and the reservation release rule) never depend on the clock.
 */
export function buildPlannerContext(parts: {
  catalogue: PlannerCatalogue;
  order: PlannerOrder;
  sessions: readonly PlannerSession[];
  dayBudget: DayBudget;
  today: IsoDate;
  /** Hours / lunch of the days read; with them no term may touch the break or the outside of the hours. */
  dayMarks?: Readonly<Record<IsoDate, DayMark>>;
}): PlannerContext {
  return {
    sessions: parts.sessions,
    categories: parts.catalogue.categories,
    demands: parts.order.demands,
    baselineSessions: parts.order.baselineSessions,
    dayBudgetMinutes: parts.dayBudget.defaultMinutes,
    today: parts.today,
    window: parts.catalogue.window ?? DEFAULT_WINDOW,
    ...(parts.dayMarks && Object.keys(parts.dayMarks).length > 0 ? { dayMarks: parts.dayMarks } : {}),
  };
}
