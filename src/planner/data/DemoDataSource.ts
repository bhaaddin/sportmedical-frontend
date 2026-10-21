/*
 * In-memory planner data, seeded from the prototype's fixtures.
 *
 * Used by the unit tests and by the `/planner-lab` route. It runs the SAME pure
 * model the UI uses to validate and merge (so the lab behaves like the
 * prototype), keeps a snapshot per write for undo, bumps a `version` on every
 * touched term so the optimistic-concurrency path can be tested, and notifies
 * subscribers after each change.
 *
 * Nothing persists: a reload restores the fixtures (the prototype's
 * localStorage is deliberately not reproduced).
 */
import { planGuard } from './planGuard';
import {
  addBooking as modelAddBooking,
  addPlannedInterval,
  commitSmartEdit,
  commitTermExpansion,
  confirmTermMovement,
  contactReady,
  createFromDialog,
  dateOf,
  defaultIdFactory,
  releaseDay as modelReleaseDay,
  slotMinutesOf,
  sourceFor,
  termChangeImpact,
  timeAsMinutes,
  totals,
  weekdayIndex,
  DEFAULT_WINDOW,
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
  type FinishPlanResult,
  type MoveIntervalInput,
  type PlannerCatalogue,
  type PlannerDataSource,
  type PublishFormResult,
  type ResizeIntervalInput,
  type TermWriteResult,
  type UndoToken,
  type UpdateIntervalInput,
} from './PlannerDataSource';
import {
  DEMO_CLINIC_NAME,
  DEMO_DAY_BUDGET_MINUTES,
  demoBaseline,
  demoCategories,
  demoClubProfile,
  demoDayMark,
  demoDemands,
  demoSessions,
} from './demoFixtures';

export interface DemoDataSourceOptions {
  /** "Today" for the seven-day release rule. Default: the real local date. */
  today?: IsoDate;
  /** Artificial delay of every call, to see loading states. */
  latencyMs?: number;
  /** Replace the seeded terms (tests). */
  sessions?: PlannerSession[];
  profile?: Partial<ClubProfile>;
  /** Deterministic ids for new terms (tests). */
  newId?: () => string;
  /** Keep at most this many undo snapshots. */
  maxUndo?: number;
}

const localToday = (): IsoDate => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const clone = <T>(value: T): T => structuredClone(value);

export class DemoDataSource implements PlannerDataSource {
  readonly id = 'demo';

  private sessions: PlannerSession[];
  private profile: ClubProfile;
  private budget: DayBudget = { defaultMinutes: DEMO_DAY_BUDGET_MINUTES };
  private readonly order: PlannerOrder;
  private readonly listeners = new Set<() => void>();
  private readonly snapshots = new Map<string, PlannerSession[]>();
  private snapshotSeq = 0;
  private versionSeq = 0;
  private completed = false;
  private generated = false;
  private latencyMs: number;
  private failure: Error | null = null;
  private readonly today: IsoDate;
  private readonly newId: () => string;
  private readonly maxUndo: number;

  constructor(options: DemoDataSourceOptions = {}) {
    this.sessions = clone(options.sessions ?? demoSessions);
    this.profile = { ...demoClubProfile, ...options.profile };
    this.order = { id: 'demo-order', clubId: 'demo-club', demands: clone(demoDemands), baselineSessions: clone(demoBaseline) };
    this.latencyMs = options.latencyMs ?? 0;
    this.today = options.today ?? localToday();
    this.newId = options.newId ?? defaultIdFactory;
    this.maxUndo = options.maxUndo ?? 30;
  }

  /* ------------------------------ test hooks ------------------------------ */

  setLatency(ms: number): void {
    this.latencyMs = ms;
  }

  /** The next call (read or write) rejects with `error`. */
  failNext(error: Error): void {
    this.failure = error;
  }

  /** Snapshot of the stored terms (tests). */
  snapshotSessions(): PlannerSession[] {
    return clone(this.sessions);
  }

  get isPlanCompleted(): boolean {
    return this.completed;
  }

  /* ------------------------------ plumbing ------------------------------ */

  private async enter(): Promise<void> {
    if (this.latencyMs > 0) await new Promise((r) => setTimeout(r, this.latencyMs));
    if (this.failure) {
      const e = this.failure;
      this.failure = null;
      throw e;
    }
  }

  /** The one gate of every write: the plan never exceeds the need and never lands in the past (`planGuard`). */
  private guard(ctx: PlannerContext, sessions: readonly PlannerSession[], touched: readonly string[], allowExtra = false): void {
    const refusal = planGuard(ctx, sessions, { orderId: null, touched, allowExtra });
    if (refusal) throw new PlannerWriteError('validation', refusal);
  }

  private context(): PlannerContext {
    return buildPlannerContext({
      catalogue: this.catalogueSync(),
      order: this.order,
      sessions: this.sessions,
      dayBudget: this.budget,
      today: this.today,
    });
  }

