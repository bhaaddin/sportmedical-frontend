/*
 * Planner domain types.
 *
 * Derived from the state of the partner's prototype (design/planner-v65.html):
 * `state.events`, `category`, `demandData`, `clubContact`, `miniState`, the
 * preview objects built by `selectionFromPointer`, `proposalForMove` and
 * `proposalForTermExpansion`.
 *
 * Names are English, every UI string stays Czech. Nothing here is product
 * data: the six demo categories of the prototype are fixtures, the real
 * categories (činnosti), their colours, slot lengths and capacities arrive
 * from the API through `PlannerDataSource`.
 *
 * Naming map (prototype -> here):
 *   event          -> PlannerSession           type        -> categoryId
 *   category[x]    -> PlannerCategory          demandData  -> OrderDemand
 *   clubContact    -> ClubProfile              demoClub    -> clubBooked
 *   demoPublic     -> publicBooked             demoReleased-> released
 *   DAY_BUDGET_MINUTES -> PlannerContext.dayBudgetMinutes
 */

/** `yyyy-MM-dd`, a calendar day without a time zone. */
export type IsoDate = string;
/** `HH:mm`, 24 hour clock, local time of the clinic. */
export type ClockTime = string;
export type CategoryId = string;
export type SessionId = string;

/** Whose term it is: the club's own planned block or a public (individual) one. */
export type SessionOrigin = 'club' | 'public';

/** The key of a `<symbol id="icon-KEY">` in the sprite (`components/Icons.tsx`). */
export type IconKey = string;

export interface Validation {
  ok: boolean;
  /** Czech, shown to the desk as-is. Empty when `ok`. */
  reason: string;
}

/* -------------------------------------------------------------------------- */
/* Categories (činnosti) and the order's demand                                */
/* -------------------------------------------------------------------------- */

export interface PlannerCategory {
  id: CategoryId;
  /** "Sportovní prohlídky" */
  name: string;
  /** Short chip label of the agenda ("Prohlídky"). Falls back to `name`. */
  shortName?: string;
  iconKey: IconKey;
  /** `#RRGGBB` from the činnost / služba colour setting. */
  color: string;
  /** Second line of the carousel card ("Lékařské vyšetření"). */
  subtitle?: string;
  /** Length of ONE slot (one person) in minutes. */
  slotMinutes: number;
  /** How many people the clinic can take in parallel on this činnost; null = not known. */
  parallelCapacity?: number | null;
  /** List price in CZK from the price list, null when the API does not say. */
  priceCzk?: number | null;
}

/**
 * What the club ordered for one činnost, and what was planned before the
 * planner opened. `requested` is "objednané osoby" (seats), `baselinePlanned`
 * the prototype's `demandData[x].planned`.
 */
export interface OrderDemand {
  categoryId: CategoryId;
  requested: number;
  /** Seats already planned and counted in `baselineSessions` (see `plannedFrom`). */
  baselinePlanned: number;
  /** Optional per-činnost override of the slot length for this order. */
  slotMinutes?: number;
}

/** A session that is already included in `OrderDemand.baselinePlanned`. */
export interface BaselineSession {
  id: SessionId;
  categoryId: CategoryId;
  capacity: number;
  origin?: SessionOrigin;
}

export interface PlannerOrder {
  id: string;
  clubId: string;
  /** Display order of the činnosti in the order (the prototype's `visibleOrderTypes()`). */
  demands: OrderDemand[];
  baselineSessions: BaselineSession[];
  /* ---- real sources only (PL-F): what the desk reads about the order being planned ---- */
  /** The planner shows the whole board without an order (standard booking): `false`. Absent = club order. */
  club?: boolean;
  clubName?: string;
  serviceId?: string | null;
  serviceName?: string;
  /** "KO-1A2B3C4D" - the code the desk reads out; null while the order does not exist yet. */
  code?: string | null;
  /** The server's status (`Invited` | `Requested` | `Confirmed` | ...) or 'New' before the order exists. */
  status?: string;
  paymentMethod?: 'ClubInvoice' | 'PerPerson' | null;
  /** The windows the club asked for / the desk confirmed (`OrderRange`). */
  requestedRanges?: PlannerOrderRange[];
  note?: string;
  /** Players ordered in all činnosti. */
  totalSeats?: number;
  /** Players already registered through the club's link. */
  registered?: number;
  /** The club's link (form while Invited, portal afterwards) when the order has one. */
  linkUrl?: string | null;
  /** The server's price quote of the order (`ClubOrderView.priceQuote`): list total and the total after the discount. */
  quote?: { listCzk: number; totalCzk: number } | null;
}

