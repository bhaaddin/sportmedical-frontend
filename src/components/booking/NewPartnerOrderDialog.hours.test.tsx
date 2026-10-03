/*
 * The default hours of a club reservation day are the clinic's calendar settings
 * (Nastavení › Kalendář), not numbers written into the dialog.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VIEWPORTS, setViewport } from '../../test/viewport';

vi.mock('../../api/activities', () => ({ activitiesApi: { list: vi.fn().mockResolvedValue({ activities: [] }) } }));
vi.mock('../../api/partnerOrders', () => ({ partnerOrdersApi: {} }));
vi.mock('../../api/workingHours', () => ({ workingHoursApi: { listWorkingHours: vi.fn().mockResolvedValue([]), listPeriods: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../services/clubsApi', () => ({ clubsApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../api/displaySettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/displaySettings')>();
  return {
    ...actual,
    useCalendarDisplay: () => ({ settings: { ...actual.CALENDAR_DISPLAY_OFFLINE, dayStartHour: 9, dayEndHour: 17 }, loaded: true }),
  };
});

const { NewPartnerOrderDialog } = await import('./NewPartnerOrderDialog');

describe.each(Object.entries(VIEWPORTS))('club reservation hours at %s (%i px)', (_name, width) => {
  it('starts the bulk range at the calendar settings hours and the added day too', async () => {
    setViewport(width);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NewPartnerOrderDialog open calendarId="c1" onClose={() => {}} onCreated={() => {}} />
      </QueryClientProvider>,
    );
    const from = (await screen.findAllByLabelText('Od')).find((el) => (el as HTMLInputElement).type === 'time') as HTMLInputElement;
    const to = screen.getAllByLabelText('Do').find((el) => (el as HTMLInputElement).type === 'time') as HTMLInputElement;
    expect(from.value).toBe('09:00');
    expect(to.value).toBe('17:00');

    await userEvent.clear(from);
    await userEvent.type(from, '10:30');
    expect(from.value).toBe('10:30');
  });
});
