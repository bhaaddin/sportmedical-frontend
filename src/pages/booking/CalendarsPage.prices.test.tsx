/*
 * "Ceny doplnit všude" (10. 10. 2026): under the služba a calendar runs, its
 * činnosti with their prices - "od 1 200 Kč — Základní · 1 200 Kč, Komplexní ·
 * bez ceny". Read from the shared `["activities"]` query; a server that does
 * not answer leaves the line out and the table stands.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { VIEWPORTS, setViewport } from '../../test/viewport';

const listCalendars = vi.fn();
const listClinicServices = vi.fn();
const listActivities = vi.fn();

vi.mock('../../api/calendars', () => ({
  calendarsApi: {
    list: listCalendars, create: vi.fn(), update: vi.fn(), remove: vi.fn(), deactivate: vi.fn(), activate: vi.fn(),
    getAccess: vi.fn().mockResolvedValue([]), saveAccess: vi.fn(),
  },
}));
vi.mock('../../api/clinicServices', () => ({ clinicServicesApi: { list: listClinicServices } }));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: listActivities } }));

const { default: CalendarsPage } = await import('./CalendarsPage');

/* jest-dom collapses every whitespace (the non-breaking one too) before comparing text, so a plain space is what to expect. */
const SP = ' ';

const svc = (id: string, name: string) => ({ id, name, description: '', sortOrder: 0, isActive: true, activities: 2, calendars: 1 });
const calendar = (id: string, name: string, clinicServiceId: string | null) => ({
  id, name, color: '#0D7377', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 0, clinicServiceId,
  publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null,
});
const act = (id: string, name: string, clinicServiceId: string, priceCzk: number | null, sortOrder = 0) => ({
  id, name, slug: id, durationMinutes: 30, color: '#0D7377', publicNote: '', isPubliclyBookable: true,
  requiresReportByEmail: false, requiresClubSharing: false, questionnaireRequirement: 'NotAsked', sortOrder,
  isActive: true, serviceItemId: null, priceCzk, clinicServiceId, questionnaireDefinitionId: null,
  parallelCapacity: 1, requiredDocumentTemplateIds: [],
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <CalendarsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  listCalendars.mockReset().mockResolvedValue([calendar('c1', 'Ordinace A', 's1'), calendar('c2', 'Ordinace B', 's2'), calendar('c3', 'Bez služby', null)]);
  listClinicServices.mockReset().mockResolvedValue([svc('s1', 'Prohlídky'), svc('s2', 'Diagnostika')]);
  listActivities.mockReset().mockResolvedValue({
    activities: [act('a1', 'Základní', 's1', 1200), act('a2', 'Komplexní', 's1', 2500, 1), act('a3', 'Konzultace', 's1', null, 2), act('d1', 'Spiroergometrie', 's2', 1800)],
    warnings: [],
  });
});

describe.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)('calendar prices at %s', (_n, width) => {
  beforeEach(() => setViewport(width));

  it('shows the služba\'s price under each calendar, with every činnost and its price in the tooltip', async () => {
    renderPage();
    const flat = (text: string | null): string => (text ?? '').replace(/[^\S\n]/g, ' ');
    const first = await screen.findByTestId('calendar-prices-c1');
    expect(first).toHaveTextContent(`od 1${SP}200${SP}Kč`);
    expect(flat(first.getAttribute('title'))).toBe('Základní · 1 200 Kč\nKomplexní · 2 500 Kč\nKonzultace · bez ceny');
    const second = screen.getByTestId('calendar-prices-c2');
    expect(second).toHaveTextContent(`1${SP}800${SP}Kč`);
    expect(flat(second.getAttribute('title'))).toBe('Spiroergometrie · 1 800 Kč');
    expect(screen.queryByTestId('calendar-prices-c3')).toBeNull();
  });
});

describe('without the činnosti', () => {
  it('shows the table without a price line when the read fails', async () => {
    listActivities.mockRejectedValue(new Error('offline'));
    renderPage();
    expect(await screen.findByText('Ordinace A')).toBeInTheDocument();
    await waitFor(() => expect(listActivities).toHaveBeenCalled());
    expect(screen.queryByTestId('calendar-prices-c1')).toBeNull();
  });
});
