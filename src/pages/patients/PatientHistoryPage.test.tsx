/*
 * Historie karty as shelves: Změny karty (who, when, why) and Přístupy (only when there are any).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const listByEntity = vi.fn();
vi.mock('../../api/audit', () => ({ auditApi: { listByEntity }, AUDIT_ENTITY: { patient: 'Patient' } }));

const { default: PatientHistoryPage, isAccess } = await import('./PatientHistoryPage');

const entry = (over: Record<string, unknown> = {}) => ({
  id: 'e1', userEmail: 'recepce@example.test', action: 'PatientUpdated', entity: 'Patient', entityId: 'p1',
  timestamp: '2026-10-01T08:00:00Z', oldValue: { phone: '111' }, newValue: { phone: '222' }, notes: 'Pacient změnil číslo', ...over,
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/patients/p1/historie']}>
        <Routes>
          <Route path="/patients/:id/historie" element={<PatientHistoryPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  localStorage.setItem('permissions', JSON.stringify(['patients.view', 'patients.edit', 'settings.clinic.manage']));
  listByEntity.mockReset().mockResolvedValue([]);
});

describe('Historie karty', () => {
  it('shows each change with its author, its reason and what changed', async () => {
    listByEntity.mockResolvedValue([entry()]);
    renderPage();

    const changes = await screen.findByRole('region', { name: 'Změny karty' });
    const row = await within(changes).findByTestId('history-entry');
    expect(row).toHaveTextContent('recepce@example.test');
    expect(row).toHaveTextContent('Důvod: Pacient změnil číslo');
    expect(row).toHaveTextContent('phone: 111 → 222');
    expect(within(changes).getByLabelText('Počet: 1')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Přístupy' })).toBeNull();
  });

  it('puts opening and exporting the file on its own shelf', async () => {
    listByEntity.mockResolvedValue([entry(), entry({ id: 'e2', action: 'PatientViewed', oldValue: null, newValue: null, notes: null })]);
    renderPage();

    const access = await screen.findByRole('region', { name: 'Přístupy' });
    expect(within(access).getByText('PatientViewed')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Změny karty' })).queryByText('PatientViewed')).toBeNull();
  });

  it('offers to edit the card when nothing has changed yet, only to someone who may', async () => {
    renderPage();
    const changes = await screen.findByRole('region', { name: 'Změny karty' });
    expect(await within(changes).findByRole('link', { name: 'Upravit kartu' })).toHaveAttribute('href', '/patients/p1/edit');
  });

  it('offers no edit without the permission', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view', 'settings.clinic.manage']));
    renderPage();
    const changes = await screen.findByRole('region', { name: 'Změny karty' });
    await within(changes).findByText('Zatím není zaznamenaná žádná změna tohoto pacienta.');
    expect(within(changes).queryByRole('link', { name: 'Upravit kartu' })).toBeNull();
  });

  it('asks nobody without settings.clinic.manage, and says who sees the history', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view', 'patients.edit']));
    renderPage();
    const changes = await screen.findByRole('region', { name: 'Změny karty' });
    expect(within(changes).getByText('Historii změn karty vidí správce kliniky.')).toBeInTheDocument();
    expect(listByEntity).not.toHaveBeenCalled();
  });

  it('says it could not load, with a retry', async () => {
    listByEntity.mockRejectedValue(new Error('500'));
    renderPage();
    expect(await screen.findByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
  });

  it('tells an access from a change', () => {
    expect(isAccess('PatientViewed')).toBe(true);
    expect(isAccess('ExportDownloaded')).toBe(true);
    expect(isAccess('PatientUpdated')).toBe(false);
    expect(isAccess('PatientCreated')).toBe(false);
  });
});
