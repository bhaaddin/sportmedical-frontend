/*
 * The planner on OUR system: `PlannerDataSource` implemented over the existing API clients.
 *
 *   new ApiDataSource({ deps: defaultApiDeps(queryClient), session })     // see `api/useApiDataSource.ts`
 *
 * No parallel endpoint and no parallel model: every read and write goes through the application's own clients
 * (`appointmentsApi`, `clubOrdersApi`, `clubsApi`, ...) bound in `../api/deps.ts`, with the query keys the
 * existing screens use, so the calendar and the planner invalidate each other.
 *
 * Two modes:
 *   standard   no order is planned: the board shows and moves ordinary bookings (the same calendar the grid shows);
 *   club       `session` (a `PickSession`, the one the calendar's pick mode starts from) names the order being
 *              planned: a NEW order, the terms of an EXISTING one ('edit') or a club's request to confirm
 *              ('process'). The windows of that order are a LOCAL DRAFT: create / move / resize / update / delete
 *              / undo change only the draft; `finishPlan` makes ONE real call (create staff order | update |
 *              update + confirm) with the ranges the calendar's own rules (`ordersRangesOf`) derive from it.
 *
 * Decisions are listed in `../api/mappers.ts`; what is not done is in the PL-F report.
 */
import { planGuard } from './planGuard';
import { orderCode } from '../../components/clubs/order/orderFormat';
import type { PickSession } from '../../components/clubs/order/pickSession';
import { editBlockRefs } from '../../components/clubs/order/editSession';
import type { CoverageActivity } from '../../components/clubs/order/coverage';
import type { ClubOrderView } from '../../api/clubOrders';
import type { Activity, PreviewDay } from '../../api/bookingContracts';
import { rangeToInstants, type MinuteRange } from '../../components/booking/grid/timeRange';
import { pragueDateKey } from '../../utils/time';
import { defaultApiDeps, type ApiDeps } from '../api/deps';
import { toWriteError } from '../api/errors';
import {
  budgetOf,
  categoriesOf,
  clubUpdateOf,
  cleanHex as cleanHexOf,
  dayBudgetOf,
  dayMarkOf,
  demandsOf,
  eachDay,
  fingerprintOf,
  foreignWindowSessionsOf,
  noOrder,
  openPiecesOfDay,
  openingOf,
  ownSessionsOf,
  planningWindowOf,
  plannerRangeOf,
  profileOf,
  rangesOfDraft,
  snapshotOf,
  standardSessionsOf,
  windowsOfOrder,
  type DraftOrigin,
  type OrderWindow,
} from '../api/mappers';
import {
  addPlannedInterval,
  plannedFrom,
  commitSmartEdit,
  commitTermExpansion,
  confirmTermMovement,
  createFromDialog,
  defaultIdFactory,
  makeContext,
  slotMinutesOf,
  termChangeImpact,
  timeAsMinutes,
  totals,
  type ClubProfile,
  type DayBudget,
  type DayMark,
  type IntervalInput,
  type IsoDate,
  type PlannerContext,
  type PlannerOrder,
  type PlannerSession,
  type ResizePreview,
  type SessionId,
} from '../model';
import {
  PlannerWriteError,
  buildPlannerContext,
  type CreateIntervalResult,
  type DateRange,
  type FinishPlanOptions,
  type FinishPlanResult,
  type MoveIntervalInput,
  type PlannerCalendar,
  type PlannerCatalogue,
  type PlannerDataSource,
  type PublishFormResult,
  type ResizeIntervalInput,
  type TermWriteResult,
  type UndoToken,
  type UpdateIntervalInput,
} from './PlannerDataSource';

/** The club already holds a live order: the desk chooses (join it, or a separate order) - never silently a second one. */
export class PlannerDuplicateOrderError extends PlannerWriteError {
  readonly liveOrders: { id: string; code: string; serviceName: string; status: string; sameService: boolean }[];
  constructor(message: string, liveOrders: PlannerDuplicateOrderError['liveOrders']) {
    super('conflict', message);
    this.name = 'PlannerDuplicateOrderError';
    this.liveOrders = liveOrders;
  }
}

export interface ApiDataSourceOptions {
  /** The application's API clients (production: `defaultApiDeps(queryClient)`). */
  deps?: ApiDeps;
  /** The order being planned; absent = standard booking. */
  session?: PickSession | null;
  /** Calendars the board shows; default: the order's / the služba's calendars, else every active one. */
  calendarIds?: string[];
  /** Calendars NEW terms of the order are created on; default: the first of the shown calendars. */
  newCalendarIds?: string[];
  /** The clinic's today (Prague date). */
  today?: IsoDate;
  /**
   * A club's own screen (`/clubs/:clubId/kalendar`) without an order that can be edited right now (the club has no order yet,
   * or the order in view is waiting for the club / done): the planner still is in club mode - the club's header, an
   * empty deck, its windows on the board - but nothing is planned and nothing is written.
   */
  clubContext?: { clubId: string; clubName: string } | null;
  /** The source's id (the planner's query keys hang on it); one per club screen, so two orders never share a cache entry. */
  id?: string;
  newId?: () => string;
  maxUndo?: number;
}

type Mode = 'standard' | 'new' | 'edit' | 'process';

const clone = <T>(value: T): T => structuredClone(value);
const MAX_RANGE_DAYS = 62;
const LOOKAHEAD_DAYS = 28;

function chunk(range: DateRange): DateRange[] {
  const days = eachDay(range.from, range.to);
  const out: DateRange[] = [];
  for (let i = 0; i < days.length; i += MAX_RANGE_DAYS) {
    out.push({ from: days[i]!, to: days[Math.min(i + MAX_RANGE_DAYS, days.length) - 1]! });
  }
  return out;
}

