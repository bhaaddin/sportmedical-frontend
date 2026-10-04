import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import CalendarGridPage from '../../../pages/booking/CalendarGridPage';
import type { Activity, Calendar, DayAppointment, PreviewDay, TimeBlock } from '../../../api/bookingContracts';
import { addDaysToDateOnly } from '../../../utils/time';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { SidebarSlot, SidebarSlotProvider } from '../../shell/SidebarSlot';

/*
 * The calendar at its three widths - 390 (phone), 834 (tablet), 1440 (desktop) -
 * against a mocked API: what renders per device, the činnost colours, lanes,
 * club blocks, range selection producing the router state the clubs screen
 * reads, and the month's per-service panel.
 */

vi.mock('../../../api/calendars', () => ({ calendarsApi: { list: vi.fn() } }));
/* The club order dialog has its own tests; here only what the calendar hands it matters. */
vi.mock('../../clubs/order/ClubOrderDialog', () => ({
  ClubOrderDialog: (props: { initial?: unknown }) => <pre data-testid="club-order-initial">{JSON.stringify(props.initial)}</pre>,
}));
vi.mock('../../../api/clinicServices', () => ({ clinicServicesApi: { list: vi.fn() } }));
vi.mock('../../../api/holidays', () => ({ holidaysApi: { year: vi.fn() } }));
vi.mock('../../../api/clinicSettings', () => ({ readPublicClinic: vi.fn(), readSettings: vi.fn() }));
vi.mock('../../../api/workingHours', () => ({ workingHoursApi: { preview: vi.fn() } }));
vi.mock('../../../api/appointments', () => ({
  appointmentsApi: { range: vi.fn(), blocks: vi.fn(), createBlock: vi.fn(), reschedule: vi.fn() },
}));
vi.mock('../../../api/activities', () => ({ activitiesApi: { list: vi.fn() } }));
vi.mock('../../../api/client', () => ({ default: { get: vi.fn().mockRejectedValue(new Error('offline')) }, client: {} }));
vi.mock('../NewAppointmentDialog', () => ({
  NewAppointmentDialog: (props: { initialDate?: string; initialCalendarId?: string }) => (
    <div role="dialog" data-testid="new-appointment" data-date={props.initialDate} data-calendar={props.initialCalendarId} />
  ),
}));
vi.mock('../../../api/displaySettings', async (importActual) => {
  const actual = await importActual<typeof import('../../../api/displaySettings')>();
  return {
    ...actual,
    useCalendarDisplay: vi.fn(() => ({
      settings: { ...actual.CALENDAR_DISPLAY_OFFLINE, defaultView: 'week' },
      loaded: true,
    })),
  };
});

import { calendarsApi } from '../../../api/calendars';
import { clinicServicesApi } from '../../../api/clinicServices';
import { holidaysApi } from '../../../api/holidays';
import { readPublicClinic } from '../../../api/clinicSettings';
import { workingHoursApi } from '../../../api/workingHours';
import { appointmentsApi } from '../../../api/appointments';
import { activitiesApi } from '../../../api/activities';

const base = {
  location: '',
  displayStepMinutes: 30,
  isActive: true,
  publicMinimumNoticeMinutes: null,
  publicHorizonDays: null,
  publicHoldMinutes: null,
  publicCancellationHours: null,
};
const ordinace1: Calendar = { ...base, id: 'c1', name: 'Ordinace 1', color: '#90A4AE', sortOrder: 0, clinicServiceId: 's1' };
const ordinace2: Calendar = { ...base, id: 'c2', name: 'Diagnostika', color: '#A5D6A7', sortOrder: 1, clinicServiceId: 's2' };
const inbodyCal: Calendar = { ...base, id: 'c3', name: 'InBody', color: '#CE93D8', sortOrder: 2, clinicServiceId: 's3' };

