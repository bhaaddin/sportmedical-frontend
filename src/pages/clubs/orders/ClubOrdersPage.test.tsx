/*
 * Objednávky klubů, clicked through at 390 / 834 / 1440: the list and its filters, the layouts, the detail
 * with the actions each status allows, the invitation flow and the router state the calendar hands over.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { toOrder } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';

const { list, get, invite, cancel, invoiceDraft, getAllClubs, dialogProps, toastSuccess, toastError } = vi.hoisted(() => ({
  list: vi.fn(), get: vi.fn(), invite: vi.fn(), cancel: vi.fn(), invoiceDraft: vi.fn(), getAllClubs: vi.fn(), dialogProps: vi.fn(), toastSuccess: vi.fn(), toastError: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({ default: { success: toastSuccess, error: toastError } }));
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, list, get, invite, cancel, invoiceDraft } };
});
vi.mock('../../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubs')>();
  return { ...actual, clubsApi: { ...actual.clubsApi, getAll: getAllClubs } };
});
vi.mock('../../../api/clinicServices', () => ({
  clinicServicesApi: { list: vi.fn().mockResolvedValue([{ id: 's-1', name: 'Sportovní prohlídky', isActive: true }]) },
}));
vi.mock('../../../api/clinicSettings', () => ({ readSettings: vi.fn().mockResolvedValue({}) }));
vi.mock('../../../components/clubs/order/ClubOrderDialog', () => ({
  ClubOrderDialog: (props: { open: boolean }) => {
    dialogProps(props);
    return props.open ? <div role="dialog" aria-label="Dialog objednávky" /> : null;
  },
}));

const { default: ClubOrdersPage } = await import('./ClubOrdersPage');

const make = (over: Record<string, unknown> = {}): ClubOrderView =>
  toOrder({
    id: 'o-1', clubId: 'club-1', clubName: 'FK Slaný', clubColorHex: '#2E7D6B', serviceId: 's-1', serviceName: 'Sportovní prohlídky',
    status: 'Requested', paymentMethod: 'ClubInvoice',
    activitySeats: [
      { activityId: 'a-1', activityName: 'Základní', durationMinutes: 30, seats: 20, registered: 5, unitPriceCzk: 1000 },
      { activityId: 'a-2', activityName: 'Diagnostika', durationMinutes: 60, seats: 10, registered: 0, unitPriceCzk: 2000 },
    ],
    totalSeats: 30, registered: 5,
    priceQuote: { listTotalCzk: 40000, discounts: [{ kind: 'Team', label: 'Sleva klubu', percent: 10, amountCzk: 4000 }], totalCzk: 36000 },
    requestedRanges: [
      { fromDate: '2026-11-02', toDate: '2026-11-04' }, { fromDate: '2026-11-09', toDate: '2026-11-09' }, { fromDate: '2026-11-16', toDate: '2026-11-16' },
    ],
    blocks: [], note: 'Pozdní příchod', contact: { name: 'Jan Trenér', phone: '+420 603 221 004', email: 'jan@fkslany.cz' },
    formToken: 'ft', formUrl: 'https://app.test/klub-objednavka/ft', registrationToken: 'rt', registrationUrl: 'https://app.test/klub/rt',
    createdBy: 'Club', createdAtUtc: '2026-10-01T10:00:00Z', history: [{ atUtc: '2026-10-01T10:00:00Z', user: 'Klub', text: 'Formulář odeslán' }],
    ...over,
  });

const orders = [
  make(),
  make({ id: 'o-2', clubId: 'club-2', clubName: 'HC Kladno', clubColorHex: null, status: 'Invited', paymentMethod: null, activitySeats: [], totalSeats: 0, registered: 0, priceQuote: null, requestedRanges: [], contact: null, createdAtUtc: '2026-09-30T10:00:00Z' }),
  make({ id: 'o-3', clubName: 'FK Slaný', status: 'Confirmed', registered: 12, createdAtUtc: '2026-09-29T10:00:00Z',
    blocks: [{ id: 'b-1', status: 'Active', fromDate: '2026-11-02', toDate: '2026-11-03', dailyFrom: '08:00', dailyTo: '12:00' }] }),
  make({ id: 'o-4', status: 'Confirmed', paymentMethod: 'PerPerson', registered: 0, createdAtUtc: '2026-09-28T10:00:00Z' }),
  make({ id: 'o-5', status: 'Cancelled', createdAtUtc: '2026-09-27T10:00:00Z' }),
];

function Probe() {
  const location = useLocation();
  return <div data-testid="state">{location.pathname} {JSON.stringify(location.state)}</div>;
}

function Wrap({ children, state = null }: { children: ReactNode; state?: unknown }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: '/clubs/objednavky', state }]}>
        <Routes>
          <Route path="/clubs/objednavky" element={children} />
          <Route path="*" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

let clipboard = vi.fn();
/* user-event installs its own clipboard on setup(), so spy on that one. */
const setupUser = () => {
  const user = userEvent.setup();
  clipboard = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
  return user;
};

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  list.mockReset().mockResolvedValue(orders);
  get.mockReset().mockImplementation(async (id: string) => orders.find((o) => o.id === id));
  invite.mockReset();
  cancel.mockReset().mockResolvedValue(orders[0]);
  invoiceDraft.mockReset().mockResolvedValue({
    clubId: 'club-1', groupId: 'o-3', paymentMethod: 'ClubInvoice', headcount: 30, lines: [{ orderId: 'o-3', serviceName: 'Prohlídky', activityName: 'VO2max', quantity: 30, unitPriceCzk: 1200, totalCzk: 36000 }], discounts: [], listTotalCzk: 36000, totalCzk: 36000, note: '', invoiceId: null, supplementary: false, alreadyInvoiced: [],
  });
  dialogProps.mockClear();
  toastSuccess.mockClear();
  toastError.mockClear();
  getAllClubs.mockReset().mockResolvedValue([
    { id: 'club-1', name: 'FK Slaný', ico: '1', paymentTermsDays: 14, isActive: true, createdAt: '' },
    { id: 'club-2', name: 'HC Kladno', ico: '2', paymentTermsDays: 14, isActive: true, createdAt: '' },
  ]);
});