interface Known {
  session: PlannerSession;
}

export class ApiDataSource implements PlannerDataSource {
  readonly id: string;

  private readonly deps: ApiDeps;
  private session: PickSession | null;
  private readonly explicitCalendarIds: string[] | undefined;
  private readonly explicitNewCalendarIds: string[] | undefined;
  private readonly today: IsoDate;
  private readonly clubContext: { clubId: string; clubName: string } | null;
  private readonly newId: () => string;
  private readonly maxUndo: number;

  private mode: Mode;
  private orderView: ClubOrderView | null = null;
  private draft: PlannerSession[] = [];
  private origin: DraftOrigin = { windows: [], index: new Map(), snapshot: new Map() };
  private loading: Promise<void> | null = null;
  private versionSeq = 0;
  private snapshotSeq = 0;
  private readonly snapshots = new Map<string, { kind: 'draft'; draft: PlannerSession[] } | { kind: 'move'; moves: { calendarId: string; id: string; fromStartUtc: string }[]; notify?: boolean }>();
  private readonly known = new Map<SessionId, Known>();
  private budgetOverride: number | null = null;
  private readonly listeners = new Set<() => void>();
  private catalogueCache: { at: number; value: Promise<PlannerCatalogue> } | null = null;

  constructor(options: ApiDataSourceOptions = {}) {
    this.deps = options.deps ?? defaultApiDeps(null);
    this.session = options.session ?? null;
    this.explicitCalendarIds = options.calendarIds;
    this.explicitNewCalendarIds = options.newCalendarIds;
    this.today = options.today ?? pragueDateKey(new Date());
    this.id = options.id ?? 'api';
    this.clubContext = options.session ? null : (options.clubContext ?? null);
    this.newId = options.newId ?? defaultIdFactory;
    this.maxUndo = options.maxUndo ?? 30;
    this.mode = this.modeOf(this.session);
  }

  private modeOf(session: PickSession | null): Mode {
    if (!session) return 'standard';
    if (session.editOrder?.mode === 'edit') return 'edit';
    if (session.editOrder?.mode === 'process') return 'process';
    return 'new';
  }

  /* ------------------------------ plumbing ------------------------------ */