const mkAct = (id: string, name: string, serviceId: string, hex: string, sortOrder: number): Activity =>
  ({
    id,
    name,
    slug: id,
    durationMinutes: 30,
    color: '#000000',
    publicNote: '',
    isPubliclyBookable: true,
    requiresReportByEmail: false,
    requiresClubSharing: false,
    questionnaireRequirement: 'NotAsked',
    sortOrder,
    isActive: true,
    serviceItemId: null,
    priceCzk: null,
    clinicServiceId: serviceId,
    questionnaireDefinitionId: null,
    effectiveColorHex: hex,
    parallelCapacity: 1,
  }) as Activity;

const ACTIVITIES = [
  mkAct('a1', 'Základní prohlídka', 's1', '#1565C0', 1),
  mkAct('a2', 'Komplexní prohlídka', 's1', '#0D47A1', 2),
  mkAct('a3', 'Spiroergometrie', 's2', '#2E7D32', 3),
  mkAct('a4', 'InBody analýza', 's3', '#8E24AA', 4),
];
const OFFERED: Record<string, string[]> = { c1: ['a1', 'a2'], c2: ['a3'], c3: ['a4'] };

const appt = (
  id: string,
  calendarId: string,
  activityId: string,
  activityName: string,
  startUtc: string,
  endUtc: string,
  extra: Partial<DayAppointment> = {},
): DayAppointment => ({
  id,
  calendarId,
  patientId: '',
  patientName: `Pacient ${id}`,
  activityId,
  activityName,
  startUtc,
  endUtc,
  status: 0,
  isRunningLate: false,
  checkedInUtc: null,
  paperwork: null,
  partnerName: null,
  clubDiscountPercent: null,
  paymentState: 'none',
  invoiceId: null,
  ...extra,
});

/* Monday 26. 10. 2026, 09:15 in Prague (CET again since 25. 10.). */
const DAY = '2026-10-26';
const BOOKINGS: DayAppointment[] = [
  appt('k1', 'c1', 'a1', 'Základní prohlídka', '2026-10-26T07:00:00Z', '2026-10-26T07:30:00Z', { patientName: 'Jan Novák' }),
  appt('k2', 'c1', 'a1', 'Základní prohlídka', '2026-10-26T07:00:00Z', '2026-10-26T07:30:00Z', { patientName: 'Eva Marešová' }),
  appt('k3', 'c1', 'a2', 'Komplexní prohlídka', '2026-10-26T10:00:00Z', '2026-10-26T11:00:00Z', {
    patientName: 'FK Slaný B',
    partnerName: 'FK Slaný',
    clubDiscountPercent: 10,
    headcount: 8,
  }),
  appt('k4', 'c2', 'a3', 'Spiroergometrie', '2026-10-26T08:00:00Z', '2026-10-26T09:00:00Z', { patientName: 'Karel Zeman' }),
  appt('k5', 'c3', 'a4', 'InBody analýza', '2026-10-26T09:00:00Z', '2026-10-26T09:30:00Z', { patientName: 'Petr Malý' }),
];

const CLUB_BLOCK: TimeBlock = {
  id: 'blk1',
  startUtc: '2026-10-26T12:00:00Z',
  endUtc: '2026-10-26T14:00:00Z',
  reason: '',
  kind: 'club',
  clubBlockId: 'cb1',
  clubId: 'club1',
  clubName: 'FK Dukla',
  colorHex: '#7B1FA2',
};

function LocationProbe() {
  const location = useLocation();
  return <pre data-testid="clubs-state">{JSON.stringify(location.state)}</pre>;
}