const lastDialog = () => dialogProps.mock.calls.at(-1)![0] as Record<string, unknown>;

describe.each([
  ['phone', VIEWPORTS.phone, 1],
  ['tablet', VIEWPORTS.tablet, 3],
  ['desktop', VIEWPORTS.desktop, 0],
] as const)('list at %s', (device, width, columns) => {
  beforeEach(() => { setViewport(width); });

  it('draws the layout of the device', async () => {
    render(<Wrap><ClubOrdersPage /></Wrap>);
    const root = await screen.findByTestId('club-orders');
    expect(root).toHaveAttribute('data-layout', device);
    expect(root).toHaveAttribute('data-columns', String(columns));
    if (columns === 0) {
      expect(await screen.findAllByTestId('order-row')).toHaveLength(5);
      expect(screen.queryAllByTestId('order-card')).toHaveLength(0);
      const first = screen.getAllByTestId('order-row')[0];
      expect(first).toHaveTextContent('FK Slaný');
      expect(first).toHaveTextContent('Základní 5/20 · Diagnostika 0/10');
      expect(first).toHaveTextContent('+2');
      expect(first).toHaveTextContent('5 / 30');
      expect(first).toHaveTextContent('Platí klub (jedna faktura)');
      expect(first).toHaveTextContent('36');
      expect(first).toHaveTextContent('Odesláno klubem');
    } else {
      expect(await screen.findAllByTestId('order-card')).toHaveLength(5);
      expect(screen.queryAllByTestId('order-row')).toHaveLength(0);
    }
    if (device === 'phone') expect(screen.getByTestId('pinned-actions')).toBeInTheDocument();
  });
});

