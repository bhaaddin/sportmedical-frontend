/*
 * "Termíny bloku": several separate ranges for one club in one dialog.
 *
 * The clock is pinned to 4. 10. 2026 (Date only, so user-event and waitFor keep
 * running) so "in the past" means the same thing on every day the suite runs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import type { Calculation, ClubBlockView } from '../../api/clubBlocks';

const calculate = vi.fn();
const create = vi.fn();
const fetchActivities = vi.fn();
const settingsGet = vi.fn();

vi.mock('../../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubBlocks')>();
  return {
    ...actual,
    clubBlocksApi: { calculate, create, update: vi.fn(), list: vi.fn(), get: vi.fn(), cancel: vi.fn() },
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
  return { ...actual, clubsApi: { create: vi.fn(), getAll: vi.fn(), update: vi.fn(), deactivate: vi.fn() }, clubSettingsApi: { get: settingsGet, put: vi.fn() } };
});

const { ClubBlockDialog } = await import('./ClubBlockDialog');
const { ClubBlockError } = await import('../../api/clubBlocks');

const club = (id: string, name: string) => ({ id, name, ico: '00000019', paymentTermsDays: 14, isActive: true, createdAt: '2026-01-01T00:00:00Z' });
const clubs = [club('club-1', 'FK Slaný')];

const calc = (over: Partial<Calculation> = {}): Calculation => ({
  minutesPerPlayer: 60, parallelCapacity: 2, neededMinutes: 3600, dailyOpenMinutes: 600,
  suggestedDays: 7, suggestedFrom: '2026-10-26', suggestedTo: '2026-11-03', fitsHorizon: true, minimumPlayers: null, belowMinimum: false,
  perDay: [{ date: '2026-10-26', openMinutes: 600 }, { date: '2026-10-27', openMinutes: 600 }], ...over,
});

const made = (over: Partial<ClubBlockView> = {}): ClubBlockView => ({
  id: 'b-1', clubId: 'club-1', clubName: 'FK Slaný', colorHex: '#2E7D6B', name: null, calendarIds: ['c-1'], activityIds: ['a-1'],
  fromDate: '2026-10-26', toDate: '2026-10-28', dailyFrom: null, dailyTo: null, playerCount: 20, seats: 20, registered: 0,
  status: 'Active', registrationToken: 'tok', registrationUrl: 'https://app/klub/tok', note: null, createdAtUtc: null, athletes: [], ...over,
});

function Wrap({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const RANGES = [
  { fromDate: '2026-10-26', toDate: '2026-10-26', dailyFrom: '08:00', dailyTo: '12:00' },
  { fromDate: '2026-10-28', toDate: '2026-10-28', dailyFrom: '14:00', dailyTo: '18:00' },
  { fromDate: '2026-11-02', toDate: '2026-11-08' },
];

const open = (props: Partial<Parameters<typeof ClubBlockDialog>[0]> = {}) =>
  render(<Wrap><ClubBlockDialog clubs={clubs} onClose={vi.fn()} {...props} /></Wrap>);

const prefillRanges = { clubId: 'club-1', calendarIds: ['c-1'], ranges: RANGES };

async function ready(user: ReturnType<typeof userEvent.setup>, players = '20') {
  await user.type(screen.getByLabelText('Počet hráčů'), players);
  await user.click(await within(await screen.findByRole('group', { name: 'Činnosti' })).findByRole('checkbox', { name: /Základní prohlídka/ }));
}
const setField = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const norm = (el: HTMLElement) => el.textContent?.replace(/\s/g, ' ');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-04T10:00:00+02:00'));
  setViewport(VIEWPORTS.desktop);
  calculate.mockReset().mockResolvedValue(calc());
  create.mockReset().mockResolvedValue(made());
  settingsGet.mockReset().mockResolvedValue({ registrationLinkValidityDays: 14, minimumPlayers: null });
  fetchActivities.mockReset().mockResolvedValue([
    { id: 'a-1', name: 'Základní prohlídka', durationMinutes: 60, clinicServiceId: 's-1', colorHex: '#2E7D6B', parallelCapacity: 2 },
  ]);
});
afterEach(() => vi.useRealTimers());

describe.each([
  ['phone', VIEWPORTS.phone],
  ['tablet', VIEWPORTS.tablet],
  ['desktop', VIEWPORTS.desktop],
])('rows at %s width', (_name, width) => {
  beforeEach(() => setViewport(width));

  it('adds a row after the previous end, never removes the last one, and sorts on save', async () => {
    const user = userEvent.setup();
    open({ prefill: { clubId: 'club-1', calendarIds: ['c-1'], fromDate: '2026-11-10', toDate: '2026-11-12' } });
    await ready(user);
    expect(screen.queryByRole('button', { name: /Odebrat termín/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Přidat další termín' }));
    expect(screen.getAllByTestId('block-term')).toHaveLength(2);
    expect(screen.getByLabelText('Od, termín 2')).toHaveValue('2026-11-13');

    /* An earlier second row: sent before the first one. */
    setField('Od, termín 2', '2026-10-26');
    setField('Do, termín 2', '2026-10-27');
    await user.click(screen.getByRole('button', { name: 'Vytvořit bloky (2)' }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(create.mock.calls.map((c) => c[0].fromDate)).toEqual(['2026-10-26', '2026-11-10']);
  });

  it('removes a row', async () => {
    const user = userEvent.setup();
    open({ prefill: prefillRanges });
    expect(screen.getAllByTestId('block-term')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Odebrat termín 2' }));
    expect(screen.getAllByTestId('block-term')).toHaveLength(2);
    expect(screen.getByLabelText('Od, termín 2')).toHaveValue('2026-11-02');
  });
});

