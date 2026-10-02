/*
 * The appointment detail and its edit mode (board screens 12 and 13), clicked
 * through. The arithmetic is in `appointmentEdit.test.ts`; what only the
 * screen can show is that the header reads the board's way, that an
 * unfinished registration gets its beige card, that "Upravit" opens the edit
 * form with "Uložit změny" disabled until something changed, and that saving
 * a status change goes to the status endpoint and nowhere else.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const get = vi.fn();
const history = vi.fn();
const setStatus = vi.fn();
const reschedule = vi.fn();
const getAvailability = vi.fn();

vi.mock('../../api/appointments', () => ({
  appointmentsApi: { get, history, setStatus, reschedule, getAvailability, cancel: vi.fn() },
}));

vi.mock('../../api/patients', () => ({
  patientsApi: {
    getById: vi.fn().mockResolvedValue({
      id: 'p1', firstName: 'Bohumil', lastName: 'Komárek', fullName: 'Bohumil Komárek',
      dateOfBirth: '1990-01-01', sex: 'M', createdAtUtc: '', updatedAtUtc: '',
    }),
    getProfile: vi.fn().mockResolvedValue({ phone: '+420 773 539 001', email: 'bh@m.com' }),
  },
}));

vi.mock('../../api/activities', () => ({
  activitiesApi: {
    list: vi.fn().mockResolvedValue({
      activities: [
        {
          id: 'a-basic', name: 'Základní prohlídka', slug: 'zakladni', durationMinutes: 30, color: '#0D7377',
          publicNote: '', isPubliclyBookable: true, requiresReportByEmail: false, requiresClubSharing: false,
          questionnaireRequirement: 'NotAsked', sortOrder: 0, isActive: true, serviceItemId: null,
          priceCzk: 1600, clinicServiceId: 's-exam', questionnaireDefinitionId: null,
        },
      ],
      warnings: [],
    }),
  },
}));

vi.mock('../../api/patientPreRegistration', () => ({
  patientPreRegistrationApi: { issueLink: vi.fn().mockResolvedValue({ url: null, path: '/dokonceni/abc' }) },
}));

vi.mock('../../api/patientPortal', () => ({
  issuePortalLink: vi.fn().mockResolvedValue('tok'),
}));

vi.mock('../../auth/usePermission', () => ({
  usePermission: () => true,
}));

const { AppointmentDetail } = await import('./AppointmentDetail');

/* 26. 10. 2026 is a Monday on CET: 09:30 Prague = 08:30Z. */
const appointment = {
  id: 't1',
  calendarId: 'c1',
  patientId: 'p1',
  activityId: 'a-basic',
  activityName: 'Základní prohlídka',
  startUtc: '2026-10-26T08:30:00Z',
  endUtc: '2026-10-26T09:00:00Z',
  status: 0,
  source: 1,
  workerUserId: null,
  heldUntilUtc: null,
  overrideReason: null,
  note: null,
  checkedInUtc: null,
  paperwork: { ready: false, missing: ['questionnaire_missing'] },
  unregisteredName: null,
  unregisteredPhone: null,
};

beforeEach(() => {
  get.mockReset().mockResolvedValue(appointment);
  history.mockReset().mockResolvedValue([
    { action: 0, actorId: 'u1', actorDisplayName: 'Recepce', atUtc: '2026-10-24T20:26:00Z', reason: null, oldValue: null, newValue: null },
  ]);
  setStatus.mockReset().mockResolvedValue(undefined);
  reschedule.mockReset().mockResolvedValue(undefined);
  getAvailability.mockReset().mockResolvedValue([]);
});

const renderDetail = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const ui: ReactNode = (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AppointmentDetail
          appointmentId="t1"
          calendarId="c1"
          calendar={{ id: 'c1', name: 'Prohlídky', color: '#0D7377' }}
          open
          onClose={() => undefined}
          onChanged={() => undefined}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(ui);
};

describe('the appointment detail', () => {
  it('reads the board’s way: time, long date, činnost, chips, price and source', async () => {
    renderDetail();

    expect(await screen.findByText('09:30 — 10:00')).toBeInTheDocument();
    expect(screen.getByText('Pondělí 26. října 2026 · 30 minut')).toBeInTheDocument();
    expect(screen.getByText('Objednán')).toBeInTheDocument();
    expect(screen.getByText('Registrace není dokončena')).toBeInTheDocument();
    expect(screen.getByText('Pacient zatím nevyplnil vstupní dotazník.')).toBeInTheDocument();
    expect(screen.getByText('Web')).toBeInTheDocument();
    expect(await screen.findByText('Bohumil Komárek')).toBeInTheDocument();
    expect((await screen.findByText(/1.600 Kč/)).textContent?.replace(/ /g, ' ')).toBe('1 600 Kč');
    expect(await screen.findByText(/Objednáno — 24\. 10\. 2026/)).toBeInTheDocument();
  });

  it('opens the edit form from "Upravit" and only enables saving once something changed', async () => {
    renderDetail();
    await screen.findByText('09:30 — 10:00');

    await userEvent.click(screen.getByRole('button', { name: 'Upravit' }));

    expect(await screen.findByText('Úprava rezervace')).toBeInTheDocument();
    expect(screen.getByText('Bohumil Komárek · Po 26. 10. 2026, 09:30')).toBeInTheDocument();
    expect(screen.getByText(/Termín zůstává 09:30 — 10:00/)).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Uložit změny' });
    expect(save).toBeDisabled();

    /* A status change on its own: the status endpoint, and not /time. */
    await userEvent.click(screen.getByRole('combobox', { name: 'Stav' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Potvrzen' }));
    expect(save).toBeEnabled();

    await userEvent.click(save);
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith('c1', 't1', '1'));
    expect(reschedule).not.toHaveBeenCalled();
  });

  it('asks the server whether a new time is free and says so in the slot line (6.1)', async () => {
    getAvailability.mockResolvedValue([
      { startUtc: '2026-10-26T09:00:00Z', endUtc: '2026-10-26T09:30:00Z' },
    ]);
    renderDetail();
    await screen.findByText('09:30 — 10:00');
    await userEvent.click(screen.getByRole('button', { name: 'Upravit' }));
    await screen.findByText('Úprava rezervace');

    const start = screen.getByLabelText('Začátek') as HTMLInputElement;
    await userEvent.clear(start);
    await userEvent.type(start, '10:00');

    const line = await screen.findByRole('status');
    await waitFor(() =>
      expect(within(line).getByText('Nový termín 10:00 — 10:30 je volný. Nekoliduje s žádnou rezervací.')).toBeInTheDocument(),
    );
    expect(getAvailability).toHaveBeenCalledWith('c1', 'a-basic', '2026-10-26', '2026-10-26');

    await userEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(reschedule).toHaveBeenCalledWith('c1', 't1', '2026-10-26T09:00:00.000Z'));
    expect(setStatus).not.toHaveBeenCalled();
  });
});
