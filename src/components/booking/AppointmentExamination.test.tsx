import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppointmentExamination, examinationPath } from './AppointmentExamination';

const get = vi.fn();
vi.mock('../../api/client', () => ({
  default: { get: (...a: unknown[]) => get(...a) },
  client: { get: (...a: unknown[]) => get(...a) },
}));

const renderIt = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><AppointmentExamination patientId="p1" appointmentId="a1" /></MemoryRouter>
  </QueryClientProvider>,
);

beforeEach(() => get.mockReset());

describe('AppointmentExamination', () => {
  it('offers to start the examination for this visit', async () => {
    get.mockResolvedValue({ data: [] });
    renderIt();
    const link = await screen.findByRole('link', { name: 'Zahájit vyšetření' });
    expect(link).toHaveAttribute('href', examinationPath('p1', 'a1'));
  });

  it('lists only the examinations linked to this visit', async () => {
    get.mockResolvedValue({ data: [
      { id: 's1', patientId: 'p1', sessionDate: '2026-10-01T00:00:00', practitionerName: 'Dr. ZZ', appointmentId: 'a1' },
      { id: 's2', patientId: 'p1', sessionDate: '2026-09-01T00:00:00', practitionerName: 'Dr. Jiný', appointmentId: null },
    ] });
    renderIt();
    expect(await screen.findByText('Dr. ZZ')).toBeInTheDocument();
    expect(screen.queryByText('Dr. Jiný')).toBeNull();
    expect(screen.getByRole('link', { name: 'Další vyšetření' })).toBeInTheDocument();
  });
});
