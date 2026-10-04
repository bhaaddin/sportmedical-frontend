/*
 * Etapa 4, D9: a služba is archived, never deleted. The confirm says what
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

const listServices = vi.fn();
const createService = vi.fn();
const updateService = vi.fn();
const removeService = vi.fn();
const activateService = vi.fn();

vi.mock('../../api/clinicServices', () => ({
  clinicServicesApi: {
    list: listServices,
    create: createService,
    update: updateService,
    remove: removeService,
    activate: activateService,
  },
}));
vi.mock('../../api/activities', () => ({
  activitiesApi: { list: vi.fn().mockResolvedValue({ activities: [], warnings: [] }), update: vi.fn() },
}));
vi.mock('../../api/calendars', () => ({ calendarsApi: { list: vi.fn().mockResolvedValue([]), update: vi.fn() } }));

const { default: ClinicServicesPage } = await import('./ClinicServicesPage');

const svc = (id: string, name: string, isActive = true) => ({
  id, name, description: '', sortOrder: 0, isActive, activities: 2, calendars: 1, colorHex: '#0D7377',
});

beforeEach(() => {
  listServices.mockReset().mockResolvedValue([svc('s1', 'Sportovní prohlídky'), svc('s2', 'Stará služba', false)]);
  createService.mockReset().mockResolvedValue(svc('s9', 'Nová'));
  updateService.mockReset().mockResolvedValue(svc('s1', 'Sportovní prohlídky'));
  removeService.mockReset().mockResolvedValue(undefined);
  activateService.mockReset().mockResolvedValue(undefined);
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/sluzby']}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <ClinicServicesPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );

describe.each(['phone', 'tablet', 'desktop'] as ViewportName[])('ClinicServicesPage archive at %s width', (name) => {
  beforeEach(() => setViewport(VIEWPORTS[name]));

  it('words the action Archivovat, never Smazat, and the confirm says what stays', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Archivovat službu Sportovní prohlídky' }));

    expect(screen.getByText('Archivovat službu?')).toBeInTheDocument();
    expect(screen.getByText('Opravdu archivovat službu „Sportovní prohlídky“?')).toBeInTheDocument();
    expect(
      screen.getByText('Existující termíny, objednávky a historie zůstanou. Služba se přestane nabízet pro nové objednávky.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Smazat/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Smazat/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Archivovat' }));
    await waitFor(() => expect(removeService).toHaveBeenCalledWith('s1'));
  });

  it('keeps archived ones in a collapsed Archivované list, with Obnovit', async () => {
    renderPage();
    const toggle = await screen.findByRole('button', { name: 'Archivované (1)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Stará služba')).not.toBeInTheDocument();

    await userEvent.click(toggle);
    expect(screen.getByText('Stará služba')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Obnovit službu Stará služba' }));
    await waitFor(() => expect(activateService).toHaveBeenCalledWith('s2'));
  });

  it('does not list an archived služba among the active ones', async () => {
    renderPage();
    await screen.findByText('Sportovní prohlídky');
    expect(screen.queryByText('Stará služba')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upravit službu Stará služba' })).not.toBeInTheDocument();
  });
});

describe('ClinicServicesPage name rules', () => {
  beforeEach(() => setViewport(VIEWPORTS.desktop));

  const openNew = async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Nová služba/ }));
    return screen.findByLabelText(/Název/);
  };

  it('shows the 409 service.duplicate sentence at the name field', async () => {
    createService.mockRejectedValue(new DuplicateNameError('Služba s tímto názvem už existuje (archivovaná).'));
    const name = await openNew();
    await userEvent.type(name, 'Sportovní prohlídky');
    await userEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    const message = await screen.findByText('Služba s tímto názvem už existuje (archivovaná).');
    expect(message.closest('.MuiFormHelperText-root')).not.toBeNull();
    expect(name).toBeInvalid();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('falls back to its own sentence when the server sends none', async () => {
    createService.mockRejectedValue(new DuplicateNameError(undefined));
    const name = await openNew();
    await userEvent.type(name, 'Sportovní prohlídky');
    await userEvent.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText(/Služba s tímto názvem už existuje/)).toBeInTheDocument();
  });

  it('never submits an empty or whitespace-only name, and trims what it sends', async () => {
    const name = await openNew();
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
    await userEvent.type(name, '    ');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
    expect(createService).not.toHaveBeenCalled();

    await userEvent.type(name, '  Nová  ');
    await userEvent.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(createService).toHaveBeenCalled());
    expect(createService.mock.calls[0][0]).toMatchObject({ name: 'Nová' });
  });
});
