/*
 * Everybody reads the price list; only whoever may change the clinic's
 * settings sees the controls that change it. The server refuses the writes
 * without settings.clinic.manage, so a button offered to anybody else would
 * only ever produce a refusal.
 *
 * The činnosti under the rows, their documents, colour and capacity are
 * tested in `cenik/Cenik.activities.test.tsx`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getAll = vi.fn();
vi.mock('../api/services', () => ({ servicesApi: { getAll, archive: vi.fn() } }));
vi.mock('../api/activities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/activities')>();
  return { ...actual, activitiesApi: { ...actual.activitiesApi, list: vi.fn().mockResolvedValue({ activities: [], warnings: [] }) } };
});
vi.mock('../api/clinicServices', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/clinicServices')>();
  return { ...actual, clinicServicesApi: { ...actual.clinicServicesApi, list: vi.fn().mockResolvedValue([]) } };
});
vi.mock('../api/documents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/documents')>();
  return { ...actual, documentsApi: { ...actual.documentsApi, getTemplates: vi.fn().mockResolvedValue([]) } };
});
vi.mock('../api/serviceColors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/serviceColors')>();
  return { ...actual, serviceColorsApi: { get: vi.fn().mockResolvedValue({ palette: [] }), put: vi.fn() } };
});

const { default: Cenik } = await import('./Cenik');

const item = {
  id: 's1',
  code: 'SLP-1',
  name: 'Sportovní prohlídka',
  description: '',
  category: '',
  durationMinutes: 60,
  priceCzk: 1200,
  vatRate: 0,
  isActive: true,
};

const renderCenik = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Cenik />
    </QueryClientProvider>,
  );

beforeEach(() => {
  getAll.mockReset().mockResolvedValue([item]);
});

afterEach(() => {
  localStorage.clear();
});

describe('Ceník', () => {
  it('shows the list without the editing controls to somebody who may not change it', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view']));

    renderCenik();

    expect((await screen.findAllByText('Sportovní prohlídka')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Nová položka/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Upravit položku Sportovní prohlídka')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Vyřadit položku Sportovní prohlídka')).not.toBeInTheDocument();
  });

  it('offers them to somebody who holds settings.clinic.manage', async () => {
    localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));

    renderCenik();

    expect(await screen.findByLabelText('Upravit položku Sportovní prohlídka')).toBeInTheDocument();
    expect(screen.getByLabelText('Vyřadit položku Sportovní prohlídka')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nová položka/ })).toBeInTheDocument();
  });

  it('says what failed and tries again when the price list does not load', async () => {
    getAll.mockRejectedValueOnce(new Error('offline'));
    renderCenik();
    expect(await screen.findByText('Ceník se nepodařilo načíst.')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Zkusit znovu' }).click();
    expect((await screen.findAllByText('Sportovní prohlídka')).length).toBeGreaterThan(0);
  });
});