/** An `OrderRange` of the API: dates `yyyy-MM-dd`, times `HH:mm`. */
export interface PlannerOrderRange {
  fromDate: string;
  toDate: string;
  dailyFrom?: string | null;
  dailyTo?: string | null;
  activityIds?: string[] | null;
}

/* -------------------------------------------------------------------------- */
/* Sessions (the prototype's "events", Czech UI: "termíny")                    */
/* -------------------------------------------------------------------------- */

export interface PlannerSlot {
  id?: string;
  date?: IsoDate;
  start: ClockTime;
  end: ClockTime;
  categoryId?: CategoryId;
  bookingId?: string | null;
  participantId?: string | null;
  reservationId?: string | null;
}

export interface PlannerSession {
  id: SessionId;
  date: IsoDate;
  start: ClockTime;
  end: ClockTime;
  categoryId: CategoryId;
  /** Number of bookable slots (people) in the term. */
  capacity: number;
  /** Legacy single counter of booked places. */
  booked: number;
  origin?: SessionOrigin;
  /** `false` hides the term from the agenda lists. Absent = shown. */
  showInList?: boolean;
  /** Places confirmed for the club / for individuals. null/absent = derive from `booked` + origin. */
  clubBooked?: number | null;
  publicBooked?: number | null;
  /** The club's held places were released to the public (7 days before). */
  released?: boolean;
  /** Created in the planner (as opposed to an imported fixture): only these may be merged. */
  createdByPlanner?: boolean;
  slotDuration?: number;
  slots?: PlannerSlot[];
  /** Planning resource; two terms only merge when all of these are equal. */
  clubId?: string | null;
  orderId?: string | null;
  staffId?: string | null;
  roomId?: string | null;
  equipmentId?: string | null;
  /**
   * Concurrency token of the stored term (the backend's row version). Passed back
   * as `expectedVersion` on move / resize / update so two desks cannot overwrite
   * each other. Absent in the demo.
   */
  version?: string | null;
  /* ---- real sources only (PL-F, `ApiDataSource`): the records behind the term ---- */
  /** Ids of the appointments behind a standard term (one per booked person per calendar). */
  appointmentIds?: string[];
  /** The people of a standard term: enough to open the detail / move it. */
  appointments?: SessionAppointment[];
  /** Ids of the time blocks (one per calendar and part of the day) behind a club window. */
  blockIds?: string[];
  /** The calendars the term runs on. */
  calendarIds?: string[];
  /** The club block (window) the term is part of. */
  clubBlockId?: string | null;
  /** The club order the window belongs to. */
  clubOrderId?: string | null;
  clubName?: string | null;
  /** The club's own colour (`#RRGGBB`) when the term is a club window. */
  clubColorHex?: string | null;
  /** Money of the term (`agreedPriceCzk ?? listPriceCzk` per appointment); absent = unknown / not a priced term. */
  price?: SessionPrice | null;
  /** The term belongs to ANOTHER club's order than the one being planned: shown as busy, not editable. */
  foreign?: boolean;
}

/** One booked person of a standard term (no identity numbers, ever). */
export interface SessionAppointment {
  id: string;
  calendarId: string;
  patientName: string | null;
  /** The booking status code of the API (0 scheduled .. 5 no-show). */
  status: number;
  /** Heads in a group booking; 1 for one person. */
  heads: number;
  /** `agreedPriceCzk ?? listPriceCzk`, null = no price. */
  priceCzk: number | null;
}

export interface SessionPrice {
  /** Sum of the priced appointments, CZK. */
  totalCzk: number;
  /** Appointments with / without a price. */
  priced: number;
  unpriced: number;
  /** At least one agreed price differs from the price list. */
  adjusted: boolean;
}

/** A session as drawn into the mini-calendar plan: a real term or the live preview. */
export type PlanEntry = PlannerSession & { extraPreview: boolean };

/* -------------------------------------------------------------------------- */
/* Context: everything the pure functions need besides their arguments         */
/* -------------------------------------------------------------------------- */

