/*
 * A club block in the club's page: what it shows at the three widths, and the
 * three things an operator does to it - shorten or extend it (a 409 lists the
 * athletes it would hit and waits for a second confirmation) and cancel it
 * (athletes block the button until their reservations are cancelled too).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { pragueWallClockToInstant } from '../../utils/time';
import type { ClubBlockAthlete, ClubBlockView } from '../../api/clubBlocks';
import { athletesToCsv } from './athleteList';

const getBlock = vi.fn();
const update = vi.fn();
const cancel = vi.fn();
const fetchActivities = vi.fn();

vi.mock('../../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubBlocks')>();
  return {
    ...actual,
    clubBlocksApi: { get: getBlock, update, cancel, calculate: vi.fn().mockResolvedValue({}), create: vi.fn(), list: vi.fn() },
    fetchBlockableActivities: fetchActivities,
  };
});
vi.mock('../../api/calendars', () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 'c-1', name: 'Prohlídky', color: '#0D5C52', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 0, clinicServiceId: 's-1' },
    ]),
  },
}));
vi.mock('../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubs')>();
  return { ...actual, clubSettingsApi: { get: vi.fn().mockResolvedValue({ registrationLinkValidityDays: 14, minimumPlayers: null }), put: vi.fn() } };
});

const { ClubBlockPanel } = await import('./ClubBlockPanel');
const { ClubBlockError } = await import('../../api/clubBlocks');

const when = pragueWallClockToInstant('2026-10-26', '11:00').toISOString();

const athlete = (over: Partial<ClubBlockAthlete> = {}): ClubBlockAthlete => ({
  id: 'p1', name: 'Jan Novák', activityName: 'Základní prohlídka', startUtc: when, endUtc: null, status: 'Booked', phone: null, ...over,
});

const block = (over: Partial<ClubBlockView> = {}): ClubBlockView => ({
  id: 'b-1', clubId: 'club-1', clubName: 'FK Slaný', colorHex: '#2E7D6B', name: null, calendarIds: ['c-1'], activityIds: ['a-1'],
  fromDate: '2026-10-26', toDate: '2026-11-03', dailyFrom: null, dailyTo: null, playerCount: 120, seats: 120, registered: 4,
  status: 'Active', registrationToken: 'tok', registrationUrl: 'https://app.test/klub/tok', note: 'Jarní příprava', createdAtUtc: null,
  athletes: [
    athlete({ id: 'p1', phone: '+420 777 123 456' }),
    athlete({ id: 'p2', name: 'Petr Malý', status: 'Attended' }),
  ],
  ...over,
});

function Wrap({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <MemoryRouter><QueryClientProvider client={client}>{children}</QueryClientProvider></MemoryRouter>;
}

const open = (b: ClubBlockView = block(), extra: Record<string, unknown> = {}) =>
  render(<Wrap><ClubBlockPanel block={b} clubName="FK Slaný" contactEmail="klub@fkslany.cz" {...extra} /></Wrap>);

const setDate = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  getBlock.mockReset().mockImplementation(async () => block());
  update.mockReset().mockResolvedValue(block({ toDate: '2026-10-30' }));
  cancel.mockReset().mockResolvedValue(undefined);
  fetchActivities.mockReset().mockResolvedValue([{ id: 'a-1', name: 'Základní prohlídka', durationMinutes: 60, clinicServiceId: 's-1', colorHex: '#2E7D6B', parallelCapacity: 1 }]);
});

describe('what a block shows', () => {
  it('draws status, days, progress, the link and the athletes', async () => {
    open();
    expect(screen.getByRole('heading', { name: 'FK Slaný', level: 3 })).toBeInTheDocument();
    expect(screen.getByText('Aktivní blok')).toBeInTheDocument();
    expect(screen.getByText(/26\.\s?—\s?3\. listopadu 2026|26\. října — 3\. listopadu 2026/)).toBeInTheDocument();
    expect(screen.getByText('Zapsáno 4 z 120 objednaných míst')).toBeInTheDocument();
    expect(screen.getByText('116 volných')).toBeInTheDocument();
    expect(Number(screen.getByRole('progressbar', { name: /Obsazenost bloku FK Slaný/ }).getAttribute('aria-valuenow'))).toBeCloseTo(3.33, 1);
    expect(screen.getByTestId('block-link')).toHaveTextContent('https://app.test/klub/tok');
    expect(screen.getByTestId('block-color')).toHaveAttribute('data-color', '#2E7D6B');
    expect(await screen.findByText('Kalendáře: Prohlídky · Činnosti: Základní prohlídka')).toBeInTheDocument();

    const table = await screen.findByRole('table', { name: /Sportovci v bloku/ });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Zaregistrován')).toBeInTheDocument();
    expect(within(rows[0]).getByRole('link', { name: '+420 777 123 456' })).toHaveAttribute('href', 'tel:+420777123456');
    expect(within(rows[1]).getByText('Dorazil')).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Telefon' })).toBeInTheDocument();
    expect(screen.getByText('Sportovci v bloku (4)')).toBeInTheDocument();
  });

  it.each(['phone', 'tablet', 'desktop'] as const)('shows every athlete\'s price at %s - the agreed one "(upraveno)", the list price, or "bez ceny" (Etapa 12)', async (name) => {
    setViewport(VIEWPORTS[name]);
    const priced = block({
      athletes: [
        athlete({ id: 'p1', name: 'Se slevou', agreedPriceCzk: 1200, listPriceCzk: 1600 }),
        athlete({ id: 'p2', name: 'Ceník', agreedPriceCzk: null, listPriceCzk: 1600 }),
        athlete({ id: 'p3', name: 'Starý server' }),
      ],
    });
    getBlock.mockResolvedValue(priced);
    open(priced);
    await screen.findByText('Se slevou');
    const prices = screen.getAllByTestId('block-athlete-price').map((p) => (p.textContent ?? '').replace(/ /g, ' '));
    expect(prices).toEqual(['1 200 Kč (upraveno)', '1 600 Kč', 'bez ceny']);
  });

  it('copies the registration link', async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    open();
    await user.click(screen.getByRole('button', { name: 'Kopírovat' }));
    expect(write).toHaveBeenCalledWith('https://app.test/klub/tok');
    expect(screen.getByRole('link', { name: 'Poslat klubu' })).toHaveAttribute('href', expect.stringContaining('mailto:klub%40fkslany.cz'));
  });

  it('says so when nobody has registered, and offers no download then', async () => {
    getBlock.mockResolvedValue(block({ registered: 0, athletes: [] }));
    open(block({ registered: 0, athletes: [] }));
    expect(await screen.findByText(/Zatím se nikdo nezaregistroval/)).toBeInTheDocument();
    expect(screen.queryByText(/server zatím nevrací/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stáhnout seznam' })).not.toBeInTheDocument();
  });

  it('keeps the list in time order and lets the term column flip it', async () => {
    const later = pragueWallClockToInstant('2026-10-27', '09:00').toISOString();
    const list = [athlete({ id: 'x', name: 'Později', startUtc: later }), athlete({ id: 'y', name: 'Dříve', startUtc: when }), athlete({ id: 'z', name: 'Bez času', startUtc: null })];
    getBlock.mockResolvedValue(block({ athletes: list }));
    const user = userEvent.setup();
    open(block({ athletes: list }));
    const names = () => screen.getAllByTestId('block-athlete').map((r) => r.querySelector('td')?.textContent);
    await waitFor(() => expect(names()).toEqual(['Dříve', 'Později', 'Bez času']));
    await user.click(screen.getByText('Termín'));
    expect(names()).toEqual(['Později', 'Dříve', 'Bez času']);
  });

  it('downloads the list as a CSV file', async () => {
    const user = userEvent.setup();
    const createUrl = vi.fn().mockReturnValue('blob:csv');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    open();
    await user.click(await screen.findByRole('button', { name: 'Stáhnout seznam' }));
    expect(createUrl).toHaveBeenCalledTimes(1);
    const blob = createUrl.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/csv;charset=utf-8');
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('keeps a cancelled block visible, muted and without actions', () => {
    open(block({ status: 'Cancelled' }));
    expect(screen.getByText('Zrušen')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zrušit blok' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zkrátit' })).not.toBeInTheDocument();
    expect(getBlock).not.toHaveBeenCalled();
  });

  it('says what failed when the athletes cannot be read', async () => {
    getBlock.mockRejectedValue(new ClubBlockError('x', 500));
    open();
    expect(await screen.findByText('Sportovce bloku se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
  });
});

describe('three layouts', () => {
  it('draws a table on tablet and desktop, small cards on a phone', async () => {
    for (const width of [VIEWPORTS.desktop, VIEWPORTS.tablet]) {
      setViewport(width);
      const { unmount } = open();
      expect(await screen.findByRole('table', { name: /Sportovci v bloku/ })).toBeInTheDocument();
      unmount();
    }

    setViewport(VIEWPORTS.phone);
    open();
    const list = await screen.findByRole('list', { name: 'Sportovci v bloku' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    /* Touch targets: the actions are full-height buttons. */
    expect(screen.getByRole('button', { name: 'Zrušit blok' })).toBeInTheDocument();
  });
});

