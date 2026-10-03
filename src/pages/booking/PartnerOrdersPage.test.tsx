/*
 * Vyhrazení pro kluby, handed a reservation to start.
 *
 * The calendar's "Rezervovat pro klub" and the clubs page land here with
 * `location.state`: the dragged slot, a club on file, or a club typed into
 * the drawer. What the test pins: the mapping from that state to the dialog's
 * prefill, that the dialog opens already filled, that a club on file is looked
 * up by id, and that the handoff is spent when the dialog closes so Back does
 * not reopen it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { pragueWallClockToInstant } from '../../utils/time';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const listOrders = vi.fn();
const notices = vi.fn();
const getClubs = vi.fn();
const preview = vi.fn();
const listBlocks = vi.fn();

vi.mock('../../api/calendars', () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 'c-1', name: 'Prohlídky', color: '#0D5C52', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 0, clinicServiceId: null },
      { id: 'c-2', name: 'Spiro', color: '#0D5C52', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 1, clinicServiceId: null },
    ]),
  },
}));
vi.mock('../../api/partnerOrders', () => ({
  partnerOrdersApi: { list: listOrders, notices, create: vi.fn(), setItems: vi.fn(), addWindow: vi.fn() },
}));
vi.mock('../../api/activities', () => ({
  activitiesApi: {
    list: vi.fn().mockResolvedValue({
      activities: [{ id: 'a-1', name: 'Komplexní prohlídka', durationMinutes: 15, isActive: true, priceCzk: 2200 }],
      warnings: [],
    }),
  },
}));
vi.mock('../../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubBlocks')>();
  return { ...actual, clubBlocksApi: { ...actual.clubBlocksApi, list: listBlocks } };
});
vi.mock('../../api/workingHours', () => ({ workingHoursApi: { preview } }));
vi.mock('../../services/clubsApi', () => ({ clubsApi: { getAll: getClubs } }));

const { default: PartnerOrdersPage, prefillFromHandoff, isReservationHandoff } = await import('./PartnerOrdersPage');

function StateProbe() {
  const location = useLocation();
  return <div data-testid="state">{JSON.stringify(location.state)}</div>;
}

function Wrap({ state, children }: { state: unknown; children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: '/vyhrazeni', state }]}>
        <Routes>
          <Route path="/vyhrazeni" element={<>{children}<StateProbe /></>} />
          <Route path="/clubs" element={<><div data-testid="clubs-page">Kluby</div><StateProbe /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const startUtc = pragueWallClockToInstant('2026-10-26', '10:00').toISOString();
const endUtc = pragueWallClockToInstant('2026-10-26', '11:00').toISOString();

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  listBlocks.mockReset().mockResolvedValue([]);
  listOrders.mockReset().mockResolvedValue([]);
  notices.mockReset().mockResolvedValue([]);
  preview.mockReset().mockResolvedValue([]);
  getClubs.mockReset().mockResolvedValue([
    { id: 'club-1', name: 'FK Slaný', ico: '25596641', contactEmail: 'klub@fkslany.cz', paymentTermsDays: 14, isActive: true, createdAt: '' },
  ]);
});

describe('prefillFromHandoff', () => {
  it('turns the dragged slot into one held window in Prague time', () => {
    expect(prefillFromHandoff({ calendarId: 'c-1', startUtc, endUtc })).toMatchObject({
      windows: [{ date: '2026-10-26', startTime: '10:00', endTime: '11:00' }],
      clubId: null,
    });
  });

  it('carries a typed club as the partner, with the contact in the note', () => {
    expect(
      prefillFromHandoff({ newClub: { name: 'SK Kladno', contactPerson: 'Eva', contactPhone: '+420 1', contactEmail: 'e@sk.cz', headcount: 48 } }),
    ).toEqual({
      partnerName: 'SK Kladno', contactEmail: 'e@sk.cz', note: 'Eva · +420 1', clubId: null, headcount: 48, windows: [],
    });
  });

  it('knows a handoff from an empty state', () => {
    expect(isReservationHandoff(null)).toBe(false);
    expect(isReservationHandoff({ calendarId: 'c-1' })).toBe(false);
    expect(isReservationHandoff({ clubId: 'club-1' })).toBe(true);
  });
});

describe('PartnerOrdersPage with a handoff', () => {
  it('opens the dialog on the handed-over calendar with the slot and the club filled in', async () => {
    render(
      <Wrap state={{ calendarId: 'c-2', startUtc, endUtc, clubId: 'club-1' }}>
        <PartnerOrdersPage />
      </Wrap>,
    );

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByLabelText('Název partnera')).toHaveValue('FK Slaný'));
    expect(within(dialog).getByLabelText('Kontaktní e-mail')).toHaveValue('klub@fkslany.cz');
    expect(within(dialog).getByLabelText('Den')).toHaveValue('2026-10-26');
    expect(within(dialog).getByDisplayValue('10:00')).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue('11:00')).toBeInTheDocument();

    /* The page itself switched to the handed-over calendar. */
    await waitFor(() => expect(listOrders).toHaveBeenCalledWith('c-2'));
    expect(preview).toHaveBeenCalledWith('c-2', '2026-10-26', '2026-10-26');
  });

  it('fills a typed club and its headcount, and spends the handoff on close', async () => {
    const user = userEvent.setup();
    render(
      <Wrap state={{ newClub: { name: 'SK Kladno', headcount: 48 } }}>
        <PartnerOrdersPage />
      </Wrap>,
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Název partnera')).toHaveValue('SK Kladno');
    await waitFor(() => expect(within(dialog).getByLabelText('Počet')).toHaveValue(48));
    expect(getClubs).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Zrušit' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('state')).toHaveTextContent('null');
  });

  it('opens nothing without a handoff', async () => {
    render(<Wrap state={null}><PartnerOrdersPage /></Wrap>);
    await screen.findByRole('heading', { name: 'Hromadné objednávky' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

/* ── Etapa 2: three layouts and the link to the block ── */

const order = (over: Record<string, unknown> = {}) => ({
  id: 'o-1', calendarId: 'c-1', partnerName: 'FK Slaný', partnerType: 0, note: '', contactEmail: null,
  linkSentAt: null, expiresAt: null, isRevoked: false,
  requestedCount: 12, bookedCount: 4, requiredMinutes: 180, coveredMinutes: 120, missingMinutes: 60,
  items: [{ activityId: 'a-1', activityName: 'Komplexní prohlídka', durationMinutes: 15, requestedCount: 12, bookedCount: 4, remaining: 8, requiredMinutes: 180 }],
  windows: [{ id: 'w-1', date: '2026-10-26', startTime: '11:00:00', endTime: '12:00:00', coveredMinutes: 60, releaseDate: null, warnDate: null, partnerReminderDate: null, releasedAt: null, isExclusive: true }],
  clubId: 'club-1', token: 'tok', clubDiscountPercent: null, clubBlockId: null, ...over,
});

describe('PartnerOrdersPage in three layouts', () => {
  beforeEach(() => {
    listOrders.mockResolvedValue([order(), order({ id: 'o-2', partnerName: 'SK Kladno' })]);
  });

  it.each([
    ['phone', VIEWPORTS.phone, '1'],
    ['tablet', VIEWPORTS.tablet, '2'],
    ['desktop', VIEWPORTS.desktop, '2'],
  ])('draws the %s layout with %s column(s)', async (device, width, columns) => {
    setViewport(width);
    render(<Wrap state={null}><PartnerOrdersPage /></Wrap>);
    const page = await screen.findByTestId('partner-orders');
    expect(page).toHaveAttribute('data-layout', device);
    expect(page).toHaveAttribute('data-columns', columns);
    expect(await screen.findAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Hromadné objednávky' })).toBeInTheDocument();
  });

  it('keeps "Nová hromadná objednávka" in the header on desktop and pins it to the bottom on a phone', async () => {
    const { unmount } = render(<Wrap state={null}><PartnerOrdersPage /></Wrap>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByTestId('pinned-actions')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nová hromadná objednávka' })).toBeInTheDocument();
    unmount();

    setViewport(VIEWPORTS.phone);
    render(<Wrap state={null}><PartnerOrdersPage /></Wrap>);
    await screen.findAllByRole('listitem');
    const bar = screen.getByTestId('pinned-actions');
    expect(within(bar).getByRole('button', { name: 'Nová hromadná objednávka' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nová hromadná objednávka' })).toHaveLength(1);
  });

  it('opens the creating dialog from the pinned button on a phone, full screen', async () => {
    setViewport(VIEWPORTS.phone);
    const user = userEvent.setup();
    render(<Wrap state={null}><PartnerOrdersPage /></Wrap>);
    await screen.findAllByRole('listitem');
    await user.click(within(screen.getByTestId('pinned-actions')).getByRole('button', { name: 'Nová hromadná objednávka' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.className).toMatch(/paperFullScreen/);
  });
});

describe('PartnerOrdersPage and club blocks', () => {
  it('links an order that came from a block to that block, and not one that did not', async () => {
    listOrders.mockResolvedValue([
      order({ clubBlockId: 'b-1' }),
      order({ id: 'o-2', partnerName: 'SK Kladno', clubId: 'club-2' }),
    ]);
    listBlocks.mockResolvedValue([{ id: 'b-1', clubId: 'club-1', fromDate: '2026-10-26', toDate: '2026-10-27' }]);
    const user = userEvent.setup();
    render(<Wrap state={null}><PartnerOrdersPage /></Wrap>);

    const link = await screen.findByTestId('order-block-link');
    expect(screen.getAllByTestId('order-block-link')).toHaveLength(1);
    await waitFor(() => expect(link).toHaveTextContent('Z bloku 26.—27. října 2026'));

    await user.click(link);
    expect(await screen.findByTestId('clubs-page')).toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId('state').textContent ?? 'null')).toEqual({ clubId: 'club-1', clubBlockId: 'b-1' });
  });

  it('still links when the blocks cannot be read, without the days', async () => {
    listOrders.mockResolvedValue([order({ clubBlockId: 'b-1' })]);
    listBlocks.mockRejectedValue(new Error('500'));
    render(<Wrap state={null}><PartnerOrdersPage /></Wrap>);
    expect(await screen.findByTestId('order-block-link')).toHaveTextContent('Z bloku klubu');
  });
});
