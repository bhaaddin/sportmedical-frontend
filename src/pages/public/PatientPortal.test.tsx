/*
 * The patient portal's documents. What the patient sees is exactly what the
 * clinic released - the list comes from the server already filtered - so what
 * is worth pinning here is the page's half: each released document opens from
 * its own link, bound to this token, and an empty list says why it is empty.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { PortalAppointment, PortalDashboard } from '../../api/patientPortal';

const openPortal = vi.fn();
const cancelPortalAppointment = vi.fn();

vi.mock('../../api/patientPortal', async () => {
  const actual = await vi.importActual<typeof import('../../api/patientPortal')>('../../api/patientPortal');
  return { ...actual, openPortal, cancelPortalAppointment };
});

// The help card reads the clinic's public contacts; a quiet clinic here keeps
// these tests about the portal itself.
vi.mock('../../api/clinicSettings', async () => {
  const actual = await vi.importActual<typeof import('../../api/clinicSettings')>('../../api/clinicSettings');
  return {
    ...actual,
    readPublicClinic: vi.fn().mockResolvedValue({
      name: 'Ordinace',
      email: '',
      phone: '',
      address: '',
      bookingEnabled: true,
    }),
  };
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
  cancelPortalAppointment.mockReset();
});

const inAWeek = new Date(Date.now() + 7 * 24 * 3600 * 1000);
const upcoming = (over: Partial<PortalAppointment> = {}): PortalAppointment => ({
  id: 'appt-1',
  activityName: 'Sportovní prohlídka',
  startUtc: inAWeek.toISOString(),
  endUtc: new Date(inAWeek.getTime() + 30 * 60 * 1000).toISOString(),
  status: 'Scheduled',
  cancelUntilUtc: new Date(inAWeek.getTime() - 24 * 3600 * 1000).toISOString(),
  ...over,
});

describe('cancelling an appointment from the patient portal', () => {
  it('offers a cancel only while the server says the deadline is still ahead', async () => {
    openPortal.mockResolvedValue(
      dashboard({
        appointments: [upcoming(), upcoming({ id: 'appt-2', cancelUntilUtc: null })],
      }),
    );
    renderPortal();

    expect(await screen.findAllByText('Sportovní prohlídka')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Zrušit termín' })).toHaveLength(1);
  });

  it('cancels through the token, then re-reads the dashboard from the server', async () => {
    openPortal
      .mockResolvedValueOnce(dashboard({ appointments: [upcoming()] }))
      .mockResolvedValueOnce(dashboard());
    cancelPortalAppointment.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPortal('tok-abc');

    await userEvent.click(await screen.findByRole('button', { name: 'Zrušit termín' }));

    await waitFor(() => expect(cancelPortalAppointment).toHaveBeenCalledWith('tok-abc', 'appt-1'));
    expect(await screen.findByText('Termín byl zrušen.')).toBeInTheDocument();
    expect(openPortal).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Zrušit termín' })).not.toBeInTheDocument();
  });

  it("shows the server's own reason when it refuses", async () => {
    const { PortalCancelError } = await import('../../api/patientPortal');
    openPortal.mockResolvedValue(dashboard({ appointments: [upcoming()] }));
    cancelPortalAppointment.mockRejectedValue(new PortalCancelError('Termín už je příliš blízko.', 409));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPortal();

    await userEvent.click(await screen.findByRole('button', { name: 'Zrušit termín' }));

    expect(await screen.findByText('Termín už je příliš blízko.')).toBeInTheDocument();
    expect(openPortal).toHaveBeenCalledTimes(1);
  });
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
