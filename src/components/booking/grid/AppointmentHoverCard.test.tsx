/*
 * The hover card's price line (Etapa 12, "ceny všude"): the agreed price
 * first, the row's list price next, the činnost's catalogue price last - and
 * "upraveno (ceník …)" under an agreed figure that differs from the list.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DayAppointment } from '../../../api/bookingContracts';

const listActivities = vi.fn();
const getById = vi.fn();
vi.mock('../../../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../../../api/patients', () => ({ patientsApi: { getById } }));

const { AppointmentHoverCard } = await import('./AppointmentHoverCard');

const row = (over: Partial<DayAppointment> = {}): DayAppointment => ({
  id: 'a1',
  calendarId: 'c1',
  patientId: '',
  patientName: 'Tomáš Kříž',
  activityId: 'act-1',
  activityName: 'Základní prohlídka',
  startUtc: '2026-10-12T08:00:00Z',
  endUtc: '2026-10-12T09:00:00Z',
  status: 0,
  isRunningLate: false,
  checkedInUtc: null,
  paperwork: null,
  ...over,
});

const renderCard = (appointment: DayAppointment, fields = ['activity', 'price']) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AppointmentHoverCard appointment={appointment} fields={fields} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  listActivities.mockReset().mockResolvedValue({ activities: [{ id: 'act-1', name: 'Základní prohlídka', priceCzk: 1600 }] });
  getById.mockReset();
});

describe('the price on the hover card', () => {
  it('shows the list price the row carries, as "Cena"', async () => {
    renderCard(row({ agreedPriceCzk: null, listPriceCzk: 1600 }));
    expect(await screen.findByText('Cena')).toBeInTheDocument();
    expect(screen.getByText('1 600 Kč')).toBeInTheDocument();
    expect(screen.queryByTestId('price-caption')).not.toBeInTheDocument();
    expect(listActivities).not.toHaveBeenCalled();
  });

  it('shows the agreed price with the list it was adjusted from', async () => {
    renderCard(row({ agreedPriceCzk: 1200, listPriceCzk: 1600 }));
    expect(await screen.findByText('1 200 Kč')).toBeInTheDocument();
    expect(screen.getByTestId('price-caption')).toHaveTextContent('upraveno (ceník 1 600 Kč)');
  });

  it('falls back to the činnost\'s catalogue price when the row has none', async () => {
    renderCard(row());
    expect(await screen.findByText('1 600 Kč')).toBeInTheDocument();
    expect(listActivities).toHaveBeenCalledTimes(1);
  });

  it('is on the card even when the clinic\'s hover-field choice left it out, after the chosen fields', async () => {
    renderCard(row({ listPriceCzk: 1600 }), ['activity', 'status']);
    const labels = (await screen.findAllByText(/^(Činnost|Stav objednávky|Cena)$/)).map((el) => el.textContent);
    expect(labels).toEqual(['Činnost', 'Stav objednávky', 'Cena']);
    expect(screen.getByText('1 600 Kč')).toBeInTheDocument();
  });

  it('says "bez ceny" when nobody knows a price, rather than hiding the line', async () => {
    listActivities.mockResolvedValue({ activities: [] });
    renderCard(row());
    expect(await screen.findByText('bez ceny')).toBeInTheDocument();
  });
});
