import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import type { DayMark, PlannerSession } from '../../model';
import { freeBlocksOfPlannerDay, planNextDay, stillNeededLine } from './addDay';
import { mountPlanner, ownerSource, term } from './testHarness';

beforeEach(() => setViewport(VIEWPORTS.desktop));
afterEach(() => cleanup());

const open = (date: string): DayMark => ({ date, closed: false, hours: { from: '07:00', to: '19:00' }, lunch: { from: '12:00', to: '12:30' } });
const figure = { name: 'Spiroergometrie', slotMinutes: 90, lanes: 1, remaining: 46 };

describe('"Přidat další den" · the next free day, whole slots only', () => {
  it('free time = opening hours without the lunch break and without the terms of the board', () => {
    const sessions: PlannerSession[] = [term('x', '2026-11-19', '09:00', '10:00', 'k', 1, { origin: 'public' })];
    const blocks = freeBlocksOfPlannerDay(open('2026-11-19'), sessions, '2026-11-19');
    expect(blocks.map((b) => [b.range.start, b.range.end])).toEqual([[420, 540], [600, 720], [750, 1140]]);
    expect(freeBlocksOfPlannerDay({ ...open('2026-11-19'), closed: true }, [], '2026-11-19')).toEqual([]);
    expect(freeBlocksOfPlannerDay({ date: '2026-11-21', closed: false, hours: null, lunch: null }, [], '2026-11-21')).toEqual([]);
    expect(freeBlocksOfPlannerDay(undefined, [], '2026-11-21')).toEqual([]);
  });

  it('skips days without hours and closed days; takes only the slots that fit, never more than the players need', () => {
    const marks = Object.fromEntries(
      ['2026-11-23', '2026-11-24'].map((d) => [d, open(d)]).concat([['2026-11-21', { date: '2026-11-21', closed: false, hours: null, lunch: null }]]),
    );
    const plan = planNextDay({ figure, from: '2026-11-21', marks, sessions: [] });
    // Saturday has no hours: Monday 23. 11.; 07:00-12:00 holds 3 spiro slots (270 min), 12:30-19:00 holds 4
    expect(plan).toEqual({ date: '2026-11-23', parts: [{ start: 420, slots: 3 }, { start: 750, slots: 4 }], slots: 7 });
    // only 2 players left: 2 slots from the start of the first block, the rest of the day stays free
    expect(planNextDay({ figure: { ...figure, remaining: 2 }, from: '2026-11-21', marks, sessions: [] })).toEqual({
      date: '2026-11-23',
      parts: [{ start: 420, slots: 2 }],
      slots: 2,
    });
    // nothing free in the next 14 days
    expect(planNextDay({ figure, from: '2026-12-05', marks, sessions: [] })).toBeNull();
    expect(planNextDay({ figure: { ...figure, remaining: 0 }, from: '2026-11-21', marks, sessions: [] })).toBeNull();
  });

  it('says what is still needed: players, hours and whole days', () => {
    expect(stillNeededLine(figure, null)).toBe('ještě 46 hráčů ≈ 69 h');
    expect(stillNeededLine(figure, 660)).toBe('ještě 46 hráčů ≈ 69 h ≈ 7 celých dní při 1 kalendáři');
  });

  it('the button under the active činnost fills the next day through the draft and says so', async () => {
    const source = ownerSource({ sessions: [term('w1', '2026-11-18', '08:00', '14:00', 's', 4)] });
    mountPlanner(source);
    await screen.findByTestId('planning-carousel');
    expect(screen.queryByTestId('add-day')).toBeNull();
    fireEvent.click(document.querySelector('[data-plan-type="s"]')!);
    const button = await screen.findByTestId('add-day');
    expect(button).toHaveAttribute('title', expect.stringContaining('ještě 46 hráčů'));
    fireEvent.click(button);
    await waitFor(() => expect(source.snapshotSessions().filter((s) => s.date === '2026-11-19')).toHaveLength(2));
    const added = source.snapshotSessions().filter((s) => s.date === '2026-11-19');
    expect(added.map((s) => [s.start, s.end, s.capacity])).toEqual([['07:00', '11:30', 3], ['12:30', '18:30', 4]]);
    expect(await screen.findByText(/Přidán Čt 19\. 11\. pro Spiroergometrické vyšetření \(7 slotů\)/)).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('[data-plan-type="s"] .plan-num')).toHaveTextContent('11 / 50'));
  });
});
