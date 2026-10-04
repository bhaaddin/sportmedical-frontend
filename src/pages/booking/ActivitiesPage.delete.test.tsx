/*
 * Činnosti page: Smazat beside Archivovat, the 200 and 409 paths, the
 * permission gate, and the duplicates helper (same name in the same služba
 * only), at the three widths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { setViewport, VIEWPORTS, type ViewportName } from '../../test/viewport';
import { InUseError } from '../../api/deleteInUse';

const listActivities = vi.fn();
const removeActivity = vi.fn();
const removePermanently = vi.fn();
let allowed = true;

vi.mock('../../auth/usePermission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../auth/usePermission')>()),
  usePermission: () => allowed,
}));
vi.mock('../../api/activities', () => ({
  activitiesApi: {
    list: listActivities, create: vi.fn(), update: vi.fn(), restore: vi.fn(),
    remove: removeActivity, removePermanently,
  },
}));
vi.mock('../../api/services', () => ({ servicesApi: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../api/clinicServices', () => ({
  clinicServicesApi: {
    list: vi.fn().mockResolvedValue([
      { id: 's1', name: 'Sportovní prohlídky', description: '', sortOrder: 0, isActive: true, activities: 3, calendars: 1 },
      { id: 's2', name: 'Diagnostika', description: '', sortOrder: 1, isActive: true, activities: 1, calendars: 1 },
    ]),
  },
}));
vi.mock('../../api/questionnaireEditor', () => ({ questionnaireEditorApi: { list: vi.fn().mockResolvedValue([]) } }));

const { default: ActivitiesPage } = await import('./ActivitiesPage');

const act = (id: string, name: string, serviceId = 's1', isActive = true) => ({
  id, name, slug: id, durationMinutes: 30, color: '#0D7377', publicNote: '', isPubliclyBookable: false,
  requiresReportByEmail: false, requiresClubSharing: false, questionnaireRequirement: 'NotAsked',
  sortOrder: 0, isActive, serviceItemId: null, priceCzk: id === 'a1' ? 1500 : null, clinicServiceId: serviceId,
  questionnaireDefinitionId: null, colorHex: null, parallelCapacity: 1, requiredDocumentTemplateIds: [],
});

beforeEach(() => {
  allowed = true;
  listActivities.mockReset().mockResolvedValue({ activities: [act('a1', 'Základní'), act('a2', 'Komplexní')], warnings: [] });
  removeActivity.mockReset().mockResolvedValue(undefined);
  removePermanently.mockReset().mockResolvedValue(undefined);
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/activities']}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <ActivitiesPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );

describe.each(['phone', 'tablet', 'desktop'] as ViewportName[])('Činnosti delete at %s width', (name) => {
  beforeEach(() => setViewport(VIEWPORTS[name]));

  it('deletes after the confirm and refreshes', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Smazat — Komplexní' }));
    expect(screen.getByText('Opravdu smazat „Komplexní“? Smazání nelze vrátit.')).toBeInTheDocument();
    listActivities.mockResolvedValue({ activities: [act('a1', 'Základní')], warnings: [] });
    await userEvent.click(screen.getByRole('button', { name: 'Smazat' }));

    await waitFor(() => expect(removePermanently).toHaveBeenCalledWith('a2'));
    expect(await screen.findByText('Činnost „Komplexní“ byla smazána.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Komplexní')).not.toBeInTheDocument());
  });

  it('409 lists what depends on it and archives instead', async () => {
    removePermanently.mockRejectedValue(
      new InUseError('activity.in_use', 'Činnost se používá.', {
        appointments: 5, clubOrders: 0, clubBlocks: 1, priceItems: 0, calendars: 0, activities: 0,
      }),
    );
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Smazat — Základní' }));
    await userEvent.click(screen.getByRole('button', { name: 'Smazat' }));
    const panel = await screen.findByTestId('delete-in-use');
    expect(within(panel).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['5 objednávek', '1 klubový blok']);
    await userEvent.click(screen.getByRole('button', { name: 'Archivovat místo toho' }));
    await waitFor(() => expect(removeActivity).toHaveBeenCalledWith('a1'));
  });

  it('is disabled without the edit permission', async () => {
    allowed = false;
    renderPage();
    expect(await screen.findByRole('button', { name: 'Smazat — Základní' })).toBeDisabled();
  });

  it('groups duplicates within one služba only and shows service, duration and price', async () => {
    listActivities.mockResolvedValue({
      activities: [
        act('a1', 'Základní sportovní prohlídka'), act('a2', 'Sportovní prohlídka základní'),
        act('a3', 'Základní sportovní prohlídka', 's2'),
      ],
      warnings: [],
    });
    renderPage();
    expect(await screen.findByText('Nalezeny možné duplicity (1)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zobrazit' }));
    const group = await screen.findByTestId('duplicate-group');
    expect(within(group).getAllByRole('button', { name: /^Smazat činnost/ })).toHaveLength(2);
    expect(within(group).getByText(/Sportovní prohlídky · .*30.* · .*1500/)).toBeInTheDocument();
  });
});
