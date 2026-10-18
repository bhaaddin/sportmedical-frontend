import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Calendar, PreviewDay } from '../api/bookingContracts';
import type { PickSession } from '../components/clubs/order/pickSession';
import { SidebarSlot, SidebarSlotProvider } from '../components/shell/SidebarSlot';
import { setViewport, VIEWPORTS } from '../test/viewport';
import { addDaysToDateOnly } from '../utils/time';
import { boardSettings } from './components/board/boardSettings';
import { DemoDataSource } from './data/DemoDataSource';

/*
 * PlannerPage: the composition for the real route - which data it asks for, which mode the router state
 * puts it in, what it does with the sidebar slot. The board itself is tested in components/board.
 */

vi.mock('../api/calendars', () => ({ calendarsApi: { list: vi.fn() } }));
vi.mock('../api/clinicServices', () => ({ clinicServicesApi: { list: vi.fn() } }));
vi.mock('../api/workingHours', () => ({ workingHoursApi: { preview: vi.fn() } }));
vi.mock('../api/appointments', () => ({ appointmentsApi: { range: vi.fn(), blocks: vi.fn(), reschedule: vi.fn() } }));
vi.mock('../api/activities', () => ({ activitiesApi: { list: vi.fn() } }));
vi.mock('../api/client', () => ({ default: { get: vi.fn().mockRejectedValue(new Error('offline')) }, client: {} }));
vi.mock('../api/displaySettings', async (importActual) => {
  const actual = await importActual<typeof import('../api/displaySettings')>();
  return { ...actual, useCalendarDisplay: vi.fn(() => ({ settings: actual.CALENDAR_DISPLAY_OFFLINE, loaded: true })) };
});
vi.mock('../components/clubs/order/PickOrderSetup', () => ({
  PickOrderSetup: (props: { defaultClubId?: string; onStart: (s: PickSession) => void; onClose: () => void }) => (
    <div role="dialog" aria-label="Nová klubová objednávka" data-testid="pick-setup" data-club={props.defaultClubId ?? ''}>
      <button type="button" onClick={() => props.onStart(SESSION)}>Začít plánovat</button>
      <button type="button" onClick={props.onClose}>Zavřít formulář</button>
    </div>
  ),
}));
const apiSource = vi.hoisted(() => ({ calls: [] as unknown[], source: null as unknown }));
vi.mock('./api/useApiDataSource', () => ({
  useApiDataSource: (options: unknown) => {
    apiSource.calls.push(options);
    return apiSource.source;
  },
}));

import { calendarsApi } from '../api/calendars';
import { clinicServicesApi } from '../api/clinicServices';
import { workingHoursApi } from '../api/workingHours';
import { appointmentsApi } from '../api/appointments';
import { activitiesApi } from '../api/activities';
import PlannerPage from './PlannerPage';

const SESSION: PickSession = {
  clubId: 'club1',
  clubName: 'FK Slaný',
  serviceId: 's1',
  serviceName: 'Diagnostika',
  activities: [],
  paymentMethod: 'ClubInvoice',
  note: '',
};

const calendar: Calendar = {
  id: 'c1', name: 'Ordinace 1', color: '#999999', location: '', displayStepMinutes: 30, isActive: true, sortOrder: 0,
  clinicServiceId: 's1', publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null,
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location" data-state={JSON.stringify(location.state)} />;
}

function mount(entry: { pathname: string; search?: string; state?: unknown } = { pathname: '/planovani' }, withSlot = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <SidebarSlotProvider available={withSlot}>
          {withSlot ? <SidebarSlot /> : null}
          <LocationProbe />
          <Routes>
            <Route path="/planovani" element={<PlannerPage />} />
          </Routes>
        </SidebarSlotProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  window.localStorage.clear();
  window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'bookings.edit']));
  boardSettings.reset();
  apiSource.calls = [];
  apiSource.source = new DemoDataSource({ today: '2026-11-10' });
  vi.mocked(calendarsApi.list).mockResolvedValue([calendar]);
  vi.mocked(clinicServicesApi.list).mockResolvedValue([
    { id: 's1', name: 'Diagnostika', description: '', sortOrder: 0, isActive: true, activities: 1, calendars: 1, colorHex: '#1565C0' },
    { id: 's2', name: 'Lékařské prohlídky', description: '', sortOrder: 1, isActive: true, activities: 1, calendars: 0, colorHex: '#2E7D32' },
  ]);
  vi.mocked(activitiesApi.list).mockResolvedValue({ activities: [], warnings: [] });
  vi.mocked(workingHoursApi.preview).mockImplementation(async (_id, from, to) => {
    const rows: PreviewDay[] = [];
    for (let d = from; d <= to; d = addDaysToDateOnly(d, 1)) {
      rows.push({ date: d, isOpen: true, closedBecause: null, startTime: '08:00:00', endTime: '16:00:00', breakStart: null, breakEnd: null, workerUserId: 'u1', workerDisplayName: 'Anna', isChangedByOverride: false, offeredActivityIds: ['a1'] });
    }
    return rows;
  });
  vi.mocked(appointmentsApi.range).mockResolvedValue([]);
  vi.mocked(appointmentsApi.blocks).mockResolvedValue([]);
});

