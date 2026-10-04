/*
 * Smazat a službu, Smazat a činnost, Duplicity: the confirm, the 200 path, the
 * 409 "in use" path with its usage list and the archive fallback, the
 * permission gate and the duplicates helper, at the three widths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { setViewport, VIEWPORTS, type ViewportName } from '../../test/viewport';
import { InUseError } from '../../api/deleteInUse';

const listServices = vi.fn();
const removeService = vi.fn();
const removeServicePermanently = vi.fn();
const listActivities = vi.fn();
const removeActivity = vi.fn();
const removeActivityPermanently = vi.fn();
let allowed = true;

vi.mock('../../auth/usePermission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../auth/usePermission')>()),
  usePermission: () => allowed,
}));
vi.mock('../../api/clinicServices', () => ({
  clinicServicesApi: {
    list: listServices, create: vi.fn(), update: vi.fn(), activate: vi.fn(),
    remove: removeService, removePermanently: removeServicePermanently,
  },
}));
vi.mock('../../api/activities', async () => {
  const actual = await vi.importActual<typeof import('../../api/activities')>('../../api/activities');
  return {
    ...actual,
    activitiesApi: {
      list: listActivities, update: vi.fn(), restore: vi.fn(),
      remove: removeActivity, removePermanently: removeActivityPermanently,
    },
  };
});
vi.mock('../../api/calendars', () => ({ calendarsApi: { list: vi.fn().mockResolvedValue([]), update: vi.fn() } }));
vi.mock('../../api/services', () => ({ servicesApi: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../api/documents', () => ({ documentsApi: { getTemplates: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../api/serviceColors', () => ({
  serviceColorsApi: { get: vi.fn().mockResolvedValue({ palette: [] }) },
  SERVICE_COLORS_QUERY_KEY: ['settings', 'service-colors'],
}));

const { default: ClinicServicesPage } = await import('./ClinicServicesPage');

const svc = (id: string, name: string, isActive = true) => ({
  id, name, description: '', sortOrder: 0, isActive, activities: 2, calendars: 1, colorHex: '#0D7377',
});
const act = (id: string, name: string, serviceId = 's1') => ({
  id, name, slug: id, durationMinutes: 30, color: '#0D7377', colorHex: null, effectiveColorHex: null, publicNote: '',
  isPubliclyBookable: false, requiresReportByEmail: false, requiresClubSharing: false,
  questionnaireRequirement: 'NotAsked', sortOrder: 0, isActive: true, serviceItemId: null, priceCzk: null,
  clinicServiceId: serviceId, questionnaireDefinitionId: null, parallelCapacity: 1, requiredDocumentTemplateIds: [],
});

const usage = { appointments: 12, clubOrders: 3, clubBlocks: 0, priceItems: 0, calendars: 2, activities: 0 };
const inUse = () => new InUseError('service.in_use', 'Službu nelze smazat, protože se používá.', usage);

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}

beforeEach(() => {
  allowed = true;
  listServices.mockReset().mockResolvedValue([svc('s1', 'Sportovní prohlídky'), svc('s2', 'Diagnostika')]);
  removeService.mockReset().mockResolvedValue(undefined);
  removeServicePermanently.mockReset().mockResolvedValue(undefined);
  listActivities.mockReset().mockResolvedValue({ activities: [act('a1', 'Základní')], warnings: [] });
  removeActivity.mockReset().mockResolvedValue(undefined);
  removeActivityPermanently.mockReset().mockResolvedValue(undefined);
});

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <Routes>
          <Route path="/nastaveni/sluzby/:serviceId?" element={<><ClinicServicesPage /><Where /></>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );

describe.each(['phone', 'tablet', 'desktop'] as ViewportName[])('Služby delete at %s width', (name) => {
  beforeEach(() => setViewport(VIEWPORTS[name]));

  it('confirms, deletes for good, toasts and refreshes the list', async () => {
    renderAt('/nastaveni/sluzby');
    await userEvent.click(await screen.findByRole('button', { name: 'Smazat službu Diagnostika' }));

    expect(screen.getByText('Smazat službu?')).toBeInTheDocument();
    expect(screen.getByText('Opravdu smazat „Diagnostika“? Smazání nelze vrátit.')).toBeInTheDocument();
    listServices.mockResolvedValue([svc('s1', 'Sportovní prohlídky')]);
    await userEvent.click(screen.getByRole('button', { name: 'Smazat' }));

    await waitFor(() => expect(removeServicePermanently).toHaveBeenCalledWith('s2'));
    expect(removeService).not.toHaveBeenCalled();
    expect(await screen.findByText('Služba „Diagnostika“ byla smazána.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Smazat službu?')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText('Diagnostika')).not.toBeInTheDocument());
  });

  it('on 409 shows the server message, the usage without zero counts, and archives instead', async () => {
    removeServicePermanently.mockRejectedValue(inUse());
    renderAt('/nastaveni/sluzby');
    await userEvent.click(await screen.findByRole('button', { name: 'Smazat službu Sportovní prohlídky' }));
    await userEvent.click(screen.getByRole('button', { name: 'Smazat' }));

    const panel = await screen.findByTestId('delete-in-use');
    expect(within(panel).getByText('Službu nelze smazat, protože se používá.')).toBeInTheDocument();
    const items = within(panel).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(['12 objednávek', '3 klubové objednávky', '2 kalendáře']);
    expect(screen.queryByRole('button', { name: 'Smazat' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Archivovat místo toho' }));
    await waitFor(() => expect(removeService).toHaveBeenCalledWith('s1'));
    expect(await screen.findByText('Služba „Sportovní prohlídky“ byla archivována.')).toBeInTheDocument();
  });

  it('is disabled when the user may not edit settings', async () => {
    allowed = false;
    renderAt('/nastaveni/sluzby');
    const button = await screen.findByRole('button', { name: 'Smazat službu Sportovní prohlídky' });
    expect(button).toBeDisabled();
    expect(screen.queryByText('Smazat službu?')).not.toBeInTheDocument();
  });

  it('flags likely duplicates and deletes from the dialog', async () => {
    listServices.mockResolvedValue([
      svc('s1', 'Základní sportovní prohlídka'), svc('s2', 'Sportovní prohlídka základní'), svc('s3', 'Diagnostika'),
    ]);
    renderAt('/nastaveni/sluzby');
    expect(await screen.findByText('Nalezeny možné duplicity (1)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zobrazit' }));

    const group = await screen.findByTestId('duplicate-group');
    expect(within(group).getByText('Základní sportovní prohlídka')).toBeInTheDocument();
    expect(within(group).getByText('Sportovní prohlídka základní')).toBeInTheDocument();
    expect(within(group).getAllByText('2 činnosti · 1 kalendář')).toHaveLength(2);
    expect(within(group).queryByText('Diagnostika')).not.toBeInTheDocument();

    await userEvent.click(within(group).getByRole('button', { name: 'Smazat službu Sportovní prohlídka základní' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Smazat' }));
    await waitFor(() => expect(removeServicePermanently).toHaveBeenCalledWith('s2'));
  });

  it('shows no duplicates banner when names differ', async () => {
    renderAt('/nastaveni/sluzby');
    await screen.findByText('Diagnostika');
    expect(screen.queryByTestId('duplicates-banner')).not.toBeInTheDocument();
  });
});

describe('Služba detail and činnost card', () => {
  beforeEach(() => setViewport(VIEWPORTS.desktop));

  it('deleting the opened služba goes back to the list', async () => {
    renderAt('/nastaveni/sluzby/s1');
    await userEvent.click(await screen.findByRole('button', { name: 'Smazat službu' }));
    expect(screen.getByText('Opravdu smazat „Sportovní prohlídky“? Smazání nelze vrátit.')).toBeInTheDocument();
    listServices.mockResolvedValue([svc('s2', 'Diagnostika')]);
    await userEvent.click(screen.getByRole('button', { name: 'Smazat' }));
    await waitFor(() => expect(removeServicePermanently).toHaveBeenCalledWith('s1'));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/nastaveni\/sluzby$/));
  });

  it('a činnost card has Smazat next to Archivovat; 409 offers archiving', async () => {
    removeActivityPermanently.mockRejectedValue(
      new InUseError('activity.in_use', 'Činnost se používá.', { ...usage, appointments: 1, clubOrders: 0, calendars: 0 }),
    );
    renderAt('/nastaveni/sluzby/s1');
    const card = await screen.findByTestId('activity-a1');
    expect(within(card).getByRole('button', { name: 'Archivovat činnost Základní' })).toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: 'Smazat činnost Základní' }));

    expect(screen.getByText('Smazat činnost?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Smazat' }));
    const panel = await screen.findByTestId('delete-in-use');
    expect(within(panel).getByText('Činnost se používá.')).toBeInTheDocument();
    expect(within(panel).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['1 objednávka']);

    await userEvent.click(screen.getByRole('button', { name: 'Archivovat místo toho' }));
    await waitFor(() => expect(removeActivity).toHaveBeenCalledWith('a1'));
  });
});
