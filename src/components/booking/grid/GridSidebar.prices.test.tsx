/*
 * "Ceny doplnit všude" (10. 10. 2026): the SLUŽBY legend carries a price per
 * služba - "od 1 200 Kč" (the lowest of its činnosti), the one price when they
 * agree, "bez ceny" when none is priced - and a tooltip that lists every
 * činnost with its own. Read from the shared `["activities"]` query; while it
 * has not answered the legend shows no price and nothing else changes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VIEWPORTS, setViewport } from '../../../test/viewport';

vi.mock('../../../api/activities', () => ({ activitiesApi: { list: vi.fn() } }));

const { activitiesApi } = await import('../../../api/activities');
const { GridSidebar, ServiceLegend } = await import('./GridSidebar');

/* jest-dom collapses every whitespace (the non-breaking one too) before comparing text, so a plain space is what to expect. */
const SP = ' ';
/* An attribute is compared as written, so the formatter's own spaces are flattened before comparing. */
const flat = (text: string | null): string | null => (text === null ? null : text.replace(/[^\S\n]/g, ' '));

const act = (id: string, name: string, clinicServiceId: string, priceCzk: number | null, sortOrder = 0, isActive = true) => ({
  id, name, slug: id, durationMinutes: 30, color: '#0D7377', publicNote: '', isPubliclyBookable: true,
  requiresReportByEmail: false, requiresClubSharing: false, questionnaireRequirement: 'NotAsked', sortOrder,
  isActive, serviceItemId: priceCzk === null ? null : `p-${id}`, priceCzk, clinicServiceId, questionnaireDefinitionId: null,
  parallelCapacity: 1, requiredDocumentTemplateIds: [],
});

const SERVICES = [
  { id: 's1', name: 'Prohlídky', color: '#0D7377' },
  { id: 's2', name: 'Diagnostika', color: '#AA3377' },
  { id: 's3', name: 'Konzultace', color: '#777777' },
];

const renderSidebar = (touch: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <GridSidebar
        anchor="2026-10-12"
        view="week"
        onDate={() => undefined}
        holidays={new Set()}
        closedDays={new Set()}
        services={SERVICES}
        isServiceShown={() => true}
        onToggleService={() => undefined}
        onOnlyService={() => undefined}
        onAllServices={() => undefined}
        touch={touch}
      />
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.mocked(activitiesApi.list).mockReset().mockResolvedValue({
    activities: [
      act('a2', 'Komplexní', 's1', 2500, 1),
      act('a1', 'Základní', 's1', 1200, 0),
      act('a0', 'Stará', 's1', 10, 2, false),
      act('d1', 'Spiroergometrie', 's2', 1800),
      act('d2', 'InBody', 's2', 1800, 1),
      act('k1', 'Konzultace', 's3', null),
    ] as never,
    warnings: [],
  });
});

describe.each([['desktop', VIEWPORTS.desktop, false], ['tablet', VIEWPORTS.tablet, false], ['phone', VIEWPORTS.phone, true]] as const)(
  'the legend prices at %s',
  (_name, width, touch) => {
    beforeEach(() => setViewport(width));

    it('shows "od" the lowest price, the one price when they agree, and "bez ceny" when none is priced', async () => {
      renderSidebar(touch);
      expect(await screen.findByTestId('legend-price-s1')).toHaveTextContent(`od 1${SP}200${SP}Kč`);
      expect(screen.getByTestId('legend-price-s2')).toHaveTextContent(`1${SP}800${SP}Kč`);
      expect(screen.getByTestId('legend-price-s3')).toHaveTextContent('bez ceny');
      // The name is still the checkbox's label; the price is not part of it.
      expect(screen.getByRole('checkbox', { name: 'Prohlídky' })).toBeInTheDocument();
    });

    it('lists "Činnost · cena" lines in the title tooltip, archived činnosti left out', async () => {
      renderSidebar(touch);
      await screen.findByTestId('legend-price-s1');
      const row = screen.getByRole('checkbox', { name: 'Prohlídky' }).closest('label');
      expect(flat(row?.getAttribute('title') ?? null)).toBe('Základní · 1 200 Kč\nKomplexní · 2 500 Kč');
      const none = screen.getByRole('checkbox', { name: 'Konzultace' }).closest('label');
      expect(none).toHaveAttribute('title', 'Konzultace · bez ceny');
    });
  },
);

describe('before the činnosti are read', () => {
  it('shows no price and does not break when the read fails', async () => {
    vi.mocked(activitiesApi.list).mockRejectedValue(new Error('offline'));
    renderSidebar(false);
    expect(await screen.findByRole('checkbox', { name: 'Prohlídky' })).toBeInTheDocument();
    await Promise.resolve();
    expect(screen.queryByTestId('legend-price-s1')).toBeNull();
  });

  it('the pure legend shows no price without a price map', () => {
    render(
      <ServiceLegend services={SERVICES} isShown={() => true} onToggle={() => undefined} onOnly={() => undefined} onAll={() => undefined} />,
    );
    expect(screen.getByRole('checkbox', { name: 'Prohlídky' })).toBeInTheDocument();
    expect(screen.queryByTestId('legend-price-s1')).toBeNull();
  });
});