describe('filters', () => {
  it('shows the counts on the status chips and filters by status', async () => {
    const user = setupUser();
    render(<Wrap><ClubOrdersPage /></Wrap>);
    await screen.findAllByTestId('order-row');
    const group = screen.getByRole('group', { name: 'Stav objednávky' });
    expect(within(group).getByRole('button', { name: /^Vše\s*5$/ })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: /Čeká na formulář\s*1/ })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: /Potvrzeno\s*2/ })).toBeInTheDocument();
    await user.click(within(group).getByRole('button', { name: /Potvrzeno/ }));
    expect(screen.getAllByTestId('order-row')).toHaveLength(2);
    await user.click(within(group).getByRole('button', { name: /Zrušeno/ }));
    expect(screen.getAllByTestId('order-row')).toHaveLength(1);
  });

  it('asks the server for one club and for a date range', async () => {
    const user = setupUser();
    render(<Wrap><ClubOrdersPage /></Wrap>);
    await screen.findAllByTestId('order-row');
    await user.click(screen.getByLabelText('Klub'));
    await user.click(await screen.findByRole('option', { name: 'HC Kladno' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ clubId: 'club-2' }));
    await user.type(screen.getByLabelText('Termín od'), '2026-11-10');
    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ clubId: 'club-2', from: '2026-11-10' }));
  });

  it('narrows by date range against the terms', async () => {
    const user = setupUser();
    render(<Wrap><ClubOrdersPage /></Wrap>);
    await screen.findAllByTestId('order-row');
    await user.type(screen.getByLabelText('Termín od'), '2027-01-01');
    await waitFor(() => expect(screen.queryAllByTestId('order-row')).toHaveLength(0));
    expect(screen.getByText('Tomuto filtru neodpovídá žádná objednávka.')).toBeInTheDocument();
  });
});

