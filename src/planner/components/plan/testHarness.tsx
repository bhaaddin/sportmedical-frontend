/*
 * Test-only helpers for the club-planning component and flow tests: the owner's case as a data source, the board's
 * geometry for jsdom (it has no layout) and pointer helpers. Not exported from any barrel.
 */
import { render } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DemoDataSource } from '../../data/DemoDataSource';
import type { PlannerCatalogue } from '../../data/PlannerDataSource';
import type { OrderDemand, PlannerCategory, PlannerSession } from '../../model';
import { PlannerShell } from '../PlannerShell';

export const TODAY = '2026-11-10';
export const WEEK_DATE = '2026-11-20';

export const komplexni: PlannerCategory = { id: 'k', name: 'Komplexní sportovní prohlídka', subtitle: 'Lékařské vyšetření', iconKey: 'heart', color: '#00f1dc', slotMinutes: 60, parallelCapacity: 1, priceCzk: 1600 };
export const spiro: PlannerCategory = { id: 's', name: 'Spiroergometrické vyšetření', subtitle: 'Zátěžový test', iconKey: 'run', color: '#0f94ff', slotMinutes: 90, parallelCapacity: 1, priceCzk: 900 };

export const ownerDemands: OrderDemand[] = [
  { categoryId: 'k', requested: 20, baselinePlanned: 0 },
  { categoryId: 's', requested: 50, baselinePlanned: 0 },
];

export const term = (id: string, date: string, start: string, end: string, categoryId: string, capacity: number, extra: Partial<PlannerSession> = {}): PlannerSession => ({
  id, date, start, end, categoryId, capacity, booked: 0, showInList: true, createdByPlanner: true, origin: 'club', ...extra,
});

export interface OwnerSourceOptions {
  sessions?: PlannerSession[];
  demands?: OrderDemand[];
  categories?: PlannerCategory[];
  contact?: boolean;
}

/** The demo source re-pointed at the owner's order: 20 Komplexní (60 min) + 50 Spiro (90 min), no baseline. */
export function ownerSource(options: OwnerSourceOptions = {}): DemoDataSource {
  let n = 0;
  const source = new DemoDataSource({
    today: TODAY,
    sessions: options.sessions ?? [],
    newId: () => `new-${++n}`,
    profile: options.contact === false ? { clubName: 'SK Dukla' } : { clubName: 'SK Dukla', contactName: 'Jan Novák', contactEmail: 'jan@dukla.cz' },
  });
  const catalogue: PlannerCatalogue = {
    clinicName: 'Klinika Test',
    categories: options.categories ?? [komplexni, spiro],
    window: { startMinutes: 420, endMinutes: 1140 },
    dayMarkColors: { holiday: '#5b6b7a', lunch: '#3a4a58' },
    releaseDaysBefore: 7,
    capabilities: { simulateBookings: false, logoUpload: false, realPublish: false },
  };
  const internals = source as unknown as { order: unknown; catalogueSync: () => PlannerCatalogue };
  internals.order = { id: 'order-1', clubId: 'club-1', demands: options.demands ?? ownerDemands, baselineSessions: [] };
  internals.catalogueSync = () => catalogue;
  return source;
}

export function mountPlanner(source: DemoDataSource, initialEntries: Parameters<typeof MemoryRouter>[0]['initialEntries'] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <PlannerShell source={source} today={TODAY} initialDate={WEEK_DATE} forceDesktop />
    </MemoryRouter>,
  );
}

/** jsdom has no layout: the board is 700 x 455 at (100, 50) - 100 px a day, 455 px for 07:00-19:00. */
export const BOARD = { left: 100, top: 50, width: 700, height: 455 };

/** `geometry`: another board size (the fluid stage's measured one); default the file's. */
export function giveBoardGeometry(board: HTMLElement, geometry: typeof BOARD = BOARD): void {
  board.getBoundingClientRect = () =>
    ({ ...geometry, right: geometry.left + geometry.width, bottom: geometry.top + geometry.height, x: geometry.left, y: geometry.top, toJSON: () => ({}) }) as DOMRect;
  Object.defineProperty(board, 'clientWidth', { configurable: true, value: geometry.width });
  Object.defineProperty(board, 'clientHeight', { configurable: true, value: geometry.height });
  (board as HTMLElement & { setPointerCapture: () => void }).setPointerCapture = () => undefined;
}

/** Client coordinates of a day column (0 = Monday) at a wall-clock minute. */
export const at = (day: number, minute: number, geometry: typeof BOARD = BOARD): { clientX: number; clientY: number } => ({
  clientX: geometry.left + (day + 0.5) * (geometry.width / 7),
  clientY: geometry.top + ((minute - 420) / 720) * geometry.height,
});

export const pointer = (extra: Record<string, unknown> = {}) => ({ button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true, ...extra });

export function press(el: Element, where: { clientX: number; clientY: number }): void {
  fireEvent.pointerDown(el, { ...pointer(), ...where });
}
export function drag(el: Element, where: { clientX: number; clientY: number }): void {
  fireEvent.pointerMove(el, { ...pointer(), ...where });
}
export function release(el: Element, where: { clientX: number; clientY: number }): void {
  fireEvent.pointerUp(el, { ...pointer(), ...where });
}
