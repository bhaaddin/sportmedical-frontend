/*
 * Etapa 12: the "Sloučit do jedné objednávky" dialog on its own - the default main order, the gating, the body of
 * the merge call, a 409 without a named order, the success, and the layouts (full screen on a phone).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { setViewport, VIEWPORTS } from '../../../test/viewport';

const mergeMock = vi.fn();
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, merge: mergeMock } };
});

const { MergeOrdersDialog, mergeRowText } = await import('./MergeOrdersDialog');
const { defaultMainOrder, groupOrders, mergeableRoots } = await import('./orderGroups');
const { toOrder, ClubOrderError } = await import('../../../api/clubOrders');

const A = 'aaaa0000-0000-0000-0000-0000aaaaaaaa';
const B = 'bbbb0000-0000-0000-0000-0000bbbbbbbb';
const C = 'cccc0000-0000-0000-0000-0000cccccccc';
const block = (id: string, orderId: string, from: string) => ({
  id, clubId: 'club-1', clubOrderId: orderId, clubName: 'FK', colorHex: null, name: null, calendarIds: ['cal'], activityIds: [],
  fromDate: from, toDate: from, dailyFrom: '08:00', dailyTo: '12:00', playerCount: 5, seats: 5, registered: 0,
  status: 'Active', registrationToken: 't', registrationUrl: '', note: null, createdAtUtc: null, athletes: [],
});
const base = { clubId: 'club-1', clubName: 'FK', paymentMethod: 'ClubInvoice', requestedRanges: [], parentOrderId: null, addenda: [] };
const requestedOld = toOrder({ ...base, id: A, groupId: A, serviceName: 'Fyzioterapie', status: 'Requested', totalSeats: 5, createdAtUtc: '2099-01-01T00:00:00Z', activitySeats: [{ activityId: 'f', activityName: 'Fyzio', seats: 5, registered: 0 }], blocks: [] });
const confirmedMid = toOrder({ ...base, id: B, groupId: B, serviceName: 'Prohlídky', status: 'Confirmed', totalSeats: 12, createdAtUtc: '2099-02-01T00:00:00Z', priceQuote: { listTotalCzk: 6000, discounts: [], totalCzk: 6000 }, activitySeats: [{ activityId: 'z', activityName: 'Základní', seats: 12, registered: 0 }], blocks: [block('w1', B, '2099-11-01'), block('w2', B, '2099-11-02')] });
const confirmedNew = toOrder({ ...base, id: C, groupId: C, serviceName: 'Diagnostika', status: 'Confirmed', totalSeats: 8, createdAtUtc: '2099-03-01T00:00:00Z', priceQuote: { listTotalCzk: 4000, discounts: [], totalCzk: 4000 }, activitySeats: [{ activityId: 'd', activityName: 'Diagnostika', seats: 8, registered: 0 }], blocks: [block('w3', C, '2099-11-05')] });

function Wrap({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const onClose = vi.fn();
const onMerged = vi.fn();
const open = (orders = [requestedOld, confirmedMid, confirmedNew]) => render(<Wrap><MergeOrdersDialog orders={orders} onClose={onClose} onMerged={onMerged} /></Wrap>);

beforeEach(() => vi.clearAllMocks());

describe('orderGroups', () => {
  it('folds by groupId, leaves cancelled out, offers only live roots, defaults to the oldest Confirmed', () => {
    const addendum = toOrder({ ...base, id: 'add', parentOrderId: B, groupId: B, status: 'Confirmed', createdAtUtc: '2099-02-02T00:00:00Z', blocks: [] });
    const cancelled = toOrder({ ...base, id: 'x', groupId: 'x', status: 'Cancelled', blocks: [] });
    const completed = toOrder({ ...base, id: 'done', groupId: 'done', status: 'Completed', blocks: [] });
    const groups = groupOrders([addendum, cancelled, confirmedNew, completed, confirmedMid, requestedOld]);
    expect(groups.map((g) => [g.root.id, g.addenda.map((a) => a.id)])).toEqual([[B, ['add']], [C, []], [A, []], ['done', []]]);
    expect(mergeableRoots(groups).map((o) => o.id)).toEqual([A, B, C]);
    expect(defaultMainOrder(mergeableRoots(groups))?.id).toBe(B);
    expect(defaultMainOrder([requestedOld])?.id).toBe(A);
  });

  it('stands an orphaned addendum at the head of its group rather than dropping it', () => {
    const orphan = toOrder({ ...base, id: 'orphan', parentOrderId: 'gone', groupId: 'gone', status: 'Confirmed', blocks: [] });
    const groups = groupOrders([orphan]);
    expect(groups).toHaveLength(1);
    expect(groups[0].root.id).toBe('orphan');
    /* ...but it is not a root, so it cannot be a merge target */
    expect(mergeableRoots(groups)).toEqual([]);
  });

  it('describes a row with code, služba, players, terms and payment', () => {
    expect(mergeRowText(confirmedMid)).toBe('KO-BBBBBBBB · Prohlídky · 12 hráčů · 2 termíny · Platí klub (jedna faktura)');
    expect(mergeRowText(requestedOld)).toBe('KO-AAAAAAAA · Fyzioterapie · 5 hráčů · 0 termínů · Platí klub (jedna faktura)');
  });
});