export interface PlannerContext {
  /** Every session the UI currently knows (shared calendar: club + public). */
  sessions: readonly PlannerSession[];
  /** The catalogue in its natural order (the prototype's `Object.keys(category)`). */
  categories: readonly PlannerCategory[];
  /** The order's demand, in display order (`visibleOrderTypes()`). */
  demands: readonly OrderDemand[];
  baselineSessions: readonly BaselineSession[];
  /** Reference day capacity of the mini-calendar in minutes (`DAY_BUDGET_MINUTES`). */
  dayBudgetMinutes: number;
  /** Today, `yyyy-MM-dd` — injected so that the logic stays pure and testable. */
  today: IsoDate;
  /** Working window of the planning board in minutes (07:00 = 420 … 19:00 = 1140). */
  window: PlanningWindow;
  /**
   * Hours and lunch break of the days the source has read (the clinic's own settings). With a day here no term may
   * touch the break or reach outside the hours (`openTime.ts`); a day without a mark is the whole planning window.
   */
  dayMarks?: Readonly<Record<IsoDate, DayMark>>;
}

export interface PlanningWindow {
  startMinutes: number;
  endMinutes: number;
}

/* -------------------------------------------------------------------------- */
/* Day plan (mini-calendar ring)                                               */
/* -------------------------------------------------------------------------- */

export interface DaySlice {
  categoryId: CategoryId;
  minutes: number;
  terms: number;
  slots: number;
}

export interface DayPlan {
  date: IsoDate;
  entries: PlanEntry[];
  minutes: number;
  /** 0..1, planned minutes / day budget. */
  ratio: number;
  /** 0..100 */
  percent: number;
  slices: DaySlice[];
  slots: number;
}

export interface RingArc {
  categoryId: CategoryId;
  color: string;
  /** SVG `stroke-dasharray` first number. */
  dash: number;
  /** SVG `stroke-dashoffset` (negative). */
  offset: number;
}

export interface MiniCellModel {
  date: IsoDate;
  dayNumber: number;
  hasTerms: boolean;
  /** Present only when the day has at least one term. */
  ring: {
    circumference: number;
    arcs: RingArc[];
    /** Liquid orb fill in percent (0..100). */
    liquidPercent: number;
  } | null;
  percent: number;
  termCount: number;
  slotCount: number;
  /** Czech accessible label of the day button. */
  ariaLabel: string;
}

/* -------------------------------------------------------------------------- */
/* Booking (reservations) breakdown                                            */
/* -------------------------------------------------------------------------- */

export interface BookingState {
  source: SessionOrigin;
  cap: number;
  club: number;
  publicCount: number;
  confirmed: number;
  held: number;
  free: number;
  released: boolean;
  /** `yyyy-MM-dd`: the day the club's unfilled places are released to the public. */
  cutoff: IsoDate;
}

export interface DayReservationSummary {
  events: number;
  slots: number;
  club: number;
  publicCount: number;
  held: number;
  free: number;
  confirmed: number;
  clubEvents: number;
  publicEvents: number;
  percent: number;
}

export interface BreakdownPart {
  label: string;
  count: number;
  tone: string;
  sub: string;
  /** Share of the day's slots, 0..100 (for the occupancy split bar). */
  widthPercent: number;
}

/* -------------------------------------------------------------------------- */
/* Order totals                                                                */
/* -------------------------------------------------------------------------- */

export interface OrderTotals {
  requested: number;
  planned: number;
  pending: number;
  percent: number;
}

export interface OrderRow {
  categoryId: CategoryId;
  name: string;
  requested: number;
  planned: number;
  remaining: number;
  percent: number;
  slotMinutes: number;
  color: string;
}

export interface OrderSnapshot {
  totals: OrderTotals;
  /** The club's planned terms of the ordered činnosti. */
  terms: PlannerSession[];
  slots: number;
  pendingMinutes: number;
  rows: OrderRow[];
  contactReady: boolean;
  fullyPlanned: boolean;
  planExists: boolean;
  /** Czech sentences; empty = ready. */
  issues: string[];
}

export interface OrderCommandModel {
  percent: number;
  planned: number;
  requested: number;
  /** "126 osob zbývá naplánovat" / "✓ Požadavek klubu splněn" */
  remainingText: string;
  /** Club terms of the ordered činnosti. */
  terms: number;
  /** Slots added in this session (not in the baseline). */
  newSlots: number;
  ready: boolean;
}