  private emit(): void {
    this.catalogueCache = null;
    for (const l of [...this.listeners]) l();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private stamp(session: PlannerSession): PlannerSession {
    return { ...session, version: String(++this.versionSeq) };
  }

  private remember(entry: { kind: 'draft'; draft: PlannerSession[] } | { kind: 'move'; moves: { calendarId: string; id: string; fromStartUtc: string }[]; notify?: boolean }): string {
    const token = `${entry.kind === 'draft' ? 'dr' : 'mv'}-${++this.snapshotSeq}`;
    this.snapshots.set(token, entry);
    while (this.snapshots.size > this.maxUndo) this.snapshots.delete(this.snapshots.keys().next().value as string);
    return token;
  }

  private get planning(): boolean {
    return this.mode !== 'standard';
  }

  /** The order's činnosti as the pick calculator reads them. */
  private get activities(): CoverageActivity[] {
    return this.session?.activities ?? [];
  }

  private get routableIds(): string[] {
    return this.activities.filter((a) => a.seats > 0).map((a) => a.activityId);
  }

  /* ------------------------------ loading ------------------------------ */

  /** The order (edit / process) and its windows as a draft - read once, re-read after the order is saved. */
  private ensureLoaded(): Promise<void> {
    if (!this.loading) {
      this.loading = this.load().catch((error) => {
        this.loading = null;
        throw error;
      });
    }
    return this.loading;
  }

  private async load(preloaded?: ClubOrderView): Promise<void> {
    this.draft = [];
    this.origin = { windows: [], index: new Map(), snapshot: new Map() };
    if (this.mode === 'standard' || this.mode === 'new') {
      this.orderView = preloaded ?? null;
      return;
    }
    const orderId = this.session!.editOrder!.orderId;
    const view = preloaded ?? (await this.deps.order(orderId));
    this.orderView = view;
    const windows = windowsOfOrder(view);
    const calendars = await this.deps.calendars();
    const stepOf = (ids: readonly string[]) => calendars.find((c) => c.id === ids[0])?.displayStepMinutes ?? 30;
    const openPiecesOf = await this.openPiecesTest(windows);
    const own = ownSessionsOf({
      orderId: view.id,
      windows,
      activities: this.activities,
      stepOf,
      ...(openPiecesOf ? { openPiecesOf } : {}),
      clubName: view.clubName,
      clubColorHex: view.clubColorHex,
      clubId: view.clubId,
    });
    this.draft = own.sessions.map((s) => this.stamp(s));
    this.origin = {
      windows,
      index: own.index,
      snapshot: new Map(this.draft.map((s) => [s.id, snapshotOf(s)] as const)),
    };
  }

  /** What the server blocks of a day (open hours without the lunch break) for the calendars of a window; see `openPiecesOf`. */
  private async openPiecesTest(windows: readonly OrderWindow[]): Promise<((ids: readonly string[], date: IsoDate) => MinuteRange[] | null) | undefined> {
    const dates = windows.flatMap((w) => [w.range.fromDate, w.range.toDate || w.range.fromDate]).filter(Boolean).sort();
    if (dates.length === 0) return undefined;
    const ids = [...new Set(windows.flatMap((w) => w.calendarIds))];
    if (ids.length === 0) return undefined;
    try {
      const rows = new Map<string, Map<string, PreviewDay>>();
      for (const part of chunk({ from: dates[0]!, to: dates[dates.length - 1]! })) {
        const got = await this.deps.previews(ids, part.from, part.to);
        for (const [calendarId, byDate] of got) {
          const into = rows.get(calendarId) ?? new Map<string, PreviewDay>();
          for (const [d, row] of byDate) into.set(d, row);
          rows.set(calendarId, into);
        }
      }
      return (calendarIds, date) => openPiecesOfDay(calendarIds[0] === undefined ? undefined : rows.get(calendarIds[0])?.get(date));
    } catch {
      return undefined;
    }
  }

  /* ------------------------------ calendars ------------------------------ */

  private async allActiveCalendars() {
    return (await this.deps.calendars()).filter((c) => c.isActive);
  }

  /** The calendars the board shows (ordered as the application lists them). */
  private async shownCalendars() {
    const active = await this.allActiveCalendars();
    if (this.explicitCalendarIds && this.explicitCalendarIds.length > 0) {
      const chosen = active.filter((c) => this.explicitCalendarIds!.includes(c.id));
      if (chosen.length > 0) return chosen;
    }
    if (this.session) {
      await this.ensureLoaded();
      /* The order's own calendars and every calendar of its služba: the board is the shared calendar. */
      const own = new Set(this.origin.windows.flatMap((w) => w.calendarIds));
      const serviceId = this.session.serviceId;
      const related = active.filter((c) => own.has(c.id) || (serviceId !== '' && c.clinicServiceId === serviceId));
      if (related.length > 0) return related;
    }
    return active;
  }

  /** The calendars new terms of the order go to. */
  private async newCalendars(): Promise<string[]> {
    if (this.explicitNewCalendarIds && this.explicitNewCalendarIds.length > 0) return this.explicitNewCalendarIds;
    const shown = await this.shownCalendars();
    /* An order that already has windows keeps adding to the calendar of its first window. */
    const own = new Set(this.origin.windows.flatMap((w) => w.calendarIds));
    const first = shown.find((c) => own.has(c.id)) ?? shown[0];
    return first ? [first.id] : [];
  }

  async getCalendars(): Promise<PlannerCalendar[]> {
    return (await this.shownCalendars()).map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      clinicServiceId: c.clinicServiceId,
      stepMinutes: c.displayStepMinutes,
    }));
  }

  /* ------------------------------ reads ------------------------------ */

  getCatalogue(): Promise<PlannerCatalogue> {
    const cached = this.catalogueCache;
    if (cached && Date.now() - cached.at < 15_000) return cached.value;
    const value = this.readCatalogue();
    this.catalogueCache = { at: Date.now(), value };
    value.catch(() => {
      if (this.catalogueCache?.value === value) this.catalogueCache = null;
    });
    return value;
  }

  private async readCatalogue(): Promise<PlannerCatalogue> {
    await this.ensureLoaded();
    const [activities, services, display, clubSettings, clinicName, shown] = await Promise.all([
      this.deps.activities(),
      this.deps.services(),
      this.deps.display(),
      this.deps.clubSettings(),
      this.deps.clinicName(),
      this.shownCalendars(),
    ]);
    const scope = new Set(shown.map((c) => c.clinicServiceId).filter((id): id is string => id !== null));
    if (this.session && this.session.serviceId) scope.add(this.session.serviceId);
    const always = new Set(this.activities.map((a) => a.activityId));
    const categories = categoriesOf(activities.activities, services, scope, always);
    const previews = await this.lookAhead(shown.map((c) => c.id));
    const permissions = new Set(this.deps.permissions());
    const canBook = permissions.has('bookings.create');
    const canEditBookings = permissions.has('bookings.edit');
    const release = this.orderView?.effectiveReleaseDaysBefore ?? clubSettings.releaseUnusedDaysBefore;
    return {
      clinicName: clinicName.trim(),
      categories,
      window: planningWindowOf(display.settings, previews ? openingOf(previews) : null),
      dayMarkColors: { holiday: display.settings.holidayColor, lunch: display.settings.lunchColor },
      releaseDaysBefore: release ?? 0,
      ...(release === null ? { releaseNever: true } : {}),
      capabilities: {
        simulateBookings: false,
        logoUpload: false,
        realPublish: true,
        canBook,
        canEditBookings,
        canPlanClubs: canBook && canEditBookings,
        mode: this.planning || this.clubContext !== null ? 'club' : 'standard',
      },
    };
  }

  /** The next weeks of the shown calendars as the server works them out (null when it cannot be read). */
  private async lookAhead(calendarIds: string[]): Promise<Map<string, Map<string, PreviewDay>> | null> {
    if (calendarIds.length === 0) return null;
    try {
      return await this.deps.previews(calendarIds, this.today, addDays(this.today, LOOKAHEAD_DAYS - 1));
    } catch {
      return null;
    }
  }

  async getOrder(): Promise<PlannerOrder> {
    if (!this.session && this.clubContext) {
      /* A club's screen with nothing to plan: the club layout, no činnosti, no order behind it. */
      return { ...noOrder(), club: true, clubId: this.clubContext.clubId, clubName: this.clubContext.clubName, status: 'New', code: null, totalSeats: 0, registered: 0 };
    }
    if (!this.session) return noOrder();
    await this.ensureLoaded();
    const view = this.orderView;
    const session = this.session;
    return {
      id: view?.id ?? '',
      clubId: session.clubId,
      demands: demandsOf(this.activities),
      baselineSessions: [],
      club: true,
      clubName: view?.clubName ?? session.clubName,
      serviceId: session.serviceId || null,
      serviceName: view?.serviceName ?? session.serviceName,
      code: view ? orderCode(view.id) : null,
      status: view?.status ?? 'New',
      paymentMethod: view?.paymentMethod ?? session.paymentMethod,
      requestedRanges: (view?.requestedRanges ?? []).map(plannerRangeOf),
      note: view?.note ?? session.note,
      totalSeats: this.activities.reduce((n, a) => n + Math.max(0, a.seats), 0),
      registered: view?.registered ?? 0,
      linkUrl: view ? view.portalUrl || view.formUrl || null : null,
    };
  }

  async getClubProfile(): Promise<ClubProfile> {
    if (!this.session && this.clubContext) return profileOf(await this.deps.club(this.clubContext.clubId));
    if (this.session) {
      await this.ensureLoaded();
      const profile = profileOf(await this.deps.club(this.session.clubId));
      /* The club card may carry no colour of its own while its order / windows do (the server colours the blocks). */
      return profile.colorHex ? profile : { ...profile, colorHex: cleanHexOf(this.orderView?.clubColorHex) };
    }
    const name = (await this.deps.clinicName()).trim();
    return {
      clubName: name,
      ico: '',
      dic: '',
      address: '',
      leaderName: '',
      leaderEmail: '',
      leaderPhone: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      logoUrl: null,
    };
  }

  async listSessions(range: DateRange): Promise<PlannerSession[]> {
    await this.ensureLoaded();
    const external = await this.externalSessions(range);
    const own = this.draft.filter((s) => s.date >= range.from && s.date <= range.to);
    return clone([...external, ...own]);
  }

  async listOrderSessions(): Promise<PlannerSession[]> {
    await this.ensureLoaded();
    return clone(this.draft);
  }

  /** Everything on the shared calendar that is not a term of the order being planned. */
  private async externalSessions(range: DateRange): Promise<PlannerSession[]> {
    const shown = await this.shownCalendars();
    const ids = shown.map((c) => c.id);
    if (ids.length === 0) return [];
    const activities = await this.deps.activities();
    const byId = new Map<string, Activity>(activities.activities.map((a) => [a.id, a]));
    const out: PlannerSession[] = [];
    for (const part of chunk(range)) {
      const [appointments, blockLists, details, previews] = await Promise.all([
        this.deps.range(part.from, part.to, ids),
        Promise.all(ids.map(async (id) => [id, await this.deps.blocks(id, part.from, part.to)] as const)),
        this.deps.clubBlocks(part.from, part.to).catch(() => []),
        this.deps.previews(ids, part.from, part.to).catch(() => new Map<string, Map<string, PreviewDay>>()),
      ]);
      const blocksByCalendar = new Map(blockLists);
      const lunchOf = (calendarId: string, date: IsoDate) => {
        const row = previews.get(calendarId)?.get(date);
        const s = row?.breakStart ? timeAsMinutes(row.breakStart) : null;
        const e = row?.breakEnd ? timeAsMinutes(row.breakEnd) : null;
        return s !== null && e !== null && e > s ? { start: s, end: e } : null;
      };
      out.push(
        ...standardSessionsOf({ appointments, activities: byId, blocksByCalendar, range: part }),
        ...foreignWindowSessionsOf({
          blocksByCalendar,
          lunchOf,
          details: new Map(details.map((d) => [d.id, d])),
          activities: byId,
          range: part,
          ownBlockIds: new Set(this.origin.windows.map((w) => w.id)),
          planning: this.planning,
        }),
      );
    }
    for (const s of out) this.known.set(s.id, { session: s });
    return out;
  }

  async listDayMarks(range: DateRange): Promise<DayMark[]> {
    const ids = (await this.shownCalendars()).map((c) => c.id);
    const years = [...new Set(eachDay(range.from, range.to).map((d) => Number(d.slice(0, 4))))];
    const [holidayLists, previews] = await Promise.all([
      Promise.all(years.map((y) => this.deps.holidays(y).catch(() => []))),
      ids.length > 0 ? this.previewsChunked(ids, range) : Promise.resolve(new Map<string, Map<string, PreviewDay>>()),
    ]);
    const holidayByDate = new Map(holidayLists.flat().map((h) => [h.date, h] as const));
    return eachDay(range.from, range.to).map((date) => dayMarkOf(date, previews, holidayByDate.get(date)));
  }

  private async previewsChunked(ids: string[], range: DateRange): Promise<Map<string, Map<string, PreviewDay>>> {
    const merged = new Map<string, Map<string, PreviewDay>>();
    for (const part of chunk(range)) {
      const got = await this.deps.previews(ids, part.from, part.to);
      for (const [calendarId, byDate] of got) {
        const into = merged.get(calendarId) ?? new Map<string, PreviewDay>();
        for (const [d, row] of byDate) into.set(d, row);
        merged.set(calendarId, into);
      }
    }
    return merged;
  }

  async getDayBudget(): Promise<DayBudget> {
    const [shown, display] = await Promise.all([this.shownCalendars(), this.deps.display()]);
    const previews = await this.lookAhead(shown.map((c) => c.id));
    const days = eachDay(this.today, addDays(this.today, LOOKAHEAD_DAYS - 1));
    const computed = previews ? dayBudgetOf(previews, days) : { defaultMinutes: 0, byDate: {} };
    const window = Math.max(60, (display.settings.dayEndHour - display.settings.dayStartHour) * 60);
    const budget = budgetOf(computed, window);
    return this.budgetOverride !== null ? { ...budget, defaultMinutes: this.budgetOverride } : budget;
  }

  /* ------------------------------ the context for the draft ------------------------------ */

  private async context(dates: readonly IsoDate[]): Promise<{ ctx: PlannerContext; externalIds: Set<string> }> {
    await this.ensureLoaded();
    const sorted = [...dates].sort();
    const [catalogue, order, budget] = await Promise.all([this.getCatalogue(), this.getOrder(), this.getDayBudget()]);
    const targets = new Set(await this.newCalendars());
    const span = sorted.length > 0 ? { from: sorted[0]!, to: sorted[sorted.length - 1]! } : null;
    const [external, marks] = span
      ? await Promise.all([this.externalSessions(span), this.listDayMarks(span).catch(() => [] as DayMark[])])
      : [[] as PlannerSession[], [] as DayMark[]];
    const dayMarks = Object.fromEntries(marks.map((m) => [m.date, m] as const));
    /* A term on another calendar than the ones new terms go to does not collide with them. */
    const relevant = external.filter((s) => !s.calendarIds || s.calendarIds.length === 0 || targets.size === 0 || s.calendarIds.some((c) => targets.has(c)));
    const ctx = buildPlannerContext({
      catalogue,
      order,
      sessions: [...this.draft, ...relevant],
      dayBudget: budget,
      today: this.today,
      dayMarks,
    });
    return { ctx, externalIds: new Set(relevant.map((s) => s.id)) };
  }

  private async finalizeDraft(result: PlannerSession[], externalIds: ReadonlySet<string>, touched: readonly SessionId[]): Promise<void> {
    const newCalendars = await this.newCalendars();
    const touchedSet = new Set(touched);
    this.draft = result
      .filter((s) => !externalIds.has(s.id))
      .map((s) => {
        const withOwner: PlannerSession =
          s.calendarIds && s.calendarIds.length > 0
            ? s
            : {
                ...s,
                calendarIds: newCalendars,
                clubOrderId: this.orderView?.id ?? null,
                orderId: this.orderView?.id ?? null,
                clubId: this.session?.clubId ?? null,
                clubName: this.session?.clubName ?? null,
                origin: 'club',
              };
        return touchedSet.has(s.id) || !s.version ? this.stamp(withOwner) : withOwner;
      });
  }

  /** The one gate of every write: the plan never exceeds the need and never lands in the past (`planGuard`). */
  private guard(ctx: PlannerContext, sessions: readonly PlannerSession[], touched: readonly string[], allowExtra = false): void {
    const baseline = this.session?.editOrder?.baseline;
    const refusal = planGuard(ctx, sessions, { orderId: this.orderView?.id ?? null, ...(baseline ? { baseline } : {}), touched, allowExtra });
    if (refusal) throw new PlannerWriteError('validation', refusal);
  }

  private assertDraftVersion(id: SessionId, expected: string | null | undefined): PlannerSession {
    const current = this.draft.find((s) => s.id === id);
    if (!current) throw new PlannerWriteError('notFound', 'Termín již neexistuje.');
    if (expected != null && current.version !== expected) {
      throw new PlannerWriteError('stale', 'Termín se mezitím změnil. Otevřete jej znovu pro aktuální kontrolu.');
    }
    return current;
  }

  private isDraft(id: SessionId): boolean {
    return this.draft.some((s) => s.id === id);
  }

  private requireClub(what: string): void {
    if (!this.planning) throw new PlannerWriteError('forbidden', `${what} má smysl jen při plánování klubové objednávky.`);
  }

  /* ------------------------------ writes: the club draft ------------------------------ */

  async createInterval(input: IntervalInput): Promise<CreateIntervalResult> {
    this.requireClub('Plánování termínů');
    const { ctx, externalIds } = await this.context([input.date]);
    const result = addPlannedInterval(ctx, input, this.newId);
    if (!result.ok || !result.merged) throw new PlannerWriteError('validation', result.reason);
    this.guard(ctx, result.sessions, [result.merged.id], input.allowExtra === true);
    const undoToken = this.remember({ kind: 'draft', draft: clone(this.draft) });
    await this.finalizeDraft(result.sessions, externalIds, [result.merged.id]);
    this.emit();
    return {
      session: clone(this.draft.find((s) => s.id === result.merged!.id)!),
      removedIds: result.removedIds,
      mergedCount: result.mergedCount,
      complete: result.complete,
      undoToken,
    };
  }

  async createIntervals(inputs: readonly IntervalInput[]): Promise<{ created: number; complete: boolean; mergedCount: number; undoToken: UndoToken | null }> {
    this.requireClub('Plánování termínů');
    if (inputs.length === 0) return { created: 0, complete: false, mergedCount: 0, undoToken: null };
    const { ctx, externalIds } = await this.context(inputs.map((i) => i.date));
    let working = ctx;
    const touched: string[] = [];
    let mergedCount = 0;
    for (const input of inputs) {
      const r = addPlannedInterval(working, input, this.newId);
      if (!r.ok || !r.merged) throw new PlannerWriteError('validation', r.reason);
      working = { ...working, sessions: r.sessions };
      touched.push(r.merged.id);
      mergedCount += r.mergedCount;
    }
    this.guard(ctx, working.sessions, touched);
    const undoToken = this.remember({ kind: 'draft', draft: clone(this.draft) });
    await this.finalizeDraft([...working.sessions], externalIds, touched);
    this.emit();
    const complete = inputs.length > 0 && inputs.every((i) => { const d = ctx.demands.find((x) => x.categoryId === i.categoryId); return d ? plannedFrom(working, working.sessions, i.categoryId) >= d.requested : false; });
    return { created: inputs.length, complete, mergedCount, undoToken };
  }

  async createTerm(input: { date: IsoDate; categoryId: string; start: string; end: string }): Promise<CreateIntervalResult> {
    if (!this.planning) {
      throw new PlannerWriteError('forbidden', 'Rezervaci pacienta vytvoříte v okně Nová rezervace, termín klubu při plánování jeho objednávky.');
    }
    const { ctx, externalIds } = await this.context([input.date]);
    const result = createFromDialog(ctx, input, this.newId);
    if (!result.ok) throw new PlannerWriteError('validation', result.reason);
    this.guard(ctx, result.sessions, [result.session.id]);
    const undoToken = this.remember({ kind: 'draft', draft: clone(this.draft) });
    await this.finalizeDraft(result.sessions, externalIds, [result.session.id]);
    this.emit();
    const planned = totals(ctx);
    const demand = ctx.demands.find((d) => d.categoryId === input.categoryId);
    return {
      session: clone(this.draft.find((s) => s.id === result.session.id)!),
      removedIds: [],
      mergedCount: 0,
      complete: !!demand && planned.pending === 0,
      undoToken,
    };
  }

  private termResult(ctx: PlannerContext, before: PlannerSession, after: PlannerSession, undoToken: UndoToken): TermWriteResult {
    const impact = termChangeImpact(ctx, before);
    return { session: clone(after), undoToken, notified: { clubLinkUpdated: impact.clubLinkUpdated, individuals: impact.individualRecipients } };
  }

  async moveInterval(input: MoveIntervalInput): Promise<TermWriteResult> {
    if (!this.isDraft(input.id)) return this.moveStandard(input);
    this.assertDraftVersion(input.id, input.expectedVersion);
    const current = this.draft.find((s) => s.id === input.id)!;
    const { ctx, externalIds } = await this.context([input.date, current.date]);
    const r = confirmTermMovement(ctx, input.id, input);
    if (!r.ok || !r.term || !r.before) throw new PlannerWriteError(r.reason.startsWith('Termín již') ? 'notFound' : 'conflict', r.reason);
    this.guard(ctx, r.sessions, [input.id]);
    const undoToken = this.remember({ kind: 'draft', draft: clone(this.draft) });
    await this.finalizeDraft(r.sessions, externalIds, [input.id]);
    this.emit();
    return this.termResult(ctx, r.before, this.draft.find((s) => s.id === input.id)!, undoToken);
  }

  async resizeInterval(input: ResizeIntervalInput): Promise<TermWriteResult> {
    if (!this.isDraft(input.id)) throw this.notEditable(input.id, 'Délku rezervace určuje činnost, upravit ji nelze.');
    const current = this.assertDraftVersion(input.id, input.expectedVersion);
    const { ctx, externalIds } = await this.context([current.date]);
    const proposal: ResizePreview = {
      kind: 'resize',
      eventId: current.id,
      date: current.date,
      categoryId: current.categoryId,
      edge: input.edge,
      added: input.added,
      capacity: current.capacity + input.added,
      start: input.start,
      end: input.end,
      startMinutes: timeAsMinutes(input.start),
      endMinutes: timeAsMinutes(input.end),
      col: 0,
      validation: { ok: true, reason: '' },
      original: current,
    };
    const r = commitTermExpansion(ctx, current, proposal);
    if (!r.ok || !r.term || !r.before) throw new PlannerWriteError(r.reason.includes('mezitím') ? 'stale' : 'validation', r.reason);
    this.guard(ctx, r.sessions, [input.id]);
    const undoToken = this.remember({ kind: 'draft', draft: clone(this.draft) });
    await this.finalizeDraft(r.sessions, externalIds, [input.id]);
    this.emit();
    return this.termResult(ctx, r.before, this.draft.find((s) => s.id === input.id)!, undoToken);
  }

  async updateInterval(input: UpdateIntervalInput): Promise<TermWriteResult> {
    if (!this.isDraft(input.id)) {
      const known = this.known.get(input.id)?.session;
      if (known && known.categoryId === input.categoryId && known.capacity === input.capacity) {
        return this.moveStandard({ id: input.id, date: input.date, start: input.start, end: input.end, expectedVersion: input.expectedVersion });
      }
      throw this.notEditable(input.id, 'U rezervace lze měnit jen datum a čas; činnost a počet osob se mění v jejím detailu.');
    }
    const current = this.assertDraftVersion(input.id, input.expectedVersion);
    const { ctx, externalIds } = await this.context([input.date, current.date]);
    const next: PlannerSession = {
      ...current,
      date: input.date,
      categoryId: input.categoryId,
      start: input.start,
      end: input.end,
      capacity: input.capacity,
      slotDuration: slotMinutesOf(ctx, input.categoryId),
    };
    const r = commitSmartEdit(ctx, current, next);
    if (!r.ok || !r.term || !r.before) throw new PlannerWriteError(r.reason.includes('mezitím') ? 'stale' : 'validation', r.reason);
    this.guard(ctx, r.sessions, [input.id]);
    const undoToken = this.remember({ kind: 'draft', draft: clone(this.draft) });
    await this.finalizeDraft(r.sessions, externalIds, [input.id]);
    this.emit();
    return this.termResult(ctx, r.before, this.draft.find((s) => s.id === input.id)!, undoToken);
  }

  async deleteInterval(id: SessionId): Promise<{ undoToken: UndoToken }> {
    if (!this.isDraft(id)) throw this.notEditable(id, 'Rezervaci zrušte v jejím detailu, termín jiného klubu v jeho objednávce.');
    const undoToken = this.remember({ kind: 'draft', draft: clone(this.draft) });
    this.draft = this.draft.filter((s) => s.id !== id);
    this.emit();
    return { undoToken };
  }

  private notEditable(id: SessionId, standardMessage: string): PlannerWriteError {
    const known = this.known.get(id)?.session;
    if (known?.foreign) return new PlannerWriteError('forbidden', 'Termín jiného klubu zde nelze měnit - upravte jej v objednávce toho klubu.');
    if (!known) return new PlannerWriteError('notFound', 'Termín již neexistuje.');
    return new PlannerWriteError('forbidden', standardMessage);
  }

  /* ------------------------------ writes: a standard booking ------------------------------ */

  private async moveStandard(input: MoveIntervalInput): Promise<TermWriteResult> {
    const known = this.known.get(input.id)?.session;
    if (!known || !known.appointments || known.appointments.length === 0) throw this.notEditable(input.id, 'Termín nelze přesunout.');
    if (known.foreign) throw this.notEditable(input.id, '');
    const people = known.appointments;

    /* The row version: the bookings as they are NOW must equal the bookings the desk saw. */
    let currents;
    try {
      currents = await Promise.all(people.map((p) => this.deps.appointment(p.calendarId, p.id)));
    } catch (error) {
      throw toWriteError(error, 'Rezervaci se nepodařilo načíst.');
    }
    const expected = input.expectedVersion ?? known.version ?? null;
    if (expected !== null && fingerprintOf(currents) !== expected) {
      throw new PlannerWriteError('stale', 'Termín se mezitím změnil. Otevřete jej znovu pro aktuální kontrolu.');
    }
    const lengthMs = new Date(currents[0]!.endUtc).getTime() - new Date(currents[0]!.startUtc).getTime();
    const { startUtc } = rangeToInstants(input.date, { start: timeAsMinutes(input.start), end: timeAsMinutes(input.end) });
    if (startUtc.getTime() === new Date(currents[0]!.startUtc).getTime()) {
      return { session: clone(known), undoToken: null, notified: { clubLinkUpdated: false, individuals: 0 } };
    }

    const done: { calendarId: string; id: string; fromStartUtc: string }[] = [];
    let told = 0;
    let answered = 0;
    try {
      for (let i = 0; i < people.length; i += 1) {
        const p = people[i]!;
        /* The version of the single read just made: a booking changed by somebody else in between is a 412. */
        const options = {
          ...(input.notifyPatient === undefined ? {} : { notifyPatient: input.notifyPatient }),
          ...(currents[i]!.concurrencyToken ? { ifMatch: currents[i]!.concurrencyToken } : {}),
        };
        const notice = await this.deps.reschedule(p.calendarId, p.id, startUtc, input.overrideReason, Object.keys(options).length > 0 ? options : undefined);
        done.push({ calendarId: p.calendarId, id: p.id, fromStartUtc: currents[i]!.startUtc });
        if (notice && typeof notice === 'object') {
          answered += 1;
          if (notice.patientNotified) told += 1;
        }
      }
    } catch (error) {
      /* All or nothing as far as we can: put the ones already moved back (without telling anybody twice). */
      for (const d of done.reverse()) {
        await this.deps.reschedule(d.calendarId, d.id, d.fromStartUtc, undefined, { notifyPatient: false }).catch(() => undefined);
      }
      throw toWriteError(error, 'Přesun se nepodařil.');
    }

    await this.deps.invalidate();
    const moved = currents.map((c) => ({
      id: c.id,
      startUtc: startUtc.toISOString(),
      endUtc: new Date(startUtc.getTime() + lengthMs).toISOString(),
      status: c.status,
    }));
    const after: PlannerSession = {
      ...known,
      date: input.date,
      start: input.start,
      end: input.end,
      version: fingerprintOf(moved),
    };
    this.known.set(after.id, { session: after });
    const undoToken = this.remember({ kind: 'move', moves: done, ...(input.notifyPatient !== undefined ? { notify: input.notifyPatient } : {}) });
    this.emit();
    return {
      session: clone(after),
      undoToken,
      /* What the server says (a walk-in has nobody to tell); an answer-less server: as many as were asked to be told. */
      notified: { clubLinkUpdated: false, individuals: answered > 0 ? told : input.notifyPatient === false ? 0 : people.length },
    };
  }

  async undo(token: string): Promise<void> {
    const entry = this.snapshots.get(token);
    if (!entry) throw new PlannerWriteError('notFound', 'Tuto změnu už nelze vrátit.');
    if (entry.kind === 'draft') {
      this.draft = clone(entry.draft);
      this.snapshots.delete(token);
      this.emit();
      return;
    }
    try {
      for (const m of [...entry.moves].reverse()) {
        await this.deps.reschedule(m.calendarId, m.id, m.fromStartUtc, undefined, entry.notify === undefined ? undefined : { notifyPatient: entry.notify });
      }
    } catch (error) {
      throw toWriteError(error, 'Změnu se nepodařilo vrátit.');
    }
    this.snapshots.delete(token);
    await this.deps.invalidate();
    this.emit();
  }

  /* ------------------------------ finish / publish ------------------------------ */

  hasUnsavedChanges(): boolean {
    if (!this.session) return false;
    if (this.mode === 'process') return true;
    if (this.session.editOrder?.dirty === true) return true;
    const byId = new Map(this.draft.map((s) => [s.id, s] as const));
    for (const [id, was] of this.origin.snapshot) {
      const now = byId.get(id);
      if (!now || JSON.stringify(snapshotOf(now)) !== JSON.stringify(was)) return true;
    }
    return this.draft.some((s) => s.origin === 'club' && !s.foreign && !this.origin.snapshot.has(s.id));
  }

  async finishPlan(options: FinishPlanOptions = {}): Promise<FinishPlanResult> {
    if (!this.session) throw new PlannerWriteError('validation', 'Neplánuje se žádná objednávka klubu.');
    await this.ensureLoaded();
    const session = this.session;
    const newCalendarIds = await this.newCalendars();
    const { ranges, calendarIds } = rangesOfDraft({
      draft: this.draft,
      origin: this.origin,
      routableIds: this.routableIds,
      today: this.today,
      newCalendarIds,
    });
    const hadWindows = this.origin.windows.length > 0;
    if (ranges.length === 0 && !(this.mode === 'edit' && !hadWindows)) {
      throw new PlannerWriteError('validation', 'Nejsou naplánované žádné budoucí termíny - objednávku není co uložit.');
    }
    const activitySeats = session.activities.map((a) => ({ activityId: a.activityId, seats: a.seats }));
    const note = session.note.trim();
    let view: ClubOrderView;
    try {
      if (this.mode === 'edit') {
        view = await this.deps.updateOrder(
          session.editOrder!.orderId,
          { activitySeats, paymentMethod: session.paymentMethod, ranges, calendarIds, note },
          options.cancelAffectedAthletes === true,
        );
      } else if (this.mode === 'process') {
        const orderId = session.editOrder!.orderId;
        if (session.editOrder!.dirty) await this.deps.updateOrder(orderId, { activitySeats, paymentMethod: session.paymentMethod, note }, false);
        view = await this.deps.confirmOrder(orderId, { calendarIds, ranges });
      } else {
        if (session.parentOrderId === undefined && options.skipDuplicateCheck !== true) await this.refuseDuplicate(session);
        view = await this.deps.createStaffOrder({
          clubId: session.clubId,
          serviceId: session.serviceId,
          activitySeats,
          paymentMethod: session.paymentMethod,
          ranges,
          calendarIds,
          status: 'Confirmed',
          ...(note !== '' ? { note } : {}),
          ...(session.parentOrderId !== undefined ? { parentOrderId: session.parentOrderId } : {}),
        });
      }
    } catch (error) {
      throw toWriteError(error, 'Objednávku se nepodařilo uložit. Plán zůstal beze změny - zkuste to znovu.');
    }
    /* "Ready" is the figures' definition: the same today, the same terms (an unsaved past one counts for nothing). */
    const ctx = makeContext({ categories: [], demands: demandsOf(this.activities), sessions: this.draft, today: this.today });
    const ready = totals(ctx).pending === 0;
    await this.adopt(view);
    await this.deps.invalidate();
    this.emit();
    return { ready, orderId: view.id, orderCode: orderCode(view.id), windows: ranges.length };
  }

  /** After a successful save the saved order is the one being edited. */
  private async adopt(view: ClubOrderView): Promise<void> {
    if (!this.session) return;
    const blocks = editBlockRefs(view);
    this.session = {
      ...this.session,
      editOrder: {
        mode: 'edit',
        orderId: view.id,
        dirty: false,
        requested: [],
        blocks,
        firstDate: blocks.map((b) => b.range.fromDate).sort()[0] ?? null,
      },
    };
    this.mode = 'edit';
    this.snapshots.clear();
    this.catalogueCache = null;
    this.loading = this.load(view);
    await this.loading;
  }

  private async refuseDuplicate(session: PickSession): Promise<void> {
    let orders: ClubOrderView[];
    try {
      orders = await this.deps.clubOrders(session.clubId);
    } catch {
      return; /* unreadable list: same as the calendar - nothing to ask */
    }
    const live = orders.filter((o) => o.status === 'Requested' || o.status === 'Confirmed');
    if (live.length === 0) return;
    const rows = live.map((o) => ({
      id: o.id,
      code: orderCode(o.id),
      serviceName: o.serviceName,
      status: o.status,
      sameService: o.serviceId === session.serviceId,
    }));
    throw new PlannerDuplicateOrderError(
      'Klub už má živou objednávku. Přidejte termíny do ní (nebo jako dodatek), nebo potvrďte, že chcete samostatnou objednávku.',
      rows,
    );
  }

  async publishForm(): Promise<PublishFormResult> {
    if (!this.session) throw new PlannerWriteError('validation', 'Odkaz pro klub vzniká až u objednávky klubu.');
    await this.ensureLoaded();
    const existing = this.orderView;
    if (existing) {
      return { url: existing.portalUrl || existing.formUrl || null, generated: true };
    }
    try {
      const invited = await this.deps.inviteClub({
        clubId: this.session.clubId,
        ...(this.session.serviceId ? { serviceId: this.session.serviceId } : {}),
        ...(this.session.note.trim() !== '' ? { note: this.session.note.trim() } : {}),
      });
      this.session = {
        ...this.session,
        editOrder: { mode: 'edit', orderId: invited.id, dirty: false, requested: [], blocks: [], firstDate: null },
      };
      this.mode = 'edit';
      this.orderView = invited;
      this.loading = Promise.resolve();
      await this.deps.invalidate();
      this.emit();
      return { url: invited.portalUrl || invited.formUrl || null, generated: true };
    } catch (error) {
      throw toWriteError(error, 'Odkaz pro klub se nepodařilo vytvořit.');
    }
  }

  /* ------------------------------ club header ------------------------------ */

  async saveClubProfile(patch: Partial<Omit<ClubProfile, 'logoUrl'>>): Promise<ClubProfile> {
    if (!this.session) throw new PlannerWriteError('forbidden', 'Údaje kliniky se upravují v Nastavení.');
    try {
      const club = await this.deps.club(this.session.clubId);
      const saved = await this.deps.updateClub(club.id, clubUpdateOf(club, patch));
      await this.deps.invalidate();
      this.emit();
      return profileOf(saved);
    } catch (error) {
      throw toWriteError(error, 'Údaje klubu se nepodařilo uložit.');
    }
  }

  async saveLogo(_file: Blob): Promise<ClubProfile> {
    throw new PlannerWriteError('forbidden', 'Logo klubu zatím nelze nahrát - klub v systému nemá pole pro logo. Místo něj slouží iniciály klubu.');
  }

  async saveDayBudget(defaultMinutes: number): Promise<DayBudget> {
    if (!Number.isFinite(defaultMinutes) || defaultMinutes <= 0) {
      throw new PlannerWriteError('validation', 'Referenční kapacita dne musí být kladné číslo.');
    }
    /* Not a setting of the system: it only scales the rings of the mini calendar, for this session. */
    this.budgetOverride = Math.round(defaultMinutes);
    this.emit();
    return this.getDayBudget();
  }
}

function addDays(date: IsoDate, n: number): IsoDate {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