  private catalogueSync(): PlannerCatalogue {
    return {
      clinicName: DEMO_CLINIC_NAME,
      categories: clone(demoCategories),
      window: { ...DEFAULT_WINDOW },
      dayMarkColors: { holiday: '#5b6b7a', lunch: '#3a4a58' },
      releaseDaysBefore: 7,
      capabilities: { simulateBookings: true, logoUpload: true, realPublish: false },
    };
  }

  private emit(): void {
    for (const l of [...this.listeners]) l();
  }

  /** Remember the CURRENT terms; the token restores them. */
  private remember(): string {
    const token = `undo-${++this.snapshotSeq}`;
    this.snapshots.set(token, clone(this.sessions));
    while (this.snapshots.size > this.maxUndo) this.snapshots.delete(this.snapshots.keys().next().value as string);
    return token;
  }

  private stamp(session: PlannerSession): PlannerSession {
    return { ...session, version: String(++this.versionSeq) };
  }

  private replaceWith(sessions: PlannerSession[], touchedIds: readonly SessionId[]): void {
    const touched = new Set(touchedIds);
    this.sessions = sessions.map((s) => (touched.has(s.id) ? this.stamp(s) : s));
  }

  private assertVersion(id: SessionId, expected: string | null | undefined): PlannerSession {
    const current = this.sessions.find((s) => s.id === id);
    if (!current) throw new PlannerWriteError('notFound', 'Termín již neexistuje.');
    if (expected != null && current.version !== expected) {
      throw new PlannerWriteError('stale', 'Termín se mezitím změnil. Otevřete jej znovu pro aktuální kontrolu.');
    }
    return current;
  }

  /* ------------------------------ reads ------------------------------ */

  async getCatalogue(): Promise<PlannerCatalogue> {
    await this.enter();
    return this.catalogueSync();
  }

  async getOrder(): Promise<PlannerOrder> {
    await this.enter();
    return clone(this.order);
  }

  async getClubProfile(): Promise<ClubProfile> {
    await this.enter();
    return { ...this.profile };
  }

  async listSessions(range: DateRange): Promise<PlannerSession[]> {
    await this.enter();
    return clone(this.sessions.filter((s) => s.date >= range.from && s.date <= range.to));
  }

  async listOrderSessions(): Promise<PlannerSession[]> {
    await this.enter();
    return clone(this.sessions.filter((s) => sourceFor(s) === 'club'));
  }

  async listDayMarks(range: DateRange): Promise<DayMark[]> {
    await this.enter();
    const out: DayMark[] = [];
    for (let d = dateOf(range.from); d <= dateOf(range.to); d.setDate(d.getDate() + 1)) {
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out.push(demoDayMark(date, weekdayIndex(d)));
    }
    return out;
  }

  async getDayBudget(): Promise<DayBudget> {
    await this.enter();
    return { ...this.budget };
  }

  /* ------------------------------ writes ------------------------------ */

  async createInterval(input: IntervalInput): Promise<CreateIntervalResult> {
    await this.enter();
    const before = this.context();
    const result = addPlannedInterval(before, input, this.newId);
    if (!result.ok || !result.merged) throw new PlannerWriteError('validation', result.reason);
    this.guard(before, result.sessions, [result.merged.id], input.allowExtra === true);
    const undoToken = this.remember();
    this.replaceWith(result.sessions, [result.merged.id]);
    this.emit();
    return {
      session: clone(this.sessions.find((s) => s.id === result.merged!.id)!),
      removedIds: result.removedIds,
      mergedCount: result.mergedCount,
      complete: result.complete,
      undoToken,
    };
  }

  async createTerm(input: { date: IsoDate; categoryId: string; start: string; end: string }): Promise<CreateIntervalResult> {
    await this.enter();
    const before = this.context();
    const result = createFromDialog(before, input, this.newId);
    if (!result.ok) throw new PlannerWriteError('validation', result.reason);
    this.guard(before, result.sessions, [result.session.id]);
    const undoToken = this.remember();
    this.replaceWith(result.sessions, [result.session.id]);
    this.emit();
    const ctx = this.context();
    const demand = ctx.demands.find((d) => d.categoryId === input.categoryId);
    const planned = totals(ctx);
    return {
      session: clone(this.sessions.find((s) => s.id === result.session.id)!),
      removedIds: [],
      mergedCount: 0,
      complete: !!demand && planned.pending === 0,
      undoToken,
    };
  }

  private termResult(before: PlannerSession, after: PlannerSession, undoToken: UndoToken): TermWriteResult {
    const impact = termChangeImpact(this.context(), before);
    return {
      session: clone(after),
      undoToken,
      notified: { clubLinkUpdated: impact.clubLinkUpdated, individuals: impact.individualRecipients },
    };
  }