/* -------------------------------------------------------------------------- */
/* Club header                                                                 */
/* -------------------------------------------------------------------------- */

export interface ClubProfile {
  clubName: string;
  ico: string;
  dic: string;
  address: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  /** URL / data URI of the club logo, null = empty slot with "Změnit logo". */
  logoUrl?: string | null;
  /** The club record behind the header (real sources only): the edit dialog opens it. */
  clubId?: string | null;
  /** The club's own colour (hex) for the initials avatar; null = the neutral chip. */
  colorHex?: string | null;
}

export type ClubProfileField = Exclude<keyof ClubProfile, 'logoUrl' | 'clubId' | 'colorHex'>;

/** One cell of the header strip: the value or the Czech placeholder "Doplnit". */
export interface HeaderValue {
  field: ClubProfileField;
  value: string;
  missing: boolean;
  /** tooltip */
  title: string;
}

/* -------------------------------------------------------------------------- */
/* Day marks and day budget (new for the product, not in the prototype)        */
/* -------------------------------------------------------------------------- */

export interface DayMark {
  date: IsoDate;
  /** The whole day is closed (holiday, closure, absence). */
  closed: boolean;
  /** Name of the holiday / closure, Czech, from the holidays settings. */
  label?: string | null;
  /** Working hours of the clinic that day; null = no hours known. */
  hours?: { from: ClockTime; to: ClockTime } | null;
  /** Lunch break; null = none. */
  lunch?: { from: ClockTime; to: ClockTime } | null;
}

export interface DayMarkColors {
  /** `#RRGGBB` the closed day is painted in. */
  holiday: string;
  lunch: string;
}

export interface DayBudget {
  /** Reference day capacity in minutes for the mini-calendar fill. */
  defaultMinutes: number;
  /** Per-day override (e.g. a short day), `yyyy-MM-dd` -> minutes. */
  byDate?: Record<IsoDate, number>;
}

/* -------------------------------------------------------------------------- */
/* Previews and proposals (drag / move / resize)                               */
/* -------------------------------------------------------------------------- */

/** Result of dragging a činnost into the board (`selectionFromPointer`). */
export interface PlacementPreview {
  kind: 'place';
  date: IsoDate;
  categoryId: CategoryId;
  start: ClockTime;
  end: ClockTime;
  quantity: number;
  validation: Validation;
  /** Day column 0..6 */
  col: number;
  startMinutes: number;
  endMinutes: number;
  isLimit: boolean;
  stoppedAtLimit: boolean;
  blockedByEndOfDay: boolean;
  remaining: number;
  /** The runs of whole slots the drop is made of: more than one when the block would cross the lunch break. */
  parts?: { start: number; end: number; slots: number }[];
}

/** Result of moving an existing term (`proposalForMove`). */
export interface MovePreview {
  kind: 'move';
  eventId: SessionId;
  date: IsoDate;
  categoryId: CategoryId;
  start: ClockTime;
  end: ClockTime;
  startMinutes: number;
  endMinutes: number;
  col: number;
  quantity: number;
  validation: Validation;
  oldDate: IsoDate;
  oldStart: ClockTime;
  oldEnd: ClockTime;
}

export type ResizeEdge = 'top' | 'bottom';

/** Result of pulling the top/bottom edge of a term (`proposalForTermExpansion`). */
export interface ResizePreview {
  kind: 'resize';
  eventId: SessionId;
  date: IsoDate;
  categoryId: CategoryId;
  edge: ResizeEdge;
  /** Slots added. */
  added: number;
  /** New total capacity. */
  capacity: number;
  start: ClockTime;
  end: ClockTime;
  startMinutes: number;
  endMinutes: number;
  col: number;
  validation: Validation;
  original: PlannerSession;
}

export type Preview = PlacementPreview | MovePreview | ResizePreview;

/** The pointer in board-relative fractions (`pointerCoords`). */
export interface BoardPoint {
  x: number;
  y: number;
}

/** What the placement drag remembers between pointer events (`planState.dragging`). */
export interface PlacementDrag {
  day: number;
  startMinutes: number;
}

