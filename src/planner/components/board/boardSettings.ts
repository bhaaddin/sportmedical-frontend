/*
 * What the desk chose for the board and wants kept while it works: the zoom (1-6x, the gear's "Rozlišení"),
 * which calendars are shown, which služby, which worker. A tiny external store shared by the
 * board (it draws with it) and the settings dialog behind the gear (it edits it) - the two live
 * in different branches of the stage, so a store beats props.
 *
 * Persistence:
 *   - the zoom is remembered in `localStorage` under `calendarZoomV2` (1-6). The first version kept 0.6-2 under
 *     `calendarZoom`; that value is migrated once to the nearest preset (0.6 -> 1, 1 -> 2, 1.5 -> 3.5, 2 -> 6), so the
 *     desk's saved level does not break (`boardZoom.ts`). The old grid keeps its own key;
 *   - calendars, služby and worker are session state (the page did not store them either);
 *   - the minute at the top of the scrolled board is kept in memory (not storage), so leaving the planner and coming
 *     back shows the same hours.
 *
 * The board also PUBLISHES the facets the dialog needs to offer (the calendars on screen, the
 * workers of the rota, the služby), because only the board has read them.
 */
import { useSyncExternalStore } from 'react';
import { toggleGroupSet, type ServiceGroup } from './serviceGroups';
import {
  clampZoom,
  presetOf,
  readStoredZoom,
  stepPreset,
  stepZoom,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_PRESETS,
  ZOOM_STORAGE_KEY,
  type ResolutionKey,
  type ZoomPreset,
} from './boardZoom';

export { ZOOM_MAX, ZOOM_MIN, ZOOM_STORAGE_KEY };

export interface FacetCalendar {
  id: string;
  name: string;
  color: string;
  serviceId: string | null;
}
export interface FacetEmployee {
  id: string;
  name: string;
}
export interface FacetService {
  id: string;
  name: string;
  color: string;
}
export interface BoardFacets {
  calendars: FacetCalendar[];
  /** R2: the služby of the clinic (one chip each), each with the calendars it runs. */
  groups: ServiceGroup[];
  employees: FacetEmployee[];
  services: FacetService[];
}

export interface BoardSettingsState {
  zoom: number;
  /** Calendars shown; `null` = all. */
  ticked: ReadonlySet<string> | null;
  /** Služby shown; `null` = all. */
  serviceSet: ReadonlySet<string> | null;
  employeeId: string | null;
  facets: BoardFacets;
  /**
   * The calendars every day of the week is split into (reviewer 2.4), in column order, published by the board; null while the
   * week is one column per day. The compact layouts read it to head the columns of the one day they show.
   */
  columns: readonly FacetCalendar[] | null;
}

const EMPTY_FACETS: BoardFacets = { calendars: [], groups: [], employees: [], services: [] };

/** The stored zoom; a saved value of the first version is migrated and written under the new key once. */
function readZoom(storage: Storage | null): number {
  const { zoom, migrated } = readStoredZoom(storage);
  if (migrated) {
    try {
      storage?.setItem(ZOOM_STORAGE_KEY, String(zoom));
    } catch {
      /* storage blocked: the migrated level still works for this view */
    }
  }
  return zoom;
}

const browserStorage = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

