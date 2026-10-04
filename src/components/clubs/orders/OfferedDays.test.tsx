/*
 * Etapa 8: the desk offers a club days to choose from - tapping days on the calendar, the week / working-days helpers,
 * the counter and the list, the invite payload with `offeredDates`, and the order detail's offered-vs-chosen block
 * with the PUT. Rendered at the three widths.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { VIEWPORTS, setViewport } from '../../../test/viewport';
import { toOrder } from '../../../api/clubOrders';
import { addDays, addMonths, monthStart, todayIso } from './dayOffer';

const { invite, setOfferedDates, clubsGetAll, servicesList, holidaysYear, toastSuccess } = vi.hoisted(() => ({
  invite: vi.fn(), setOfferedDates: vi.fn(), clubsGetAll: vi.fn(), servicesList: vi.fn(), holidaysYear: vi.fn(), toastSuccess: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({ default: { success: toastSuccess, error: vi.fn() } }));
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, invite, setOfferedDates } };
});
vi.mock('../../../api/clubs', () => ({ clubsApi: { getAll: clubsGetAll } }));
vi.mock('../../../api/clinicServices', () => ({ clinicServicesApi: { list: servicesList } }));
vi.mock('../../../api/holidays', () => ({ holidaysApi: { year: holidaysYear } }));
vi.mock('../../../api/clinicSettings', () => ({ readSettings: vi.fn().mockResolvedValue({}) }));

const { InviteClubDialog } = await import('./InviteClubDialog');
const { OfferedDaysBlock } = await import('./OfferedDaysBlock');

const today = todayIso();
/** A day in the NEXT month (always in the future), so the test taps after one "Další měsíc". */
const nextMonth = monthStart(addMonths(today, 1));
const dayIn = (n: number) => addDays(nextMonth, n - 1);
const cell = (iso: string) => document.querySelector(`[data-date="${iso}"]`) as HTMLButtonElement;

function wrap(ui: ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
}

const order = (over: Record<string, unknown> = {}) => toOrder({
  id: 'o-1', clubId: 'c-1', clubName: 'FK Slaný', status: 'Invited', formUrl: '/klub-objednavka/tok', ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  clubsGetAll.mockResolvedValue([{ id: 'c-1', name: 'FK Slaný', isActive: true }]);
  servicesList.mockResolvedValue([]);
  holidaysYear.mockResolvedValue([]);
});

