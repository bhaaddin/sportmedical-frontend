import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PatientClubsShelf, { membershipLine } from './PatientClubsShelf';
import { readPatientClubs } from '../../api/clubs';

const get = vi.fn();
vi.mock('../../api/client', () => ({
  default: { get: (...a: unknown[]) => get(...a) },
  client: { get: (...a: unknown[]) => get(...a) },
}));

const renderIt = () => render(
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter><PatientClubsShelf patientId="p1" /></MemoryRouter>
  </QueryClientProvider>,
);

beforeEach(() => { get.mockReset(); localStorage.setItem('permissions', JSON.stringify(['patients.view'])); });

describe('Kluby on the patient card', () => {
  it('lists the clubs, active first', async () => {
    get.mockResolvedValue({ data: [
      { memberId: 'm1', clubId: 'c1', clubName: 'ZZ test FC', position: 'brankář', isActive: true, joinedAt: '2026-01-02T00:00:00Z' },
      { memberId: 'm2', clubId: 'c2', clubName: 'ZZ test HC', isActive: false, leftAt: '2025-06-01T00:00:00Z' },
    ] });
    renderIt();
    expect(await screen.findByText(/ZZ test FC/)).toBeInTheDocument();
    expect(screen.getByText(/ZZ test HC/)).toBeInTheDocument();
  });

  it('renders nothing for no clubs', async () => {
    get.mockResolvedValue({ data: [] });
    const { container } = renderIt();
    await new Promise((r) => setTimeout(r, 30));
    expect(container).toBeEmptyDOMElement();
  });

  it('reads defensively', () => {
    expect(readPatientClubs({ nope: 1 })).toEqual([]);
    expect(readPatientClubs([{ clubId: 'c', clubName: '' }])[0].clubName).toBe('Klub');
    expect(membershipLine({ memberId: 'm', clubId: 'c', clubName: 'x', memberNumber: '7', position: null, joinedAt: null, leftAt: null, isActive: false })).toBe('č. 7 · bývalý člen');
  });
});