describe.each(['phone', 'tablet', 'desktop'] as const)('MergeOrdersDialog at %s', (name) => {
  it('defaults the main order to the oldest Confirmed one, lists the others with a checkbox and gates the button', async () => {
    setViewport(VIEWPORTS[name]);
    const user = userEvent.setup();
    open();
    const dialog = screen.getByRole('dialog', { name: 'Sloučit do jedné objednávky' });
    expect(screen.getByTestId('merge-orders-dialog')).toHaveAttribute('data-layout', name);
    expect(within(dialog).getByRole('radio', { name: 'Hlavní objednávka KO-BBBBBBBB' })).toBeChecked();
    expect(within(dialog).getAllByRole('radio')).toHaveLength(3);
    expect(within(dialog).getAllByTestId('merge-pick-row').map((r) => r.getAttribute('data-order-id'))).toEqual([A, C]);
    expect(within(dialog).getByText(/stanou dodatky hlavní objednávky/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Sloučit' });
    expect(confirm).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Sloučit KO-CCCCCCCC' }));
    expect(confirm).toBeEnabled();
    expect(within(dialog).getByTestId('merge-summary')).toHaveTextContent('Po sloučení: Objednávka KO-BBBBBBBB + 1 dodatek · 10 000 Kč');
    /* choosing the ticked one as main un-ticks it and the list changes */
    await user.click(within(dialog).getByRole('radio', { name: 'Hlavní objednávka KO-CCCCCCCC' }));
    expect(within(dialog).getAllByTestId('merge-pick-row').map((r) => r.getAttribute('data-order-id'))).toEqual([A, B]);
    expect(confirm).toBeDisabled();
  });

  it('sends the main id and the ticked ids, then reports success', async () => {
    setViewport(VIEWPORTS[name]);
    const user = userEvent.setup();
    mergeMock.mockResolvedValue(confirmedMid);
    open();
    await user.click(screen.getByRole('checkbox', { name: 'Sloučit KO-AAAAAAAA' }));
    await user.click(screen.getByRole('checkbox', { name: 'Sloučit KO-CCCCCCCC' }));
    await user.click(screen.getByRole('button', { name: 'Sloučit' }));
    await waitFor(() => expect(mergeMock).toHaveBeenCalledWith(B, [A, C]));
    await waitFor(() => expect(onMerged).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a 409 without a named order above the list and lets the desk try again', async () => {
    setViewport(VIEWPORTS[name]);
    const user = userEvent.setup();
    mergeMock.mockRejectedValueOnce(new ClubOrderError('Objednávky patří jinému klubu.', 409, 'club_order.parent_other_club'));
    open();
    await user.click(screen.getByRole('checkbox', { name: 'Sloučit KO-AAAAAAAA' }));
    await user.click(screen.getByRole('button', { name: 'Sloučit' }));
    expect(await screen.findByTestId('merge-error')).toHaveTextContent('Objednávky patří jinému klubu.');
    expect(onMerged).not.toHaveBeenCalled();
    /* the message clears once the choice changes */
    await user.click(screen.getByRole('checkbox', { name: 'Sloučit KO-CCCCCCCC' }));
    expect(screen.queryByTestId('merge-error')).toBeNull();
  });

  it('"Zpět" closes without a call', async () => {
    setViewport(VIEWPORTS[name]);
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'Zpět' }));
    expect(onClose).toHaveBeenCalled();
    expect(mergeMock).not.toHaveBeenCalled();
  });
});