describe.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)('offering days at %s', (_n, width) => {
  beforeEach(() => setViewport(width));

  async function openOffer(user: ReturnType<typeof userEvent.setup>) {
    wrap(<InviteClubDialog open onClose={() => undefined} defaultClubId="c-1" />);
    await user.click(await screen.findByTestId('offer-toggle'));
    await user.click(screen.getByRole('button', { name: 'Další měsíc' }));
  }

  it('taps days on and off, greys weekends and blocks past days', async () => {
    const user = userEvent.setup();
    await openOffer(user);
    expect(screen.getByTestId('offered-count')).toHaveTextContent('Nabídnuto: 0 dní');
    await user.click(cell(dayIn(10)));
    await user.click(cell(dayIn(11)));
    expect(screen.getByTestId('offered-count')).toHaveTextContent('Nabídnuto: 2 dny');
    expect(within(screen.getByTestId('offered-list')).getAllByRole('listitem')).toHaveLength(2);
    await user.click(cell(dayIn(10))); // tap again removes
    expect(screen.getByTestId('offered-count')).toHaveTextContent('Nabídnuto: 1 den');
    // the list's x removes too
    await user.click(screen.getByRole('button', { name: /^Odebrat/ }));
    expect(screen.getByTestId('offered-count')).toHaveTextContent('Nabídnuto: 0 dní');
    // a weekend is greyed but selectable
    const weekend = Array.from({ length: 14 }, (_, i) => dayIn(i + 1)).find((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 6) as string;
    expect(cell(weekend)).toBeEnabled();
    await user.click(cell(weekend));
    expect(cell(weekend)).toHaveAttribute('data-state', 'on');
    // a past day (previous month, from this month's first day) is inert
    await user.click(screen.getByRole('button', { name: 'Předchozí měsíc' }));
    const past = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-date]')).find((b) => (b.dataset.date as string) < today);
    if (past !== undefined) expect(past).toBeDisabled();
  });

  it('"Přidat celý týden" adds Po–Ne of the last tapped day; "Přidat pracovní dny od–do" adds Po–Pá only', async () => {
    const user = userEvent.setup();
    await openOffer(user);
    await user.click(cell(dayIn(15)));
    await user.click(screen.getByRole('button', { name: 'Přidat celý týden' }));
    expect(screen.getByTestId('offered-count')).toHaveTextContent('Nabídnuto: 7 dní');

    // a span of 14 days a few weeks later: 10 working days
    const start = addDays(dayIn(1), 60);
    fireEvent.change(screen.getByLabelText('Pracovní dny od'), { target: { value: start } });
    fireEvent.change(screen.getByLabelText('Pracovní dny do'), { target: { value: addDays(start, 13) } });
    await user.click(screen.getByRole('button', { name: 'Přidat pracovní dny od–do' }));
    expect(screen.getByTestId('offered-count')).toHaveTextContent('Nabídnuto: 17 dní');
  });

  it('creates the order with offeredDates, and without them when nothing is offered', async () => {
    const user = userEvent.setup();
    invite.mockResolvedValue(order({ offeredDates: [dayIn(10), dayIn(12)] }));
    await openOffer(user);
    await user.click(cell(dayIn(12)));
    await user.click(cell(dayIn(10)));
    await user.click(screen.getByRole('button', { name: 'Vytvořit odkaz' }));
    await waitFor(() => expect(invite).toHaveBeenCalledTimes(1));
    expect(invite.mock.calls[0][0]).toEqual({ clubId: 'c-1', offeredDates: [dayIn(10), dayIn(12)] });
    expect(await screen.findByTestId('invite-offered')).toHaveTextContent('Nabídnuto klubu: 2 dní');
    expect(screen.getByTestId('invite-link')).toBeInTheDocument();
  });

  it('sends no offeredDates when the step is left empty (the club chooses freely)', async () => {
    const user = userEvent.setup();
    invite.mockResolvedValue(order());
    wrap(<InviteClubDialog open onClose={() => undefined} defaultClubId="c-1" />);
    await user.click(await screen.findByRole('button', { name: 'Vytvořit odkaz' }));
    await waitFor(() => expect(invite).toHaveBeenCalledTimes(1));
    expect(invite.mock.calls[0][0]).toEqual({ clubId: 'c-1' });
  });
});

describe('order detail: offered vs chosen', () => {
  beforeEach(() => setViewport(VIEWPORTS.desktop));

  it('shows the offered chips, what the club chose, and saves an edit with PUT offered-dates', async () => {
    const user = userEvent.setup();
    const offered = [dayIn(12), dayIn(13), dayIn(15), dayIn(20)];
    const requested = order({ status: 'Requested', offeredDates: offered, requestedDates: [dayIn(12), dayIn(13), dayIn(15)] });
    setOfferedDates.mockResolvedValue(requested);
    const onChanged = vi.fn();
    wrap(<OfferedDaysBlock order={requested} onChanged={onChanged} />);
    expect(within(screen.getByTestId('order-offered-chips')).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByTestId('order-club-chose')).toHaveTextContent(/Klub vybral: 12\., 13\., 15\./);
    expect(screen.getByTestId('order-club-chose')).toHaveTextContent('3 z 4 nabídnutých');

    await user.click(screen.getByTestId('offered-edit'));
    await user.click(screen.getByRole('button', { name: 'Další měsíc' }));
    await user.click(cell(dayIn(20))); // remove the 20th
    await user.click(screen.getByRole('button', { name: 'Uložit nabídku' }));
    await waitFor(() => expect(setOfferedDates).toHaveBeenCalledWith('o-1', [dayIn(12), dayIn(13), dayIn(15)]));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('is hidden once the order is confirmed and says "nothing offered" when there is no offer', () => {
    const { unmount } = wrap(<OfferedDaysBlock order={order({ status: 'Confirmed' })} onChanged={() => undefined} />);
    expect(screen.queryByTestId('offered-days-block')).not.toBeInTheDocument();
    unmount();
    wrap(<OfferedDaysBlock order={order({ status: 'Invited' })} onChanged={() => undefined} />);
    expect(screen.getByText(/Klubu nic nenabízíte/)).toBeInTheDocument();
    expect(screen.getByTestId('offered-edit')).toHaveTextContent('Nabídnout dny');
  });
});
