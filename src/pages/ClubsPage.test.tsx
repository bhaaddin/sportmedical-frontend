/*
 * Kluby a týmy, clicked through.
 *
 * `clubs/clubOrders.test.ts` holds the arithmetic. What only the screen can
 * show: that every club gets a card with its reservation state, its headcount
 * and the band that headcount lands in; that the filters narrow the grid; that
 * opening a card shows the board's detail - the link box, the taken places,
 * the money with the discount applied; and that the payer record is still
 * editable from there.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { addDaysToDateOnly, pragueWallClockToInstant, toDateOnly } from '../utils/time';

const getAll = vi.fn();
const update = vi.fn();
const listOrders = vi.fn();
const range = vi.fn();

vi.mock('../services/clubsApi', () => ({
  clubsApi: { getAll, create: vi.fn(), update, deactivate: vi.fn() },
}));
vi.mock('../api/calendars', () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 'c-1', name: 'Prohlídky', color: '#0D5C52', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 0, clinicServiceId: null },
      { id: 'c-off', name: 'Starý', color: '#000', location: '', displayStepMinutes: 15, isActive: false, sortOrder: 1, clinicServiceId: null },
    ]),
  },
}));
vi.mock('../api/partnerOrders', () => ({
  partnerOrdersApi: { list: listOrders, setItems: vi.fn() },
}));
vi.mock('../api/activities', () => ({
  activitiesApi: {
    list: vi.fn().mockResolvedValue({
      activities: [{ id: 'a-1', name: 'Komplexní prohlídka', durationMinutes: 15, isActive: true, priceCzk: 2200 }],
      warnings: [],
    }),
  },
}));
vi.mock('../api/appointments', () => ({ appointmentsApi: { range } }));
vi.mock('../api/groupDiscounts', () => ({
  GROUP_DISCOUNTS_QUERY_KEY: ['settings', 'group-discounts'],
  readGroupDiscounts: vi.fn().mockResolvedValue({
    settings: { tiers: [{ minHeadcount: 5, maxHeadcount: 9, percent: 5 }, { minHeadcount: 10, maxHeadcount: null, percent: 10 }] },
    defaults: { tiers: [] },
    maxTiers: 5,
  }),
}));

const { default: ClubsPage } = await import('./ClubsPage');

const today = toDateOnly(new Date());
const day1 = addDaysToDateOnly(today, 20);
const day2 = addDaysToDateOnly(today, 21);

const slany = {
  id: 'club-1', name: 'FK Slaný', ico: '25596641', address: 'Sportovní 1', city: 'Slaný', postalCode: '27401',
  contactPerson: 'Jan Trenér', contactPhone: '+420 603 221 004', contactEmail: 'klub@fkslany.cz',
  bankAccount: '123456', bankCode: '0100', iban: '', paymentTermsDays: 14, isActive: true, createdAt: '2026-01-01T00:00:00Z',
};
const kladno = {
  id: 'club-2', name: 'HC Kladno', ico: '00000019', contactPerson: 'Eva Vedoucí', contactPhone: '+420 602 554 117',
  paymentTermsDays: 14, isActive: true, createdAt: '2026-01-01T00:00:00Z',
};

const window1 = { id: 'w-1', date: day1, startTime: '11:00:00', endTime: '12:00:00', coveredMinutes: 60, releaseDate: null, warnDate: null, partnerReminderDate: null, releasedAt: null, isExclusive: true };
const window2 = { id: 'w-2', date: day2, startTime: '09:00:00', endTime: '10:00:00', coveredMinutes: 60, releaseDate: null, warnDate: null, partnerReminderDate: null, releasedAt: null, isExclusive: true };

const slanyOrder = {
  id: 'o-1', calendarId: 'c-1', partnerName: 'FK Slaný', partnerType: 0, note: '', contactEmail: null,
  linkSentAt: null, expiresAt: pragueWallClockToInstant(addDaysToDateOnly(today, 19), '12:00').toISOString(), isRevoked: false,
  requestedCount: 12, bookedCount: 4, requiredMinutes: 180, coveredMinutes: 120, missingMinutes: 60,
  items: [{ activityId: 'a-1', activityName: 'Komplexní prohlídka', durationMinutes: 15, requestedCount: 12, bookedCount: 4, remaining: 8, requiredMinutes: 180 }],
  windows: [window1, window2],
  clubId: 'club-1', token: 'fk-slany-rijen26',
};

const appt = (id: string, date: string, time: string, name: string, ready = true) => ({
  id, calendarId: 'c-1', patientId: '', activityId: 'a-1', activityName: 'Komplexní prohlídka',
  startUtc: pragueWallClockToInstant(date, time).toISOString(),
  endUtc: pragueWallClockToInstant(date, time).toISOString(),
  status: 0, isRunningLate: false, checkedInUtc: null,
  paperwork: ready ? { ready: true, missing: [] } : { ready: false, missing: ['questionnaire'] },
  patientName: name,
});

function Wrap({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/clubs']}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  getAll.mockReset().mockResolvedValue([slany, kladno]);
  update.mockReset().mockResolvedValue(slany);
  listOrders.mockReset().mockResolvedValue([slanyOrder]);
  range.mockReset().mockResolvedValue([
    appt('p1', day1, '11:00', 'Jan Novák'),
    appt('p2', day1, '11:15', 'Petr Malý'),
    appt('p3', day2, '09:00', 'Adam Říha', false),
    appt('p4', day2, '09:15', 'Lukáš Beran'),
  ]);
});

describe('ClubsPage', () => {
  it('draws one card per club with its state, headcount and discount band', async () => {
    render(<Wrap><ClubsPage /></Wrap>);

    const cards = await screen.findAllByRole('listitem');
    expect(cards).toHaveLength(2);

    const first = within(cards[0]);
    expect(first.getByRole('heading', { name: 'FK Slaný' })).toBeInTheDocument();
    await waitFor(() => expect(first.getByText('Aktivní rezervace')).toBeInTheDocument());
    expect(first.getByText('Jan Trenér · +420 603 221 004')).toBeInTheDocument();
    expect(first.getByText('12')).toBeInTheDocument();
    expect(first.getByText('−10 %')).toBeInTheDocument();

    const second = within(cards[1]);
    await waitFor(() => expect(second.getByText('Bez objednávky')).toBeInTheDocument());
    expect(second.getAllByText('—')).toHaveLength(2);

    /* Only the active calendar's orders were asked for. */
    expect(listOrders).toHaveBeenCalledTimes(1);
    expect(listOrders).toHaveBeenCalledWith('c-1');
  });

  it('narrows the grid with the chips and the search box', async () => {
    const user = userEvent.setup();
    render(<Wrap><ClubsPage /></Wrap>);
    await screen.findAllByRole('listitem');
    await screen.findByText('Aktivní rezervace');

    await user.click(screen.getByRole('button', { name: /Bez objednávky/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'HC Kladno' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Všechny/ }));
    await user.type(screen.getByRole('textbox', { name: 'Hledat klub' }), 'trenér');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'FK Slaný' })).toBeInTheDocument();
  });

  it('opens the club detail with the link, the taken places and the discounted total', async () => {
    const user = userEvent.setup();
    render(<Wrap><ClubsPage /></Wrap>);
    const cards = await screen.findAllByRole('listitem');
    await screen.findByText('Aktivní rezervace');

    await user.click(cards[0]);

    expect(await screen.findByRole('heading', { name: 'FK Slaný', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/^Hromadná rezervace /)).toBeInTheDocument();
    expect(screen.getByText('Registrační odkaz pro sportovce')).toBeInTheDocument();
    expect(screen.getByTestId('club-link')).toHaveTextContent('/klub/fk-slany-rijen26');
    expect(screen.getByRole('button', { name: 'Kopírovat' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Poslat klubu' })).toHaveAttribute('href', expect.stringContaining('mailto:klub%40fkslany.cz'));
    expect(screen.getByText('Obsazeno 4 z 12 míst')).toBeInTheDocument();
    expect(screen.getByText('8 volných')).toBeInTheDocument();
    expect(screen.getByText(/^Odkaz platí do /)).toBeInTheDocument();

    const table = await screen.findByRole('table', { name: 'Rezervovaná místa' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(12);
    expect(within(rows[0]).getByText('Jan Novák')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Registrován')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Adam Říha')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Chybí dotazník')).toBeInTheDocument();
    expect(within(rows[4]).getByText('—')).toBeInTheDocument();
    expect(within(rows[4]).getByText('volné místo')).toBeInTheDocument();
    expect(within(rows[4]).getByText('Čeká na sportovce')).toBeInTheDocument();
    expect(range).toHaveBeenCalledWith(day1, day2, ['c-1']);

    /* The rail: the club's facts and the order's money. */
    expect(screen.getByText('−10 % (10+ osob)')).toBeInTheDocument();
    expect(screen.getByText('Na klub')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/23.760 Kč/)).toBeInTheDocument());
    expect(screen.getByText(/12 × 2.200 Kč se slevou 10 %/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Přidat místa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vystavit fakturu' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zpět na kluby' }));
    expect(await screen.findAllByRole('listitem')).toHaveLength(2);
  });

  it('says when the API does not give the link rather than inventing one', async () => {
    listOrders.mockResolvedValue([{ ...slanyOrder, token: null }]);
    const user = userEvent.setup();
    render(<Wrap><ClubsPage /></Wrap>);
    const cards = await screen.findAllByRole('listitem');
    await screen.findByText('Aktivní rezervace');
    await user.click(cards[0]);

    expect(await screen.findByTestId('club-link')).toHaveTextContent('Odkaz zatím není k dispozici');
    expect(screen.getByRole('button', { name: 'Kopírovat' })).toBeDisabled();
  });

  it('still edits the payer record from the detail', async () => {
    const user = userEvent.setup();
    render(<Wrap><ClubsPage /></Wrap>);
    const cards = await screen.findAllByRole('listitem');
    await user.click(cards[1]);

    expect(await screen.findByText('Tento klub zatím nemá hromadnou rezervaci.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Upravit klub' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Upravit klub' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Název')).toHaveValue('HC Kladno');

    await user.clear(within(dialog).getByLabelText('Město'));
    await user.type(within(dialog).getByLabelText('Město'), 'Kladno');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith('club-2', expect.objectContaining({ name: 'HC Kladno', city: 'Kladno' })));
  });
});
