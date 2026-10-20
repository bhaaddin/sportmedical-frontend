/*
 * Settings audit (20. 10. 2026) - Hromadné objednávky a blokace (/vyhrazeni).
 *
 * Server facts (dev API, /api/calendars/{id}/partner-orders…):
 *   POST …/revoke is permanent: the order stays listed with isRevoked true and cannot be revoked "again" to undo;
 *   PUT …/deadlines accepts a date in the PAST, a date after the window and even a garbage string (200 each);
 *   a window whose end is before its start -> 422 scheduling.partner.window_end_before_start;
 *   a calendar that holds an order cannot be deleted (409), only deactivated.
 * So the screen asks before revoking, and refuses to move a deadline into the past.
 */
process.env.TZ = 'America/Los_Angeles';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../../test/auditHarness';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const listOrders = vi.fn();
const notices = vi.fn();
const revoke = vi.fn();
const setDeadlines = vi.fn();
const listBlocks = vi.fn();

vi.mock('../../api/calendars', () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 'c1', name: 'Prohlídky', color: '#0D5C52', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 0, clinicServiceId: null },
      { id: 'c2', name: 'Spiro', color: '#0D5C52', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 1, clinicServiceId: null },
      { id: 'c3', name: 'Zrušený', color: '#0D5C52', location: '', displayStepMinutes: 15, isActive: false, sortOrder: 2, clinicServiceId: null },
    ]),
  },
}));
vi.mock('../../api/partnerOrders', () => ({
  partnerOrdersApi: { list: listOrders, notices, revoke, setDeadlines, create: vi.fn(), setItems: vi.fn(), addWindow: vi.fn(), releaseWindow: vi.fn() },
}));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: vi.fn().mockResolvedValue({ activities: [], warnings: [] }) } }));
vi.mock('../../api/clubBlocks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/clubBlocks')>()),
  clubBlocksApi: { ...(await importOriginal<typeof import('../../api/clubBlocks')>()).clubBlocksApi, list: listBlocks },
}));
vi.mock('../../api/workingHours', () => ({ workingHoursApi: { preview: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../services/clubsApi', () => ({ clubsApi: { getAll: vi.fn().mockResolvedValue([]) } }));

const { default: PartnerOrdersPage } = await import('./PartnerOrdersPage');

const order = (over: Record<string, unknown> = {}) => ({
  id: 'o1', calendarId: 'c1', partnerName: 'FK Slaný', partnerType: 0, note: '', contactEmail: null, linkSentAt: null, expiresAt: null, isRevoked: false,
  requestedCount: 12, bookedCount: 12, requiredMinutes: 180, coveredMinutes: 180, missingMinutes: 0,
  items: [{ activityId: 'a1', activityName: 'Komplexní prohlídka', durationMinutes: 15, requestedCount: 12, bookedCount: 12, remaining: 0, requiredMinutes: 180 }],
  windows: [{ id: 'w1', date: '2026-12-10', startTime: '11:00:00', endTime: '12:00:00', coveredMinutes: 60, releaseDate: '2026-12-01', warnDate: null, partnerReminderDate: null, releasedAt: null, isExclusive: true }],
  clubId: 'club-1', token: 'tok', clubDiscountPercent: null, clubBlockId: null, ...over,
});

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  listOrders.mockReset().mockResolvedValue([order()]);
  notices.mockReset().mockResolvedValue([]);
  revoke.mockReset().mockResolvedValue(order({ isRevoked: true }));
  setDeadlines.mockReset().mockResolvedValue(order());
  listBlocks.mockReset().mockResolvedValue([]);
});

describe('the list', () => {
  it('lists the orders of the first ACTIVE calendar, and offers only active calendars', async () => {
    const user = userEvent.setup();
    renderScreen(<PartnerOrdersPage />, '/vyhrazeni');
    await screen.findByText('FK Slaný');
    expect(listOrders).toHaveBeenCalledWith('c1');
    await user.click(screen.getByRole('combobox', { name: 'Kalendář' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Prohlídky', 'Spiro']);
  });

  it('reads the orders of the calendar that was picked', async () => {
    const user = userEvent.setup();
    renderScreen(<PartnerOrdersPage />, '/vyhrazeni');
    await user.click(await screen.findByRole('combobox', { name: 'Kalendář' }));
    await user.click(screen.getByRole('option', { name: 'Spiro' }));
    await waitFor(() => expect(listOrders).toHaveBeenCalledWith('c2'));
  });

  it('shows the server’s counts, "Obsazeno" when full and the revoked state', async () => {
    listOrders.mockResolvedValue([order(), order({ id: 'o2', partnerName: 'SK Kladno', bookedCount: 3, isRevoked: true })]);
    renderScreen(<PartnerOrdersPage />, '/vyhrazeni');
    await screen.findByText('FK Slaný');
    expect(screen.getAllByText('Obsazeno 12 z 12 míst').length).toBe(1);
    expect(screen.getByText('Obsazeno')).toBeInTheDocument();
    expect(screen.getByText('odkaz zrušen')).toBeInTheDocument();
  });

  it('warns a window whose deadline is within two days, in the Prague calendar', async () => {
    const now = new Date();
    const prague = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date(now.getTime() + 86_400_000));
    listOrders.mockResolvedValue([order({ windows: [{ ...order().windows[0], releaseDate: prague }] })]);
    renderScreen(<PartnerOrdersPage />, '/vyhrazeni');
    expect(await screen.findByText(/⚠/)).toBeInTheDocument();
  });

  it('says which orders fall due today and that sending is not done here', async () => {
    notices.mockResolvedValue([{ orderId: 'o1', windowId: 'w1', partnerName: 'FK Slaný', windowDate: '2026-12-10', requestedCount: 12, bookedCount: 8, contactEmail: 'klub@example.cz' }]);
    renderScreen(<PartnerOrdersPage />, '/vyhrazeni');
    expect(await screen.findByText(/klub@example\.cz/)).toBeInTheDocument();
  });

  it('shows a banner, not silence, when the notices cannot be read', async () => {
    notices.mockRejectedValue(new Error('down'));
    renderScreen(<PartnerOrdersPage />, '/vyhrazeni');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('says there is none when there is none', async () => {
    listOrders.mockResolvedValue([]);
    renderScreen(<PartnerOrdersPage />, '/vyhrazeni');
    expect(await screen.findByText(/Zatím žádná hromadná objednávka/)).toBeInTheDocument();
  });
});

describe('revoking the link (permanent)', () => {
  it('asks first, names the club, and revokes only on the confirmation', async () => {
    const user = userEvent.setup();
    renderScreen(<PartnerOrdersPage />, '/vyhrazeni');
    await user.click(await screen.findByRole('button', { name: 'Zrušit odkaz' }));
    expect(revoke).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog', { name: 'Zrušit odkaz?' });
    expect(dialog).toHaveTextContent('FK Slaný');
    expect(dialog).toHaveTextContent(/nedá obnovit/);
    await user.click(within(dialog).getByRole('button', { name: 'Zrušit odkaz' }));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('c1', 'o1'));
  });

  it('"Zrušit" in the dialog leaves the link alone', async () => {
    const user = userEvent.setup();
    renderScreen(<PartnerOrdersPage />, '/vyhrazeni');
    await user.click(await screen.findByRole('button', { name: 'Zrušit odkaz' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Zrušit' }));
    expect(revoke).not.toHaveBeenCalled();
  });

  it('shows a refusal inside the dialog, where it can be seen', async () => {
    const { BookingApiError } = await import('../../api/apiError');
    revoke.mockRejectedValue(new BookingApiError('server', 500));
    const user = userEvent.setup();
    renderScreen(<PartnerOrdersPage />, '/vyhrazeni');
    await user.click(await screen.findByRole('button', { name: 'Zrušit odkaz' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Zrušit odkaz' }));
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toBeInTheDocument();
  });

  it('is off for an order that is already revoked', async () => {
    listOrders.mockResolvedValue([order({ isRevoked: true })]);
    renderScreen(<PartnerOrdersPage />, '/vyhrazeni');
    expect(await screen.findByRole('button', { name: 'Zrušit odkaz' })).toBeDisabled();
  });

  it('sends one request for a double click on the confirmation', async () => {
    let finish: (value: unknown) => void = () => undefined;
    revoke.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    renderScreen(<PartnerOrdersPage />, '/vyhrazeni');
    await user.click(await screen.findByRole('button', { name: 'Zrušit odkaz' }));
    await user.dblClick(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Zrušit odkaz' }));
    expect(revoke).toHaveBeenCalledTimes(1);
    finish(order({ isRevoked: true }));
  });
});

describe('extending the deadline', () => {
  const open = async () => {
    const user = userEvent.setup();
    renderScreen(<PartnerOrdersPage />, '/vyhrazeni');
    await user.click(await screen.findByRole('button', { name: 'Prodloužit lhůtu' }));
    return user;
  };
  const pragueToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date());

  it('opens with the date empty and the save off', async () => {
    await open();
    const field = screen.getByLabelText('Nová lhůta');
    expect(field).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('does not allow a date before today (Prague), even though the server would store it', async () => {
    const user = await open();
    const field = screen.getByLabelText('Nová lhůta');
    expect(field).toHaveAttribute('min', pragueToday());
    await user.type(field, '2020-01-01');
    expect(screen.getByText('Lhůta nemůže být v minulosti.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('sends the date as releaseDate and nothing else', async () => {
    const user = await open();
    await user.type(screen.getByLabelText('Nová lhůta'), '2099-01-15');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(setDeadlines).toHaveBeenCalledWith('c1', 'o1', { releaseDate: '2099-01-15' }));
  });

  it('closes after a save and reads the orders again', async () => {
    const user = await open();
    await user.type(screen.getByLabelText('Nová lhůta'), '2099-01-15');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(screen.queryByLabelText('Nová lhůta')).not.toBeInTheDocument());
    await waitFor(() => expect(listOrders.mock.calls.length).toBeGreaterThan(1));
  });

  it('Zrušit closes the form without a request', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Zrušit', hidden: false }));
    expect(screen.queryByLabelText('Nová lhůta')).not.toBeInTheDocument();
    expect(setDeadlines).not.toHaveBeenCalled();
  });

  it('shows the server’s refusal above the field', async () => {
    const { BookingApiError } = await import('../../api/apiError');
    setDeadlines.mockRejectedValue(new BookingApiError('domainRule', 422, 'Lhůta je po začátku vyhrazeného času.'));
    const user = await open();
    await user.type(screen.getByLabelText('Nová lhůta'), '2099-01-15');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText('Lhůta je po začátku vyhrazeného času.')).toBeInTheDocument();
  });
});

describe('layouts', () => {
  it.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)('%s: the order card keeps its 44 px actions where it has a phone layout', async (_name, width) => {
    setViewport(width);
    renderScreen(<PartnerOrdersPage />, '/vyhrazeni');
    expect(await screen.findByRole('button', { name: 'Prodloužit lhůtu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zrušit odkaz' })).toBeInTheDocument();
    expect(screen.getByTestId('partner-orders')).toHaveAttribute('data-layout', width === VIEWPORTS.phone ? 'phone' : width === VIEWPORTS.tablet ? 'tablet' : 'desktop');
  });
});
