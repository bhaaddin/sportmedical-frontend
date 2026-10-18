/*
 * What the club list asks the server, card by card: a club that is switched off gets no summary request (its card draws
 * from the block totals), and a card only warms its own screen once the pointer has rested on it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Club } from '../../api/clubs';
import { buildClubRow } from './clubRow';

const { clubSummary } = vi.hoisted(() => ({ clubSummary: vi.fn() }));
vi.mock('../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, clubSummary } };
});

const { ClubCard } = await import('./ClubCard');
const { HOVER_INTENT_MS } = await import('../../api/warmReads');

const club = (over: Partial<Club> = {}): Club => ({
  id: 'club-1', name: 'FK Slaný', ico: '00000019', paymentTermsDays: 14, isActive: true, createdAt: '', ...over,
});

const mount = (c: Club, onPrefetch?: () => void, summaryRequest?: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ClubCard row={buildClubRow(c, [], [], '2026-10-27')} ordersLoading={false} summaryRequest={summaryRequest} onOpen={() => undefined} onPrefetch={onPrefetch} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  clubSummary.mockReset().mockResolvedValue({
    clubId: 'club-1', totalSeats: 0, registered: 0, remaining: 0, byService: [], byActivity: [], ordersByStatus: {}, bookedMinutes: 0, usedMinutes: 0,
  });
});
afterEach(() => vi.useRealTimers());

describe('the summary of a club', () => {
  it('is asked for an active club', async () => {
    mount(club());
    await waitFor(() => expect(clubSummary).toHaveBeenCalledWith('club-1'));
  });

  it('is not asked for a deactivated club', async () => {
    mount(club({ isActive: false }));
    await screen.findByText('FK Slaný');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(clubSummary).not.toHaveBeenCalled();
  });

  it('is not asked per club when the list asks for all of them at once', async () => {
    mount(club(), undefined, false);
    await screen.findByText('FK Slaný');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(clubSummary).not.toHaveBeenCalled();
  });
});

describe('warming the club screen', () => {
  it('starts after the pointer has rested on the card, not on a pass-over', () => {
    vi.useFakeTimers();
    const warm = vi.fn();
    mount(club(), warm);
    const card = screen.getByRole('listitem');

    fireEvent.mouseEnter(card);
    act(() => void vi.advanceTimersByTime(HOVER_INTENT_MS - 50));
    fireEvent.mouseLeave(card);
    act(() => void vi.advanceTimersByTime(500));
    expect(warm).not.toHaveBeenCalled();

    fireEvent.mouseEnter(card);
    act(() => void vi.advanceTimersByTime(HOVER_INTENT_MS + 1));
    expect(warm).toHaveBeenCalledTimes(1);
  });

  it('also starts on keyboard focus, and never for a deactivated club', () => {
    vi.useFakeTimers();
    const warm = vi.fn();
    const first = mount(club(), warm);
    fireEvent.focus(screen.getByRole('listitem'));
    act(() => void vi.advanceTimersByTime(HOVER_INTENT_MS + 1));
    expect(warm).toHaveBeenCalledTimes(1);
    first.unmount();

    const off = vi.fn();
    mount(club({ isActive: false }), off);
    fireEvent.mouseEnter(screen.getByRole('listitem'));
    act(() => void vi.advanceTimersByTime(HOVER_INTENT_MS + 1));
    expect(off).not.toHaveBeenCalled();
  });
});
