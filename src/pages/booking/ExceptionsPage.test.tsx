import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../api/calendars', () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([
      {
        id: 'c1', name: 'Sportovní diagnostika', color: '#0D7377', location: '', displayStepMinutes: 15,
        isActive: true, sortOrder: 0, clinicServiceId: 's1',
        publicMinimumNoticeMinutes: null, publicHorizonDays: null,
      },
    ]),
    getAccess: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../api/workingHours', () => ({
  workingHoursApi: {
    listExceptions: vi.fn().mockResolvedValue([]),
    createException: vi.fn(),
    deleteException: vi.fn(),
  },
}));

const { default: ExceptionsPage } = await import('./ExceptionsPage');

describe('ExceptionsPage', () => {
  it('points at Rychlý plán for whole weeks and months', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ExceptionsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const link = await screen.findByRole('link', { name: 'Rychlém plánu' });
    expect(link).toHaveAttribute('href', '/working-hours');
  });
});
