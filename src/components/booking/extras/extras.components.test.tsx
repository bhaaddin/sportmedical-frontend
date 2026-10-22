/*
 * R15c component checks: the discount chips under the price, the same-day notice, the patient picker finding a number, the
 * "nearest free" search of one činnost. (The models are in extras.test.ts.)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

const readGroupDiscounts = vi.fn();
const range = vi.fn();
const list = vi.fn();
const getAvailability = vi.fn();

vi.mock('../../../api/groupDiscounts', async (importActual) => ({ ...(await importActual<typeof import('../../../api/groupDiscounts')>()), readGroupDiscounts }));
vi.mock('../../../api/appointments', () => ({ appointmentsApi: { range, getAvailability } }));
vi.mock('../../../api/patients', () => ({ patientsApi: { list, getProfile: vi.fn() } }));

const { DiscountPresets } = await import('./DiscountPresetChips');
const { SameDayNotice } = await import('./SameDayNotice');
const { PatientSearch } = await import('../patient/PatientSearch');
const { nearestFreeFor } = await import('./nearestFreeSearch');
const { AgreedPriceField } = await import('../price/AgreedPriceField');
const { priceView } = await import('../price/agreedPrice');

const wrap = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

beforeEach(() => {
  readGroupDiscounts.mockReset().mockResolvedValue({ settings: { tiers: [{ minHeadcount: 5, maxHeadcount: null, percent: 15 }] }, defaults: { tiers: [] }, maxTiers: 6 });
  range.mockReset();
  list.mockReset();
  getAvailability.mockReset();
});

/** The dialog's own wiring of the field and the chips, with the price and the reason as state. */
function PriceHarness({ list: listPrice = 1600, allowFree = true }: { list?: number | null; allowFree?: boolean }) {
  const [typed, setTyped] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const view = priceView({ listPriceCzk: listPrice, typed });
  return (
    <>
      <AgreedPriceField
        value={{ listPriceCzk: listPrice, typed }}
        onChange={setTyped}
        reason={reason}
        onReasonChange={setReason}
        extras={<DiscountPresets listPriceCzk={listPrice} typed={typed} onPick={setTyped} reason={reason} allowFree={allowFree} />}
      />
      <output data-testid="sent">{view.agreedPriceCzk === null ? 'list' : String(view.agreedPriceCzk)}</output>
    </>
  );
}

describe('R15c (a) discount chips', () => {
  it('5 %, 10 % and the group tier from the settings fill the editable price; the field stays editable and resettable', async () => {
    const user = userEvent.setup();
    wrap(<PriceHarness />);
    await screen.findByTestId('discount-group-15');
    expect(screen.getByTestId('discount-pct-5')).toHaveTextContent('−5 %');
    await user.click(screen.getByTestId('discount-pct-10'));
    expect(screen.getByLabelText('Cena')).toHaveValue('1440');
    expect(screen.getByTestId('sent')).toHaveTextContent('1440');
    expect(screen.getByTestId('discount-pct-10')).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByTestId('discount-group-15'));
    expect(screen.getByLabelText('Cena')).toHaveValue('1360'); // from the LIST price, not compounded on 1440
    await user.clear(screen.getByLabelText('Cena'));
    await user.type(screen.getByLabelText('Cena'), '1300');
    expect(screen.getByTestId('sent')).toHaveTextContent('1300');
    expect(screen.getByTestId('discount-group-15')).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: 'Vrátit ceník' }));
    expect(screen.getByTestId('sent')).toHaveTextContent('list');
  });

  it('pressing the chip that is on puts the list price back', async () => {
    const user = userEvent.setup();
    wrap(<PriceHarness />);
    await user.click(await screen.findByTestId('discount-pct-5'));
    expect(screen.getByTestId('sent')).toHaveTextContent('1520');
    await user.click(screen.getByTestId('discount-pct-5'));
    expect(screen.getByTestId('sent')).toHaveTextContent('list');
  });

  it('zdarma is 0 Kč and says it needs a reason until one is typed', async () => {
    const user = userEvent.setup();
    wrap(<PriceHarness />);
    await user.click(await screen.findByTestId('discount-free'));
    expect(screen.getByTestId('sent')).toHaveTextContent('0');
    expect(screen.getByTestId('discount-free-reason')).toBeInTheDocument();
    await user.type(screen.getByTestId('agreed-price-reason'), 'zaměstnanec');
    expect(screen.queryByTestId('discount-free-reason')).toBeNull();
  });

  it('draws nothing without a list price, and no zdarma where a reason cannot travel; a failing settings read keeps 5 % / 10 %', async () => {
    readGroupDiscounts.mockRejectedValue(new Error('offline'));
    const { unmount } = wrap(<PriceHarness list={null} />);
    expect(screen.queryByTestId('discount-presets')).toBeNull();
    unmount();
    wrap(<PriceHarness allowFree={false} />);
    await screen.findByTestId('discount-pct-10');
    expect(screen.queryByTestId('discount-free')).toBeNull();
    expect(screen.queryByTestId('discount-group-15')).toBeNull();
  });
});