describe('athletes at 390, 834 and 1440', () => {
  it.each([
    ['phone', VIEWPORTS.phone],
    ['tablet', VIEWPORTS.tablet],
    ['desktop', VIEWPORTS.desktop],
  ])('says "Zatím se nikdo nezaregistroval" on %s when the list is empty', async (_name, width) => {
    setViewport(width);
    getBlock.mockResolvedValue(block({ registered: 0, athletes: [] }));
    open(block({ registered: 0, athletes: [] }));
    expect(await screen.findByTestId('block-athletes-empty')).toHaveTextContent('Zatím se nikdo nezaregistroval');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Sportovci v bloku' })).not.toBeInTheDocument();
  });

  it('draws a card per athlete on a phone: name, status, činnost, time and a call link', async () => {
    setViewport(VIEWPORTS.phone);
    open();
    const list = await screen.findByRole('list', { name: 'Sportovci v bloku' });
    const [first, second] = within(list).getAllByRole('listitem');
    expect(first).toHaveTextContent('Jan Novák');
    expect(first).toHaveTextContent('Zaregistrován');
    expect(first).toHaveTextContent('Základní prohlídka');
    expect(within(first).getByRole('link', { name: '+420 777 123 456' })).toHaveAttribute('href', 'tel:+420777123456');
    expect(second).toHaveTextContent('Dorazil');
    expect(within(second).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stáhnout seznam' })).toBeInTheDocument();
  });

  it('shows every status in the table with its Czech word, a cancelled one included', async () => {
    const list = [
      athlete({ id: 'a', name: 'A', status: 'Booked' }), athlete({ id: 'b', name: 'B', status: 'Attended' }),
      athlete({ id: 'c', name: 'C', status: 'NoShow' }), athlete({ id: 'd', name: 'D', status: 'Cancelled' }),
    ];
    getBlock.mockResolvedValue(block({ athletes: list }));
    open(block({ athletes: list }));
    const table = await screen.findByRole('table', { name: /Sportovci v bloku/ });
    for (const word of ['Zaregistrován', 'Dorazil', 'Nedostavil se', 'Zrušeno']) expect(within(table).getByText(word)).toBeInTheDocument();
  });

  it('uses the athletes the list read already carries while the detail loads, and the header count is registered', async () => {
    getBlock.mockImplementation(() => new Promise(() => {}));
    open(block({ registered: 2 }));
    expect(screen.getByText('Sportovci v bloku (2)')).toBeInTheDocument();
  });
});

describe('Zkrátit and Prodloužit', () => {
  it('shortens a block that nobody is hit by', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'Zkrátit' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Zkrátit blok' })).toBeInTheDocument();

    /* Nothing changed yet: the button is off. */
    expect(within(dialog).getByRole('button', { name: 'Zkrátit blok' })).toBeDisabled();
    setDate('Do', '2026-10-30');
    await user.click(within(dialog).getByRole('button', { name: 'Zkrátit blok' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('b-1', { fromDate: '2026-10-26', toDate: '2026-10-30' }, { cancelAthletes: false }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('will not call a longer range "shorter", nor a shorter one "longer"', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'Zkrátit' }));
    setDate('Do', '2026-11-10');
    expect(await screen.findByText(/Zkrácený blok musí ležet uvnitř původního/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zkrátit blok' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Zavřít' }));

    await user.click(screen.getByRole('button', { name: 'Prodloužit' }));
    setDate('Do', '2026-10-30');
    expect(await screen.findByText(/Prodloužený blok musí zahrnovat původní/)).toBeInTheDocument();
    setDate('Do', '2026-11-10');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Prodloužit blok' })).toBeEnabled());
  });

  it('lists the athletes a 409 names, and cancels them only after a second confirmation', async () => {
    update
      .mockRejectedValueOnce(new ClubBlockError('Zkrácení se dotkne 2 sportovců.', 409, [
        { id: 'a1', name: 'Jan Novák', activityName: 'Základní prohlídka', startUtc: when, endUtc: when, status: 'Booked', phone: '' },
        { id: 'a2', name: 'Petr Malý', activityName: '', startUtc: '', endUtc: '', status: 'Booked', phone: '' },
      ]))
      .mockResolvedValue(block({ toDate: '2026-10-28' }));
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'Zkrátit' }));
    setDate('Do', '2026-10-28');
    await user.click(screen.getByRole('button', { name: 'Zkrátit blok' }));

    const list = await screen.findByTestId('block-conflicts');
    expect(list).toHaveTextContent('Zkrácení se dotkne 2 sportovců.');
    expect(list).toHaveTextContent('Dotčení sportovci (2)');
    expect(list).toHaveTextContent('Jan Novák · Základní prohlídka · Po 26. 10. 11:00');
    expect(list).toHaveTextContent('Petr Malý');
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][2]).toEqual({ cancelAthletes: false });

    await user.click(screen.getByRole('button', { name: 'Potvrdit a zrušit rezervace' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update.mock.calls[1]).toEqual(['b-1', { fromDate: '2026-10-26', toDate: '2026-10-28' }, { cancelAthletes: true }]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('withdraws the confirmation when the dates are changed again', async () => {
    update.mockRejectedValue(new ClubBlockError('Dotkne se sportovců.', 409, [athlete({ activityName: '', startUtc: null })]));
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'Zkrátit' }));
    setDate('Do', '2026-10-28');
    await user.click(screen.getByRole('button', { name: 'Zkrátit blok' }));
    await screen.findByTestId('block-conflicts');
    setDate('Do', '2026-10-29');
    await waitFor(() => expect(screen.queryByTestId('block-conflicts')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Zkrátit blok' })).toBeInTheDocument();
  });

  it('shows any other refusal as plain text and stays open', async () => {
    update.mockRejectedValue(new ClubBlockError('Blok už neexistuje.', 404));
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'Zkrátit' }));
    setDate('Do', '2026-10-28');
    await user.click(screen.getByRole('button', { name: 'Zkrátit blok' }));
    expect(await screen.findByText('Blok už neexistuje.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('Zrušit blok', () => {
  it('holds the button until the athletes\' reservations are cancelled too, and says the slots return', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'Zrušit blok' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/vrátí do nabídky kalendářů/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Na blok je registrováno 4 sportovců/)).toBeInTheDocument();

    const confirm = within(dialog).getByRole('button', { name: 'Zrušit blok' });
    expect(confirm).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Zrušit i rezervace registrovaných sportovců' }));
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() => expect(cancel).toHaveBeenCalledWith('b-1', true));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('cancels an empty block at once, without the athletes flag', async () => {
    getBlock.mockResolvedValue(block({ registered: 0, athletes: [] }));
    const user = userEvent.setup();
    open(block({ registered: 0, athletes: [] }));
    await user.click(screen.getByRole('button', { name: 'Zrušit blok' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Zrušit blok' }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith('b-1', false));
  });

  it('a block that belongs to a club order is not cancelled here: it explains and offers the order, never the athletes wording', async () => {
    getBlock.mockResolvedValue(block({ registered: 0, athletes: [], clubOrderId: 'o-1' }));
    const user = userEvent.setup();
    open(block({ registered: 0, athletes: [], clubOrderId: 'o-1' }));
    await user.click(screen.getByRole('button', { name: 'Zrušit blok' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('block-owned-by-order')).toHaveTextContent('termínů klubové objednávky');
    expect(within(dialog).queryByText(/registrovaní sportovci/)).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Otevřít objednávku' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Zrušit blok' })).not.toBeInTheDocument();
  });

  it('a 409 owned_by_order from the server switches the dialog to the order message, not the athletes warning', async () => {
    const owned = new ClubBlockError('Blokace je součástí klubové objednávky.', 409);
    owned.code = 'club_block.owned_by_order';
    cancel.mockRejectedValueOnce(owned);
    getBlock.mockResolvedValue(block({ registered: 0, athletes: [] }));
    const user = userEvent.setup();
    open(block({ registered: 0, athletes: [] }));
    await user.click(screen.getByRole('button', { name: 'Zrušit blok' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Zrušit blok' }));
    expect(await within(dialog).findByTestId('block-owned-by-order')).toBeInTheDocument();
    expect(within(dialog).queryByText(/registrovaní sportovci/)).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Otevřít objednávku' })).toBeInTheDocument();
  });

  it('turns a 409 from a registration that happened meanwhile into the same confirmation', async () => {
    cancel
      .mockRejectedValueOnce(new ClubBlockError('Na blok se mezitím někdo registroval.', 409, [athlete({ activityName: '', startUtc: null })]))
      .mockResolvedValue(undefined);
    getBlock.mockResolvedValue(block({ registered: 0, athletes: [] }));
    const user = userEvent.setup();
    open(block({ registered: 0, athletes: [] }));
    await user.click(screen.getByRole('button', { name: 'Zrušit blok' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Zrušit blok' }));

    expect(await within(dialog).findByTestId('block-conflicts')).toHaveTextContent('Na blok se mezitím někdo registroval.');
    const confirm = within(dialog).getByRole('button', { name: 'Zrušit blok' });
    expect(confirm).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(confirm);
    await waitFor(() => expect(cancel).toHaveBeenLastCalledWith('b-1', true));
  });
});