function renderPage(width: number, view?: 'day' | 'week' | 'month') {
  setViewport(width);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/planovani']}>
        <Routes>
          <Route path="/planovani" element={<CalendarGridPage />} />
          <Route path="/clubs" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  if (view) {
    void act(() => {
      fireEvent.click(screen.getByRole('button', { name: view === 'day' ? 'Den' : view === 'week' ? 'Týden' : 'Měsíc' }));
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-26T08:15:00Z'));
  window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'bookings.edit', 'settings.clinic.manage']));

  vi.mocked(calendarsApi.list).mockResolvedValue([ordinace1, ordinace2, inbodyCal]);
  vi.mocked(clinicServicesApi.list).mockResolvedValue([
    { id: 's1', name: 'Prohlídky', description: '', sortOrder: 1, isActive: true, activities: 2, calendars: 1, colorHex: '#1565C0' } as never,
    { id: 's2', name: 'Diagnostika', description: '', sortOrder: 2, isActive: true, activities: 1, calendars: 1, colorHex: '#2E7D32' } as never,
    { id: 's3', name: 'InBody', description: '', sortOrder: 3, isActive: true, activities: 1, calendars: 1, colorHex: '#8E24AA' } as never,
  ]);
  vi.mocked(activitiesApi.list).mockResolvedValue({ activities: ACTIVITIES, warnings: [] });
  vi.mocked(holidaysApi.year).mockResolvedValue([
    { date: '2026-10-28', name: 'Den vzniku Československa', isHoliday: true, isStatutory: true, isAmended: false },
  ]);
  vi.mocked(readPublicClinic).mockResolvedValue({ name: '', email: '', phone: '', address: '', bookingEnabled: true });
  vi.mocked(workingHoursApi.preview).mockImplementation(async (calendarId, from, to) => {
    const rows: PreviewDay[] = [];
    for (let d = from; d <= to; d = addDaysToDateOnly(d, 1)) {
      const weekday = new Date(`${d}T12:00:00Z`).getUTCDay();
      const weekend = weekday === 0 || weekday === 6;
      rows.push({
        date: d,
        isOpen: !weekend,
        closedBecause: weekend ? 'notAWorkingDay' : null,
        startTime: weekend ? null : '08:00:00',
        endTime: weekend ? null : '16:00:00',
        breakStart: null,
        breakEnd: null,
        workerUserId: 'u1',
        workerDisplayName: 'Anna Černá',
        isChangedByOverride: false,
        offeredActivityIds: weekend ? [] : OFFERED[calendarId],
      });
    }
    return rows;
  });
  vi.mocked(appointmentsApi.range).mockResolvedValue(BOOKINGS);
  vi.mocked(appointmentsApi.blocks).mockImplementation(async (calendarId) => (calendarId === 'c1' ? [CLUB_BLOCK] : []));
});

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

const pointerOf = (el: HTMLElement) => fireEvent.pointerDown(el, { button: 0, pointerId: 1 });

