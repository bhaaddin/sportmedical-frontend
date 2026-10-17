/*
 * The planner UI store: one reducer, typed actions, no library.
 *
 * It mirrors the prototype's mutable `state`, `planState`, `agendaUI`,
 * `bookingUI`, `miniState`, `adaptiveDemo.index`, `movingEvent`,
 * `resizingEvent` and the dialog / toast layers - as plain serialisable data.
 * What it does NOT hold: the terms themselves (they come from
 * `PlannerDataSource`), timers (the UI owns them) and DOM measurements.
 *
 * Each action creator in `plannerActions` mirrors a function of the prototype:
 *   selectDay, setView, previousWeek / nextWeek (`previousWeek(±7)`), changeMonth,
 *   today, setFilter, openDialog / closeDialog, selectPlanningType, setAdaptivePosition,
 *   toast, openReservationDrawer, openSummaryExperience, agendaUI changes, Esc /
 *   right-click handling, begin/update/end of the three board gestures.
 */
import {
  addDays,
  addMonths,
  initialMiniState,
  mondayOf,
  miniReduce,
  monthStartOf,
  clampCarouselIndex,
  type AgendaMode,
  type AgendaScope,
  type CategoryId,
  type DialogState,
  type DrawerTab,
  type IsoDate,
  type MiniAction,
  type MiniState,
  type MoveDrag,
  type MovePreview,
  type PlacementDrag,
  type PlacementPreview,
  type ResizeDrag,
  type ResizePreview,
  type ToastItem,
} from '../model';

export type PlannerView = 'day' | 'week' | 'month';
export type SummarySheet = 'overview' | 'activities' | 'terms';

export interface CompletionCallout {
  categoryId: CategoryId;
  /** The činnost was already complete when the desk tried to plan it again. */
  alreadyCompleted: boolean;
}

export interface PlanningState {
  /** The činnost armed for planning (`planState.selectedType`). */
  selectedCategoryId: CategoryId | null;
  /** Placement drag in progress (`planState.dragging`) and its live preview. */
  drag: PlacementDrag | null;
  preview: PlacementPreview | null;
  /** Moving an existing term (`movingEvent`). */
  move: MoveDrag | null;
  movePreview: MovePreview | null;
  /** Pulling an edge of an existing term (`resizingEvent`). */
  resize: ResizeDrag | null;
  resizePreview: ResizePreview | null;
  /** Undo handle of the last write (`planState.lastSnapshot`); null = nothing to undo. */
  undoToken: string | null;
  /** The plan was marked ready (`planState.completed`). */
  completed: boolean;
  /** "Požadavek naplněn" card (`#planner-feedback`). */
  completion: CompletionCallout | null;
  /** "Přidat termín navíc": every player has a place, the board refuses a new drop until this arms exactly one. */
  extraArmed: boolean;
  /**
   * Club orders with several činnosti: a window was just dropped and the bubble asks which činnosti it is for
   * (Vše / one / several, Rozdělit). Nothing is written until the desk confirms.
   */
  ask: PlanAsk | null;
}

/** A dropped, not yet written window (whole slots of the armed činnost). */
export interface PlanAsk {
  date: IsoDate;
  categoryId: CategoryId;
  startMinutes: number;
  /** Whole slots of the armed činnost the window is long. */
  slots: number;
}

export interface AgendaState {
  mode: AgendaMode;
  categoryId: CategoryId | null;
  scope: AgendaScope;
}

export interface ReservationDrawerState {
  date: IsoDate;
  tab: DrawerTab;
}

export interface PlannerState {
  view: PlannerView;
  /** 'all' or a činnost id (the board filter). */
  filter: CategoryId | 'all';
  selectedDate: IsoDate;
  /** Monday of the shown week. */
  weekStart: IsoDate;
  /** First day of the month shown in the mini-calendar. */
  calendarMonth: IsoDate;
  agenda: AgendaState;
  planning: PlanningState;
  carousel: { index: number };
  toasts: ToastItem[];
  toastSeq: number;
  dialog: DialogState | null;
  summary: { open: boolean; sheet: SummarySheet };
  drawer: ReservationDrawerState | null;
  mini: MiniState;
  /** "Vygenerovat DEMO" was pressed (`adaptiveDemo.generated`). */
  formGenerated: boolean;
}

