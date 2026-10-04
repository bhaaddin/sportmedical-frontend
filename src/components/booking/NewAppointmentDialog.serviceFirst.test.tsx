/*
 * Etapa 6: in the staff booking drawer the order is Služba -> Činnost. The činnosti offered are those of the chosen
 * service only; until one is chosen there are none (a single service is preselected).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../test/viewport';

vi.setConfig({ testTimeout: 20000 });

const listCalendars = vi.fn();
const listActivities = vi.fn();
const listServices = vi.fn();
const preview = vi.fn();

vi.mock('../../api/calendars', () => ({ calendarsApi: { list: listCalendars } }));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../../api/clinicServices', () => ({ clinicServicesApi: { list: listServices } }));
vi.mock('../../api/workingHours', () => ({ workingHoursApi: { preview } }));
vi.mock('../../api/appointments', () => ({
  appointmentsApi: { getAvailability: vi.fn().mockResolvedValue([]), create: vi.fn(), createUnregistered: vi.fn(), createQuick: vi.fn() },
}));
vi.mock('../../api/patients', () => ({ patientsApi: { list: vi.fn().mockResolvedValue({ items: [], totalCount: 0 }), getProfile: vi.fn(), getById: vi.fn() } }));
vi.mock('../../api/patientPreRegistration', () => ({ patientPreRegistrationApi: { issueLink: vi.fn() } }));
vi.mock('../../services/clubsApi', () => ({ clubsApi: { getAll: vi.fn().mockResolvedValue([]) } }));

const { NewAppointmentDialog } = await import('./NewAppointmentDialog');

const ACTIVITIES = [
  { id: 'a1', name: 'Základní', durationMinutes: 30, isActive: true, priceCzk: 1600, clinicServiceId: 's1' },
  { id: 'a2', name: 'Masáž', durationMinutes: 30, isActive: true, priceCzk: 900, clinicServiceId: 's2' },
];

function open() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <NewAppointmentDialog open onClose={vi.fn()} onBooked={vi.fn()} initialCalendarId="c1" initialStart="2026-09-24T09:00" initialEnd="2026-09-24T10:00" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'patients.view', 'patients.register']));
  listCalendars.mockReset().mockResolvedValue([{ id: 'c1', name: 'Kalendář', isActive: true }]);
  listActivities.mockReset().mockResolvedValue({ activities: ACTIVITIES, warnings: [] });
  listServices.mockReset().mockResolvedValue([
    { id: 's1', name: 'Prohlídky', isActive: true, sortOrder: 0, activities: 1, calendars: 1, colorHex: null, description: '' },
    { id: 's2', name: 'Fyzioterapie', isActive: true, sortOrder: 1, activities: 1, calendars: 1, colorHex: null, description: '' },
  ]);
  preview.mockReset().mockResolvedValue([{ date: '2026-09-24', isOpen: true, closedBecause: null, offeredActivityIds: ['a1', 'a2'] }]);
});

describe.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)('service first in quick registration · %s', (_n, width) => {
  beforeEach(() => setViewport(width, width === VIEWPORTS.desktop ? 900 : 1112));

  it('offers no činnost until a service is chosen, then only that service\'s', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('radio', { name: 'Rychlá registrace' }));
    const service = await screen.findByRole('combobox', { name: 'Služba' });
    const activity = screen.getByRole('combobox', { name: 'Prohlídka, na kterou volal' });
    /* Služba stands above the činnost in the form. */
    expect(service.compareDocumentPosition(activity) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(activity);
    expect(screen.queryByRole('option', { name: /Základní/ })).toBeNull();
    expect(screen.queryByRole('option', { name: /Masáž/ })).toBeNull();
    await user.keyboard('{Escape}');

    await user.click(service);
    await user.click(await screen.findByRole('option', { name: 'Fyzioterapie' }));
    await user.click(screen.getByRole('combobox', { name: 'Prohlídka, na kterou volal' }));
    expect(await screen.findByRole('option', { name: /Masáž/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Základní/ })).toBeNull();
  });
});
