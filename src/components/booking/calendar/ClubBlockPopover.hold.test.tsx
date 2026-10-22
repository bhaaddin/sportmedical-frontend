/*
 * R13: the club popover of the main calendar says where the hold stands ("Čeká na hráče" / "Obsazeno" / "Hold vypršel"), and offers
 * "Uvolnit nevyplněné" to who may edit bookings - with a confirmation, never silently, and only where the server told us about the hold.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { toOrder } from '../../../api/clubOrders';
import type { ClubBlockView } from '../../../api/clubBlocks';
import type { TimeBlock } from '../../../api/bookingContracts';

const { getBlock, getOrder, release } = vi.hoisted(() => ({ getBlock: vi.fn(), getOrder: vi.fn(), release: vi.fn() }));

vi.mock('../../../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubBlocks')>();
  return { ...actual, clubBlocksApi: { ...actual.clubBlocksApi, get: getBlock } };
});
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, get: getOrder, releaseUnfilled: release } };
});

const { ClubBlockPopover } = await import('./ClubBlockPopover');

const ORDER_ID = '80e74a6c-0000-4000-8000-0000000000aa';
const view = (id: string): ClubBlockView => ({
  id, clubId: 'club-1', clubName: 'FK Slaný', colorHex: '#2E7D6B', name: null, calendarIds: ['cal-1'], activityIds: [], fromDate: '2099-10-29', toDate: '2099-10-29',
  dailyFrom: '08:00', dailyTo: '12:00', playerCount: 0, seats: 0, registered: 0, status: 'Active', registrationToken: null, registrationUrl: null,
  note: null, createdAtUtc: null, athletes: [], clubOrderId: ORDER_ID,
});
const order = toOrder({
  id: ORDER_ID, groupId: ORDER_ID, clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's-1', serviceName: 'Prohlídky', status: 'Confirmed', paymentMethod: 'ClubInvoice',
  totalSeats: 22, registered: 7, activitySeats: [{ activityId: 'a-1', activityName: 'Základní prohlídka', durationMinutes: 30, seats: 22, registered: 7, unitPriceCzk: 200 }], blocks: [view('w1')],
});
const held = (over: Partial<TimeBlock> = {}): TimeBlock =>
  ({ id: 'w1', startUtc: '2099-10-29T07:00:00Z', endUtc: '2099-10-29T11:00:00Z', reason: '', kind: 'club', clubName: 'FK Slaný', clubBlockId: 'w1', clubOrderId: ORDER_ID, orderCode: 'KO-000000AA', seats: 22, registered: 7, playersMissing: true, ...over }) as TimeBlock;

function show(block: TimeBlock | undefined, mayRelease = true) {
  const handlers = { onOpen: vi.fn(), onOpenOrder: vi.fn(), onClose: vi.fn(), onReleased: vi.fn() };
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ClubBlockPopover
        pick={{ clubBlockId: 'w1', clubId: 'club-1', clubName: 'FK Slaný', colorHex: '#2E7D6B', range: { from: '2099-10-29', to: '2099-10-29' }, ...(block ? { block } : {}), x: 200, y: 200 }}
        today="2099-10-01"
        onOpen={handlers.onOpen}
        onOpenOrder={handlers.onOpenOrder}
        onClose={handlers.onClose}
        mayRelease={mayRelease}
        onReleased={handlers.onReleased}
      />
    </QueryClientProvider>,
  );
  return handlers;
}

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  getBlock.mockReset().mockImplementation(async (id: string) => view(id));
  getOrder.mockReset().mockResolvedValue(order);
  release.mockReset().mockResolvedValue({ orderId: ORDER_ID, windowsRemoved: 2, windowsShortened: 1, minutesReleased: 180, stretchesKept: 3, onlyExpired: false, blockCancelled: false });
});

describe('the hold in the popover', () => {
  it('names the state and the seats under the title, with the order code from the block itself', async () => {
    show(held());
    const dialog = await screen.findByRole('dialog', { name: 'Objednávka KO-000000AA · FK Slaný' });
    expect(within(dialog).getByTestId('club-popover-hold')).toHaveTextContent('Čeká na hráče · 7/22 zapsáno');
    expect(within(dialog).getByTestId('club-popover-hold')).toHaveAttribute('data-hold', 'waiting');
  });

  it('"Uvolnit nevyplněné" asks first, then gives the unfilled part back and says what it did', async () => {
    const user = userEvent.setup();
    const handlers = show(held());
    await user.click(await screen.findByTestId('club-release'));
    const confirm = screen.getByTestId('club-popover-release-confirm');
    expect(confirm).toHaveTextContent('Zapsaní hráči a jejich termíny se nemění');
    expect(release).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Uvolnit' }));
    await waitFor(() => expect(release).toHaveBeenCalledWith(ORDER_ID, { onlyExpired: false }));
    expect(await screen.findByTestId('club-popover-released')).toHaveTextContent('Uvolněno 180 min, odstraněno 2, zkráceno 1, ponecháno 3.');
    expect(handlers.onReleased).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('club-release')).toBeNull(); // done: nothing to offer twice
  });

  it('an expired hold also offers "Uvolnit jen vypršené" (only the stretches whose hold ran out)', async () => {
    const user = userEvent.setup();
    show(held({ holdExpired: true, windowEmpty: true }));
    expect(await screen.findByTestId('club-popover-hold')).toHaveTextContent('Hold vypršel');
    await user.click(screen.getByTestId('club-release-expired'));
    await user.click(within(screen.getByTestId('club-popover-release-confirm')).getByRole('button', { name: 'Uvolnit' }));
    await waitFor(() => expect(release).toHaveBeenCalledWith(ORDER_ID, { onlyExpired: true }));
  });

  it('a refused release shows the server\'s sentence and keeps the offer', async () => {
    release.mockRejectedValue(new Error('Objednávka není potvrzená.'));
    const user = userEvent.setup();
    show(held());
    await user.click(await screen.findByTestId('club-release'));
    await user.click(within(screen.getByTestId('club-popover-release-confirm')).getByRole('button', { name: 'Uvolnit' }));
    expect(await screen.findByTestId('club-popover-release-error')).toHaveTextContent('Objednávka není potvrzená.');
    expect(screen.getByTestId('club-release')).toBeInTheDocument();
  });

  it('no action for someone who may not edit bookings, none on an older server (no hold data), and no hold line either', async () => {
    const { unmount } = render(<div />);
    unmount();
    show(held(), false);
    await screen.findByRole('dialog');
    expect(screen.queryByTestId('club-release')).toBeNull();
  });

  it('an older server (the block carries no hold data): no state line, no release', async () => {
    show({ id: 'w1', startUtc: '2099-10-29T07:00:00Z', endUtc: '2099-10-29T11:00:00Z', reason: '', kind: 'club', clubName: 'FK Slaný', clubBlockId: 'w1' } as TimeBlock);
    await screen.findByRole('dialog');
    expect(screen.queryByTestId('club-popover-hold')).toBeNull();
    expect(screen.queryByTestId('club-release')).toBeNull();
  });
});