describe('R15c (c) same-day notice', () => {
  const row = (id: string, patientId: string, startUtc: string, status = 0) => ({ id, calendarId: 'c1', patientId, activityName: 'Spiroergometrie', startUtc, endUtc: startUtc, status });

  it('names the other booking of the patient that day with its time and činnost, and links to the card without the patient in a query', async () => {
    range.mockResolvedValue([row('a', 'p1', '2026-12-10T08:00:00Z'), row('b', 'p2', '2026-12-10T09:00:00Z'), row('c', 'p1', '2026-12-10T09:00:00Z', 4)]);
    wrap(<SameDayNotice patientId="p1" date="2026-12-10" calendarIds={['c1', 'c2']} />);
    const notice = await screen.findByTestId('same-day-notice');
    expect(notice).toHaveTextContent('Pacient už má ten den rezervaci: 09:00 Spiroergometrie.');
    expect(screen.getByRole('link', { name: 'Otevřít kartu pacienta' })).toHaveAttribute('href', '/patients/p1');
    expect(range).toHaveBeenCalledWith('2026-12-10', '2026-12-10', ['c1', 'c2']);
  });

  it('says nothing when there is nothing to say, and never blocks (no buttons)', async () => {
    range.mockResolvedValue([row('b', 'p2', '2026-12-10T09:00:00Z')]);
    wrap(<SameDayNotice patientId="p1" date="2026-12-10" calendarIds={['c1']} />);
    await waitFor(() => expect(range).toHaveBeenCalled());
    expect(screen.queryByTestId('same-day-notice')).toBeNull();
  });

  it('is silent when the day cannot be read', async () => {
    range.mockRejectedValue(new Error('offline'));
    wrap(<SameDayNotice patientId="p1" date="2026-12-10" calendarIds={['c1']} />);
    await waitFor(() => expect(range).toHaveBeenCalled());
    expect(screen.queryByTestId('same-day-notice')).toBeNull();
  });
});

describe('R15c (f) the patient picker finds a number', () => {
  const person = (id: string, last: string, phone: string | null) => ({ id, firstName: 'Jan', lastName: last, fullName: `Jan ${last}`, dateOfBirth: '1990-01-01', phone });

  it('matches +420 / spaces / no prefix, reads the register WITHOUT a query parameter and never puts the number anywhere', async () => {
    list.mockResolvedValue({ items: [person('1', 'Novák', '+420 777 123 456'), person('2', 'Svoboda', '602111222'), person('3', 'Bez', null)], totalCount: 3, page: 1, pageSize: 100 });
    const user = userEvent.setup();
    const onPick = vi.fn();
    wrap(<PatientSearch enabled mayRegister onPick={onPick} />);
    await user.type(screen.getByLabelText('Jméno nebo příjmení'), '777 123');
    const found = await screen.findByText('Jan Novák');
    expect(screen.queryByText('Jan Svoboda')).toBeNull();
    expect(list).toHaveBeenCalled();
    for (const call of list.mock.calls) {
      expect(JSON.stringify(call)).not.toMatch(/777|query/);
    }
    await user.click(found);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  it('the same number typed with the country prefix finds the same row', async () => {
    list.mockResolvedValue({ items: [person('1', 'Novák', '777123456')], totalCount: 1, page: 1, pageSize: 100 });
    const user = userEvent.setup();
    wrap(<PatientSearch enabled mayRegister onPick={vi.fn()} />);
    await user.type(screen.getByLabelText('Jméno nebo příjmení'), '+420777123');
    expect(await screen.findByText('Jan Novák')).toBeInTheDocument();
  });

  it('a name is still the name search (the query goes to the server, no register scan)', async () => {
    list.mockResolvedValue({ items: [person('1', 'Novák', '777123456')], totalCount: 1, page: 1, pageSize: 50 });
    const user = userEvent.setup();
    wrap(<PatientSearch enabled mayRegister onPick={vi.fn()} />);
    await user.type(screen.getByLabelText('Jméno nebo příjmení'), 'Novák');
    await screen.findByText('Jan Novák');
    expect(list.mock.calls.every(([arg]) => (arg as { query?: string }).query === 'Novák')).toBe(true);
  });

  it('a register larger than the scan says it searched only the first part', async () => {
    list.mockImplementation(async ({ page }: { page: number }) => ({
      items: Array.from({ length: 100 }, (_, i) => person(`${page}-${i}`, `P${page}-${i}`, i === 0 && page === 1 ? '777999888' : null)),
      totalCount: 5000,
      page,
      pageSize: 100,
    }));
    const user = userEvent.setup();
    wrap(<PatientSearch enabled mayRegister onPick={vi.fn()} />);
    await user.type(screen.getByLabelText('Jméno nebo příjmení'), '777999');
    await screen.findByText('Jan P1-0');
    expect(await screen.findByText(/Prohledáno prvních 1000 pacientů/)).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(10);
  });
});

describe('R15c (b) the nearest free start of a činnost', () => {
  it('asks the server for that činnost window by window and returns the first later start', async () => {
    getAvailability
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ startUtc: '2026-12-29T08:00:00Z' }, { startUtc: '2026-12-28T10:00:00Z' }]);
    const found = await nearestFreeFor('c1', 'a1', new Date('2026-12-10T07:00:00Z'));
    expect(found).toEqual({ date: '2026-12-28', time: '11:00', startUtc: '2026-12-28T10:00:00Z' });
    expect(getAvailability).toHaveBeenNthCalledWith(1, 'c1', 'a1', '2026-12-10', '2026-12-23', { staffStarts: true });
    expect(getAvailability).toHaveBeenNthCalledWith(2, 'c1', 'a1', '2026-12-24', '2027-01-06', { staffStarts: true });
  });

  it('gives up after four windows with null (nothing is invented)', async () => {
    getAvailability.mockResolvedValue([]);
    expect(await nearestFreeFor('c1', 'a1', new Date('2026-12-10T07:00:00Z'))).toBeNull();
    expect(getAvailability).toHaveBeenCalledTimes(4);
  });

  it('a start in the past of today is not "nearest"', async () => {
    getAvailability.mockResolvedValueOnce([{ startUtc: '2026-12-10T06:00:00Z' }, { startUtc: '2026-12-10T12:00:00Z' }]);
    expect((await nearestFreeFor('c1', 'a1', new Date('2026-12-10T07:00:00Z')))?.startUtc).toBe('2026-12-10T12:00:00Z');
  });
});
