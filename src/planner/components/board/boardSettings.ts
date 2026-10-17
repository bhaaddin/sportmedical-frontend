/*
 * What the desk chose for the board and wants kept while it works: the zoom ("Rozlišení"),
 * which calendars are shown, which služby, which worker. A tiny external store shared by the
 * board (it draws with it) and the settings dialog behind the gear (it edits it) - the two live
 * in different branches of the stage, so a store beats props.
 *
 * Persistence is exactly the calendar page's:
 *   - the zoom is remembered in `localStorage` under the SAME key (`calendarZoom`, 0.6-2), so a
 *     level chosen here is the level the old grid opens at and vice versa;
 *   - calendars, služby and worker are session state (the page did not store them either).
 *
 * The board also PUBLISHES the facets the dialog needs to offer (the calendars on screen, the
 * workers of the rota, the služby), because only the board has read them.
 */
import { useSyncExternalStore } from 'react';
import { RESOLUTIONS, resolutionOf, stepResolution, type Resolution } from '../../../components/booking/grid/resolution';

export const ZOOM_STORAGE_KEY = 'calendarZoom';
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 2;

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
}

const EMPTY_FACETS: BoardFacets = { calendars: [], employees: [], services: [] };

function readZoom(storage: Pick<Storage, 'getItem'> | null): number {
  try {
    const v = Number(storage?.getItem(ZOOM_STORAGE_KEY));
    return v >= ZOOM_MIN && v <= ZOOM_MAX ? v : 1;
  } catch {
    return 1;
  }
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
  /** One level coarser (-1) / finer (+1) than the current zoom. */
  stepResolution(direction: -1 | 1): void;
  setResolution(key: Resolution['key']): void;
  /** Tick / untick one calendar (`allIds` = every calendar, to fold "all ticked" back into `null`). */
  toggleCalendar(id: string, allIds: readonly string[]): void;
  onlyCalendar(id: string): void;
  showAllCalendars(): void;
  toggleService(id: string, allIds: readonly string[]): void;
  onlyService(id: string): void;
  showAllServices(): void;
  setEmployee(id: string | null): void;
  publishFacets(facets: BoardFacets): void;
  /** Back to the defaults (tests; the zoom is re-read from storage). */
  reset(): void;
}

export function createBoardSettings(getStorage: () => Storage | null = browserStorage): BoardSettingsStore {
  let state: BoardSettingsState = { zoom: readZoom(getStorage()), ticked: null, serviceSet: null, employeeId: null, facets: EMPTY_FACETS };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<BoardSettingsState>) => {
    state = { ...state, ...patch };
    for (const l of [...listeners]) l();
  };
  const fold = (next: Set<string>, all: readonly string[]): ReadonlySet<string> | null =>
    all.length > 0 && next.size >= all.length && all.every((id) => next.has(id)) ? null : next;
  const setZoom = (zoom: number) => {
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(zoom * 10) / 10));
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
    stepResolution(direction) {
      setZoom(stepResolution(state.zoom, direction).zoom);
    },
    setResolution(key) {
      const level = RESOLUTIONS.find((r) => r.key === key);
      if (level) setZoom(level.zoom);
    },
    toggleCalendar(id, allIds) {
      const next = new Set(state.ticked ?? allIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      set({ ticked: fold(next, allIds) });
    },
    onlyCalendar: (id) => set({ ticked: new Set([id]) }),
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
    reset() {
      set({ zoom: readZoom(getStorage()), ticked: null, serviceSet: null, employeeId: null, facets: EMPTY_FACETS });
    },
  };
}

/** The one store of the application: the board and its gear dialog share it. */
export const boardSettings: BoardSettingsStore = createBoardSettings();

export function useBoardSettings(): BoardSettingsState {
  return useSyncExternalStore(boardSettings.subscribe, boardSettings.getState, boardSettings.getState);
}

export { RESOLUTIONS, resolutionOf };
export type { Resolution };