afterEach(() => cleanup());

describe('PlannerPage', () => {
  it('standard ordering: the real data source without an order, the board on the real calendar, the clinic\'s header', async () => {
    mount();
    const page = await screen.findByTestId('planner-page');
    expect(page).toHaveAttribute('data-mode', 'standard');
    expect(apiSource.calls[0]).toMatchObject({ session: null });
    const panel = await screen.findByTestId('week-board-panel');
    expect(panel).toHaveAttribute('data-real-calendar', 'true');
    expect(document.getElementById('day-board')).toHaveAttribute('data-board-mode', 'standard');
    expect(await screen.findByTestId('board-entry-points')).toBeInTheDocument();
    // the club's header is the clinic's: a club is not being planned
    expect(screen.getByTestId('club-header')).toHaveAttribute('data-mode', 'clinic');
  });

  it('a PickSession in the router state is club planning: the whole planner interface for that order', async () => {
    mount({ pathname: '/planovani', state: { pickOrder: { start: SESSION } } });
    const page = await screen.findByTestId('planner-page');
    expect(page).toHaveAttribute('data-mode', 'club');
    expect(apiSource.calls.at(-1)).toMatchObject({ session: SESSION });
    await screen.findByTestId('week-board-panel');
    expect(document.getElementById('day-board')).toHaveAttribute('data-board-mode', 'club');
    expect(screen.getByTestId('club-header')).toHaveAttribute('data-mode', 'club');
    expect(screen.queryByTestId('pick-setup')).toBeNull();
  });

  it('while a club order is planned only its služba is shown, and the filter comes back afterwards', async () => {
    const view = mount({ pathname: '/planovani', state: { pickOrder: { start: SESSION } } });
    await screen.findByTestId('planner-page');
    expect([...(boardSettings.getState().serviceSet ?? [])]).toEqual(['s1']);
    view.unmount();
    expect(boardSettings.getState().serviceSet).toBeNull();
  });

  it('"pickOrder" without a session asks for the small setup form first, then starts planning', async () => {
    mount({ pathname: '/planovani', state: { pickOrder: { clubId: 'club7' } } });
    const setup = await screen.findByTestId('pick-setup');
    expect(setup).toHaveAttribute('data-club', 'club7');
    expect(screen.getByTestId('planner-page')).toHaveAttribute('data-mode', 'standard');
    fireEvent.click(within(setup).getByRole('button', { name: 'Začít plánovat' }));
    await waitFor(() => expect(screen.getByTestId('planner-page')).toHaveAttribute('data-mode', 'club'));
    expect(screen.queryByTestId('pick-setup')).toBeNull();
    expect(JSON.parse(screen.getByTestId('location').dataset.state!)).toMatchObject({ pickOrder: { start: { clubId: 'club1' } } });
  });

  it('closing the setup form goes back to the standard calendar', async () => {
    mount({ pathname: '/planovani', state: { pickOrder: true } });
    fireEvent.click(within(await screen.findByTestId('pick-setup')).getByRole('button', { name: 'Zavřít formulář' }));
    await waitFor(() => expect(screen.queryByTestId('pick-setup')).toBeNull());
    expect(screen.getByTestId('location').dataset.state).toBe('null');
    expect(screen.getByTestId('planner-page')).toHaveAttribute('data-mode', 'standard');
  });

  it('has no SLUŽBY legend of its own in standard ordering: the služba filter is the one in the gear, the prices are next to each činnost', async () => {
    mount({ pathname: '/planovani' }, true);
    await screen.findByTestId('week-board-panel');
    expect(screen.queryByTestId('planner-service-legend')).toBeNull();
  });

  it('has no legend while a club order is planned', async () => {
    mount({ pathname: '/planovani', state: { pickOrder: { start: SESSION } } }, true);
    await screen.findByTestId('week-board-panel');
    expect(screen.queryByTestId('planner-service-legend')).toBeNull();
  });
});
