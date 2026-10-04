/* The consent line on the appointment card: paperwork.missing may carry "consent_missing". */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { setViewport, VIEWPORTS, type ViewportName } from '../../test/viewport';

const get = vi.fn();
const history = vi.fn();
const setStatus = vi.fn();
const reschedule = vi.fn();
const getAvailability = vi.fn();
const range = vi.fn();
const checkRequired = vi.fn();
const issueLink = vi.fn();

vi.mock('../../api/appointments', () => ({
  appointmentsApi: { get, history, setStatus, reschedule, getAvailability, range, cancel: vi.fn() },
}));

vi.mock('../../api/documents', () => ({
  documentsApi: { checkRequired },
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
  patientPreRegistrationApi: { issueLink },
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

/* The grid's row for the same appointment: it carries what the detail view does not (G3). */
const dayRow = {
  id: 't1', calendarId: 'c1', patientId: 'p1', activityId: 'a-basic', activityName: 'Základní prohlídka',
  startUtc: '2026-10-26T08:30:00Z', endUtc: '2026-10-26T09:00:00Z', status: 0, isRunningLate: false,
  checkedInUtc: null, paperwork: { ready: false, missing: ['questionnaire_missing'] },
  patientName: 'Bohumil Komárek', partnerName: null, clubDiscountPercent: null,
  paymentState: 'unpaid' as const, invoiceId: 'inv-1',
};


const documentCheck = { allRequiredPresent: true, requirements: [] };

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  issueLink.mockReset().mockResolvedValue({
    url: 'https://sportmedical.test/dokonceni/tok',
    path: '/dokonceni/tok',
    token: 'tok',
    referenceNumber: 'R1',
    expiresAtUtc: '2026-10-27T08:30:00Z',
  });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
  get.mockReset().mockResolvedValue(appointment);
  range.mockReset().mockResolvedValue([dayRow]);
  checkRequired.mockReset().mockResolvedValue(documentCheck);
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

const withPaperwork = (paperwork: unknown) => get.mockResolvedValue({ ...appointment, paperwork });

describe('the consent line on the appointment card', () => {
  it('names the missing consents in Czech when consent_missing is among the codes', async () => {
    withPaperwork({ ready: false, missing: ['consent_missing'], missingConsents: ['treatment', 'club'] });
    renderDetail();
    expect(await screen.findByText('Registrace není dokončena')).toBeInTheDocument();
    expect(
      screen.getByText(/Chybí souhlasy: .*zdravotním stavu.*, Sdílení výsledků se sportovním klubem/),
    ).toBeInTheDocument();
  });

  it('shows the bare line when the server named no consents, and does not crash', async () => {
    withPaperwork({ ready: false, missing: ['consent_missing'] });
    renderDetail();
    expect(await screen.findByText('Chybí souhlasy')).toBeInTheDocument();
  });

  it('keeps the existing questionnaire notice working next to the consent line', async () => {
    withPaperwork({ ready: false, missing: ['questionnaire_missing', 'consent_missing'], missingConsents: ['report_email'] });
    renderDetail();
    expect(await screen.findByText('Registrace není dokončena')).toBeInTheDocument();
    expect(screen.getByText(/Chybí dotazník · Chybí souhlasy: Zaslání zprávy e-mailem/)).toBeInTheDocument();
  });

  it('keeps the old single-reason sentence when only the questionnaire is missing', async () => {
    renderDetail();
    expect(await screen.findByText('Pacient zatím nevyplnil vstupní dotazník.')).toBeInTheDocument();
    expect(screen.queryByText(/Chybí souhlasy/)).not.toBeInTheDocument();
  });

  it.each(['phone', 'tablet', 'desktop'] as ViewportName[])('renders the line at %s width', async (name) => {
    setViewport(VIEWPORTS[name]);
    withPaperwork({ ready: false, missing: ['consent_missing'], missingConsents: ['treatment'] });
    renderDetail();
    expect(await screen.findByText(/Chybí souhlasy: /)).toBeInTheDocument();
  });
});