describe('overlaps', () => {
  it('names the other row at the row and refuses to send', async () => {
    const user = userEvent.setup();
    open({ prefill: { clubId: 'club-1', calendarIds: ['c-1'], ranges: [{ fromDate: '2026-10-26', toDate: '2026-10-30' }, { fromDate: '2026-10-29', toDate: '2026-11-02' }] } });
    await ready(user);
    const rows = screen.getAllByTestId('block-term');
    expect(rows[0]).toHaveTextContent('Tento termín se překrývá s řádkem 2');
    expect(rows[1]).toHaveTextContent('Tento termín se překrývá s řádkem 1');
    await user.click(screen.getByRole('button', { name: 'Vytvořit bloky (2)' }));
    expect(create).not.toHaveBeenCalled();

    setField('Od, termín 2', '2026-10-31');
    expect(screen.queryByText(/překrývá/)).not.toBeInTheDocument();
  });

  it('treats a duplicate row as an overlap', () => {
    open({ prefill: { ranges: [RANGES[0], RANGES[0]] } });
    expect(screen.getAllByText(/Tento termín se překrývá s řádkem/)).toHaveLength(2);
  });
});

describe('past dates', () => {
  it('warns at the row, disables saving and fixes it with "Posunout na dnešek"', async () => {
    const user = userEvent.setup();
    open({ prefill: { clubId: 'club-1', calendarIds: ['c-1'], fromDate: '2026-09-30', toDate: '2026-10-02' } });
    await ready(user);
    expect(screen.getByText('Termín začíná v minulosti')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vytvořit blok' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Posunout na dnešek' }));
    expect(screen.getByLabelText('Od')).toHaveValue('2026-10-04');
    expect(screen.getByLabelText('Do')).toHaveValue('2026-10-04');
    expect(screen.queryByText('Termín začíná v minulosti')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vytvořit blok' })).toBeEnabled();
  });

  it('keeps a later end when moving the start to today', async () => {
    const user = userEvent.setup();
    open({ prefill: { fromDate: '2026-09-30', toDate: '2026-10-09' } });
    await user.click(screen.getByRole('button', { name: 'Posunout na dnešek' }));
    expect(screen.getByLabelText('Do')).toHaveValue('2026-10-09');
  });

  it("shows the server's own refusal at the row", async () => {
    create.mockRejectedValue(new ClubBlockError('Blokace nemůže začínat v minulosti.', 400));
    const user = userEvent.setup();
    open({ prefill: { clubId: 'club-1', calendarIds: ['c-1'], fromDate: '2026-10-04', toDate: '2026-10-05' } });
    await ready(user);
    await user.click(screen.getByRole('button', { name: 'Vytvořit blok' }));
    const row = await screen.findByTestId('block-term');
    expect(await within(row).findByText('Blokace nemůže začínat v minulosti.')).toBeInTheDocument();
  });
});