export interface BoardSettingsStore {
  getState(): BoardSettingsState;
  subscribe(listener: () => void): () => void;
  setZoom(zoom: number): void;
  /** One step of the ladder smaller (-1) / larger (+1): the "−" / "+" of the board. */
  stepZoom(direction: -1 | 1): void;
  /** One gear preset coarser (-1) / finer (+1) than the current zoom. */
  stepResolution(direction: -1 | 1): void;
  setResolution(key: ResolutionKey): void;
  /** The minute at the top of the scrolled board (kept for the next time the board is drawn); `null` = never scrolled. */
  getTopMinute(): number | null;
  setTopMinute(minute: number | null): void;
  /** Tick / untick one calendar (`allIds` = every calendar, to fold "all ticked" back into `null`). */
  toggleCalendar(id: string, allIds: readonly string[]): void;
  onlyCalendar(id: string): void;
  /** R2: a click on a služba's chip (see `toggleGroupSet`): one click shows only it, a second služba adds a column. */
  clickGroup(id: string, groups: readonly ServiceGroup[]): void;
  showAllCalendars(): void;
  toggleService(id: string, allIds: readonly string[]): void;
  onlyService(id: string): void;
  showAllServices(): void;
  setEmployee(id: string | null): void;
  publishFacets(facets: BoardFacets): void;
  publishColumns(columns: readonly FacetCalendar[] | null): void;
  /** Back to the defaults (tests; the zoom is re-read from storage). */
  reset(): void;
}

export function createBoardSettings(getStorage: () => Storage | null = browserStorage): BoardSettingsStore {
  let state: BoardSettingsState = { zoom: readZoom(getStorage()), ticked: null, serviceSet: null, employeeId: null, facets: EMPTY_FACETS, columns: null };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<BoardSettingsState>) => {
    state = { ...state, ...patch };
    for (const l of [...listeners]) l();
  };
  const fold = (next: Set<string>, all: readonly string[]): ReadonlySet<string> | null =>
    all.length > 0 && next.size >= all.length && all.every((id) => next.has(id)) ? null : next;
  let topMinute: number | null = null;
  const setZoom = (zoom: number) => {
    const next = clampZoom(zoom);
    if (next === state.zoom) return;
    try {
      getStorage()?.setItem(ZOOM_STORAGE_KEY, String(next));
    } catch {
      /* storage blocked: the level still works for this view */
    }
    set({ zoom: next });
  };
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setZoom,
    stepZoom(direction) {
      setZoom(stepZoom(state.zoom, direction));
    },
    stepResolution(direction) {
      setZoom(stepPreset(state.zoom, direction).zoom);
    },
    setResolution(key) {
      const level = ZOOM_PRESETS.find((r) => r.key === key);
      if (level) setZoom(level.zoom);
    },
    getTopMinute: () => topMinute,
    setTopMinute(minute) {
      topMinute = minute;
    },
    toggleCalendar(id, allIds) {
      const next = new Set(state.ticked ?? allIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      set({ ticked: fold(next, allIds) });
    },
    onlyCalendar: (id) => set({ ticked: new Set([id]) }),
    clickGroup: (id, groups) => set({ ticked: toggleGroupSet(state.ticked, groups, id) }),
    showAllCalendars: () => set({ ticked: null }),
    toggleService(id, allIds) {
      const next = new Set(state.serviceSet ?? allIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      set({ serviceSet: fold(next, allIds) });
    },
    onlyService: (id) => set({ serviceSet: new Set([id]) }),
    showAllServices: () => set({ serviceSet: null }),
    setEmployee: (id) => set({ employeeId: id }),
    publishFacets(facets) {
      const same =
        JSON.stringify(facets) === JSON.stringify(state.facets);
      if (!same) set({ facets });
    },
    publishColumns(columns) {
      if (JSON.stringify(columns) !== JSON.stringify(state.columns)) set({ columns });
    },
    reset() {
      topMinute = null;
      set({ zoom: readZoom(getStorage()), ticked: null, serviceSet: null, employeeId: null, facets: EMPTY_FACETS, columns: null });
    },
  };
}

/** The one store of the application: the board and its gear dialog share it. */
export const boardSettings: BoardSettingsStore = createBoardSettings();

export function useBoardSettings(): BoardSettingsState {
  return useSyncExternalStore(boardSettings.subscribe, boardSettings.getState, boardSettings.getState);
}

export { ZOOM_PRESETS as RESOLUTIONS, presetOf as resolutionOf };
export type { ZoomPreset as Resolution };
