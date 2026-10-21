/*
 * UniversalSearch is only the shortcut and the loader: Ctrl/Cmd+K (or any search button in the shell) opens the palette,
 * which is a chunk of its own and is not there until somebody asks.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../api/patients', () => ({ patientsApi: { search: vi.fn().mockResolvedValue([]) } }));
vi.mock('../api/clubs', () => ({ clubsApi: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('../api/billing', () => ({ billingApi: { getInvoices: vi.fn().mockResolvedValue([]) } }));
vi.mock('../api/clinicServices', () => ({ clinicServicesApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('../api/calendar', () => ({ calendarApi: { getAppointments: vi.fn().mockResolvedValue([]) } }));
vi.mock('../api/clubOrders', async (importOriginal) => ({ ...(await importOriginal<typeof import('../api/clubOrders')>()), clubOrdersApi: { list: vi.fn().mockResolvedValue([]) } }));

/* The palette is a lazy chunk; load it once up front so the tests measure the shortcut, not the transform of its imports. */
await import('../ui/shelf/palette/CommandPalette');
const { default: UniversalSearch, OPEN_SEARCH_EVENT, openUniversalSearch } = await import('./UniversalSearch');

const renderSearch = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <UniversalSearch />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['patients.view']));
});

describe('UniversalSearch', () => {
  it('draws nothing, and has not loaded the palette, until it is asked for', () => {
    renderSearch();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Ctrl+K opens the palette once its chunk has arrived, and Ctrl+K again closes it', async () => {
    renderSearch();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(await screen.findByRole('combobox', { name: 'Hledat' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'K', ctrlKey: true });
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Hledat' })).toBeNull());
  });

  it('Cmd+K does the same (a Mac)', async () => {
    renderSearch();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(await screen.findByRole('combobox', { name: 'Hledat' })).toBeInTheDocument();
  });

  it('a search button anywhere in the shell opens it through the named event', async () => {
    renderSearch();
    act(() => openUniversalSearch());
    expect(await screen.findByRole('combobox', { name: 'Hledat' })).toBeInTheDocument();
    expect(OPEN_SEARCH_EVENT).toBe('sm-open-search');
  });

  it('does not steal a K typed with no modifier, or Alt+Ctrl+K', () => {
    renderSearch();
    fireEvent.keyDown(window, { key: 'k' });
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true, altKey: true });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape closes it', async () => {
    renderSearch();
    act(() => openUniversalSearch());
    const input = await screen.findByRole('combobox', { name: 'Hledat' });
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Hledat' })).toBeNull());
  });
});
