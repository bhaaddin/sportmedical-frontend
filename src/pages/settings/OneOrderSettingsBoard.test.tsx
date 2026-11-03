import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const { getSettings, putSettings, getAll } = vi.hoisted(() => ({ getSettings: vi.fn(), putSettings: vi.fn(), getAll: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../api/clubOneOrder', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../api/clubOneOrder')>()), getOneOrderSettings: getSettings, putOneOrderSettings: putSettings }));
vi.mock('../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubs')>();
  return { ...actual, clubsApi: { ...actual.clubsApi, getAll } };
});
const { OneOrderSettingsBoard, toggled } = await import('./OneOrderSettingsBoard');

const mount = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><OneOrderSettingsBoard /></MemoryRouter>
  </QueryClientProvider>,
);

beforeEach(() => {
  getSettings.mockReset(); putSettings.mockReset(); getAll.mockReset();
  getAll.mockResolvedValue([{ id: 'c1', name: 'Sparta' }, { id: 'c2', name: 'Slavia' }]);
  setViewport(VIEWPORTS.desktop);
});

describe('OneOrderSettingsBoard', () => {
  it('is not drawn when the server has no such setting (404)', async () => {
    getSettings.mockResolvedValue(null);
    const { container } = mount();
    await waitFor(() => expect(getSettings).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 30));
    expect(container).toBeEmptyDOMElement();
    expect(getAll).not.toHaveBeenCalled();
  });

  it('shows a switch per club with the explanation and saves the list at once', async () => {
    getSettings.mockResolvedValue({ clubIds: ['c1'] });
    putSettings.mockResolvedValue({ clubIds: ['c1', 'c2'] });
    mount();
    expect(await screen.findByText('Vše nové pro vybrané kluby se přidává do jejich otevřené objednávky.')).toBeInTheDocument();
    expect(screen.getByTestId('one-order-club-c1')).toBeChecked();
    expect(screen.getByTestId('one-order-club-c2')).not.toBeChecked();
    await userEvent.click(screen.getByTestId('one-order-club-c2'));
    await waitFor(() => expect(putSettings).toHaveBeenCalled());
    expect(putSettings.mock.calls[0]![0]).toEqual(['c1', 'c2']);
  });

  it('toggled adds once and removes', () => {
    expect(toggled(['a'], 'b', true)).toEqual(['a', 'b']);
    expect(toggled(['a', 'b'], 'b', true)).toEqual(['a', 'b']);
    expect(toggled(['a', 'b'], 'a', false)).toEqual(['b']);
  });
});