describe('what the dialog opens with', () => {
  it('shows every range of the router state, `ranges` winning over the single fields', () => {
    open({ prefill: { ...prefillRanges, fromDate: '2027-01-01', toDate: '2027-01-02' } });
    expect(screen.getAllByTestId('block-term')).toHaveLength(3);
    expect(screen.getByLabelText('Od, termín 1')).toHaveValue('2026-10-26');
    expect(screen.getByLabelText('Denně od, termín 1')).toHaveValue('08:00');
    expect(screen.getByLabelText('Denně do, termín 2')).toHaveValue('18:00');
    expect(screen.getByLabelText('Do, termín 3')).toHaveValue('2026-11-08');
  });

  it('still reads the old single fields as one range', () => {
    open({ prefill: { fromDate: '2026-10-26', toDate: '2026-10-28', dailyFrom: '08:00', dailyTo: '12:00' } });
    expect(screen.getAllByTestId('block-term')).toHaveLength(1);
    expect(screen.getByLabelText('Od')).toHaveValue('2026-10-26');
    expect(screen.getByLabelText('Denně do')).toHaveValue('12:00');
  });
});

describe('creating several blocks', () => {
  it('stops at the failing row, keeps the first one and on retry sends only the missing one', async () => {
    create
      .mockResolvedValueOnce(made({ id: 'b-1', fromDate: '2026-10-26', toDate: '2026-10-26' }))
      .mockRejectedValueOnce(new ClubBlockError('V tom termínu už je jiný blok.', 409))
      .mockResolvedValue(made({ id: 'b-2', fromDate: '2026-10-28', toDate: '2026-10-28', registrationUrl: 'https://app/klub/t2' }));
    const user = userEvent.setup();
    open({ prefill: { clubId: 'club-1', calendarIds: ['c-1'], ranges: RANGES.slice(0, 2) } });
    await ready(user);

    await user.click(screen.getByRole('button', { name: 'Vytvořit bloky (2)' }));
    await waitFor(() => expect(screen.getByText('V tom termínu už je jiný blok.')).toBeInTheDocument());
    const rows = screen.getAllByTestId('block-term');
    expect(within(rows[1]).getByText('V tom termínu už je jiný blok.')).toBeInTheDocument();
    expect(within(rows[0]).getByText('vytvořeno ✓')).toBeInTheDocument();
    expect(within(rows[0]).getByLabelText('Od, termín 1')).toBeDisabled();
    expect(create).toHaveBeenCalledTimes(2);

    /* Retry: only the missing row; the button counts what is left. */
    await user.click(screen.getByRole('button', { name: 'Vytvořit bloky (1)' }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(3));
    expect(create.mock.calls.map((c) => c[0].fromDate)).toEqual(['2026-10-26', '2026-10-28', '2026-10-28']);
    expect(await screen.findByTestId('club-block-results')).toBeInTheDocument();
  });

  it('ends on a result screen with every range, every link and a copy-all button', async () => {
    create
      .mockResolvedValueOnce(made({ id: 'b-1', fromDate: '2026-10-26', toDate: '2026-10-28', registrationUrl: 'https://app/klub/t1' }))
      .mockResolvedValueOnce(made({ id: 'b-2', fromDate: '2026-11-02', toDate: '2026-11-08', registrationUrl: 'https://app/klub/t2' }));
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    open({ onSaved, onClose, prefill: { clubId: 'club-1', calendarIds: ['c-1'], ranges: [{ fromDate: '2026-10-26', toDate: '2026-10-28' }, { fromDate: '2026-11-02', toDate: '2026-11-08' }] } });
    await ready(user);
    await user.click(screen.getByRole('button', { name: 'Vytvořit bloky (2)' }));

    const results = await screen.findAllByTestId('club-block-result');
    expect(results).toHaveLength(2);
    expect(within(results[0]).getByTestId('block-link')).toHaveTextContent('https://app/klub/t1');
    expect(within(results[1]).getByTestId('block-link')).toHaveTextContent('https://app/klub/t2');
    expect(onClose).not.toHaveBeenCalled();

    await user.click(within(results[0]).getByRole('button', { name: /Kopírovat/ }));
    expect(await navigator.clipboard.readText()).toBe('https://app/klub/t1');

    await user.click(screen.getByRole('button', { name: 'Kopírovat všechny odkazy' }));
    expect(await navigator.clipboard.readText()).toBe('26. 10. – 28. 10.: https://app/klub/t1\n2. 11. – 8. 11.: https://app/klub/t2');

    await user.click(screen.getByRole('button', { name: 'Hotovo' }));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'b-1' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('the calculator over all rows', () => {
  const perDayByFrom = (from: string) =>
    from === '2026-10-26'
      ? [{ date: '2026-10-26', openMinutes: 600 }, { date: '2026-10-27', openMinutes: 600 }, { date: '2026-10-28', openMinutes: 600 }]
      : [{ date: '2026-11-02', openMinutes: 600 }, { date: '2026-11-03', openMinutes: 600 }];
  const twoRows = { clubId: 'club-1', calendarIds: ['c-1'], ranges: [{ fromDate: '2026-10-26', toDate: '2026-10-27' }, { fromDate: '2026-11-02', toDate: '2026-11-02' }] };

  it('calls once per row and sums the open minutes inside each row against the one need', async () => {
    calculate.mockImplementation(async (input: { fromDate?: string }) => calc({ neededMinutes: 3600, perDay: perDayByFrom(input.fromDate ?? '') }));
    const user = userEvent.setup();
    open({ prefill: twoRows });
    await ready(user);

    const box = await screen.findByTestId('coverage');
    await waitFor(() => expect(norm(box)).toContain('Vybrané termíny pojmou 1 800 min z potřebných 3 600 min'));
    expect(box).toHaveAttribute('data-state', 'short');
    const froms = calculate.mock.calls.map((c) => c[0].fromDate);
    expect(froms).toContain('2026-10-26');
    expect(froms).toContain('2026-11-02');
    /* A warning only: saving is not blocked. */
    expect(screen.getByRole('button', { name: 'Vytvořit bloky (2)' })).toBeEnabled();
  });

  it('turns green when the rows together are enough', async () => {
    calculate.mockImplementation(async (input: { fromDate?: string }) => calc({ neededMinutes: 1800, perDay: perDayByFrom(input.fromDate ?? '') }));
    const user = userEvent.setup();
    open({ prefill: twoRows });
    await ready(user);
    await waitFor(() => expect(screen.getByTestId('coverage')).toHaveAttribute('data-state', 'enough'));
  });

  it('"Použít návrh" fills the first row only', async () => {
    const user = userEvent.setup();
    open({ prefill: { clubId: 'club-1', calendarIds: ['c-1'], ranges: [{ fromDate: '2026-10-05', toDate: '2026-10-05' }, { fromDate: '2026-11-02', toDate: '2026-11-02' }] } });
    await ready(user);
    await user.click(await screen.findByRole('button', { name: 'Použít návrh' }));
    expect(screen.getByLabelText('Od, termín 1')).toHaveValue('2026-10-26');
    expect(screen.getByLabelText('Do, termín 1')).toHaveValue('2026-11-03');
    expect(screen.getByLabelText('Od, termín 2')).toHaveValue('2026-11-02');
  });
});
