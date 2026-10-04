/*
 * Etapa 6: the club-block dialog starts with Služba. Until a service is chosen (or a calendar ticked, which names it)
 * no činnost is offered; choosing a service lists its calendars and its činnosti only, and changing it clears the rest.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const fetchActivities = vi.fn();

vi.mock('../../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubBlocks')>();
  return {
    ...actual,
    clubBlocksApi: { calculate: vi.fn().mockResolvedValue({}), create: vi.fn(), update: vi.fn(), list: vi.fn(), get: vi.fn(), cancel: vi.fn() },
    fetchBlockableActivities: fetchActivities,
  };
});
vi.mock('../../api/calendars', () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 'c-1', name: 'Prohlídky', color: '#0D5C52', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 0, clinicServiceId: 's-1' },
      { id: 'c-2', name: 'Spiroergometrie', color: '#2B5C9B', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 1, clinicServiceId: 's-2' },
    ]),
  },
}));
vi.mock('../../api/clinicServices', () => ({
  clinicServicesApi: {
    list: vi.fn().mockResolvedValue([
      { id: 's-1', name: 'Sportovní prohlídky', description: '', sortOrder: 0, isActive: true, activities: 2, calendars: 1, colorHex: '#2E7D6B' },
      { id: 's-2', name: 'Diagnostika', description: '', sortOrder: 1, isActive: true, activities: 1, calendars: 1, colorHex: '#3B6EA8' },
    ]),
  },
}));
vi.mock('../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubs')>();
  return { ...actual, clubsApi: { create: vi.fn(), getAll: vi.fn(), update: vi.fn(), deactivate: vi.fn() }, clubSettingsApi: { get: vi.fn().mockResolvedValue({ registrationLinkValidityDays: 14, minimumPlayers: null }), put: vi.fn() } };
});

const { ClubBlockDialog } = await import('./ClubBlockDialog');

const clubs = [{ id: 'club-1', name: 'FK Slaný', ico: '00000019', paymentTermsDays: 14, isActive: true, createdAt: '2026-01-01T00:00:00Z' }];

function open() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ClubBlockDialog clubs={clubs} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchActivities.mockReset().mockResolvedValue([
    { id: 'a-1', name: 'Základní prohlídka', durationMinutes: 60, clinicServiceId: 's-1', colorHex: '#2E7D6B', parallelCapacity: 2 },
    { id: 'a-2', name: 'Spiroergometrie', durationMinutes: 45, clinicServiceId: 's-2', colorHex: '#3B6EA8', parallelCapacity: 1 },
  ]);
});

describe.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)('block dialog service first · %s', (_n, width) => {
  beforeEach(() => setViewport(width));

  it('asks Služba above the calendars and činnosti, gates the činnosti, and narrows calendars to the chosen service', async () => {
    const user = userEvent.setup();
    open();
    const service = await screen.findByRole('combobox', { name: 'Služba' });
    const calendars = await screen.findByRole('group', { name: 'Kalendáře' });
    expect(service.compareDocumentPosition(calendars) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await screen.findByTestId('activities-hint')).toHaveTextContent('Nejdřív vyberte službu');

    await user.click(service);
    await user.click(await screen.findByRole('option', { name: 'Diagnostika' }));
    const cals = within(await screen.findByRole('group', { name: 'Kalendáře' }));
    expect(cals.getByRole('checkbox', { name: /Spiroergometrie/ })).toBeInTheDocument();
    expect(cals.queryByRole('checkbox', { name: /Prohlídky/ })).toBeNull();
    const acts = within(await screen.findByRole('group', { name: 'Činnosti' }));
    expect(await acts.findByRole('checkbox', { name: /Spiroergometrie/ })).toBeInTheDocument();
    expect(acts.queryByRole('checkbox', { name: /Základní prohlídka/ })).toBeNull();
  });
});
