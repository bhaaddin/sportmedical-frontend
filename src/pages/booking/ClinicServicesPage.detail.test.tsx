/*
 * Služby as a master-detail workspace: list -> `/nastaveni/sluzby/:serviceId`,
 * the five tabs, in-place činnost editing, at the three widths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setViewport, VIEWPORTS, type ViewportName } from '../../test/viewport';

const listServices = vi.fn();
const listActivities = vi.fn();
const updateActivity = vi.fn();
const removeActivity = vi.fn();
const restoreActivity = vi.fn();

vi.mock('../../auth/usePermission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../auth/usePermission')>()),
  usePermission: () => true,
}));
vi.mock('../../api/clinicServices', () => ({
  clinicServicesApi: { list: listServices, create: vi.fn(), update: vi.fn(), remove: vi.fn(), activate: vi.fn() },
}));
vi.mock('../../api/activities', async () => {
  const actual = await vi.importActual<typeof import('../../api/activities')>('../../api/activities');
  return {
    ...actual,
    activitiesApi: { list: listActivities, update: updateActivity, remove: removeActivity, restore: restoreActivity },
  };
});
vi.mock('../../api/calendars', () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 'c1', name: 'Ordinace A', color: '#0D7377', location: 'Praha', displayStepMinutes: 15, isActive: true, sortOrder: 0, clinicServiceId: 's1' },
    ]),
    update: vi.fn(),
  },
}));
vi.mock('../../api/workingHours', () => ({
  workingHoursApi: {
    listPeriods: vi.fn().mockResolvedValue([{ id: 'p1', name: 'Rok', validFrom: '2020-01-01', validTo: null }]),
    listWorkingHours: vi.fn().mockResolvedValue([
      { id: 'w1', dayOfWeek: 1, startTime: '08:00', endTime: '16:00', isActive: true },
      { id: 'w2', dayOfWeek: 3, startTime: '08:00', endTime: '16:00', isActive: true },
    ]),
  },
}));
vi.mock('../../api/services', () => ({
  servicesApi: {
    getAll: vi.fn().mockResolvedValue([
      { id: 'p1', code: 'PROH', name: 'Prohlídka', description: '', durationMinutes: 30, priceCzk: 1500, listPriceCzk: 1800, isActive: true },
    ]),
  },
}));
vi.mock('../../api/discounts', () => ({
  discountSettingsApi: { get: vi.fn().mockResolvedValue({ tiers: [], packageDiscounts: [{ activityId: 'a1', percent: 10 }], roleLimits: [] }) },
}));
vi.mock('../../api/documentRequirements', () => ({
  documentRequirementsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 'r1', templateId: 't1', templateName: 'Výpis z karty', clinicServiceId: 's1', serviceName: 'Prohlídky', serviceExists: true, validityMonths: 12, warnDaysBefore: 30, firstVisitOnly: false, blocksBooking: false },
    ]),
  },
}));
vi.mock('../../api/documents', () => ({ documentsApi: { getTemplates: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../api/serviceColors', () => ({
  serviceColorsApi: { get: vi.fn().mockResolvedValue({ palette: [] }) },
  SERVICE_COLORS_QUERY_KEY: ['settings', 'service-colors'],
}));
vi.mock('../../api/appointments', () => ({
  appointmentsApi: {
    range: vi.fn().mockResolvedValue([
      { id: 'x1', activityId: 'a1', status: 0 },
      { id: 'x2', activityId: 'a1', status: 4 },
      { id: 'x3', activityId: 'other', status: 0 },
    ]),
  },
}));
vi.mock('../../api/clubOrders', () => ({
  clubOrdersApi: {
    list: vi.fn().mockResolvedValue([
      { id: 'o1', serviceId: 's1', status: 'Confirmed', clubName: 'FC Test', totalSeats: 12 },
      { id: 'o2', serviceId: 's1', status: 'Cancelled', clubName: 'Zrušený', totalSeats: 5 },
    ]),
  },
  ORDER_STATUS_LABEL: { Invited: 'Čeká', Requested: 'Odesláno', Confirmed: 'Potvrzeno', Completed: 'Hotovo', Cancelled: 'Zrušeno' },
}));

const { default: ClinicServicesPage } = await import('./ClinicServicesPage');

const svc = (id: string, name: string, isActive = true) => ({
  id, name, description: 'Popis služby', sortOrder: 0, isActive, activities: 2, calendars: 1, colorHex: '#0D7377',
});
const act = (id: string, name: string, sortOrder: number, extra: Record<string, unknown> = {}) => ({
  id, name, slug: id, durationMinutes: 30, color: '#0D7377', publicNote: '', isPubliclyBookable: false,
  requiresReportByEmail: false, requiresClubSharing: false, questionnaireRequirement: 'NotAsked', sortOrder,
  isActive: true, serviceItemId: 'p1', priceCzk: 1500, clinicServiceId: 's1', questionnaireDefinitionId: null,
  parallelCapacity: 1, requiredDocumentTemplateIds: [], ...extra,
});

beforeEach(() => {
  listServices.mockReset().mockResolvedValue([svc('s1', 'Prohlídky'), svc('s2', 'Diagnostika')]);
  listActivities.mockReset().mockResolvedValue({
    activities: [act('a1', 'Základní', 0), act('a2', 'Komplexní', 1), act('a3', 'Stará', 2, { isActive: false }), act('a9', 'Cizí', 0, { clinicServiceId: 's2' })],
    warnings: [],
  });
  updateActivity.mockReset().mockResolvedValue({ activity: {}, warnings: [] });
  removeActivity.mockReset().mockResolvedValue(undefined);
  restoreActivity.mockReset().mockResolvedValue(undefined);
});

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <Routes>
          <Route path="/nastaveni/sluzby" element={<ClinicServicesPage />} />
          <Route path="/nastaveni/sluzby/:serviceId" element={<ClinicServicesPage />} />
          <Route path="/activities" element={<div>Obrazovka činností</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );

describe.each(['phone', 'tablet', 'desktop'] as ViewportName[])('Služby master-detail at %s width', (name) => {
  beforeEach(() => setViewport(VIEWPORTS[name]));

  it('opens the detail of a služba from the list', async () => {
    renderAt('/nastaveni/sluzby');
    await userEvent.click(await screen.findByRole('button', { name: 'Otevřít službu Prohlídky' }));
    expect(await screen.findByTestId('service-detail')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Prohlídky' })).toBeInTheDocument();
    expect(await screen.findByTestId('activity-a1')).toBeInTheDocument();
    // Another služba's činnost is not shown, an archived one sits behind its toggle.
    expect(screen.queryByText('Cizí')).not.toBeInTheDocument();
    expect(screen.queryByText('Stará')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archivované činnosti (1)' })).toBeInTheDocument();
    if (name === 'phone') {
      expect(screen.queryByTestId('service-list')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Všechny služby' }));
      expect(await screen.findByTestId('service-list')).toBeInTheDocument();
    } else {
      expect(screen.getByTestId('service-list')).toBeInTheDocument();
    }
  });

  it('saves a changed length of a činnost as the whole činnost', async () => {
    renderAt('/nastaveni/sluzby/s1');
    const card = await screen.findByTestId('activity-a1');
    const length = within(card).getByLabelText('Délka');
    await userEvent.clear(length);
    await userEvent.type(length, '45');
    await userEvent.tab();
    await waitFor(() => expect(updateActivity).toHaveBeenCalled());
    const [id, input] = updateActivity.mock.calls[0];
    expect(id).toBe('a1');
    expect(input).toMatchObject({ durationMinutes: 45, name: 'Základní', serviceItemId: 'p1', clinicServiceId: 's1', parallelCapacity: 1 });
  });

  it('refuses a zero length instead of saving it', async () => {
    renderAt('/nastaveni/sluzby/s1');
    const card = await screen.findByTestId('activity-a1');
    const length = within(card).getByLabelText('Délka');
    await userEvent.clear(length);
    await userEvent.type(length, '0');
    expect(within(card).getByText('Celé číslo od 1')).toBeInTheDocument();
    await userEvent.tab();
    expect(updateActivity).not.toHaveBeenCalled();
  });

  it('archives a činnost, and restores an archived one', async () => {
    renderAt('/nastaveni/sluzby/s1');
    await userEvent.click(await screen.findByRole('button', { name: 'Archivovat činnost Základní' }));
    await waitFor(() => expect(removeActivity).toHaveBeenCalledWith('a1'));
    await userEvent.click(screen.getByRole('button', { name: 'Archivované činnosti (1)' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Obnovit činnost Stará' }));
    await waitFor(() => expect(restoreActivity).toHaveBeenCalledWith('a3'));
  });

  it('reorders: moving the second činnost up swaps the sort orders', async () => {
    renderAt('/nastaveni/sluzby/s1');
    await userEvent.click(await screen.findByRole('button', { name: 'Posunout činnost Komplexní výš' }));
    await waitFor(() => expect(updateActivity).toHaveBeenCalledTimes(2));
    const byId = Object.fromEntries(updateActivity.mock.calls.map(([id, input]) => [id, input.sortOrder]));
    expect(byId).toEqual({ a2: 0, a1: 1 });
  });

  it('shows the price line with its crossed-out list price and package', async () => {
    renderAt('/nastaveni/sluzby/s1');
    await userEvent.click(await screen.findByRole('tab', { name: 'Ceník' }));
    const line = await screen.findByTestId('price-p1');
    expect(within(line).getByText(/1\s800\sKč/)).toHaveStyle({ textDecoration: 'line-through' });
    expect(within(line).getByText(/1\s500\sKč/)).toBeInTheDocument();
    expect(within(line).getByText('Balíček −10 %')).toBeInTheDocument();
  });

  it('shows the calendars with their working days, and the rules of the služba', async () => {
    renderAt('/nastaveni/sluzby/s1');
    await userEvent.click(await screen.findByRole('tab', { name: 'Kalendáře' }));
    const calendar = await screen.findByTestId('calendar-c1');
    expect(await within(calendar).findByLabelText('Pracovní dny')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Pravidla a dokumenty' }));
    expect(await screen.findByText('Výpis z karty')).toBeInTheDocument();
  });

  it('counts the upcoming appointments and open club orders, without cancelled ones', async () => {
    renderAt('/nastaveni/sluzby/s1');
    await userEvent.click(await screen.findByRole('tab', { name: 'Použití' }));
    expect(await screen.findByLabelText('Nadcházející termíny: 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Otevřené objednávky klubů: 1')).toBeInTheDocument();
    expect(screen.getByText('FC Test')).toBeInTheDocument();
    expect(screen.queryByText('Zrušený')).not.toBeInTheDocument();
  });

  it('says so when the služba in the address does not exist', async () => {
    renderAt('/nastaveni/sluzby/nope');
    expect(await screen.findByText(/nepodařilo najít/)).toBeInTheDocument();
  });
});

describe('Služby detail states', () => {
  beforeEach(() => setViewport(VIEWPORTS.desktop));

  it('names an empty služba and offers the first činnost', async () => {
    listActivities.mockResolvedValue({ activities: [], warnings: [] });
    renderAt('/nastaveni/sluzby/s1');
    expect(await screen.findByText(/zatím nemá žádnou činnost/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Přidat činnost' }));
    expect(await screen.findByText('Obrazovka činností')).toBeInTheDocument();
  });

  it('says what failed and offers a retry when the činnosti do not load', async () => {
    listActivities.mockRejectedValue(new Error('boom'));
    renderAt('/nastaveni/sluzby/s1');
    expect(await screen.findByRole('button', { name: /Zkusit znovu/ })).toBeInTheDocument();
  });

  it('searches the list', async () => {
    renderAt('/nastaveni/sluzby');
    await screen.findByRole('button', { name: 'Otevřít službu Prohlídky' });
    await userEvent.type(screen.getByLabelText('Hledat službu'), 'diag');
    expect(screen.queryByRole('button', { name: 'Otevřít službu Prohlídky' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Otevřít službu Diagnostika' })).toBeInTheDocument();
  });
});
