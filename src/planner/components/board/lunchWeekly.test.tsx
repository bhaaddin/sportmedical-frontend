/*
 * Per-weekday lunch (R17): "Přesunout každý pátek" writes the weekly break of that weekday, in the period that holds the day, for every
 * open calendar - and says plainly when a calendar has no period or no lunch on that weekday.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const wh = vi.hoisted(() => ({ listPeriods: vi.fn(), listWorkingHours: vi.fn(), updateWorkingHour: vi.fn() }));
vi.mock('../../../api/workingHours', () => ({ workingHoursApi: wh }));

import { moveWeeklyLunch, lunchOutcomeText, weekdayOf } from './lunchActions';
import { LunchPopover } from './LunchPopover';
import { LUNCH_TEXT } from './lunchModel';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'r5', schedulePeriodId: 'p1', dayOfWeek: 5, startTime: '08:00', endTime: '16:00', breakStart: '12:00', breakEnd: '12:30',
  repeatEveryNWeeks: 1, weekOffset: 0, workerUserId: null, workerDisplayName: null, isActive: true, ...over,
});
const targets = [{ id: 'c1', name: 'Fyzio' }, { id: 'c2', name: 'Diagnostika' }];
const FRIDAY = '2026-10-30';

beforeEach(() => {
  vi.clearAllMocks();
  wh.listPeriods.mockResolvedValue([
    { id: 'old', name: 'Léto', validFrom: '2026-06-01', validTo: '2026-08-31' },
    { id: 'p1', name: 'Podzim', validFrom: '2026-09-01', validTo: null },
  ]);
  wh.listWorkingHours.mockResolvedValue([row(), row({ id: 'r4', dayOfWeek: 4 }), row({ id: 'r5b', breakStart: null, breakEnd: null })]);
  wh.updateWorkingHour.mockResolvedValue(row());
});

describe('moveWeeklyLunch', () => {
  it('counts the weekday like the rows do (0 = Sunday)', () => {
    expect(weekdayOf(FRIDAY)).toBe(5);
    expect(weekdayOf('2026-11-01')).toBe(0);
  });

  it('moves the break of that weekday in the period holding the day, keeps its length, for every open calendar', async () => {
    const outcome = await moveWeeklyLunch(targets, FRIDAY, '13:00');
    expect(outcome).toMatchObject({ done: 2, total: 2, errors: [] });
    expect(wh.listWorkingHours).toHaveBeenCalledWith('c1', 'p1');
    expect(wh.updateWorkingHour).toHaveBeenCalledTimes(2);
    expect(wh.updateWorkingHour).toHaveBeenCalledWith('c1', 'r5', expect.objectContaining({ dayOfWeek: 5, startTime: '08:00', endTime: '16:00', breakStart: '13:00', breakEnd: '13:30', repeatEveryNWeeks: 1, isActive: true }));
    expect(wh.updateWorkingHour.mock.calls.map((c) => c[1])).not.toContain('r4');
    expect(wh.updateWorkingHour.mock.calls.map((c) => c[1])).not.toContain('r5b');
  });

  it('refuses a lunch that would leave the working hours, before writing anything', async () => {
    const outcome = await moveWeeklyLunch(targets, FRIDAY, '15:45');
    expect(wh.updateWorkingHour).not.toHaveBeenCalled();
    expect(lunchOutcomeText(outcome, 'ok')).toEqual({ text: LUNCH_TEXT.outsideHours('08:00', '16:00'), tone: 'error' });
  });

  it('says so when a calendar has no period for the day, or no lunch on that weekday', async () => {
    wh.listPeriods.mockResolvedValueOnce([]);
    const noPeriod = await moveWeeklyLunch(targets.slice(0, 1), FRIDAY, '13:00');
    expect(lunchOutcomeText(noPeriod, 'ok').text).toBe(LUNCH_TEXT.weekly.noPeriod);

    wh.listWorkingHours.mockResolvedValueOnce([row({ breakStart: null, breakEnd: null })]);
    const noLunch = await moveWeeklyLunch(targets.slice(0, 1), FRIDAY, '13:00');
    expect(lunchOutcomeText(noLunch, 'ok').text).toBe(LUNCH_TEXT.weekly.noLunch);
  });

  it('a calendar that refused is reported as a partial change', async () => {
    wh.updateWorkingHour.mockResolvedValueOnce(row()).mockRejectedValueOnce(new Error('409'));
    const outcome = await moveWeeklyLunch(targets, FRIDAY, '13:00');
    expect(lunchOutcomeText(outcome, 'ok').text).toBe(LUNCH_TEXT.partial(1, 2));
  });
});

describe('LunchPopover - the weekly button', () => {
  const base = {
    band: { day: FRIDAY, from: '12:00', to: '12:30', state: 'weekly' as const, original: null },
    dateLabel: 'Pá 30. 10.', targets, hours: { from: '08:00', to: '16:00' }, bookings: [], mayEdit: true, mayBook: false,
    point: { x: 10, y: 10 }, onMove: vi.fn(), onRemove: vi.fn(), onRestore: vi.fn(), onBook: vi.fn(), onClose: vi.fn(),
  };

  it('is offered with the weekday named, and sends the typed start', async () => {
    const onMoveWeekly = vi.fn().mockResolvedValue({ ok: true, text: 'ok' });
    render(<LunchPopover {...base} onMoveWeekly={onMoveWeekly} weekday={5} />);
    const go = screen.getByTestId('lunch-move-weekly');
    expect(go).toHaveTextContent('Přesunout každý pátek');
    expect(go).toBeDisabled();
    fireEvent.change(screen.getByTestId('lunch-start'), { target: { value: '13:00' } });
    fireEvent.click(go);
    await waitFor(() => expect(onMoveWeekly).toHaveBeenCalledWith('13:00'));
    expect(screen.getByText(LUNCH_TEXT.weekly.hint('každý pátek'))).toBeInTheDocument();
  });

  it('is not offered without the permission, nor on a day that already carries an exception', () => {
    const { unmount } = render(<LunchPopover {...base} weekday={5} />);
    expect(screen.queryByTestId('lunch-move-weekly')).toBeNull();
    expect(screen.getByText(LUNCH_TEXT.onlyToday)).toBeInTheDocument();
    unmount();
    render(<LunchPopover {...base} band={{ ...base.band, state: 'moved', original: { from: '12:00', to: '12:30' } }} onMoveWeekly={vi.fn()} weekday={5} />);
    expect(screen.queryByTestId('lunch-move-weekly')).toBeNull();
  });
  it('a press inside the pop-out never reaches the board it was opened from (React bubbles through the portal)', () => {
    const boardDown = vi.fn();
    const boardClick = vi.fn();
    render(
      <div onPointerDown={boardDown} onMouseDown={boardDown} onClick={boardClick}>
        <LunchPopover {...base} onMoveWeekly={vi.fn()} weekday={5} />
      </div>,
    );
    const go = screen.getByTestId('lunch-move-go');
    fireEvent.pointerDown(go);
    fireEvent.mouseDown(go);
    fireEvent.click(go);
    expect(boardDown).not.toHaveBeenCalled();
    expect(boardClick).not.toHaveBeenCalled();
  });
});