describe('detail and actions', () => {
  const openRow = async (index: number) => {
    const user = setupUser();
    render(<Wrap><ClubOrdersPage /></Wrap>);
    const rows = await screen.findAllByTestId('order-row');
    await user.click(rows[index]);
    const detail = await screen.findByTestId('order-detail');
    return { user, detail };
  };

  it('Requested: summary, requested terms, activities, quote, contact links and process/edit/cancel', async () => {
    const { user, detail } = await openRow(0);
    expect(detail).toHaveAttribute('data-status', 'Requested');
    expect(within(detail).getByTestId('requested-ranges').querySelectorAll('li')).toHaveLength(3);
    expect(within(detail).getAllByTestId('order-activity-row')).toHaveLength(2);
    expect(within(detail).getByTestId('price-quote')).toHaveTextContent('Sleva klubu (10 %)');
    expect(within(detail).getByText('Platí klub (jedna faktura)')).toBeInTheDocument();
    expect(within(detail).getByRole('link', { name: '+420 603 221 004' })).toHaveAttribute('href', 'tel:+420603221004');
    expect(within(detail).getByRole('link', { name: 'jan@fkslany.cz' })).toHaveAttribute('href', 'mailto:jan@fkslany.cz');
    expect(within(detail).getByText('Formulář odeslán')).toBeInTheDocument();

    const actions = screen.getByTestId('order-actions');
    expect(within(actions).getByRole('button', { name: 'Upravit' })).toBeInTheDocument();
    expect(within(actions).getByRole('button', { name: 'Zrušit' })).toBeInTheDocument();
    await user.click(within(actions).getByRole('button', { name: 'Zpracovat' }));
    expect(lastDialog().open).toBe(true);
    expect((lastDialog().processOrder as ClubOrderView).id).toBe('o-1');
    expect(lastDialog().order).toBeUndefined();
  });

  it('Requested: Upravit opens the dialog with the order', async () => {
    const { user } = await openRow(0);
    await user.click(within(screen.getByTestId('order-actions')).getByRole('button', { name: 'Upravit' }));
    expect((lastDialog().order as ClubOrderView).id).toBe('o-1');
    expect(lastDialog().processOrder).toBeUndefined();
  });

  it('Invited: the form link is copied from the links block (once) and the order can be cancelled, nothing else', async () => {
    const { user, detail } = await openRow(1);
    const actions = screen.getByTestId('order-actions');
    expect(within(actions).queryByRole('button', { name: 'Zpracovat' })).toBeNull();
    expect(within(actions).queryByRole('button', { name: /Zkopírovat/ })).toBeNull();
    expect(within(actions).queryByRole('button', { name: 'Napsat klubu' })).toBeNull();
    await user.click(within(detail).getByRole('button', { name: 'Zkopírovat: Odkaz pro klub (formulář objednávky)' }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Odkaz zkopírován'));
    expect(within(actions).getByRole('button', { name: 'Zrušit' })).toBeInTheDocument();
  });

  it('Confirmed with club invoice: windows, edit, athletes link, invoice navigation state', async () => {
    const { user, detail } = await openRow(2);
    expect(within(detail).getByTestId('confirmed-windows')).toHaveTextContent('08:00–12:00');
    const actions = screen.getByTestId('order-actions');
    await user.click(within(actions).getByRole('button', { name: 'Upravit' }));
    expect((lastDialog().order as ClubOrderView).id).toBe('o-3');
    expect(within(actions).queryByRole('button', { name: /Zkopírovat/ })).toBeNull();
    await user.click(within(detail).getByRole('button', { name: 'Zkopírovat: Odkaz pro hráče a rodiče (registrace)' }));
    expect(clipboard).toHaveBeenCalledWith('https://app.test/klub/rt');
    await user.click(within(actions).getByRole('button', { name: 'Vystavit jednu fakturu klubu' }));
    /* Etapa 5: the one-invoice endpoint (draft first), not a prefilled /billing form. */
    expect(await screen.findByRole('dialog', { name: 'Jedna faktura klubu' })).toBeInTheDocument();
    expect(invoiceDraft).toHaveBeenCalledWith('o-3');
  });

  it('Confirmed per person: the invoice button is disabled and says why', async () => {
    await openRow(3);
    const invoice = within(screen.getByTestId('order-actions')).getByRole('button', { name: 'Vystavit jednu fakturu klubu' });
    expect(invoice).toBeDisabled();
    expect(screen.getByTestId('invoice-per-person-hint')).toBeInTheDocument();
  });

  it('Confirmed with athletes: cancelling offers to cancel their reservations', async () => {
    const { user } = await openRow(2);
    await user.click(within(screen.getByTestId('order-actions')).getByRole('button', { name: 'Zrušit objednávku' }));
    const confirm = await screen.findByRole('dialog', { name: 'Zrušit objednávku?' });
    await user.click(within(confirm).getByRole('checkbox', { name: 'Zrušit i jejich rezervace (12)' }));
    await user.click(within(confirm).getByRole('button', { name: 'Ano, zrušit' }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith('o-3', true, false));
  });

  it('Confirmed without athletes: no checkbox, cancels without athletes', async () => {
    const { user } = await openRow(3);
    await user.click(within(screen.getByTestId('order-actions')).getByRole('button', { name: 'Zrušit objednávku' }));
    const confirm = await screen.findByRole('dialog', { name: 'Zrušit objednávku?' });
    expect(within(confirm).queryByRole('checkbox')).toBeNull();
    await user.click(within(confirm).getByRole('button', { name: 'Ano, zrušit' }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith('o-4', false, false));
  });

  it('Cancelled keeps one action: write to the club (its portal shows the notices)', async () => {
    await openRow(4);
    expect(within(screen.getByTestId('order-actions')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Napsat klubu']);
  });

  it('uses a full-screen drawer on a phone', async () => {
    setViewport(VIEWPORTS.phone);
    const user = setupUser();
    render(<Wrap><ClubOrdersPage /></Wrap>);
    await user.click((await screen.findAllByTestId('order-card'))[0]);
    await screen.findByTestId('order-detail');
    expect(document.querySelector('[data-testid="order-drawer"]')).toHaveAttribute('data-layout', 'phone');
  });
});

describe('new order: two ways in', () => {
  it('"Nová objednávka" asks the two-way question', async () => {
    const user = setupUser();
    render(<Wrap><ClubOrdersPage /></Wrap>);
    await screen.findAllByTestId('order-row');
    expect(screen.queryByRole('button', { name: 'Poslat formulář klubu' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Nová objednávka' }));
    const entry = await screen.findByTestId('club-order-entry');
    expect(within(entry).getByRole('button', { name: /Vyplním sám \(telefonická objednávka\)/ })).toBeInTheDocument();
    expect(within(entry).getByRole('button', { name: /Poslat odkaz klubu/ })).toBeInTheDocument();
  });

  it('"Vyplním sám" goes straight to the calendar picking mode', async () => {
    const user = setupUser();
    render(<Wrap><ClubOrdersPage /></Wrap>);
    await screen.findAllByTestId('order-row');
    await user.click(screen.getByRole('button', { name: 'Nová objednávka' }));
    await user.click(await screen.findByTestId('entry-phone'));
    expect(await screen.findByTestId('state')).toHaveTextContent('/planovani {"pickOrder":true}');
  });

  it('"Poslat odkaz klubu" creates an Invited order and shows the short link with one-click Zkopírovat', async () => {
    invite.mockResolvedValue(make({ id: 'o-9', status: 'Invited', clubName: 'HC Kladno', formUrl: 'https://app.test/klub-objednavka/zz' }));
    const user = setupUser();
    render(<Wrap><ClubOrdersPage /></Wrap>);
    await screen.findAllByTestId('order-row');
    await user.click(screen.getByRole('button', { name: 'Nová objednávka' }));
    await user.click(await screen.findByTestId('entry-link'));
    const dialog = await screen.findByRole('dialog', { name: 'Poslat odkaz klubu' });
    expect(within(dialog).getByText(/Nic se neodesílá e-mailem/)).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText('Klub'));
    await user.click(await screen.findByRole('option', { name: 'HC Kladno' }));
    await user.type(within(dialog).getByLabelText('Poznámka (nepovinné)'), 'Podzim');
    await user.click(within(dialog).getByRole('button', { name: 'Vytvořit odkaz' }));
    expect(invite).toHaveBeenCalledWith({ clubId: 'club-2', note: 'Podzim' });
    const link = await within(dialog).findByTestId('invite-link');
    expect(link).toHaveTextContent('app.test/klub-objednavka/zz');
    expect(link).not.toHaveTextContent('https://');
    await user.click(within(dialog).getByRole('button', { name: /Zkopírovat/ }));
    expect(clipboard).toHaveBeenCalledWith('https://app.test/klub-objednavka/zz');
  });
});

describe('router state', () => {
  it('opens the order named by openOrderId', async () => {
    render(<Wrap state={{ openOrderId: 'o-3' }}><ClubOrdersPage /></Wrap>);
    const detail = await screen.findByTestId('order-detail');
    expect(detail).toHaveAttribute('data-status', 'Confirmed');
    expect(get).toHaveBeenCalledWith('o-3');
  });

  it('opens the two-way chooser (never a form with terms) for newOrder', async () => {
    render(<Wrap state={{ newOrder: { clubId: 'club-1' } }}><ClubOrdersPage /></Wrap>);
    const entry = await screen.findByTestId('club-order-entry');
    expect(within(entry).getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByText(/Přidat termín/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Automatický návrh/)).not.toBeInTheDocument();
  });
});

describe('failure', () => {
  it('says so and offers a retry', async () => {
    list.mockRejectedValue(new Error('500'));
    render(<Wrap><ClubOrdersPage /></Wrap>);
    expect(await screen.findByText('Objednávky se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
  });
});
