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
import { render, screen, within } from '@testing-library/react';
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

const renderOverview = (upcoming: unknown[] = []) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <MemoryRouter initialEntries={['/x']}>
        <Routes>
          <Route
            element={(
              <Outlet
                context={{
                  patient: PATIENT, profile: null, documents: [], templates: [], requirements: [],
                  upcoming, displayPhone: '+420 773 539 001', displayEmail: 'bh@example.cz',
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

/*
 * Etapa 12, "ceny všude": the next booking's price is the one the desk agreed
 * for that visit, before the list price the window carries, before the
 * catalogue. The visit history's prices come off the catalogue by name (the
 * clinic-wide list carries no money).
 */
describe('prices on the overview', () => {
  const inWindow = (over: Record<string, unknown> = {}) => ({
    id: 'w1', calendarId: 'c1', patientId: 'p1', activityId: 'act-1', activityName: 'Kontrola',
    startUtc: '2099-02-01T08:00:00Z', endUtc: '2099-02-01T08:30:00Z', status: 0,
    isRunningLate: false, checkedInUtc: null, paperwork: null, ...over,
  });
  const nextCard = async () => within((await screen.findByText('Příští termín')).closest('.MuiPaper-root') as HTMLElement);

  it.each([['phone', VIEWPORTS.phone], ['desktop', VIEWPORTS.desktop]])('%s: the next visit shows its agreed price', async (_n, width) => {
    setViewport(width);
    listActivities.mockResolvedValue({ activities: [{ id: 'act-1', name: 'Kontrola', priceCzk: 1600 }] });
    renderOverview([inWindow({ agreedPriceCzk: 1200, listPriceCzk: 1600 })]);

    expect(await (await nextCard()).findByText(/Kontrola · 30 min · 1 200 Kč/)).toBeInTheDocument();
  });

  it("falls back to the window's list price, then the catalogue", async () => {
    setViewport(VIEWPORTS.desktop);
    listActivities.mockResolvedValue({ activities: [{ id: 'act-1', name: 'Kontrola', priceCzk: 900 }] });
    const { unmount } = renderOverview([inWindow({ agreedPriceCzk: null, listPriceCzk: 1600 })]);
    expect(await (await nextCard()).findByText(/1 600 Kč/)).toBeInTheDocument();
    unmount();

    renderOverview([inWindow()]);
    expect(await (await nextCard()).findByText(/900 Kč/)).toBeInTheDocument();
  });

  it('prices the visit history off the catalogue by name', async () => {
    setViewport(VIEWPORTS.desktop);
    listActivities.mockResolvedValue({ activities: [{ id: 'act-9', name: 'Komplexní prohlídka', priceCzk: 2200 }] });
    renderOverview();

    const history = await screen.findByRole('list', { name: 'Historie návštěv' });
    expect(await within(history).findByText(/2 200 Kč/)).toBeInTheDocument();
  });
});
