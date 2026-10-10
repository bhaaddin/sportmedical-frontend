/*
 * Dnešní přehled and the money (Etapa 12, "ceny všude"): every late row says
 * what it costs - a Cena column on a desktop and a tablet, a line under the
 * name on a phone - and the list opens with "Celkem dnes", the sum of the
 * day's visits that still stand, at their agreed prices.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import type { DayAppointment } from '../../api/bookingContracts';

const daySummary = vi.fn();
const range = vi.fn();
const listCalendars = vi.fn();
const listActivities = vi.fn();
const getById = vi.fn();

vi.mock('../../api/appointments', () => ({ appointmentsApi: { daySummary, range, setStatus: vi.fn() } }));
vi.mock('../../api/calendars', () => ({ calendarsApi: { list: listCalendars } }));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../../api/patients', () => ({ patientsApi: { getById } }));
vi.mock('../../components/booking/NewAppointmentDialog', () => ({ NewAppointmentDialog: () => null }));

const { default: DayOverviewPage } = await import('./DayOverviewPage');

/* Every row started an hour ago and is still expected, so it is late and listed. */
const row = (id: string, status: number, over: Partial<DayAppointment> = {}): DayAppointment => ({
  id,
  calendarId: 'c1',
  patientId: '',
  patientName: `Pacient ${id}`,
  activityId: 'act-1',
  activityName: 'Základní prohlídka',
  startUtc: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  endUtc: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  status,
  isRunningLate: false,
  checkedInUtc: null,
  paperwork: null,
  ...over,
});

const summary = {
  date: '2026-10-12',
  booked: 3,
  arrived: 0,
  runningLate: 0,
  didNotCome: 0,
  cancelled: 1,
  byActivity: [],
  byCalendar: [],
  workingMinutes: 480,
  bookedMinutes: 90,
  unusedMinutes: 390,
  freeMinutesLeft: 390,
  paperwork: null,
  nextAppointment: null,
  absent: [],
};

beforeEach(() => {
  localStorage.setItem('permissions', JSON.stringify(['bookings.edit']));
  listCalendars.mockReset().mockResolvedValue([{ id: 'c1', name: 'Ordinace 1', color: '#999', isActive: true }]);
  daySummary.mockReset().mockResolvedValue(summary);
  listActivities.mockReset().mockResolvedValue({ activities: [{ id: 'act-1', name: 'Základní prohlídka', priceCzk: 1600 }] });
  getById.mockReset();
  range.mockReset().mockResolvedValue([
    row('a', 0, { listPriceCzk: 1600 }),                       // list price stands
    row('b', 0, { agreedPriceCzk: 1200, listPriceCzk: 1600 }), // agreed, adjusted
    row('c', 0),                                                 // nothing on the row: the catalogue
    row('d', 4, { listPriceCzk: 1600 }),                       // cancelled: not counted, not listed
  ]);
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <DayOverviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe.each([
  ['desktop', VIEWPORTS.desktop],
  ['tablet', VIEWPORTS.tablet],
])('Dnešní přehled on a %s', (_name, width) => {
  it('has a Cena column with every row\'s price and the day\'s total on top', async () => {
    setViewport(width);
    renderPage();

    expect(await screen.findByTestId('day-total')).toHaveTextContent('Celkem dnes: 4 400 Kč');
    expect(await screen.findByRole('columnheader', { name: 'Cena' })).toBeInTheDocument();
    const prices = await screen.findAllByTestId('row-price');
    /* formatCzk groups thousands with a no-break space; the assertion reads it as a space. */
    expect(prices.map((p) => (p.textContent ?? '').replace(/ /g, ' '))).toEqual([
      '1 600 Kč',
      '1 200 Kčupraveno (ceník 1 600 Kč)',
      '1 600 Kč',
    ]);
    expect(prices[0].tagName).toBe('TD');
  });
});

describe('Dnešní přehled on a phone', () => {
  it('puts the price under the name instead of in a column, and still totals the day', async () => {
    setViewport(VIEWPORTS.phone);
    renderPage();

    expect(await screen.findByTestId('day-total')).toHaveTextContent('Celkem dnes: 4 400 Kč');
    await screen.findAllByTestId('row-price');
    expect(screen.queryByRole('columnheader', { name: 'Cena' })).not.toBeInTheDocument();
    const nameCell = screen.getByText('Pacient b').closest('td') as HTMLElement;
    expect(within(nameCell).getByTestId('row-price')).toHaveTextContent('1 200 Kč');
    expect(within(nameCell).getByTestId('row-price')).toHaveTextContent('upraveno (ceník 1 600 Kč)');
  });
});
