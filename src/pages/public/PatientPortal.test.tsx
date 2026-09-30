/*
 * The patient portal's documents. What the patient sees is exactly what the
 * clinic released - the list comes from the server already filtered - so what
 * is worth pinning here is the page's half: each released document opens from
 * its own link, bound to this token, and an empty list says why it is empty.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { PortalDashboard } from '../../api/patientPortal';

const openPortal = vi.fn();

vi.mock('../../api/patientPortal', async () => {
  const actual = await vi.importActual<typeof import('../../api/patientPortal')>('../../api/patientPortal');
  return { ...actual, openPortal };
});

const { default: PatientPortal } = await import('./PatientPortal');

const dashboard = (over: Partial<PortalDashboard> = {}): PortalDashboard => ({
  givenName: 'Jan',
  familyName: 'Novák',
  appointments: [],
  pastAppointments: [],
  documents: [],
  invoices: [],
  ...over,
});

const renderPortal = (token = 'tok-123') =>
  render(
    <MemoryRouter initialEntries={[`/portal/${token}`]}>
      <Routes>
        <Route path="/portal/:token" element={<PatientPortal />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  openPortal.mockReset();
});

describe('documents in the patient portal', () => {
  it('says why the list is empty when nothing has been released', async () => {
    openPortal.mockResolvedValue(dashboard());
    renderPortal();
    expect(await screen.findByText(/Jakmile vám je ordinace uvolní/)).toBeInTheDocument();
  });

  it('opens each released document from its own link, bound to this token', async () => {
    openPortal.mockResolvedValue(
      dashboard({
        documents: [
          { id: 'doc-1', title: 'Výpis ze zdravotní dokumentace (20. 5. 2026)', issuedAtUtc: '2026-09-30T10:00:00Z' },
        ],
      }),
    );
    renderPortal('tok-abc');

    expect(await screen.findByText('Výpis ze zdravotní dokumentace (20. 5. 2026)')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /Otevřít dokument Výpis/ });
    expect(link.getAttribute('href')).toMatch(
      /\/api\/patient-portal\/tok-abc\/documents\/doc-1$/,
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });
});
