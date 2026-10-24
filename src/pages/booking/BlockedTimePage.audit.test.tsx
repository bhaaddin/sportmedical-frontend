/*
 * Settings audit (20. 10. 2026) - Pauzy a přestávky (/blokovany-cas).
 *
 * Measured on the dev API (POST /api/calendars/{id}/blocks):
 *   end before start -> 422 scheduling.range.end_before_start
 *   empty reason     -> 422 scheduling.block.reason_required
 *   reason over 300  -> 422 scheduling.text.too_long
 *   overlapping a block -> 409 "Tento čas už je obsazený."
 *   a time without the Z -> 422 scheduling.range.not_utc
 *
 * The clinic works in Prague time, so the list shows Prague dates and the form
 * starts on the Prague day - whatever zone the browser happens to be set to.
 * The test below runs the page in New York to hold that: the date column used
 * the browser's own calendar day while the time next to it was Prague's.
 */
process.env.TZ = 'America/New_York';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../../test/auditHarness';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const listBlocks = vi.fn();
const createBlock = vi.fn();
const deleteBlock = vi.fn();

vi.mock('../../api/calendars', () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 'c1', name: 'Diagnostika', color: '#0D7377', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 0, clinicServiceId: 's1', publicMinimumNoticeMinutes: null, publicHorizonDays: null },
      { id: 'c2', name: 'InBody', color: '#2563EB', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 1, clinicServiceId: 's1', publicMinimumNoticeMinutes: null, publicHorizonDays: null },
    ]),
  },
}));
vi.mock('../../api/appointments', () => ({ appointmentsApi: { blocks: listBlocks, createBlock, deleteBlock } }));

const { default: BlockedTimePage } = await import('./BlockedTimePage');

const block = (over: Record<string, unknown> = {}) => ({
  id: 'b1', calendarId: 'c1', startUtc: '2026-12-01T12:00:00Z', endUtc: '2026-12-01T13:00:00Z', reason: 'Servis přístroje', kind: 'manual', clubBlockId: null, clubName: null, colorHex: null, ...over,
});

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  listBlocks.mockReset().mockResolvedValue([]);
  createBlock.mockReset().mockResolvedValue(block());
  deleteBlock.mockReset().mockResolvedValue(undefined);
});

describe('the zone of the test', () => {
  it('really runs in New York, otherwise the Prague assertions below prove nothing', () => {
    expect(new Date('2026-12-01T12:00:00Z').getHours()).toBe(7);
  });
});

