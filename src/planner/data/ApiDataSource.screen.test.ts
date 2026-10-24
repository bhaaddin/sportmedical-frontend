/*
 * The planner screen is optional: `deps.screen` is asked once for a window before the reads, and whatever it does - answers,
 * hangs for a moment, fails - the reads that follow are the ones the source always made.
 */
import { describe, expect, it, vi } from 'vitest';
import { fakeDeps, fakeState, CAL_A } from '../api/testSupport';
import { ApiDataSource } from './ApiDataSource';

const WEEK = { from: '2026-11-02', to: '2026-11-08' };

function make(screen?: (range: { from: string; to: string }, ids?: readonly string[]) => Promise<void>, calendarIds?: string[]) {
  const deps = { ...fakeDeps(fakeState()), ...(screen ? { screen } : {}) };
  return { source: new ApiDataSource({ deps, session: null, today: '2026-11-02', ...(calendarIds ? { calendarIds } : {}) }), deps };
}

describe('planner screen hook of ApiDataSource', () => {
  it('without a screen nothing changes: the board reads as before', async () => {
    const { source, deps } = make();
    await source.listSessions(WEEK);
    expect(deps.screen).toBeUndefined();
  });

  it('asks for the window once per chunk, before the reads, with the calendars it was told to show', async () => {
    const screen = vi.fn(async () => undefined);
    const { source, deps } = make(screen, [CAL_A]);
    const range = vi.spyOn(deps, 'range');
    await source.listSessions(WEEK);
    expect(screen).toHaveBeenCalledTimes(1);
    expect(screen).toHaveBeenCalledWith(WEEK, [CAL_A]);
    expect(screen.mock.invocationCallOrder[0]).toBeLessThan(range.mock.invocationCallOrder[0]!);
  });

  it('day marks ask for the same window', async () => {
    const screen = vi.fn(async () => undefined);
    const { source } = make(screen);
    await source.listDayMarks(WEEK);
    expect(screen).toHaveBeenCalledWith(WEEK, undefined);
  });

  it('a screen that fails does not fail the reads', async () => {
    const { source } = make(() => Promise.reject(new Error('boom')));
    await expect(source.listSessions(WEEK)).resolves.toBeDefined();
    await expect(source.listDayMarks(WEEK)).resolves.toBeDefined();
    await expect(source.getCatalogue()).resolves.toBeDefined();
  });

  it('the catalogue waits for the one answer when a window has asked for it', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { source, deps } = make(() => gate);
    const activities = vi.spyOn(deps, 'activities');
    const pending = Promise.all([source.getCatalogue(), source.listSessions(WEEK)]);
    await new Promise((r) => setTimeout(r, 30));
    expect(activities).not.toHaveBeenCalled();
    release();
    await pending;
    expect(activities).toHaveBeenCalled();
  });
});