  async moveInterval(input: MoveIntervalInput): Promise<TermWriteResult> {
    await this.enter();
    this.assertVersion(input.id, input.expectedVersion);
    const before = this.context();
    const r = confirmTermMovement(before, input.id, input);
    if (!r.ok || !r.term || !r.before) throw new PlannerWriteError(r.reason.startsWith('Termín již') ? 'notFound' : 'conflict', r.reason);
    this.guard(before, r.sessions, [input.id]);
    const undoToken = this.remember();
    this.replaceWith(r.sessions, [input.id]);
    this.emit();
    return this.termResult(r.before, this.sessions.find((s) => s.id === input.id)!, undoToken);
  }

  async resizeInterval(input: ResizeIntervalInput): Promise<TermWriteResult> {
    await this.enter();
    const current = this.assertVersion(input.id, input.expectedVersion);
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
    const before = this.context();
    const r = commitTermExpansion(before, current, proposal);
    if (!r.ok || !r.term || !r.before) throw new PlannerWriteError(r.reason.includes('mezitím') ? 'stale' : 'validation', r.reason);
    this.guard(before, r.sessions, [input.id]);
    const undoToken = this.remember();
    this.replaceWith(r.sessions, [input.id]);
    this.emit();
    return this.termResult(r.before, this.sessions.find((s) => s.id === input.id)!, undoToken);
  }

  async updateInterval(input: UpdateIntervalInput): Promise<TermWriteResult> {
    await this.enter();
    const current = this.assertVersion(input.id, input.expectedVersion);
    const ctx = this.context();
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
    const undoToken = this.remember();
    this.replaceWith(r.sessions, [input.id]);
    this.emit();
    return this.termResult(r.before, this.sessions.find((s) => s.id === input.id)!, undoToken);
  }

  async deleteInterval(id: SessionId): Promise<{ undoToken: UndoToken }> {
    await this.enter();
    this.assertVersion(id, null);
    const undoToken = this.remember();
    this.sessions = this.sessions.filter((s) => s.id !== id);
    this.emit();
    return { undoToken };
  }

  async undo(token: string): Promise<void> {
    await this.enter();
    const snapshot = this.snapshots.get(token);
    if (!snapshot) throw new PlannerWriteError('notFound', 'Tuto změnu už nelze vrátit.');
    this.sessions = clone(snapshot);
    this.snapshots.delete(token);
    this.emit();
  }

  async finishPlan(): Promise<FinishPlanResult> {
    await this.enter();
    const ctx = this.context();
    const ready = totals(ctx).pending === 0 && contactReady(this.profile);
    if (ready) this.completed = true;
    this.emit();
    return { ready };
  }

  async publishForm(): Promise<PublishFormResult> {
    await this.enter();
    this.generated = true;
    this.emit();
    return { url: null, generated: this.generated };
  }

  async saveClubProfile(patch: Partial<Omit<ClubProfile, 'logoUrl'>>): Promise<ClubProfile> {
    await this.enter();
    const next = { ...this.profile };
    for (const [k, v] of Object.entries(patch)) {
      if (typeof v === 'string') (next as Record<string, unknown>)[k] = v.trim();
    }
    this.profile = next;
    this.emit();
    return { ...this.profile };
  }

  async saveLogo(file: Blob): Promise<ClubProfile> {
    await this.enter();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new PlannerWriteError('unknown', 'Nepodařilo se načíst logo.'));
      reader.readAsDataURL(file);
    });
    this.profile = { ...this.profile, logoUrl: dataUrl };
    this.emit();
    return { ...this.profile };
  }

  async saveDayBudget(defaultMinutes: number): Promise<DayBudget> {
    await this.enter();
    if (!Number.isFinite(defaultMinutes) || defaultMinutes <= 0) {
      throw new PlannerWriteError('validation', 'Referenční kapacita dne musí být kladné číslo.');
    }
    this.budget = { ...this.budget, defaultMinutes };
    this.emit();
    return { ...this.budget };
  }

  /* ------------------------ demo-only simulation ------------------------ */

  async addBooking(id: SessionId, kind: 'club' | 'public'): Promise<{ message: string }> {
    await this.enter();
    const change = modelAddBooking(this.sessions, id, kind, this.today);
    if (!change.ok) throw new PlannerWriteError('validation', 'Rezervaci nelze přidat.');
    this.replaceWith(change.sessions, [id]);
    this.emit();
    return { message: change.message };
  }

  async releaseDay(date: IsoDate): Promise<{ message: string }> {
    await this.enter();
    const change = modelReleaseDay(this.sessions, date);
    const touched = this.sessions.filter((s) => s.date === date && sourceFor(s) === 'club').map((s) => s.id);
    this.replaceWith(change.sessions, touched);
    this.emit();
    return { message: change.message };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
