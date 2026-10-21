/*
 * Two club screens that need the same list ask the server once: Rezervace and Hráči read the club blocks and the club
 * orders under the SAME query keys the club list and the club's own screen use, so the second screen finds the answer in
 * the cache instead of repeating the request.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const { blocksList, ordersList, calendarsList } = vi.hoisted(() => ({
  blocksList: vi.fn(),
  ordersList: vi.fn(),
  calendarsList: vi.fn(),
}));

vi.mock('../../../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubBlocks')>();
  return { ...actual, clubBlocksApi: { list: blocksList } };
});
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { list: ordersList } };
});
vi.mock('../../../api/calendars', () => ({ calendarsApi: { list: calendarsList } }));
vi.mock('../../../services/socketService', () => ({ socketService: { stop: vi.fn() } }));

const { createQueryClient } = await import('../../../api/queryClient');
const { default: PlayersPage } = await import('../ClubPlayersPage');

const mountOn = (client: ReturnType<typeof createQueryClient>, ui: ReactNode) =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );

describe('club screens share one request per list', () => {
  beforeEach(() => {
    blocksList.mockReset().mockResolvedValue([]);
    ordersList.mockReset().mockResolvedValue([]);
    calendarsList.mockReset().mockResolvedValue([]);
  });

  it('Hráči opened twice: blocks and orders are read once', async () => {
    const client = createQueryClient();

    const first = mountOn(client, <PlayersPage />);
    await waitFor(() => expect(blocksList).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(ordersList).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(client.getQueryState(['club-blocks', 'list'])?.status).toBe('success'));
    first.unmount();

    mountOn(client, <PlayersPage />);
    await waitFor(() => expect(client.getQueryState(['club-orders', '', '', ''])?.status).toBe('success'));
    await screen.findAllByText(/./);

    expect(blocksList).toHaveBeenCalledTimes(1);
    expect(ordersList).toHaveBeenCalledTimes(1);
  });
});
