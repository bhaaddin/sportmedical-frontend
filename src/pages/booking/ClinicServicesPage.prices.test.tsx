/*
 * "Ceny doplnit všude" (10. 10. 2026): the opened služba carries its price -
 * the lowest of its činnosti ("od 1 200 Kč"), the one price when they agree,
 * "bez ceny" when none is priced - and every činnost with its own, at the three
 * widths. The figures come through the price-list link each činnost carries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setViewport, VIEWPORTS, type ViewportName } from '../../test/viewport';

const listServices = vi.fn();
const listActivities = vi.fn();

vi.mock('../../auth/usePermission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../auth/usePermission')>()),
  usePermission: () => true,
}));
vi.mock('../../api/clinicServices', () => ({
  clinicServicesApi: { list: listServices, create: vi.fn(), update: vi.fn(), remove: vi.fn(), activate: vi.fn() },
}));
vi.mock('../../api/activities', async () => {
  const actual = await vi.importActual<typeof import('../../api/activities')>('../../api/activities');
  return { ...actual, activitiesApi: { list: listActivities, update: vi.fn(), remove: vi.fn(), restore: vi.fn() } };
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
    listWorkingHours: vi.fn().mockResolvedValue([{ id: 'w1', dayOfWeek: 1, startTime: '08:00', endTime: '16:00', isActive: true }]),
  },
}));
vi.mock('../../api/services', () => ({
  servicesApi: {
    getAll: vi.fn().mockResolvedValue([
      { id: 'p1', code: 'PROH', name: 'Prohlídka', description: '', durationMinutes: 30, priceCzk: 1200, listPriceCzk: null, isActive: true },
    ]),
  },
}));
vi.mock('../../api/discounts', () => ({
  discountSettingsApi: { get: vi.fn().mockResolvedValue({ tiers: [], packageDiscounts: [], roleLimits: [] }) },
}));
vi.mock('../../api/documentRequirements', () => ({ documentRequirementsApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../api/documents', () => ({ documentsApi: { getTemplates: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../api/serviceColors', () => ({
  serviceColorsApi: { get: vi.fn().mockResolvedValue({ palette: [] }) },
  SERVICE_COLORS_QUERY_KEY: ['settings', 'service-colors'],
}));
vi.mock('../../api/appointments', () => ({ appointmentsApi: { range: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../api/clubOrders', () => ({
  clubOrdersApi: { list: vi.fn().mockResolvedValue([]) },
  ORDER_STATUS_LABEL: { Invited: 'Čeká', Requested: 'Odesláno', Confirmed: 'Potvrzeno', Completed: 'Hotovo', Cancelled: 'Zrušeno' },
}));

const { default: ClinicServicesPage } = await import('./ClinicServicesPage');

/* jest-dom collapses every whitespace (the non-breaking one too) before comparing text, so a plain space is what to expect. */
const SP = ' ';

const svc = (id: string, name: string) => ({
  id, name, description: 'Popis služby', sortOrder: 0, isActive: true, activities: 2, calendars: 1, colorHex: '#0D7377',
});
const act = (id: string, name: string, sortOrder: number, extra: Record<string, unknown> = {}) => ({
  id, name, slug: id, durationMinutes: 30, color: '#0D7377', publicNote: '', isPubliclyBookable: false,
  requiresReportByEmail: false, requiresClubSharing: false, questionnaireRequirement: 'NotAsked', sortOrder,
  isActive: true, serviceItemId: 'p1', priceCzk: 1200, clinicServiceId: 's1', questionnaireDefinitionId: null,
  parallelCapacity: 1, requiredDocumentTemplateIds: [], ...extra,
});

beforeEach(() => {
  listServices.mockReset().mockResolvedValue([svc('s1', 'Prohlídky'), svc('s2', 'Diagnostika'), svc('s3', 'Konzultace')]);
  listActivities.mockReset().mockResolvedValue({
    activities: [
      act('a1', 'Základní', 0),
      act('a2', 'Komplexní', 1, { priceCzk: 2500 }),
      act('a3', 'Stará', 2, { isActive: false, priceCzk: 10 }),
      act('d1', 'Spiroergometrie', 0, { clinicServiceId: 's2', priceCzk: 1800 }),
      act('d2', 'InBody', 1, { clinicServiceId: 's2', priceCzk: 1800 }),
      act('k1', 'Konzultace', 0, { clinicServiceId: 's3', priceCzk: null, serviceItemId: null }),
    ],
    warnings: [],
  });
});

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <Routes>
          <Route path="/nastaveni/sluzby" element={<ClinicServicesPage />} />
          <Route path="/nastaveni/sluzby/:serviceId" element={<ClinicServicesPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );

describe.each(['phone', 'tablet', 'desktop'] as ViewportName[])('the price beside an opened služba at %s width', (name) => {
  beforeEach(() => setViewport(VIEWPORTS[name]));

  it('reads "od" the lowest price with every činnost and its own', async () => {
    renderAt('/nastaveni/sluzby/s1');
    expect(await screen.findByTestId('service-prices')).toHaveTextContent(
      `Ceny: od 1${SP}200${SP}Kč — Základní · 1${SP}200${SP}Kč, Komplexní · 2${SP}500${SP}Kč`,
    );
  });

  it('reads the one price when the činnosti agree', async () => {
    renderAt('/nastaveni/sluzby/s2');
    expect(await screen.findByTestId('service-prices')).toHaveTextContent(`Ceny: 1${SP}800${SP}Kč — Spiroergometrie · 1${SP}800${SP}Kč, InBody · 1${SP}800${SP}Kč`);
  });

  it('says "bez ceny" when no činnost of the služba is priced', async () => {
    renderAt('/nastaveni/sluzby/s3');
    expect(await screen.findByTestId('service-prices')).toHaveTextContent('Ceny: bez ceny — Konzultace · bez ceny');
  });
});
