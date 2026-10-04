/*
 * Etapa 4, D9: a činnost is archived, never deleted. The confirm says what
 * stays, archived ones sit in a collapsed "Archivované" list with "Obnovit",
 * and a duplicate name is shown at the name field. At the three widths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { setViewport, VIEWPORTS, type ViewportName } from '../../test/viewport';
import { DuplicateNameError } from '../../api/duplicateName';

const listActivities = vi.fn();
const createActivity = vi.fn();
const updateActivity = vi.fn();
const removeActivity = vi.fn();
const restoreActivity = vi.fn();
const listClinicServices = vi.fn();

vi.mock('../../api/activities', () => ({
  activitiesApi: {
    list: listActivities,
    create: createActivity,
    update: updateActivity,
    remove: removeActivity,
    restore: restoreActivity,
  },
}));
vi.mock('../../api/services', () => ({ servicesApi: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../api/clinicServices', () => ({ clinicServicesApi: { list: listClinicServices } }));
vi.mock('../../api/questionnaireEditor', () => ({ questionnaireEditorApi: { list: vi.fn().mockResolvedValue([]) } }));

const { default: ActivitiesPage } = await import('./ActivitiesPage');

const act = (id: string, name: string, isActive = true) => ({
  id, name, slug: id, durationMinutes: 30, color: '#0D7377', publicNote: '', isPubliclyBookable: false,
  requiresReportByEmail: false, requiresClubSharing: false, questionnaireRequirement: 'NotAsked',
  sortOrder: 0, isActive, serviceItemId: null, priceCzk: null, clinicServiceId: 's1',
  questionnaireDefinitionId: null, colorHex: null, parallelCapacity: 1, requiredDocumentTemplateIds: [],
});

beforeEach(() => {
  listActivities.mockReset().mockResolvedValue({
    activities: [act('a1', 'Základní prohlídka'), act('a2', 'Stará prohlídka', false)],
    warnings: [],
  });
  createActivity.mockReset().mockResolvedValue({ activity: {}, warnings: [] });
  updateActivity.mockReset().mockResolvedValue({ activity: {}, warnings: [] });
  removeActivity.mockReset().mockResolvedValue(undefined);
  restoreActivity.mockReset().mockResolvedValue(undefined);
  listClinicServices.mockReset().mockResolvedValue([
    { id: 's1', name: 'Sportovní prohlídky', description: '', sortOrder: 0, isActive: true, activities: 1, calendars: 1 },
  ]);
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/activities']}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <ActivitiesPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );

describe.each(['phone', 'tablet', 'desktop'] as ViewportName[])('ActivitiesPage archive at %s width', (name) => {
  beforeEach(() => setViewport(VIEWPORTS[name]));

  it('words the action Archivovat, never Smazat, and the confirm says what stays', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Archivovat — Základní prohlídka' }));

    expect(screen.getByText('Archivovat činnost?')).toBeInTheDocument();
    expect(screen.getByText('Opravdu archivovat činnost „Základní prohlídka“?')).toBeInTheDocument();
    expect(
      screen.getByText('Existující termíny, objednávky a historie zůstanou. Činnost se přestane nabízet pro nové objednávky.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Smazat/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Archivovat' }));
    await waitFor(() => expect(removeActivity).toHaveBeenCalledWith('a1'));
  });

  it('keeps archived ones in a collapsed Archivované list, with Obnovit', async () => {
    renderPage();
    const toggle = await screen.findByRole('button', { name: 'Archivované (1)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Stará prohlídka')).not.toBeInTheDocument();

    await userEvent.click(toggle);
    expect(screen.getByText('Stará prohlídka')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Obnovit — Stará prohlídka' }));
    await waitFor(() => expect(restoreActivity).toHaveBeenCalledWith('a2'));
  });

  it('has no list heading when nothing is archived', async () => {
    listActivities.mockResolvedValue({ activities: [act('a1', 'Základní prohlídka')], warnings: [] });
    renderPage();
    await screen.findByText('Základní prohlídka');
    expect(screen.queryByRole('button', { name: /Archivované/ })).not.toBeInTheDocument();
  });
});

describe('ActivitiesPage name rules', () => {
  beforeEach(() => setViewport(VIEWPORTS.desktop));

  const openEdit = async () => {
    renderPage();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Upravit' }))[0]);
    return screen.findByLabelText(/Název/);
  };

  it('shows the 409 service.duplicate sentence at the name field', async () => {
    updateActivity.mockRejectedValue(new DuplicateNameError('Činnost s tímto názvem už v této službě existuje.'));
    const name = await openEdit();
    await userEvent.type(name, ' 2');
    await userEvent.click(screen.getByRole('button', { name: /Uložit/i }));

    const message = await screen.findByText('Činnost s tímto názvem už v této službě existuje.');
    expect(message.closest('.MuiFormHelperText-root')).not.toBeNull();
    expect(name).toBeInvalid();
    /* Typing again clears the refusal. */
    await userEvent.type(name, 'x');
    await waitFor(() => expect(screen.queryByText('Činnost s tímto názvem už v této službě existuje.')).not.toBeInTheDocument());
  });

  it('falls back to its own sentence when the server sends none', async () => {
    updateActivity.mockRejectedValue(new DuplicateNameError(undefined));
    const name = await openEdit();
    await userEvent.type(name, 'x');
    await userEvent.click(screen.getByRole('button', { name: /Uložit/i }));
    expect(await screen.findByText(/Činnost s tímto názvem už v této službě existuje/)).toBeInTheDocument();
  });

  it('never submits an empty or whitespace-only name, and trims what it sends', async () => {
    const name = await openEdit();
    await userEvent.clear(name);
    expect(screen.getByRole('button', { name: /Uložit/i })).toBeDisabled();
    await userEvent.type(name, '   ');
    expect(screen.getByRole('button', { name: /Uložit/i })).toBeDisabled();
    expect(updateActivity).not.toHaveBeenCalled();

    await userEvent.type(name, '  Nová  ');
    await userEvent.click(screen.getByRole('button', { name: /Uložit/i }));
    await waitFor(() => expect(updateActivity).toHaveBeenCalled());
    expect(updateActivity.mock.calls[0][1]).toMatchObject({ name: 'Nová' });
  });
});