describe('the list', () => {
  it('no longer warns that a blocked time stays among the free slots (the server takes it off: 17 -> 15 slots on the dev API)', async () => {
    renderScreen(<BlockedTimePage />, '/blokovany-cas');
    await screen.findByRole('combobox', { name: 'Kalendář' });
    expect(screen.queryByText(/nezmizí ze seznamu volných termínů/)).not.toBeInTheDocument();
  });

  it('shows the Prague date and time of a block, not the browser’s', async () => {
    /* 23:30 UTC on 1 Dec is 00:30 on 2 Dec in Prague and 18:30 on 1 Dec in New York. */
    listBlocks.mockResolvedValue([block({ startUtc: '2026-12-01T23:30:00Z', endUtc: '2026-12-02T00:30:00Z' })]);
    renderScreen(<BlockedTimePage />, '/blokovany-cas');
    const row = (await screen.findByText('Servis přístroje')).closest('[data-card="block"]') as HTMLElement;
    expect(within(row).getByText(/2\. ?12\. ?2026/)).toBeInTheDocument();
    expect(within(row).getByText(/00:30–01:30/)).toBeInTheDocument();
  });

  it('sorts the blocks by their start', async () => {
    listBlocks.mockResolvedValue([
      block({ id: 'late', reason: 'Pozdě', startUtc: '2026-12-03T10:00:00Z', endUtc: '2026-12-03T11:00:00Z' }),
      block({ id: 'early', reason: 'Brzy', startUtc: '2026-12-01T10:00:00Z', endUtc: '2026-12-01T11:00:00Z' }),
    ]);
    renderScreen(<BlockedTimePage />, '/blokovany-cas');
    await screen.findByText('Brzy');
    const reasons = Array.from(document.querySelectorAll('[data-card="block"]')).map((card) => card.querySelector('span')?.textContent);
    expect(reasons).toEqual(['Brzy', 'Pozdě']);
  });

  it('asks for a window from 30 days back to 180 ahead, in the Prague calendar', async () => {
    renderScreen(<BlockedTimePage />, '/blokovany-cas');
    await waitFor(() => expect(listBlocks).toHaveBeenCalled());
    const [calendarId, from, to] = listBlocks.mock.calls[0];
    expect(calendarId).toBe('c1');
    expect((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000).toBe(210);
  });

  it('reads the blocks of the calendar that was picked', async () => {
    const user = userEvent.setup();
    renderScreen(<BlockedTimePage />, '/blokovany-cas');
    await user.click(await screen.findByRole('combobox', { name: 'Kalendář' }));
    await user.click(screen.getByRole('option', { name: 'InBody' }));
    await waitFor(() => expect(listBlocks.mock.calls.some((call) => call[0] === 'c2')).toBe(true));
  });

  it('releases a block with one click and reads the list again', async () => {
    listBlocks.mockResolvedValue([block()]);
    const user = userEvent.setup();
    renderScreen(<BlockedTimePage />, '/blokovany-cas');
    await user.click(await screen.findByRole('button', { name: 'Uvolnit čas' }));
    await waitFor(() => expect(deleteBlock).toHaveBeenCalledWith('c1', 'b1'));
    await waitFor(() => expect(listBlocks.mock.calls.length).toBeGreaterThan(1));
  });
});

describe('a new block', () => {
  const open = async () => {
    const user = userEvent.setup();
    renderScreen(<BlockedTimePage />, '/blokovany-cas');
    await user.click(await screen.findByRole('button', { name: 'Zablokovat čas' }));
    return { user, dialog: await screen.findByRole('dialog') };
  };

  it('starts on the Prague day, 08:00 to 09:00', async () => {
    const { dialog } = await open();
    const prague = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date());
    expect(within(dialog).getByLabelText('Datum')).toHaveValue(prague);
    expect(within(dialog).getByLabelText('Od')).toHaveValue('08:00');
    expect(within(dialog).getByLabelText('Do')).toHaveValue('09:00');
  });

  it('needs a reason, and says so', async () => {
    const { dialog } = await open();
    expect(within(dialog).getByRole('button', { name: 'Zablokovat' })).toBeDisabled();
    expect(within(dialog).getByText(/důvod/i, { selector: '.MuiAlert-message' })).toBeInTheDocument();
  });

  it('refuses an end that is not after the start', async () => {
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText('Důvod'), 'Porada');
    const to = within(dialog).getByLabelText('Do');
    await user.clear(to);
    await user.type(to, '08:00');
    expect(within(dialog).getByRole('button', { name: 'Zablokovat' })).toBeDisabled();
  });

  it('sends Prague wall-clock times as UTC instants (13:00-14:00 in winter is 12:00-13:00Z)', async () => {
    const { user, dialog } = await open();
    const date = within(dialog).getByLabelText('Datum');
    await user.clear(date);
    await user.type(date, '2026-12-01');
    for (const [label, value] of [['Od', '13:00'], ['Do', '14:00']]) {
      const field = within(dialog).getByLabelText(label);
      await user.clear(field);
      await user.type(field, value);
    }
    await user.type(within(dialog).getByLabelText('Důvod'), '  Servis  ');
    await user.click(within(dialog).getByRole('button', { name: 'Zablokovat' }));
    await waitFor(() => expect(createBlock).toHaveBeenCalled());
    const [calendarId, start, end, reason] = createBlock.mock.calls[0];
    expect(calendarId).toBe('c1');
    expect(new Date(start).toISOString()).toBe('2026-12-01T12:00:00.000Z');
    expect(new Date(end).toISOString()).toBe('2026-12-01T13:00:00.000Z');
    expect(reason).toBe('Servis');
  });

  it('keeps 13:00 on the clock-change day 25. 10. 2026 at 13:00 (an earlier version stored 12:00)', async () => {
    const { user, dialog } = await open();
    const date = within(dialog).getByLabelText('Datum');
    await user.clear(date);
    await user.type(date, '2026-10-25');
    const from = within(dialog).getByLabelText('Od');
    await user.clear(from);
    await user.type(from, '13:00');
    const to = within(dialog).getByLabelText('Do');
    await user.clear(to);
    await user.type(to, '14:00');
    await user.type(within(dialog).getByLabelText('Důvod'), 'Porada');
    await user.click(within(dialog).getByRole('button', { name: 'Zablokovat' }));
    await waitFor(() => expect(createBlock).toHaveBeenCalled());
    expect(new Date(createBlock.mock.calls[0][1]).toISOString()).toBe('2026-10-25T12:00:00.000Z');
  });

  it('stops the reason at the 300 characters the server keeps', async () => {
    const { dialog } = await open();
    expect(within(dialog).getByLabelText('Důvod')).toHaveAttribute('maxlength', '300');
  });

  it('shows the server’s 409 for an overlapping block inside the dialog and keeps what was typed', async () => {
    const { BookingApiError } = await import('../../api/apiError');
    createBlock.mockRejectedValue(new BookingApiError('conflict', 409, 'Tento čas už je obsazený.'));
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText('Důvod'), 'Porada');
    await user.click(within(dialog).getByRole('button', { name: 'Zablokovat' }));
    expect(await within(dialog).findByText('Tento čas už je obsazený.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Důvod')).toHaveValue('Porada');
  });

  it('sends one request for a double click', async () => {
    let finish: (value: unknown) => void = () => undefined;
    createBlock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText('Důvod'), 'Porada');
    await user.dblClick(within(dialog).getByRole('button', { name: 'Zablokovat' }));
    expect(createBlock).toHaveBeenCalledTimes(1);
    finish(block());
  });
});