export interface InitialStateOptions {
  today: IsoDate;
  /** Defaults to `today`. The prototype starts on 2026-11-20. */
  selectedDate?: IsoDate;
  view?: PlannerView;
}

export function createInitialState(opts: InitialStateOptions): PlannerState {
  const selectedDate = opts.selectedDate ?? opts.today;
  return {
    view: opts.view ?? 'week',
    filter: 'all',
    selectedDate,
    weekStart: mondayOf(selectedDate),
    calendarMonth: monthStartOf(selectedDate),
    agenda: { mode: 'activities', categoryId: null, scope: 'all' },
    planning: {
      selectedCategoryId: null,
      drag: null,
      preview: null,
      move: null,
      movePreview: null,
      resize: null,
      resizePreview: null,
      undoToken: null,
      completed: false,
      completion: null,
      extraArmed: false,
      ask: null,
    },
    carousel: { index: 0 },
    toasts: [],
    toastSeq: 0,
    dialog: null,
    summary: { open: false, sheet: 'overview' },
    drawer: null,
    mini: { ...initialMiniState },
    formGenerated: false,
  };
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                     */
/* -------------------------------------------------------------------------- */

export type NewToast = Omit<ToastItem, 'id' | 'durationMs'> & { durationMs?: number };

export type PlannerAction =
  /* navigation */
  | { type: 'selectDay'; date: IsoDate }
  | { type: 'setView'; view: PlannerView }
  | { type: 'shiftWeek'; days: number }
  | { type: 'changeMonth'; direction: number }
  | { type: 'today'; today: IsoDate }
  | { type: 'setFilter'; filter: CategoryId | 'all' }
  /** After a write moved / created a term: follow it. `week: true` also jumps the week (smart editor, new term). */
  | { type: 'focusDate'; date: IsoDate; week?: boolean }
  /** Agenda "Zobrazit v kalendáři": week view, no filter, that day. */
  | { type: 'locateTerm'; date: IsoDate }
  /* agenda */
  | { type: 'setAgendaMode'; mode: AgendaMode }
  | { type: 'setAgendaCategory'; categoryId: CategoryId }
  | { type: 'setAgendaScope'; scope: AgendaScope }
  /* planning mode */
  /** `activeToast`: the Czech line shown when the činnost gets armed (needs its name, so the caller supplies it). */
  | { type: 'selectPlanningCategory'; categoryId: CategoryId; activeToast?: string }
  | { type: 'clearPlanningSelection'; toast?: boolean }
  | { type: 'beginPlacement'; drag: PlacementDrag }
  | { type: 'updatePlacement'; preview: PlacementPreview | null }
  | { type: 'endPlacement' }
  | { type: 'beginMove'; drag: MoveDrag }
  | { type: 'updateMove'; started: boolean; preview: MovePreview | null }
  | { type: 'endMove' }
  | { type: 'beginResize'; drag: ResizeDrag }
  | { type: 'updateResize'; started: boolean; preview: ResizePreview | null }
  | { type: 'endResize' }
  | { type: 'setUndoToken'; token: string | null }
  | { type: 'setPlanCompleted'; completed: boolean }
  | { type: 'showCompletion'; categoryId: CategoryId; alreadyCompleted: boolean }
  | { type: 'hideCompletion' }
  /* carousel */
  | { type: 'carouselTo'; index: number; quantity: number }
  | { type: 'carouselMove'; delta: number; quantity: number }
  /* layers */
  | { type: 'pushToast'; toast: NewToast }
  | { type: 'dismissToast'; id: number }
  | { type: 'openDialog'; dialog: DialogState }
  | { type: 'closeDialog' }
  | { type: 'openSummary' }
  | { type: 'closeSummary' }
  | { type: 'setSummarySheet'; sheet: SummarySheet }
  | { type: 'openDrawer'; date: IsoDate }
  | { type: 'closeDrawer' }
  | { type: 'setDrawerTab'; tab: DrawerTab }
  | { type: 'setFormGenerated'; generated: boolean }
  /* mini-calendar flyout */
  | { type: 'mini'; action: MiniAction }
  /* keyboard / mouse priorities of the prototype */
  | { type: 'escape' }
  | { type: 'rightClick'; onBoard: boolean }
  /* club planning (additive): the one extra drop and the činnosti bubble of a dropped window */
  | { type: 'setExtraArmed'; armed: boolean }
  | { type: 'openPlanAsk'; ask: PlanAsk }
  | { type: 'closePlanAsk' };

const DEFAULT_TOAST_MS = 2800;
const MAX_TOASTS = 3;

function withToast(state: PlannerState, toast: NewToast): PlannerState {
  const id = state.toastSeq + 1;
  const item: ToastItem = { durationMs: DEFAULT_TOAST_MS, ...toast, id };
  return { ...state, toastSeq: id, toasts: [...state.toasts, item].slice(-MAX_TOASTS) };
}

const clearGestures = (p: PlanningState): PlanningState => ({
  ...p,
  drag: null, preview: null, move: null, movePreview: null, resize: null, resizePreview: null,
});

const hideMini = (s: PlannerState): PlannerState => ({ ...s, mini: { ...initialMiniState } });

export function plannerReducer(state: PlannerState, action: PlannerAction): PlannerState {
  switch (action.type) {
    /* ------------------------------ navigation ------------------------------ */
    case 'selectDay':
      return {
        ...state,
        selectedDate: action.date,
        calendarMonth: monthStartOf(action.date),
        weekStart: mondayOf(action.date),
      };
    case 'setView':
      return { ...state, view: action.view };
    case 'shiftWeek': {
      const weekStart = addDays(state.weekStart, action.days);
      return { ...state, weekStart, selectedDate: weekStart, calendarMonth: monthStartOf(weekStart) };
    }
    case 'changeMonth':
      return { ...hideMini(state), calendarMonth: addMonths(state.calendarMonth, action.direction) };
    case 'today':
      return {
        ...state,
        selectedDate: action.today,
        weekStart: mondayOf(action.today),
        calendarMonth: monthStartOf(action.today),
      };
    case 'setFilter':
      return { ...state, filter: action.filter };
    case 'focusDate':
      return {
        ...state,
        selectedDate: action.date,
        calendarMonth: monthStartOf(action.date),
        weekStart: action.week ? mondayOf(action.date) : state.weekStart,
      };
    case 'locateTerm':
      return {
        ...state,
        weekStart: mondayOf(action.date),
        selectedDate: action.date,
        calendarMonth: monthStartOf(action.date),
        view: 'week',
        filter: 'all',
      };

    /* ------------------------------ agenda ------------------------------ */
    case 'setAgendaMode':
      return { ...state, agenda: { ...state.agenda, mode: action.mode } };
    case 'setAgendaCategory':
      return { ...state, agenda: { ...state.agenda, categoryId: action.categoryId } };
    case 'setAgendaScope':
      return { ...state, agenda: { ...state.agenda, scope: action.scope } };

    /* ------------------------------ planning mode ------------------------------ */
    case 'selectPlanningCategory': {
      // Clicking the armed card again disarms it (`selectPlanningType`).
      if (state.planning.selectedCategoryId === action.categoryId) {
        return withToast({ ...state, planning: { ...state.planning, selectedCategoryId: null } }, { message: 'Výběr činnosti zrušen' });
      }
      const armed = {
        ...state,
        planning: { ...state.planning, selectedCategoryId: action.categoryId, completion: null },
      };
      return action.activeToast ? withToast(armed, { message: action.activeToast }) : armed;
    }
    case 'clearPlanningSelection': {
      const next = { ...state, planning: clearGestures({ ...state.planning, selectedCategoryId: null }) };
      return action.toast ? withToast(next, { message: 'Výběr činnosti zrušen' }) : next;
    }
    case 'beginPlacement':
      return { ...state, planning: { ...state.planning, drag: action.drag, completion: null } };
    case 'updatePlacement':
      return { ...state, planning: { ...state.planning, preview: action.preview } };
    case 'endPlacement':
      return { ...state, planning: { ...state.planning, drag: null, preview: null } };
    case 'beginMove':
      return { ...state, planning: { ...state.planning, move: action.drag, movePreview: null } };
    case 'updateMove': {
      if (!state.planning.move) return state;
      const base = action.started && !state.planning.move.started ? hideMini(state) : state;
      return {
        ...base,
        planning: {
          ...base.planning,
          move: { ...base.planning.move!, started: action.started },
          movePreview: action.preview,
        },
      };
    }
    case 'endMove':
      return { ...state, planning: { ...state.planning, move: null, movePreview: null } };
    case 'beginResize':
      return { ...state, planning: { ...state.planning, resize: action.drag, resizePreview: null } };
    case 'updateResize': {
      if (!state.planning.resize) return state;
      const base = action.started && !state.planning.resize.started ? hideMini(state) : state;
      return {
        ...base,
        planning: {
          ...base.planning,
          resize: { ...base.planning.resize!, started: action.started },
          resizePreview: action.preview,
        },
      };
    }
    case 'endResize':
      return { ...state, planning: { ...state.planning, resize: null, resizePreview: null } };
    case 'setUndoToken':
      return { ...state, planning: { ...state.planning, undoToken: action.token } };
    case 'setPlanCompleted':
      return { ...state, planning: { ...state.planning, completed: action.completed } };
    case 'showCompletion':
      return {
        ...state,
        planning: {
          ...state.planning,
          selectedCategoryId: null,
          completion: { categoryId: action.categoryId, alreadyCompleted: action.alreadyCompleted },
        },
      };
    case 'hideCompletion':
      return { ...state, planning: { ...state.planning, completion: null } };

    /* ------------------------------ carousel ------------------------------ */
    case 'carouselTo': {
      const index = clampCarouselIndex(action.quantity, action.index);
      if (action.quantity < 3) return state;
      // Every real page change exits the activity planning mode.
      const exits = index !== state.carousel.index && state.planning.selectedCategoryId !== null;
      return {
        ...state,
        carousel: { index },
        planning: exits ? { ...state.planning, selectedCategoryId: null } : state.planning,
      };
    }
    case 'carouselMove': {
      if (action.quantity < 3) return state;
      return plannerReducer(state, { type: 'carouselTo', index: state.carousel.index + action.delta, quantity: action.quantity });
    }

    /* ------------------------------ layers ------------------------------ */
    case 'pushToast':
      return withToast(state, action.toast);
    case 'dismissToast':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case 'openDialog':
      return { ...state, dialog: action.dialog };
    case 'closeDialog':
      return { ...state, dialog: null };
    case 'openSummary':
      return { ...state, summary: { open: true, sheet: 'overview' } };
    case 'closeSummary':
      return { ...state, summary: { open: false, sheet: 'overview' } };
    case 'setSummarySheet':
      return { ...state, summary: { ...state.summary, sheet: action.sheet } };
    case 'openDrawer':
      return { ...hideMini(state), drawer: { date: action.date, tab: 'overview' } };
    case 'closeDrawer':
      return { ...state, drawer: null };
    case 'setDrawerTab':
      return state.drawer ? { ...state, drawer: { ...state.drawer, tab: action.tab } } : state;
    case 'setFormGenerated':
      return { ...state, formGenerated: action.generated };

    /* ------------------------------ mini-calendar ------------------------------ */
    case 'mini':
      return { ...state, mini: miniReduce(state.mini, action.action) };

    /* ------------------------------ Esc ------------------------------ */
    case 'escape': {
      const p = state.planning;
      if (state.summary.open) return plannerReducer(state, { type: 'closeSummary' });
      if (p.ask) return { ...state, planning: { ...p, ask: null } };
      if (p.move) {
        return withToast({ ...state, planning: { ...p, move: null, movePreview: null } }, { message: 'Přesun zrušen. Původní termín zůstal beze změny.' });
      }
      if (p.resize) {
        return withToast({ ...state, planning: { ...p, resize: null, resizePreview: null } }, { message: 'Rozšíření zrušeno. Termín zůstal beze změny.' });
      }
      if (state.drawer) return { ...state, drawer: null };
      if (state.mini.openDate !== null || state.mini.pinnedDate || state.mini.zoomHoveredDate) return hideMini(state);
      if (state.dialog) return { ...state, dialog: null };
      let next = state;
      if (p.drag) next = { ...next, planning: { ...next.planning, drag: null, preview: null } };
      if (next.planning.completion) next = { ...next, planning: { ...next.planning, completion: null } };
      if (next.planning.selectedCategoryId) {
        next = withToast({ ...next, planning: { ...next.planning, selectedCategoryId: null } }, { message: 'Výběr činnosti zrušen' });
      }
      return next;
    }

    /* ------------------------------ right click ------------------------------ */
    case 'rightClick': {
      const p = state.planning;
      if (action.onBoard) {
        if (p.move) {
          return withToast({ ...state, planning: { ...p, move: null, movePreview: null } }, { message: 'Přesun zrušen. Původní termín zůstal beze změny.' });
        }
        if (p.resize) {
          return withToast({ ...state, planning: { ...p, resize: null, resizePreview: null } }, { message: 'Rozšíření zrušeno. Termín zůstal beze změny.' });
        }
        const cleared = { ...state, planning: { ...p, drag: null, preview: null } };
        if (p.selectedCategoryId) {
          return withToast({ ...cleared, planning: { ...cleared.planning, selectedCategoryId: null } }, { message: 'Aktivní činnost byla zrušena' });
        }
        return cleared;
      }
      // Anywhere else: only when a činnost is armed (document capture handler).
      if (!p.selectedCategoryId) return state;
      return withToast(
        { ...state, planning: { ...p, drag: null, preview: null, selectedCategoryId: null } },
        { message: 'Výběr činnosti zrušen' },
      );
    }

    /* ------------------------------ club planning ------------------------------ */
    case 'setExtraArmed':
      return { ...state, planning: { ...state.planning, extraArmed: action.armed } };
    case 'openPlanAsk':
      return { ...state, planning: { ...state.planning, ask: action.ask, drag: null, preview: null } };
    case 'closePlanAsk':
      return state.planning.ask ? { ...state, planning: { ...state.planning, ask: null } } : state;
  }
}

/* -------------------------------------------------------------------------- */
/* Action creators                                                             */
/* -------------------------------------------------------------------------- */

export const plannerActions = {
  selectDay: (date: IsoDate): PlannerAction => ({ type: 'selectDay', date }),
  setView: (view: PlannerView): PlannerAction => ({ type: 'setView', view }),
  previousWeek: (): PlannerAction => ({ type: 'shiftWeek', days: -7 }),
  nextWeek: (): PlannerAction => ({ type: 'shiftWeek', days: 7 }),
  previousMonth: (): PlannerAction => ({ type: 'changeMonth', direction: -1 }),
  nextMonth: (): PlannerAction => ({ type: 'changeMonth', direction: 1 }),
  today: (today: IsoDate): PlannerAction => ({ type: 'today', today }),
  setFilter: (filter: CategoryId | 'all'): PlannerAction => ({ type: 'setFilter', filter }),
  focusDate: (date: IsoDate, week = false): PlannerAction => ({ type: 'focusDate', date, week }),
  locateTerm: (date: IsoDate): PlannerAction => ({ type: 'locateTerm', date }),

  setAgendaMode: (mode: AgendaMode): PlannerAction => ({ type: 'setAgendaMode', mode }),
  setAgendaCategory: (categoryId: CategoryId): PlannerAction => ({ type: 'setAgendaCategory', categoryId }),
  setAgendaScope: (scope: AgendaScope): PlannerAction => ({ type: 'setAgendaScope', scope }),

  selectPlanningCategory: (categoryId: CategoryId, activeToast?: string): PlannerAction => ({ type: 'selectPlanningCategory', categoryId, activeToast }),
  clearPlanningSelection: (toast = false): PlannerAction => ({ type: 'clearPlanningSelection', toast }),
  beginPlacement: (drag: PlacementDrag): PlannerAction => ({ type: 'beginPlacement', drag }),
  updatePlacement: (preview: PlacementPreview | null): PlannerAction => ({ type: 'updatePlacement', preview }),
  endPlacement: (): PlannerAction => ({ type: 'endPlacement' }),
  beginMove: (drag: MoveDrag): PlannerAction => ({ type: 'beginMove', drag }),
  updateMove: (started: boolean, preview: MovePreview | null): PlannerAction => ({ type: 'updateMove', started, preview }),
  endMove: (): PlannerAction => ({ type: 'endMove' }),
  beginResize: (drag: ResizeDrag): PlannerAction => ({ type: 'beginResize', drag }),
  updateResize: (started: boolean, preview: ResizePreview | null): PlannerAction => ({ type: 'updateResize', started, preview }),
  endResize: (): PlannerAction => ({ type: 'endResize' }),
  setUndoToken: (token: string | null): PlannerAction => ({ type: 'setUndoToken', token }),
  setPlanCompleted: (completed: boolean): PlannerAction => ({ type: 'setPlanCompleted', completed }),
  showCompletion: (categoryId: CategoryId, alreadyCompleted = false): PlannerAction => ({ type: 'showCompletion', categoryId, alreadyCompleted }),
  hideCompletion: (): PlannerAction => ({ type: 'hideCompletion' }),

  carouselTo: (index: number, quantity: number): PlannerAction => ({ type: 'carouselTo', index, quantity }),
  carouselMove: (delta: number, quantity: number): PlannerAction => ({ type: 'carouselMove', delta, quantity }),

  toast: (message: string, extra: Partial<NewToast> = {}): PlannerAction => ({ type: 'pushToast', toast: { message, ...extra } }),
  dismissToast: (id: number): PlannerAction => ({ type: 'dismissToast', id }),
  openDialog: (dialog: DialogState): PlannerAction => ({ type: 'openDialog', dialog }),
  closeDialog: (): PlannerAction => ({ type: 'closeDialog' }),
  openSummary: (): PlannerAction => ({ type: 'openSummary' }),
  closeSummary: (): PlannerAction => ({ type: 'closeSummary' }),
  setSummarySheet: (sheet: SummarySheet): PlannerAction => ({ type: 'setSummarySheet', sheet }),
  openReservationDrawer: (date: IsoDate): PlannerAction => ({ type: 'openDrawer', date }),
  closeReservationDrawer: (): PlannerAction => ({ type: 'closeDrawer' }),
  setDrawerTab: (tab: DrawerTab): PlannerAction => ({ type: 'setDrawerTab', tab }),
  setFormGenerated: (generated: boolean): PlannerAction => ({ type: 'setFormGenerated', generated }),

  mini: (action: MiniAction): PlannerAction => ({ type: 'mini', action }),
  escape: (): PlannerAction => ({ type: 'escape' }),
  rightClick: (onBoard: boolean): PlannerAction => ({ type: 'rightClick', onBoard }),
  setExtraArmed: (armed: boolean): PlannerAction => ({ type: 'setExtraArmed', armed }),
  openPlanAsk: (ask: PlanAsk): PlannerAction => ({ type: 'openPlanAsk', ask }),
  closePlanAsk: (): PlannerAction => ({ type: 'closePlanAsk' }),
} as const;
