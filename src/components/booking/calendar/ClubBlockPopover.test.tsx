/*
 * Etapa 10: a click on a club window in the calendar. A window that belongs to a club ORDER opens the order (its
 * code, its terms, the činnosti split, "7/22 zapsáno", the clicked window highlighted, "Otevřít objednávku" and
 * "Upravit termíny") - never the block. Only a legacy block without an order keeps "Otevřít blok".
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { toOrder } from '../../../api/clubOrders';
import type { ClubBlockView } from '../../../api/clubBlocks';

const { getBlock, getOrder } = vi.hoisted(() => ({ getBlock: vi.fn(), getOrder: vi.fn() }));

vi.mock('../../../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubBlocks')>();
  return { ...actual, clubBlocksApi: { ...actual.clubBlocksApi, get: getBlock } };
});
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, get: getOrder } };
});

const { ClubBlockPopover } = await import('./ClubBlockPopover');

const ORDER_ID = '80e74a6c-0000-4000-8000-0000000000aa';

const win = (id: string, from: string, to: string, over: Partial<ClubBlockView> = {}): ClubBlockView => ({
  id, clubId: 'club-1', clubName: 'FK Slaný', colorHex: '#2E7D6B', name: null, calendarIds: ['cal-1'], activityIds: [], fromDate: from, toDate: to,
  dailyFrom: '08:00', dailyTo: '12:00', playerCount: 0, seats: 0, registered: 0, status: 'Active', registrationToken: null, registrationUrl: null,
  note: null, createdAtUtc: null, athletes: [], clubOrderId: ORDER_ID, ...over,
});

const order = toOrder({
  id: ORDER_ID, groupId: ORDER_ID, clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's-1', serviceName: 'Prohlídky', status: 'Confirmed',
  paymentMethod: 'ClubInvoice', totalSeats: 22, registered: 7,
  activitySeats: [
    { activityId: 'a-1', activityName: 'Základní prohlídka', durationMinutes: 30, seats: 12, registered: 4, unitPriceCzk: 200 },
    { activityId: 'a-2', activityName: 'Komplexní prohlídka', durationMinutes: 60, seats: 10, registered: 3, unitPriceCzk: 400 },
  ],
  blocks: [win('w1', '2099-10-26', '2099-10-27'), win('w2', '2099-10-29', '2099-10-29'), win('w3', '2099-11-10', '2099-11-10')],
});

const pick = (id: string) => ({
  clubBlockId: id, clubId: 'club-1', clubName: 'FK Slaný', colorHex: '#2E7D6B', range: { from: '2099-10-26', to: '2099-11-10' }, x: 200, y: 200,
});

function show(props: { id?: string; onEditTerms?: boolean } = {}) {
  const handlers = { onOpen: vi.fn(), onOpenOrder: vi.fn(), onEditTerms: vi.fn(), onClose: vi.fn() };
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ClubBlockPopover
        pick={pick(props.id ?? 'w2')}
        today="2099-10-01"
        onOpen={handlers.onOpen}
        onOpenOrder={handlers.onOpenOrder}
        {...(props.onEditTerms === false ? {} : { onEditTerms: handlers.onEditTerms })}
        onClose={handlers.onClose}
      />
    </QueryClientProvider>,
  );
  return handlers;
}

beforeEach(() => {
  getBlock.mockReset().mockImplementation(async (id: string) => win(id, '2099-10-29', '2099-10-29'));
  getOrder.mockReset().mockResolvedValue(order);
});

describe.each([['phone'], ['tablet'], ['desktop']] as const)('a window of an order · %s', (name) => {
  beforeEach(() => setViewport(VIEWPORTS[name]));

  it('opens the ORDER: code, terms, činnosti split, registered/total, the clicked window highlighted', async () => {
    show();
    const dialog = await screen.findByRole('dialog', { name: 'Objednávka KO-000000AA · FK Slaný' });
    expect(dialog).toHaveAttribute('data-kind', 'order');
    expect(await within(dialog).findByTestId('club-popover-summary')).toHaveTextContent('3 termíny · Základní 12 · Komplexní 10 · 7/22 zapsáno');
    const pills = within(dialog).getAllByTestId('order-window');
    expect(pills).toHaveLength(3);
    expect(pills.map((p) => p.getAttribute('data-clicked'))).toEqual(['false', 'true', 'false']);
    expect(pills[1]).toHaveTextContent('Čt 29. 10. · 08:00–12:00');
    /* Never the block's wording. */
    expect(screen.queryByText(/Blok pro/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Otevřít blok' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Otevřít objednávku' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Upravit termíny' })).toBeInTheDocument();
  });

  it('"Otevřít objednávku" and "Upravit termíny" hand over the order', async () => {
    const user = userEvent.setup();
    const h = show();
    await user.click(await screen.findByRole('button', { name: 'Otevřít objednávku' }));
    expect(h.onOpenOrder).toHaveBeenCalledWith(ORDER_ID);
    await user.click(screen.getByRole('button', { name: 'Upravit termíny' }));
    expect(h.onEditTerms).toHaveBeenCalledTimes(1);
    expect(h.onEditTerms.mock.calls[0][0].id).toBe(ORDER_ID);
    expect(h.onOpen).not.toHaveBeenCalled();
  });

  it('without the right to book there is no "Upravit termíny"', async () => {
    show({ onEditTerms: false });
    await screen.findByRole('button', { name: 'Otevřít objednávku' });
    expect(screen.queryByRole('button', { name: 'Upravit termíny' })).toBeNull();
  });

  it('keeps "Otevřít objednávku" when the order itself cannot be read', async () => {
    getOrder.mockRejectedValue(new Error('500'));
    const user = userEvent.setup();
    const h = show();
    await user.click(await screen.findByRole('button', { name: 'Otevřít objednávku' }));
    expect(h.onOpenOrder).toHaveBeenCalledWith(ORDER_ID);
    expect(screen.queryByRole('button', { name: 'Upravit termíny' })).toBeNull();
  });
});

describe('a legacy block (no order)', () => {
  beforeEach(() => setViewport(VIEWPORTS.desktop));

  it('keeps the block wording and "Otevřít blok"', async () => {
    getBlock.mockResolvedValue(win('legacy', '2099-10-26', '2099-11-10', { clubOrderId: null }));
    const user = userEvent.setup();
    const h = show({ id: 'legacy' });
    expect(await screen.findByText(/Blok pro FK Slaný · 26\. 10\. – 10\. 11\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Otevřít objednávku' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Upravit termíny' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Otevřít blok' }));
    expect(h.onOpen).toHaveBeenCalledWith(expect.objectContaining({ clubBlockId: 'legacy' }));
    expect(getOrder).not.toHaveBeenCalled();
  });

  it('falls back to the block wording when the block cannot be read', async () => {
    getBlock.mockRejectedValue(new Error('offline'));
    show({ id: 'x' });
    expect(await screen.findByText(/Blok pro FK Slaný/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Otevřít blok' })).toBeEnabled();
  });
});