describe('desktop · 1440', () => {
  it('draws the day as a column per činnost, headed with its colour dot, name and reservations', async () => {
    renderPage(VIEWPORTS.desktop, 'day');
    await screen.findByTestId('column-header-c1:a1');
    for (const [key, hex] of [
      ['c1:a1', 'rgb(21, 101, 192)'],
      ['c1:a2', 'rgb(13, 71, 161)'],
      ['c2:a3', 'rgb(46, 125, 50)'],
      ['c3:a4', 'rgb(142, 36, 170)'],
    ] as const) {
      expect(screen.getByTestId(`column-dot-${key}`)).toHaveStyle({ backgroundColor: hex });
    }
    expect(within(screen.getByTestId('column-header-c1:a1')).getByText(/^2 rezervace/)).toBeInTheDocument();
    /* Three calendars: each named over its group. */
    expect(screen.getByText('Ordinace 1')).toBeInTheDocument();
    /* The same colour on the card's edge. */
    const card = within(screen.getByTestId('appointment-cell-k4')).getByRole('button');
    expect(card).toHaveStyle({ borderLeft: '3px solid #2E7D32' });
  });

  it('lays two simultaneous bookings of one činnost side by side', async () => {
    renderPage(VIEWPORTS.desktop, 'day');
    await screen.findByTestId('appointment-cell-k1');
    expect(screen.getByTestId('appointment-cell-k1')).toHaveAttribute('data-lanes', '2');
    expect(screen.getByTestId('appointment-cell-k2')).toHaveAttribute('data-lanes', '2');
  });

  it('shows the mini calendar and the service legend inline, with each service in its colour', async () => {
    renderPage(VIEWPORTS.desktop, 'day');
    const legend = await screen.findByRole('region', { name: 'Služby' });
    expect(within(legend).getByRole('checkbox', { name: 'Prohlídky' })).toBeChecked();
    expect(screen.getByTestId('legend-square-s2')).toHaveStyle({ backgroundColor: 'rgb(46, 125, 50)' });
    expect(screen.getByRole('button', { name: 'Předchozí měsíc' })).toBeInTheDocument();
  });

  it('the legend filters: unticking a service takes its columns away', async () => {
    renderPage(VIEWPORTS.desktop, 'day');
    await screen.findByTestId('column-header-c2:a3');
    fireEvent.click(within(screen.getByRole('region', { name: 'Služby' })).getByRole('checkbox', { name: 'Diagnostika' }));
    expect(screen.queryByTestId('column-header-c2:a3')).not.toBeInTheDocument();
    expect(screen.getByTestId('column-header-c1:a1')).toBeInTheDocument();
  });

  it('draws a club block tinted and named, and its click leads to the club', async () => {
    renderPage(VIEWPORTS.desktop, 'day');
    const block = (await screen.findAllByRole('button', { name: 'FK Dukla' }))[0];
    expect(block).toHaveAttribute('data-kind', 'club');
    expect(block).toHaveStyle({ borderLeft: '3px solid #7B1FA2' });
    fireEvent.click(block, { clientX: 300, clientY: 300 });
    expect(await screen.findByText(/Blok pro FK Dukla · 26\. 10\. – 26\. 10\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Otevřít blok' }));
    expect(JSON.parse((await screen.findByTestId('clubs-state')).textContent ?? '{}')).toEqual({
      clubId: 'club1',
      clubBlockId: 'cb1',
    });
  });

  it('a drag in a činnost column hands the club the calendar, the day and the daily window', async () => {
    renderPage(VIEWPORTS.desktop, 'day');
    const column = await screen.findByTestId('sub-column-c2:a3-2026-10-26');
    fireEvent.pointerDown(column, { button: 0, clientY: 100, clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(column, { clientY: 100, clientX: 100, pointerId: 1 });
    fireEvent.click(screen.getByRole('menuitem', { name: /Rezervovat pro klub/ }));
    const initial = JSON.parse((await screen.findByTestId('club-order-initial')).textContent ?? '{}');
    expect(initial.calendarIds).toEqual(['c2']);
    expect(initial.ranges).toHaveLength(1);
    expect(initial.ranges[0]).toMatchObject({ fromDate: DAY, toDate: DAY });
    expect(initial.ranges[0].dailyFrom).toMatch(/^\d\d:\d\d$/);
    expect(initial.ranges[0].dailyTo).toMatch(/^\d\d:\d\d$/);
  });

  it('the toolbar button "Klubová objednávka" asks the two-way question (fill in myself / send the link)', async () => {
    renderPage(VIEWPORTS.desktop, 'week');
    fireEvent.click(await screen.findByRole('button', { name: 'Klubová objednávka' }));
    const entry = await screen.findByTestId('club-order-entry');
    expect(within(entry).getAllByRole('button')).toHaveLength(2);
    expect(within(entry).getByRole('button', { name: /Vyplním sám/ })).toBeInTheDocument();
    expect(within(entry).getByRole('button', { name: /Poslat odkaz klubu/ })).toBeInTheDocument();
  });

  it('month: dragging across days picks a range, pills it, and "Rezervovat pro klub" hands it on', async () => {
    renderPage(VIEWPORTS.desktop, 'month');
    const first = await screen.findByTestId('month-day-2026-10-12');
    pointerOf(first);
    fireEvent.pointerEnter(screen.getByTestId('month-day-2026-10-18'));
    fireEvent.pointerEnter(screen.getByTestId('month-day-2026-10-25'));
    expect(screen.getByTestId('range-pill')).toHaveTextContent('12. 10. – 25. 10. · 14 dní');
    expect(screen.getByTestId('month-day-2026-10-20')).toHaveAttribute('data-picked', 'true');
    expect(screen.getByTestId('month-day-2026-10-26')).not.toHaveAttribute('data-picked');
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 400, clientY: 300 }));
    });
    expect(await screen.findByText('12. 10. – 25. 10.')).toBeInTheDocument();
    expect(screen.getByText('14 dní')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: /Rezervovat pro klub/ }));
    const initial = JSON.parse((await screen.findByTestId('club-order-initial')).textContent ?? '{}');
    expect(initial).toEqual({
      calendarIds: ['c1', 'c2', 'c3'],
      ranges: [{ fromDate: '2026-10-12', toDate: '2026-10-25' }],
    });
  });

  it('month: "Zablokovat čas" on a range blocks whole days in the calendars ticked', async () => {
    vi.mocked(appointmentsApi.createBlock).mockResolvedValue(CLUB_BLOCK);
    renderPage(VIEWPORTS.desktop, 'month');
    pointerOf(await screen.findByTestId('month-day-2026-10-12'));
    fireEvent.pointerEnter(screen.getByTestId('month-day-2026-10-14'));
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 400, clientY: 300 }));
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: /Zablokovat čas/ }));
    const dialog = await screen.findByRole('dialog', { name: /Zablokovat čas/ });
    fireEvent.change(within(dialog).getByLabelText(/Důvod blokace/), { target: { value: 'Klub' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zablokovat' }));
    await vi.waitFor(() => expect(appointmentsApi.createBlock).toHaveBeenCalledTimes(3));
    expect(vi.mocked(appointmentsApi.createBlock).mock.calls[0][0]).toBe('c1');
    /* 12. 10. 00:00 Prague (CEST) is 11. 10. 22:00 UTC; the end is 15. 10. 00:00 Prague, 14. 10. 22:00 UTC. */
    expect(new Date(vi.mocked(appointmentsApi.createBlock).mock.calls[0][1] as string).toISOString()).toBe('2026-10-11T22:00:00.000Z');
    expect(new Date(vi.mocked(appointmentsApi.createBlock).mock.calls[0][2] as string).toISOString()).toBe('2026-10-14T22:00:00.000Z');
  });

  it('month: a pointer resting on a day shows the people split by service, one line per službu', async () => {
    renderPage(VIEWPORTS.desktop, 'month');
    const cell = await screen.findByTestId(`month-day-${DAY}`);
    await within(cell).findByText(/Jan Novák|Pacient/);
    fireEvent.pointerEnter(cell);
    const panel = await screen.findByTestId('month-hover-panel');
    /* 2 + 8 (club, per head) + 1 + 1 = 12 people. */
    expect(within(panel).getByText('12 osob')).toBeInTheDocument();
    const services = within(panel).getAllByTestId('day-panel-service');
    expect(services.map((s) => s.textContent)).toEqual([
      expect.stringContaining('Prohlídky'),
      expect.stringContaining('Diagnostika'),
      /* InBody is its own službu, so its own line. */
      expect.stringContaining('InBody'),
    ]);
    expect(services[0]).toHaveTextContent('10 osob');
    expect(services[0]).toHaveTextContent('Základní prohlídka2');
    expect(services[0]).toHaveTextContent('Komplexní prohlídka8');
    expect(services[1]).toHaveTextContent('1 osoba');
    fireEvent.pointerLeave(cell);
    expect(screen.queryByTestId('month-hover-panel')).not.toBeInTheDocument();
  });

  it('month: a club’s block is a row of its own and opens the club popover', async () => {
    renderPage(VIEWPORTS.desktop, 'month');
    const row = await screen.findByTestId(`month-club-block-cb1-${DAY}`);
    expect(row).toHaveTextContent('Blok · FK Dukla');
    fireEvent.click(row, { clientX: 200, clientY: 200 });
    expect(await screen.findByText(/Blok pro FK Dukla/)).toBeInTheDocument();
  });

  it('month: a booking on a closed day is drawn in the cell', async () => {
    vi.mocked(appointmentsApi.range).mockResolvedValue([
      ...BOOKINGS,
      appt('sat', 'c1', 'a1', 'Sobotní prohlídka', '2026-10-24T07:00:00Z', '2026-10-24T07:30:00Z', { patientName: 'Sobota Host' }),
    ]);
    renderPage(VIEWPORTS.desktop, 'month');
    const day = await screen.findByTestId('month-day-2026-10-24');
    expect(await within(day).findByRole('button', { name: /Sobota Host/ })).toBeInTheDocument();
    expect(within(day).getByText(/Nepracovní den · 1/)).toBeInTheDocument();
  });

  it('dropping a booking on another time asks first, then moves it through the API', async () => {
    vi.mocked(appointmentsApi.reschedule).mockResolvedValue(undefined);
    renderPage(VIEWPORTS.desktop, 'day');
    const cell = await screen.findByTestId('appointment-cell-k4');
    const dnd = (type: 'dragStart' | 'dragOver' | 'drop', el: Element, clientY: number) => {
      const event = createEvent[type](el, { dataTransfer: { setData: vi.fn(), effectAllowed: '', dropEffect: '' } });
      Object.defineProperty(event, 'clientY', { value: clientY });
      fireEvent(el, event);
    };
    dnd('dragStart', cell, 0);
    /* 52 px an hour: ten hours down from the top of the grid is 10:00 more than where the grid starts. */
    const column = screen.getByTestId('sub-column-c2:a3-2026-10-26');
    dnd('dragOver', column, 130);
    dnd('drop', column, 130);
    const dialog = await screen.findByRole('dialog', { name: 'Přesunout rezervaci' });
    expect(within(dialog).getByText('Karel Zeman')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Přesunout' }));
    await vi.waitFor(() => expect(appointmentsApi.reschedule).toHaveBeenCalledTimes(1));
    const [calendarId, id, startUtc] = vi.mocked(appointmentsApi.reschedule).mock.calls[0];
    expect([calendarId, id]).toEqual(['c2', 'k4']);
    expect(String(startUtc)).toMatch(/^2026-10-26T/);
  });

  it('week: the holiday column says so, and "Nová objednávka" is in the top bar, not pinned', async () => {
    renderPage(VIEWPORTS.desktop);
    await screen.findByTestId('day-column-2026-10-28');
    expect(screen.getByText('SVÁTEK')).toBeInTheDocument();
    expect(screen.getByTestId('closed-block-2026-10-28')).toHaveTextContent('Státní svátek — zavřeno');
    expect(screen.getByRole('button', { name: 'Nová objednávka' }).closest('[data-pinned="true"]')).toBeNull();
  });
});

