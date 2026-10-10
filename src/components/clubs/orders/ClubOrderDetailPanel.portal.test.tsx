/*
 * Etapa 11: what the desk does so that the club's portal says the same as the desk. A change the desk makes carries an
 * optional "Zpráva pro klub" (`clubMessage`, sent only when typed); "Napsat klubu"; "Co vidí klub" (exactly the
 * history the club sees); the club's links shown once, with "Vygenerovat nový odkaz" behind a confirm.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { toOrder } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';

const { get, update, cancel, notice, rotateLinks, invoiceDraft, fetchActivities, toastSuccess, toastError } = vi.hoisted(() => ({
  get: vi.fn(), update: vi.fn(), cancel: vi.fn(), notice: vi.fn(), rotateLinks: vi.fn(), invoiceDraft: vi.fn(), fetchActivities: vi.fn(),
  toastSuccess: vi.fn(), toastError: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({ default: { success: toastSuccess, error: toastError } }));
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, get, update, cancel, notice, rotateLinks, invoiceDraft } };
});
vi.mock('../../../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubBlocks')>();
  return { ...actual, fetchBlockableActivities: fetchActivities };
});
vi.mock('../../../api/clinicSettings', () => ({ readSettings: vi.fn().mockResolvedValue({}) }));
vi.mock('../order/ClubOrderDialog', () => ({ ClubOrderDialog: () => null }));

const { ClubOrderDetailPanel } = await import('./ClubOrderDetailPanel');

const ID = '80e74a6c-0000-4000-8000-000000000001';

const win = (id: string, from: string, to: string) => ({
  id, clubId: 'club-1', clubName: 'FK Slaný', colorHex: null, name: null, calendarIds: ['cal-1'], activityIds: [], fromDate: from, toDate: to,
  dailyFrom: '08:00', dailyTo: '12:00', playerCount: 0, seats: 0, registered: 0, status: 'Active', registrationToken: null, registrationUrl: null,
  note: null, createdAtUtc: null, athletes: [], clubOrderId: ID,
});

const make = (over: Record<string, unknown> = {}): ClubOrderView =>
  toOrder({
    id: ID, groupId: ID, clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's-1', serviceName: 'Sportovní prohlídky',
    status: 'Confirmed', paymentMethod: 'ClubInvoice',
    activitySeats: [
      { activityId: 'a-1', activityName: 'Základní prohlídka', durationMinutes: 30, seats: 10, registered: 0, unitPriceCzk: 200 },
      { activityId: 'a-2', activityName: 'Komplexní prohlídka', durationMinutes: 60, seats: 4, registered: 0, unitPriceCzk: 400 },
    ],
    totalSeats: 14, registered: 0, priceQuote: { listTotalCzk: 4400, discounts: [], totalCzk: 4400 },
    requestedRanges: [], note: '', contact: null, createdBy: 'Staff', history: [], addenda: [],
    formUrl: 'https://app.test/klub-objednavka/ft-1', registrationUrl: 'https://app.test/klub/rt-1',
    blocks: [win('w1', '2099-10-26', '2099-10-27'), win('w2', '2099-10-29', '2099-10-29')],
    ...over,
  });

const ACTIVITIES = [
  { id: 'a-1', name: 'Základní prohlídka', durationMinutes: 30, clinicServiceId: 's-1', colorHex: '#2E7D6B', parallelCapacity: 1 },
  { id: 'a-2', name: 'Komplexní prohlídka', durationMinutes: 60, clinicServiceId: 's-1', colorHex: '#3B6EA8', parallelCapacity: 1 },
];

function mount(order: ClubOrderView) {
  get.mockReset().mockResolvedValue(order);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ClubOrderDetailPanel orderId={order.id} onClose={() => undefined} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  update.mockReset().mockResolvedValue(make());
  cancel.mockReset().mockResolvedValue(make({ status: 'Cancelled' }));
  notice.mockReset();
  rotateLinks.mockReset();
  invoiceDraft.mockReset().mockResolvedValue({ clubId: 'club-1', groupId: ID, paymentMethod: 'ClubInvoice', headcount: 14, lines: [], discounts: [], listTotalCzk: 0, totalCzk: 0, note: '', invoiceId: null, supplementary: false, alreadyInvoiced: [] });
  fetchActivities.mockReset().mockResolvedValue(ACTIVITIES);
  toastSuccess.mockClear();
  toastError.mockClear();
});

describe.each([['phone'], ['tablet'], ['desktop']] as const)('the club message and the portal links · %s', (name) => {
  beforeEach(() => setViewport(VIEWPORTS[name]));

  it('cancel order: the message field has the hint and a counter; cancelling without a message sends none', async () => {
    const user = userEvent.setup();
    mount(make());
    await user.click(within(await screen.findByTestId('order-actions')).getByRole('button', { name: 'Zrušit objednávku' }));
    const dialog = await screen.findByRole('dialog', { name: 'Zrušit objednávku?' });
    expect(within(dialog).getByLabelText('Zpráva pro klub (zobrazí se v portálu klubu)')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Klub uvidí tuto změnu v portálu automaticky.');
    expect(within(dialog).getByTestId('club-message-counter')).toHaveTextContent('0/500');
    await user.click(within(dialog).getByRole('button', { name: 'Ano, zrušit' }));
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
    expect(cancel).toHaveBeenCalledWith(ID, false, false);
  });

  it('cancel order: a typed message is counted and sent as the 4th argument, trimmed', async () => {
    const user = userEvent.setup();
    mount(make());
    await user.click(within(await screen.findByTestId('order-actions')).getByRole('button', { name: 'Zrušit objednávku' }));
    const dialog = await screen.findByRole('dialog', { name: 'Zrušit objednávku?' });
    await user.type(within(dialog).getByLabelText('Zpráva pro klub (zobrazí se v portálu klubu)'), '  Termíny rušíme. ');
    expect(within(dialog).getByTestId('club-message-counter')).toHaveTextContent('18/500');
    await user.click(within(dialog).getByRole('button', { name: 'Ano, zrušit' }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith(ID, false, false, 'Termíny rušíme.'));
  });

  it('cancel order: a message made of blanks is not sent', async () => {
    const user = userEvent.setup();
    mount(make());
    await user.click(within(await screen.findByTestId('order-actions')).getByRole('button', { name: 'Zrušit objednávku' }));
    const dialog = await screen.findByRole('dialog', { name: 'Zrušit objednávku?' });
    await user.type(within(dialog).getByLabelText('Zpráva pro klub (zobrazí se v portálu klubu)'), '    ');
    await user.click(within(dialog).getByRole('button', { name: 'Ano, zrušit' }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith(ID, false, false));
  });

  it('remove window: the message goes into the update next to the remaining ranges', async () => {
    const user = userEvent.setup();
    mount(make());
    await user.click(await screen.findByRole('button', { name: /Odebrat termín Čt 29. 10./ }));
    const dialog = await screen.findByTestId('remove-window-dialog');
    expect(dialog).toHaveTextContent('Klub uvidí tuto změnu v portálu automaticky.');
    await user.type(within(dialog).getByLabelText('Zpráva pro klub (zobrazí se v portálu klubu)'), 'Čtvrtek odpadá.');
    await user.click(within(dialog).getByRole('button', { name: 'Odebrat termín' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][1]).toEqual({
      ranges: [{ fromDate: '2099-10-26', toDate: '2099-10-27', dailyFrom: '08:00', dailyTo: '12:00' }],
      calendarIds: ['cal-1'],
      clubMessage: 'Čtvrtek odpadá.',
    });
  });

  it('remove window: without a message the update carries no clubMessage key at all', async () => {
    const user = userEvent.setup();
    mount(make());
    await user.click(await screen.findByRole('button', { name: /Odebrat termín Čt 29. 10./ }));
    await user.click(within(await screen.findByTestId('remove-window-dialog')).getByRole('button', { name: 'Odebrat termín' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect('clubMessage' in (update.mock.calls[0][1] as object)).toBe(false);
  });

  it('change players: the message goes into the update with the seats, only when typed', async () => {
    const user = userEvent.setup();
    mount(make());
    await user.click(await screen.findByRole('button', { name: 'Odebrat hráče' }));
    const dialog = await screen.findByTestId('change-players-dialog');
    const field = await within(dialog).findByLabelText('Počet hráčů, Základní prohlídka');
    await user.clear(field);
    await user.type(field, '8');
    expect(dialog).toHaveTextContent('Klub uvidí tuto změnu v portálu automaticky.');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][1]).toEqual({ activitySeats: [{ activityId: 'a-1', seats: 8 }, { activityId: 'a-2', seats: 4 }] });
  });

  it('change players: a typed message is sent as clubMessage', async () => {
    const user = userEvent.setup();
    mount(make());
    await user.click(await screen.findByRole('button', { name: 'Odebrat hráče' }));
    const dialog = await screen.findByTestId('change-players-dialog');
    const field = await within(dialog).findByLabelText('Počet hráčů, Základní prohlídka');
    await user.clear(field);
    await user.type(field, '8');
    await user.type(within(dialog).getByLabelText('Zpráva pro klub (zobrazí se v portálu klubu)'), 'Snížili jsme počet na 8.');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][1]).toEqual({
      activitySeats: [{ activityId: 'a-1', seats: 8 }, { activityId: 'a-2', seats: 4 }],
      clubMessage: 'Snížili jsme počet na 8.',
    });
  });

  it('"Napsat klubu": send is disabled until something is typed, then posts the notice and the club sees it under "Co vidí klub"', async () => {
    const user = userEvent.setup();
    mount(make());
    await user.click(await screen.findByTestId('club-visible-toggle'));
    expect(await screen.findByTestId('club-visible-empty')).toHaveTextContent('Klub zatím nevidí žádné změny.');
    const after = make({ history: [{ atUtc: '2026-10-05T09:00:00Z', user: 'Eva', text: 'Zpráva klubu: Přijďte o 10 minut dřív.', visibleToClub: true }] });
    notice.mockImplementation(async () => {
      get.mockResolvedValue(after);
      return after;
    });
    await user.click(within(screen.getByTestId('order-actions')).getByRole('button', { name: 'Napsat klubu' }));
    const dialog = await screen.findByTestId('write-to-club-dialog');
    const send = within(dialog).getByRole('button', { name: 'Odeslat' });
    expect(send).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Zpráva pro klub'), '  Přijďte o 10 minut dřív.  ');
    expect(within(dialog).getByTestId('write-to-club-text-counter')).toHaveTextContent('28/500');
    expect(send).toBeEnabled();
    await user.click(send);
    await waitFor(() => expect(notice).toHaveBeenCalledWith(ID, '  Přijďte o 10 minut dřív.  '.trim()));
    await waitFor(() => expect(screen.queryByTestId('write-to-club-dialog')).not.toBeInTheDocument());
    expect(toastSuccess).toHaveBeenCalledWith('Zpráva je v portálu klubu');
    expect(await screen.findByTestId('club-visible-list')).toHaveTextContent('Přijďte o 10 minut dřív.');
  });

  it('"Napsat klubu": a failure stays in the dialog with the text kept', async () => {
    const user = userEvent.setup();
    mount(make());
    notice.mockRejectedValue(new Error('Server neodpovídá.'));
    await user.click(await screen.findByRole('button', { name: 'Napsat klubu' }));
    const dialog = await screen.findByTestId('write-to-club-dialog');
    await user.type(within(dialog).getByLabelText('Zpráva pro klub'), 'Dobrý den');
    await user.click(within(dialog).getByRole('button', { name: 'Odeslat' }));
    expect(await within(dialog).findByTestId('write-to-club-failure')).toHaveTextContent('Server neodpovídá.');
    expect(within(dialog).getByLabelText('Zpráva pro klub')).toHaveValue('Dobrý den');
  });

  it('"Co vidí klub" lists only the history the club sees, newest first', async () => {
    const user = userEvent.setup();
    mount(make({
      history: [
        { atUtc: '2026-10-01T08:00:00Z', user: 'Eva', text: 'Objednávka potvrzena', visibleToClub: true },
        { atUtc: '2026-10-02T08:00:00Z', user: 'Eva', text: 'Interní poznámka k faktuře', visibleToClub: false },
        { atUtc: '2026-10-03T08:00:00Z', user: 'Eva', text: 'Termín 29. 10. odebrán', visibleToClub: true },
        { atUtc: '2026-10-04T08:00:00Z', user: 'Eva', text: 'Bez příznaku' },
      ],
    }));
    await user.click(await screen.findByTestId('club-visible-toggle'));
    const list = await screen.findByTestId('club-visible-list');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Termín 29. 10. odebrán');
    expect(items[1]).toHaveTextContent('Objednávka potvrzena');
    expect(list).not.toHaveTextContent('Interní poznámka');
    /* the full internal history still shows everything, once opened */
    await user.click(screen.getByTestId('order-history-wrap-toggle'));
    expect(within(await screen.findByTestId('order-history')).getAllByRole('listitem')).toHaveLength(4);
  });

  it('both history blocks start collapsed behind a button, and expand/collapse in place', async () => {
    const user = userEvent.setup();
    mount(make({
      history: [
        { atUtc: '2026-10-01T08:00:00Z', user: 'Eva', text: 'Objednávka potvrzena', visibleToClub: true },
        { atUtc: '2026-10-02T08:00:00Z', user: 'Eva', text: 'Interní poznámka', visibleToClub: false },
      ],
    }));
    const visibleToggle = await screen.findByTestId('club-visible-toggle');
    const historyToggle = await screen.findByTestId('order-history-wrap-toggle');
    /* collapsed by default: the content is not rendered, the button names the count, aria-expanded is false */
    expect(screen.queryByTestId('club-visible-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('order-history')).not.toBeInTheDocument();
    expect(visibleToggle).toHaveTextContent('Zobrazit, co vidí klub (1)');
    expect(historyToggle).toHaveTextContent('Zobrazit historii (2)');
    expect(visibleToggle).toHaveAttribute('aria-expanded', 'false');
    expect(historyToggle).toHaveAttribute('aria-expanded', 'false');
    expect(visibleToggle).toHaveAttribute('aria-controls', 'club-visible');
    expect(historyToggle).toHaveAttribute('aria-controls', 'order-history-wrap');

    await user.click(visibleToggle);
    expect(await screen.findByTestId('club-visible-list')).toBeInTheDocument();
    expect(visibleToggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(visibleToggle);
    expect(screen.queryByTestId('club-visible-list')).not.toBeInTheDocument();
    expect(visibleToggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(historyToggle);
    expect(await screen.findByTestId('order-history')).toBeInTheDocument();
    expect(historyToggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('"Co vidí klub" with no visible history yet still shows a plain button, no count', async () => {
    mount(make({ history: [] }));
    const visibleToggle = await screen.findByTestId('club-visible-toggle');
    expect(visibleToggle).toHaveTextContent('Co vidí klub');
    expect(visibleToggle).not.toHaveTextContent('(0)');
  });

  it('shows the club link and the players\' link once each, with copy', async () => {
    mount(make());
    const links = await screen.findByTestId('club-links');
    expect(within(links).getByTestId('club-portal-url')).toHaveAttribute('data-url', 'https://app.test/klub-objednavka/ft-1');
    expect(within(links).getByTestId('players-url')).toHaveAttribute('data-url', 'https://app.test/klub/rt-1');
    expect(screen.getAllByTestId('club-portal-url')).toHaveLength(1);
    expect(screen.getAllByTestId('players-url')).toHaveLength(1);
    expect(within(links).getByRole('button', { name: 'Zkopírovat: Odkaz pro klub (portál klubu)' })).toBeInTheDocument();
    expect(within(links).getByRole('button', { name: 'Zkopírovat: Odkaz pro hráče a rodiče (registrace)' })).toBeInTheDocument();
  });

  it('an invited order has the form link only; a cancelled one cannot rotate', async () => {
    const view = mount(make({ status: 'Invited', blocks: [] }));
    const links = await screen.findByTestId('club-links');
    expect(within(links).getByRole('button', { name: 'Zkopírovat: Odkaz pro klub (formulář objednávky)' })).toBeInTheDocument();
    expect(within(links).queryByTestId('players-url')).toBeNull();
    expect(screen.queryByTestId('club-visible')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Napsat klubu' })).toBeNull();
    view.unmount();
    mount(make({ status: 'Cancelled' }));
    await screen.findByTestId('club-links');
    expect(screen.queryByTestId('rotate-links')).toBeNull();
  });

  it('"Vygenerovat nový odkaz" asks first: keeping does nothing, confirming rotates and shows the new links', async () => {
    const user = userEvent.setup();
    mount(make());
    await user.click(await screen.findByTestId('rotate-links'));
    const dialog = await screen.findByTestId('rotate-links-dialog');
    expect(dialog).toHaveTextContent('Starý odkaz přestane fungovat. Pokračovat?');
    await user.click(within(dialog).getByRole('button', { name: 'Ponechat' }));
    expect(rotateLinks).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('rotate-links-dialog')).not.toBeInTheDocument());

    const rotated = make({ formUrl: 'https://app.test/klub-objednavka/ft-2', registrationUrl: 'https://app.test/klub/rt-2' });
    rotateLinks.mockImplementation(async () => {
      get.mockResolvedValue(rotated);
      return rotated;
    });
    await user.click(screen.getByTestId('rotate-links'));
    await user.click(within(await screen.findByTestId('rotate-links-dialog')).getByRole('button', { name: 'Vygenerovat nový' }));
    await waitFor(() => expect(rotateLinks).toHaveBeenCalledWith(ID));
    await waitFor(() => expect(screen.getByTestId('club-portal-url')).toHaveAttribute('data-url', 'https://app.test/klub-objednavka/ft-2'));
    expect(screen.getByTestId('players-url')).toHaveAttribute('data-url', 'https://app.test/klub/rt-2');
    expect(toastSuccess).toHaveBeenCalledWith('Nový odkaz je vygenerován');
  });

  it('a failed rotation says so and keeps the dialog open', async () => {
    const user = userEvent.setup();
    mount(make());
    rotateLinks.mockRejectedValue(new Error('Nepodařilo se.'));
    await user.click(await screen.findByTestId('rotate-links'));
    await user.click(within(await screen.findByTestId('rotate-links-dialog')).getByRole('button', { name: 'Vygenerovat nový' }));
    expect(await screen.findByTestId('rotate-links-failure')).toHaveTextContent('Nepodařilo se.');
  });
});
