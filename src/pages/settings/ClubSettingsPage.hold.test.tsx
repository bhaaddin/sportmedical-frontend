/*
 * R13: "Držet čas klubu do X dní před termínem" (`holdUntilDaysBefore`): shown only when the server has the setting, saved as a number
 * 0-365 (0 = never expires), refused otherwise before the server is asked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import ClubSettingsPage, { validateClubSettings } from './ClubSettingsPage';

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubs')>();
  return { ...actual, clubSettingsApi: { get, put } };
});
vi.mock('../../components/settings/changesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../components/settings/changesApi')>();
  return { ...actual, fetchSettingChanges: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/nastaveni/kluby']}>
        <ClubSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const BASE = { registrationLinkValidityDays: 14, minimumPlayers: null, releaseUnusedDaysBefore: null, allowMultiServiceOrders: false };

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  put.mockReset().mockImplementation(async (settings) => settings);
});

describe('holdUntilDaysBefore', () => {
  it('shows the stored 7 days and saves a changed value as a number, carrying the other settings back', async () => {
    get.mockReset().mockResolvedValue({ ...BASE, holdUntilDaysBefore: 7 });
    const user = userEvent.setup();
    renderPage();
    const field = await screen.findByLabelText('Držet čas klubu do X dní před termínem');
    expect(field).toHaveValue('7');
    expect(screen.getByText(/„Hold vypršel“/)).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, '14');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith(expect.objectContaining({ ...BASE, holdUntilDaysBefore: 14 })));
  });

  it('0 means the hold never expires and is a valid answer', async () => {
    get.mockReset().mockResolvedValue({ ...BASE, holdUntilDaysBefore: 7 });
    const user = userEvent.setup();
    renderPage();
    const field = await screen.findByLabelText('Držet čas klubu do X dní před termínem');
    await user.clear(field);
    await user.type(field, '0');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith(expect.objectContaining({ holdUntilDaysBefore: 0 })));
  });

  it('refuses what the server would refuse (not a whole number, more than a year) before asking it', () => {
    const draft = { registrationLinkValidityDays: '14', minimumPlayers: '', releaseUnusedDaysBefore: '', allowMultiServiceOrders: false, payerTextClubInvoice: '', payerTextPerPerson: '' };
    expect(validateClubSettings({ ...draft, holdUntilDaysBefore: '366' }).holdUntilDaysBefore).toMatch(/0 do 365/);
    expect(validateClubSettings({ ...draft, holdUntilDaysBefore: '1,5' }).holdUntilDaysBefore).toMatch(/0 do 365/);
    expect(validateClubSettings({ ...draft, holdUntilDaysBefore: '-1' }).holdUntilDaysBefore).toMatch(/0 do 365/);
    expect(validateClubSettings({ ...draft, holdUntilDaysBefore: '365' }).holdUntilDaysBefore).toBeUndefined();
    expect(validateClubSettings({ ...draft, holdUntilDaysBefore: '0' }).holdUntilDaysBefore).toBeUndefined();
    expect(validateClubSettings(draft).holdUntilDaysBefore).toBeUndefined();
  });

  it('an older server (the field is absent) gets no such field and is never sent one', async () => {
    get.mockReset().mockResolvedValue({ ...BASE });
    const user = userEvent.setup();
    renderPage();
    const days = await screen.findByLabelText('Platnost odkazu');
    expect(screen.queryByLabelText('Držet čas klubu do X dní před termínem')).toBeNull();
    await user.clear(days);
    await user.type(days, '20');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0]![0]).not.toHaveProperty('holdUntilDaysBefore');
  });
});
