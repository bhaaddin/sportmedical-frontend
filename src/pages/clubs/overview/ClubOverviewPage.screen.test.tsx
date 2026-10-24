/*
 * The club page and the one-request club screen (`GET /api/v1/screens/club/{id}`): with patients.view and a server that has it, the
 * page's own reads (club, orders, windows, summary) are not made; with an older server (404), a failed answer or without the
 * permission they are made exactly as before.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../../test/viewport';

const { getById, listOrders, getOrder, clubSummary, listBlocks, getInvoices, get } = vi.hoisted(() => ({
  getById: vi.fn(), listOrders: vi.fn(), getOrder: vi.fn(), clubSummary: vi.fn(), listBlocks: vi.fn(), getInvoices: vi.fn(), get: vi.fn(),
}));

vi.mock('../../../api/client', () => ({ default: { get: (...args: unknown[]) => get(...args) }, client: {} }));
vi.mock('../../../api/clubs', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../api/clubs')>()), clubsApi: { getById } }));
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, list: listOrders, get: getOrder, clubSummary } };
});
vi.mock('../../../api/clubBlocks', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../api/clubBlocks')>()), clubBlocksApi: { list: listBlocks } }));
vi.mock('../../../api/billing', () => ({ billingApi: { getInvoices } }));
vi.mock('../../../api/clinicSettings', () => ({ readSettings: vi.fn().mockResolvedValue({}), readPublicClinic: vi.fn().mockResolvedValue({}) }));
vi.mock('../../../api/warmReads', () => ({ prefetchClubScreen: vi.fn() }));
vi.mock('../PayerDialog', () => ({ PayerDialog: () => null }));
vi.mock('../../../components/clubs/order/ClubOrderEntry', () => ({ ClubOrderEntry: () => null }));

const { default: ClubOverviewPage } = await import('./ClubOverviewPage');
const { resetClubScreenForTests } = await import('../../../api/clubScreen');

const CLUB = { id: 'club-1', name: 'FK Slaný', isActive: true, createdAt: '2026-01-01T00:00:00Z' };
const SUMMARY = { clubId: 'club-1', totalSeats: 20, registered: 7, remaining: 13, byService: [], byActivity: [], ordersByStatus: { Confirmed: 1 }, bookedMinutes: 0, usedMinutes: 0 };
const ok = (data: unknown) => ({ data });

function mount() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <MemoryRouter initialEntries={['/clubs/club-1']}>
        <Routes><Route path="/clubs/:clubId" element={<ClubOverviewPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['patients.view']));
  resetClubScreenForTests();
  get.mockReset();
  getById.mockReset().mockResolvedValue(CLUB);
  listOrders.mockReset().mockResolvedValue([]);
  getOrder.mockReset();
  clubSummary.mockReset().mockResolvedValue(SUMMARY);
  listBlocks.mockReset().mockResolvedValue([]);
  getInvoices.mockReset().mockResolvedValue([]);
  setViewport(VIEWPORTS.desktop);
});

describe('the club page over the club screen', () => {
  it('draws from the one answer and makes none of its own reads', async () => {
    get.mockResolvedValue(ok({ clubId: 'club-1', sections: { club: ok(CLUB), orders: ok([]), clubBlocks: ok([]), summary: ok(SUMMARY) } }));
    mount();

    expect(await screen.findByRole('heading', { level: 1, name: /FK Slaný/ })).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]![0]).toBe('/api/v1/screens/club/club-1');
    expect(getById).not.toHaveBeenCalled();
    expect(listOrders).not.toHaveBeenCalled();
    expect(listBlocks).not.toHaveBeenCalled();
    expect(clubSummary).not.toHaveBeenCalled();
  });

  it('an older server (404): the page reads the club, orders, windows and summary as before', async () => {
    get.mockRejectedValue({ response: { status: 404 } });
    mount();

    expect(await screen.findByRole('heading', { level: 1, name: /FK Slaný/ })).toBeInTheDocument();
    expect(getById).toHaveBeenCalledWith('club-1');
    expect(listOrders).toHaveBeenCalledWith({ clubId: 'club-1' });
    expect(listBlocks).toHaveBeenCalledWith({ clubId: 'club-1' });
    await waitFor(() => expect(clubSummary).toHaveBeenCalledWith('club-1'));
  });

  it('a section the screen could not read: only that read is made by the page', async () => {
    get.mockResolvedValue(ok({ clubId: 'club-1', sections: { club: ok(CLUB), orders: ok([]), clubBlocks: ok([]), summary: { error: { code: 'screen.section_failed', message: 'x' } } } }));
    mount();

    await screen.findByRole('heading', { level: 1, name: /FK Slaný/ });
    await waitFor(() => expect(clubSummary).toHaveBeenCalledWith('club-1'));
    expect(getById).not.toHaveBeenCalled();
    expect(listOrders).not.toHaveBeenCalled();
  });

  it('without patients.view the screen is not asked', async () => {
    localStorage.setItem('permissions', JSON.stringify(['billing.manage']));
    mount();

    expect(await screen.findByRole('heading', { level: 1, name: /FK Slaný/ })).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    expect(getById).toHaveBeenCalledTimes(1);
  });
});
