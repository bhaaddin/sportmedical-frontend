/*
 * A club reservation is tied to one calendar, and a calendar runs one služba:
 * the činnost list offers only that služba's činnosti.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VIEWPORTS, setViewport } from '../../test/viewport';

const act = (id: string, name: string, clinicServiceId: string) => ({
  id, name, isActive: true, durationMinutes: 30, priceCzk: null, clinicServiceId,
});
vi.mock('../../api/activities', () => ({
  activitiesApi: { list: vi.fn().mockResolvedValue({ activities: [
    { id: 'a1', name: 'Základní', isActive: true, durationMinutes: 30, priceCzk: null, clinicServiceId: 's1' },
    { id: 'a2', name: 'Spiroergo', isActive: true, durationMinutes: 30, priceCzk: null, clinicServiceId: 's2' },
  ] }) },
}));
vi.mock('../../api/calendars', () => ({ calendarsApi: { list: vi.fn().mockResolvedValue([{ id: 'c1', name: 'A', clinicServiceId: 's2' }]) } }));
vi.mock('../../api/partnerOrders', () => ({ partnerOrdersApi: {} }));
vi.mock('../../api/workingHours', () => ({ workingHoursApi: { listWorkingHours: vi.fn().mockResolvedValue([]), listPeriods: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../services/clubsApi', () => ({ clubsApi: { list: vi.fn().mockResolvedValue([]) } }));

const { NewPartnerOrderDialog } = await import('./NewPartnerOrderDialog');
void act;

describe('club reservation činnosti', () => {
  it('offers only the činnosti of the calendar služba', async () => {
    setViewport(VIEWPORTS.desktop);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NewPartnerOrderDialog open calendarId="c1" initial={{ headcount: 5 }} onClose={() => {}} onCreated={() => {}} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThan(1));
    const selects = screen.getAllByRole('combobox');
    const select = selects[selects.length - 1];
    await userEvent.click(select);
    await waitFor(async () => {
      const text = (await screen.findAllByRole('option')).map((o) => o.textContent).join('|');
      expect(text).toContain('Spiroergo');
      expect(text).not.toContain('Základní');
    });
  });
});