describe('tablet · 834', () => {
  it('keeps the grid of činnosti with the mini calendar collapsed above it', async () => {
    renderPage(VIEWPORTS.tablet, 'day');
    await screen.findByTestId('column-header-c1:a1');
    expect(screen.getByTestId('time-grid-scroll')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Kalendář a filtry' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    /* Collapsed: neither the month nor the legend is on screen. */
    expect(screen.queryByRole('region', { name: 'Služby' })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(await screen.findByRole('region', { name: 'Služby' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Další měsíc' })).toBeInTheDocument();
  });

  it('week: seven day columns in a scroller that shows three at a time', async () => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 });
    try {
      renderPage(VIEWPORTS.tablet, 'week');
      await screen.findByTestId('day-column-2026-10-26');
      expect(screen.getAllByTestId(/^day-column-/)).toHaveLength(7);
      const headerRow = screen.getByTestId('day-header-2026-10-26').parentElement!.parentElement!;
      /* (800 − 56 gutter) / 3 = 248 px a day. */
      expect(headerRow.style.gridTemplateColumns || getComputedStyle(headerRow).gridTemplateColumns).toContain('248px');
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, 'clientWidth', original);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
    }
  });

  it('month: a 7 × 6 grid with the short labels "J. Novák"', async () => {
    renderPage(VIEWPORTS.tablet, 'month');
    const cell = await screen.findByTestId(`month-day-${DAY}`);
    expect(await within(cell).findByRole('button', { name: /J\. Novák/ })).toBeInTheDocument();
    expect(screen.getAllByTestId(/^month-day-/)).toHaveLength(35);
  });

  it('month: a tap shows the panel with the split by službu, and "Otevřít den" opens the day', async () => {
    renderPage(VIEWPORTS.tablet, 'month');
    const cell = await screen.findByTestId(`month-day-${DAY}`);
    await within(cell).findByRole('button', { name: /J\. Novák/ });
    fireEvent.pointerDown(cell, { button: 0, pointerType: 'touch', pointerId: 4 });
    fireEvent.pointerUp(cell, { pointerType: 'touch', pointerId: 4 });
    fireEvent.click(cell);
    const panel = await screen.findByTestId('month-tap-panel');
    expect(within(panel).getByText('12 osob')).toBeInTheDocument();
    expect(within(panel).getAllByTestId('day-panel-service')).toHaveLength(3);
    fireEvent.click(within(panel).getByRole('button', { name: 'Otevřít den' }));
    expect(await screen.findByRole('heading', { name: 'Pondělí 26. října 2026' })).toBeInTheDocument();
  });

  it('month: "Vybrat dny" lets a finger mark a range by tapping the first and the last day', async () => {
    renderPage(VIEWPORTS.tablet, 'month');
    await screen.findByTestId(`month-day-${DAY}`);
    fireEvent.click(screen.getByRole('button', { name: 'Vybrat dny' }));
    expect(screen.getByTestId('range-hint')).toHaveTextContent('Klepněte na první a pak na poslední den.');
    fireEvent.click(screen.getByTestId('month-day-2026-10-12'), { clientX: 100, clientY: 100 });
    expect(screen.getByTestId('range-hint')).toHaveTextContent('Klepněte na poslední den výběru.');
    fireEvent.click(screen.getByTestId('month-day-2026-10-25'), { clientX: 200, clientY: 200 });
    expect(await screen.findByText('12. 10. – 25. 10.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: /Rezervovat pro klub/ }));
    const initial = JSON.parse((await screen.findByTestId('club-order-initial')).textContent ?? '{}');
    expect(initial.ranges[0]).toMatchObject({ fromDate: '2026-10-12', toDate: '2026-10-25' });
  });
});

describe('phone · 390', () => {
  it('has no grid: the day is a list of bookings with time, patient, činnost and status', async () => {
    renderPage(VIEWPORTS.phone, 'day');
    const list = await screen.findByTestId('phone-day-list');
    expect(screen.queryByTestId('time-grid-scroll')).not.toBeInTheDocument();
    expect(await within(list).findByText('Karel Zeman')).toBeInTheDocument();
    const k4 = within(list).getByRole('button', { name: /Spiroergometrie/ });
    expect(k4).toHaveTextContent('Karel Zeman');
    expect(k4).toHaveTextContent('Spiroergometrie');
    expect(k4).toHaveTextContent(/09:00 – 10:00/);
    /* Sorted by time: 08:00 Jan Novák first, the club's 11:00 last. */
    const times = within(list).getAllByRole('button').map((b) => b.textContent ?? '');
    expect(times[0]).toContain('08:00');
    expect(times[times.length - 1]).toContain('11:00');
  });

  it('week: one day at a time, a seven-day strip on top, the top bar steps a day', async () => {
    renderPage(VIEWPORTS.phone, 'week');
    await screen.findByTestId('phone-day-list');
    const strip = screen.getByRole('group', { name: 'Dny týdne' });
    expect(within(strip).getAllByRole('button')).toHaveLength(7);
    expect(screen.getByTestId('week-strip-2026-10-26')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('week-strip-2026-10-26')).toHaveStyle({ minHeight: '64px' });
    fireEvent.click(screen.getByRole('button', { name: 'Další' }));
    expect(screen.getByTestId('week-strip-2026-10-27')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('week-strip-2026-10-30'));
    expect(screen.getByTestId('week-strip-2026-10-30')).toHaveAttribute('aria-pressed', 'true');
  });

  it('week: a swipe moves one day', async () => {
    renderPage(VIEWPORTS.phone, 'week');
    const root = await screen.findByTestId('phone-calendar');
    fireEvent.touchStart(root, { touches: [{ clientX: 300, clientY: 400 }] });
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 120, clientY: 410 }] });
    expect(screen.getByTestId('week-strip-2026-10-27')).toHaveAttribute('aria-pressed', 'true');
  });

  it('month: a list of days with counts and the split by službu; a tap opens that day’s list', async () => {
    renderPage(VIEWPORTS.phone, 'month');
    const row = await screen.findByTestId(`phone-month-day-${DAY}`);
    await vi.waitFor(() => expect(row).toHaveTextContent('Prohlídky 10 · Diagnostika 1 · InBody 1'));
    expect(row).toHaveStyle({ minHeight: '56px' });
    expect(screen.getByTestId('phone-month-day-2026-10-28')).toHaveTextContent('SVÁTEK');
    /* A list of the month's days only - no grid cells. */
    expect(screen.queryAllByTestId(/^month-day-/)).toHaveLength(0);
    fireEvent.click(row);
    expect(await screen.findByTestId('phone-day-list')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pondělí 26. října 2026' })).toBeInTheDocument();
  });

  it('pins "Nová objednávka" at the bottom, once', async () => {
    renderPage(VIEWPORTS.phone, 'day');
    await screen.findByTestId('phone-day-list');
    const buttons = screen.getAllByRole('button', { name: 'Nová objednávka' });
    expect(buttons).toHaveLength(1);
    expect(buttons[0].closest('[data-pinned="true"]')).not.toBeNull();
  });

  it('keeps the calendar and the filters in a "Kalendář a filtry" sheet', async () => {
    renderPage(VIEWPORTS.phone, 'day');
    await screen.findByTestId('phone-day-list');
    expect(screen.queryByRole('region', { name: 'Služby' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Kalendář a filtry' }));
    const sheet = await screen.findByRole('dialog', { name: 'Kalendář a filtry' });
    expect(within(sheet).getByRole('region', { name: 'Služby' })).toBeInTheDocument();
    expect(within(sheet).getByRole('region', { name: 'Kalendáře' })).toBeInTheDocument();
    /* Finger-sized rows. */
    expect(within(sheet).getByRole('checkbox', { name: 'Prohlídky' }).closest('label')).toHaveStyle({ minHeight: '44px' });
  });

  it('draws the činnost colour on a booking in the list', async () => {
    renderPage(VIEWPORTS.phone, 'day');
    const button = await screen.findByRole('button', { name: /Spiroergometrie/ });
    expect(button).toHaveStyle({ borderLeft: '3px solid #2E7D32' });
  });
});

describe('inside the shell', () => {
  function renderInShell(width: number, available: boolean) {
    setViewport(width);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/planovani']}>
          <SidebarSlotProvider available={available}>
            <aside data-testid="shell-sidebar">
              <SidebarSlot />
            </aside>
            <main data-testid="page">
              <Routes>
                <Route path="/planovani" element={<CalendarGridPage />} />
              </Routes>
            </main>
          </SidebarSlotProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('desktop: the mini calendar and the legend are drawn in the sidebar, not beside the grid', async () => {
    renderInShell(VIEWPORTS.desktop, true);
    const side = screen.getByTestId('shell-sidebar');
    expect(await within(side).findByRole('region', { name: 'Služby' })).toBeInTheDocument();
    expect(within(side).getByRole('button', { name: 'Další měsíc' })).toBeInTheDocument();
    /* Nothing of it in the page itself: one sidebar, never two. */
    expect(within(screen.getByTestId('page')).queryByRole('region', { name: 'Služby' })).not.toBeInTheDocument();
    expect(within(screen.getByTestId('page')).queryByRole('button', { name: 'Další měsíc' })).not.toBeInTheDocument();
  });

  it('tablet: the shell offers no slot, so the page carries it in the collapsible block', async () => {
    renderInShell(VIEWPORTS.tablet, false);
    const page = screen.getByTestId('page');
    fireEvent.click(await within(page).findByRole('button', { name: 'Kalendář a filtry' }));
    expect(await within(page).findByRole('region', { name: 'Služby' })).toBeInTheDocument();
    expect(within(screen.getByTestId('shell-sidebar')).queryByRole('region', { name: 'Služby' })).not.toBeInTheDocument();
  });
});
