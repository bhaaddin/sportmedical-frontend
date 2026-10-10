/*
 * The price on the grid card itself (Etapa 12, "ceny všude"): a line of its
 * own when the card has room for four lines, on the time line when it has
 * room for three, nowhere on a dense or a month (compact) card. The card
 * measures its own height, so this stubs what the browser would answer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DayAppointment } from '../../../api/bookingContracts';

vi.mock('../../../api/activities', () => ({ activitiesApi: { list: vi.fn().mockResolvedValue({ activities: [] }) } }));
vi.mock('../../../api/patients', () => ({ patientsApi: { getById: vi.fn() } }));
vi.mock('../../../api/displaySettings', async (importActual) => {
  const actual = await importActual<typeof import('../../../api/displaySettings')>();
  return { ...actual, useCalendarDisplay: () => ({ settings: { hoverFields: [] } }) };
});

const { AppointmentButton, linesThatFit } = await import('./AppointmentButton');

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
  agreedPriceCzk: null,
  listPriceCzk: 1600,
  ...over,
});

const original = HTMLElement.prototype.getBoundingClientRect;
const cardHeight = (px: number) => {
  HTMLElement.prototype.getBoundingClientRect = function rect() {
    return { ...original.call(this), height: px } as DOMRect;
  };
};
afterEach(() => { HTMLElement.prototype.getBoundingClientRect = original; });
beforeEach(() => { cardHeight(0); });

const renderCard = (layout: 'block' | 'row' | 'compact', appointment = row(), dense = false) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AppointmentButton appointment={appointment} now={new Date('2026-10-12T07:00:00Z')} onOpen={() => {}} layout={layout} dense={dense} hover={false} />
    </QueryClientProvider>,
  );

describe('how many lines a card holds', () => {
  it('counts 14 px lines inside 10 px of padding', () => {
    expect(linesThatFit(0)).toBe(0);
    expect(linesThatFit(39)).toBe(2);
    expect(linesThatFit(52)).toBe(3);
    expect(linesThatFit(66)).toBe(4);
  });
});

describe('the price on a grid card', () => {
  it('is a line of its own, after the name, when four lines fit', () => {
    cardHeight(78);
    renderCard('block');
    const price = screen.getByTestId('price-line');
    expect(price).toHaveTextContent('1 600 Kč');
    expect(price.previousElementSibling).toHaveTextContent('Tomáš Kříž');
    expect(screen.getByText(/Základní prohlídka/)).toBeInTheDocument();
  });

  it('rides on the time line when exactly three lines fit, so the name and the činnost stay', () => {
    cardHeight(52);
    renderCard('block');
    const price = screen.getByTestId('price-line');
    expect(price).toHaveTextContent('1 600 Kč');
    expect(price.parentElement).toHaveTextContent('10:00 – 11:00');
    expect(screen.getByText('Tomáš Kříž')).toBeInTheDocument();
    expect(screen.getByText(/Základní prohlídka/)).toBeInTheDocument();
  });

  it('is absent when fewer than three lines fit', () => {
    cardHeight(45);
    renderCard('block');
    expect(screen.queryByTestId('price-line')).not.toBeInTheDocument();
  });

  it('never appears on a dense card or a month cell', () => {
    cardHeight(78);
    renderCard('block', row(), true);
    expect(screen.queryByTestId('price-line')).not.toBeInTheDocument();
    renderCard('compact');
    expect(screen.queryByTestId('price-line')).not.toBeInTheDocument();
  });

  it('marks an agreed price as adjusted', () => {
    cardHeight(78);
    renderCard('block', row({ agreedPriceCzk: 1200 }));
    expect(screen.getByTestId('price-line')).toHaveTextContent('1 200 Kč · upraveno');
  });

  it('says "bez ceny" when the row and the catalogue have none', async () => {
    cardHeight(78);
    renderCard('block', row({ listPriceCzk: null }));
    expect(await screen.findByTestId('price-line')).toHaveTextContent('bez ceny');
  });

  it('a list row (phone) always shows the price', () => {
    renderCard('row');
    expect(screen.getByTestId('price-line')).toHaveTextContent('1 600 Kč');
  });
});
