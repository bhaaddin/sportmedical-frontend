/*
 * The patient's overview (Přehled) in its three layouts.
 *
 * The board draws OSOBNÍ ÚDAJE and HISTORIE NÁVŠTĚV on the left and PŘÍŠTÍ
 * TERMÍN and UPOZORNĚNÍ on the right. On a phone the two columns become one
 * (the rail follows the main column) and the visit history is a list of rows,
 * never a table that scrolls sideways.
 *
 * What would have to break for these to fail: a table in the history, a
 * missing right rail, or a result session without its report button reachable
 * with a thumb (44 px).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../test/viewport';

const getByPatient = vi.fn();
const fetchAllAppointments = vi.fn();
const listActivities = vi.fn();

vi.mock('../api/diagnostics', () => ({ diagnosticsApi: { getByPatient, downloadPdf: vi.fn() } }));
vi.mock('../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../api/billing', () => ({ billingApi: { getInvoices: vi.fn().mockResolvedValue([]) } }));
vi.mock('../components/patients/appointmentsSource', () => ({
  ALL_APPOINTMENTS_KEY: ['scheduling', 'appointments', 'all'],
  UPCOMING_WINDOW_KEY: ['day', 'upcoming-window'],
  fetchAllAppointments,
  fetchUpcomingWindow: vi.fn().mockResolvedValue([]),
}));
vi.mock('../components/booking/patient/CompletionLinkButton', () => ({ CompletionLinkButton: () => null }));
vi.mock('../components/booking/patient/PortalLinkButton', () => ({ PortalLinkButton: () => null }));

const { default: PatientDetails } = await import('./PatientDetails');

const PATIENT = {
  id: 'p1', firstName: 'Cesta', lastName: 'Jedna', dateOfBirth: '1990-05-15', sex: 'Male', status: 'Active',
  createdAtUtc: '2026-01-09T10:00:00Z', updatedAtUtc: '2026-01-09T10:00:00Z',
};

beforeEach(() => {
  localStorage.setItem('permissions', JSON.stringify(['patients.view']));
  getByPatient.mockReset().mockResolvedValue([]);
  listActivities.mockReset().mockResolvedValue({ activities: [] });
  fetchAllAppointments.mockReset().mockResolvedValue([
    {
      id: 'a1', patientId: 'p1', eventName: 'Komplexní prohlídka', status: 'Completed',
      startTime: '2026-03-14T08:00:00Z', endTime: '2026-03-14T09:00:00Z', notes: '',
    },
  ]);
});

const renderOverview = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <MemoryRouter initialEntries={['/x']}>
        <Routes>
          <Route
            element={(
              <Outlet
                context={{
                  patient: PATIENT, profile: null, documents: [], templates: [], requirements: [],
                  upcoming: [], displayPhone: '+420 773 539 001', displayEmail: 'bh@example.cz',
                  reloadDocuments: vi.fn(),
                }}
              />
            )}
          >
            <Route path="/x" element={<PatientDetails />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe.each([
  ['phone', VIEWPORTS.phone],
  ['iPad', VIEWPORTS.tablet],
  ['desktop', VIEWPORTS.desktop],
])('Přehled on a %s', (_name, width) => {
  it('has the personal data, the visit history as rows, and the right rail', async () => {
    setViewport(width);
    const { container } = renderOverview();

    expect(await screen.findByText('Osobní údaje')).toBeInTheDocument();
    const history = await screen.findByRole('list', { name: 'Historie návštěv' });
    expect(history.querySelectorAll('li')).toHaveLength(1);
    expect(container.querySelector('table')).toBeNull();
    expect(screen.getByText('Příští termín')).toBeInTheDocument();
    expect(screen.getByText('Upozornění')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Poslat odkaz' })).toBeInTheDocument();
  });
});

describe('Přehled on a phone', () => {
  it('has a new-measurement button a thumb can hit', async () => {
    setViewport(VIEWPORTS.phone);
    renderOverview();

    const button = await screen.findByRole('button', { name: 'Nové vyšetření' });
    expect(getComputedStyle(button).minHeight).toBe('44px');
  });
});