export interface MoveDrag {
  id: SessionId;
  pointerId: number;
  /** Pointer position at pointerdown (client px). */
  x: number;
  y: number;
  started: boolean;
  oldDate: IsoDate;
  oldStart: ClockTime;
  oldEnd: ClockTime;
  /** Minutes between the term start and the grabbed point. */
  grabOffset: number;
}

export interface ResizeDrag {
  id: SessionId;
  pointerId: number;
  edge: ResizeEdge;
  originY: number;
  started: boolean;
  original: PlannerSession;
}

/* -------------------------------------------------------------------------- */
/* Edits (smart editor, merge, expansion)                                      */
/* -------------------------------------------------------------------------- */

export interface SmartEditDraft {
  date: IsoDate;
  categoryId: CategoryId;
  start: ClockTime;
  end: ClockTime;
  capacity: number;
  /** `auto`: end follows from start + capacity; `manual`: capacity follows from the end. */
  mode: 'auto' | 'manual';
  dirty: boolean;
}

export interface MergeResult {
  group: PlannerSession[];
  start: ClockTime;
  end: ClockTime;
}

export interface IntervalInput {
  date: IsoDate;
  categoryId: CategoryId;
  start: ClockTime;
  /** Whole slots of the činnost. */
  quantity: number;
  /**
   * "Přidat termín navíc": the desk chose to plan beyond the players still missing (the club planner's one extra
   * drop). The places beyond are reported as spare and can be trimmed before the order is saved.
   */
  allowExtra?: boolean;
}

export interface AddIntervalResult {
  ok: boolean;
  reason: string;
  sessions: PlannerSession[];
  /** The session that now covers the new slots (new or merged). */
  merged: PlannerSession | null;
  /** Ids of the terms that were absorbed into `merged`. */
  removedIds: SessionId[];
  mergedCount: number;
  /** Whole činnost is planned after this step. */
  complete: boolean;
}

/* -------------------------------------------------------------------------- */
/* Agenda                                                                      */
/* -------------------------------------------------------------------------- */

export type AgendaMode = 'activities' | 'all';
export type AgendaScope = 'all' | 'day' | 'week';

export interface AgendaRowModel {
  id: SessionId;
  date: IsoDate;
  dayLabel: string;
  dayCode: string;
  name: string;
  tone: string;
  iconKey: IconKey;
  timeRange: string;
  slots: number;
  slotLabel: string;
  title: string;
  /** A činnost's several bookings / terms of one day folded into this row (reviewer 2.2): the ids behind it. */
  group?: { count: number; entryIds: string[] };
}

/* -------------------------------------------------------------------------- */
/* Toasts, dialogs, drawer                                                     */
/* -------------------------------------------------------------------------- */

export interface ToastItem {
  id: number;
  message: string;
  /** Label of the action button ("↶ Zpět"). */
  actionLabel?: string;
  /** Opaque key the UI maps to an action (`undo`), keeping state serialisable. */
  actionKey?: string;
  tone?: 'default' | 'moved';
  /** ms, 0 = stays until dismissed. */
  durationMs: number;
}

export type DrawerTab = 'overview' | 'bookings' | 'club';

export type DialogState =
  | { kind: 'orderDetails' }
  | { kind: 'settings' }
  | { kind: 'search' }
  | { kind: 'notifications' }
  | { kind: 'profile' }
  | { kind: 'filterPicker' }
  | { kind: 'clubDetails' }
  | { kind: 'clubEdit' }
  | { kind: 'eventDetail'; id: SessionId }
  | { kind: 'agendaDetail'; id: SessionId }
  | { kind: 'agendaFullList'; categoryId: CategoryId | 'all' }
  | { kind: 'deleteConfirm'; id: SessionId }
  | { kind: 'newEvent'; defaults?: Partial<{ date: IsoDate; start: ClockTime; end: ClockTime; categoryId: CategoryId }> }
  | { kind: 'smartEdit'; id: SessionId; prefill?: SmartEditDraft }
  | { kind: 'smartEditConfirm'; id: SessionId; draft: SmartEditDraft }
  | { kind: 'moveConfirm'; proposal: MovePreview }
  | { kind: 'expandConfirm'; proposal: ResizePreview }
  | { kind: 'finish' }
  | { kind: 'publish' }
  | { kind: 'formPreview' }
  | { kind: 'emailPreview' }
  | { kind: 'clubOccupancy'; focusDate: IsoDate };

export type DialogKind = DialogState['kind'];
