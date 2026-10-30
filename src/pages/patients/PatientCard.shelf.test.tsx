/*
 * The patient's card as shelves: the header (name, status badges, the next booking as a connected chip, a pin), the
 * sticky tabs, the "Související" shelf and the overview's own shelves. Opening a card writes it to the person's recents
 * - an id and a name, nothing else.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { getMemory, resetMemoryCacheForTests } from '../../ui/shelf/memory';

const getById = vi.fn();
const getTemplates = vi.fn();
const getPatientDocuments = vi.fn();
const checkRequired = vi.fn();
const getConsents = vi.fn();
const getByPatient = vi.fn();
const listActivities = vi.fn();
const getInvoices = vi.fn();
const getClubs = vi.fn();
const fetchAllAppointments = vi.fn();
const fetchUpcomingWindow = vi.fn();

vi.mock('../../api/patients', () => ({ patientsApi: { getById, getProfile: vi.fn().mockResolvedValue(null) } }));
vi.mock('../../api/documents', async () => {
  const actual = await vi.importActual<typeof import('../../api/documents')>('../../api/documents');
  return { ...actual, documentsApi: { getTemplates, getPatientDocuments, checkRequired } };
});
vi.mock('../../api/client', () => ({ default: { get: getConsents } }));
vi.mock('../../api/diagnostics', () => ({ diagnosticsApi: { getByPatient, downloadPdf: vi.fn() } }));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../../api/billing', () => ({ billingApi: { getInvoices } }));
vi.mock('../../api/clubs', () => ({ clubsApi: { getAll: getClubs } }));
vi.mock('../../components/patients/appointmentsSource', () => ({
  ALL_APPOINTMENTS_KEY: ['scheduling', 'appointments', 'all'],
  UPCOMING_WINDOW_KEY: ['day', 'upcoming-window'],
  fetchAllAppointments,
  fetchUpcomingWindow,
}));
vi.mock('../../components/booking/patient/CompletionLinkButton', () => ({ CompletionLinkButton: () => null }));
vi.mock('../../components/booking/patient/PortalLinkButton', () => ({ PortalLinkButton: () => null }));

const { default: PatientLayout } = await import('./PatientLayout');
const { default: PatientDetails } = await import('../PatientDetails');

const PATIENT = { id: 'p1', firstName: 'Jana', lastName: 'Marková', dateOfBirth: '1990-05-15', sex: 'Female', status: 'Active' };

const windowRow = (over: Record<string, unknown> = {}) => ({
  id: 'w1', calendarId: 'k1', patientId: 'p1', activityId: 'act', activityName: 'Kontrola',
  startUtc: '2099-02-01T08:00:00Z', endUtc: '2099-02-01T08:30:00Z', status: 0, isRunningLate: false, checkedInUtc: null, paperwork: null,
  partnerName: 'FC Sparta', ...over,
});

beforeEach(() => {
  localStorage.clear();
  resetMemoryCacheForTests();
  setViewport(VIEWPORTS.desktop);
  localStorage.setItem('user', JSON.stringify({ id: 'u1' }));
  localStorage.setItem('permissions', JSON.stringify(['patients.view', 'billing.manage', 'patients.edit']));
  getById.mockReset().mockResolvedValue(PATIENT);
  getTemplates.mockReset().mockResolvedValue([]);
  getPatientDocuments.mockReset().mockResolvedValue([
    { id: 'd1', patientId: 'p1', templateId: 't', templateName: 'Výpis', status: 'SignedOff', uploadedAt: '2026-09-01T10:00:00Z' },
  ]);
  checkRequired.mockReset().mockResolvedValue({ allRequiredPresent: true, requirements: [] });
  getConsents.mockReset().mockResolvedValue({ data: [] });
  getByPatient.mockReset().mockResolvedValue([]);
  listActivities.mockReset().mockResolvedValue({ activities: [] });
  getInvoices.mockReset().mockResolvedValue([
    {
      id: 'i1', patientId: 'p1', patientName: 'Jana Marková', invoiceNumber: 'FA-1', status: 'Issued', totalCzk: 1000, paidCzk: 0, remainingCzk: 1000,
      currency: 'CZK', issueDateUtc: '2026-10-01T10:00:00Z', dueDateUtc: '2099-11-01T10:00:00Z', items: [],
    },
  ]);
  getClubs.mockReset().mockResolvedValue([{ id: 'c1', name: 'FC Sparta', ico: '1', paymentTermsDays: 14, isActive: true, createdAt: '2026-01-01' }]);
  fetchAllAppointments.mockReset().mockResolvedValue([]);
  fetchUpcomingWindow.mockReset().mockResolvedValue([windowRow()]);
});

const renderCard = (path = '/patients/p1') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/patients/:id" element={<PatientLayout />}>
            <Route index element={<PatientDetails />} />
            <Route path="dokumenty" element={<div>DOKUMENTY</div>} />
          </Route>
          <Route path="/kalendar/:calendarId/termin/:appointmentId" element={<div>TERMÍN</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('the header', () => {
  it('is the patient: one h1 with the name, the year and the status badge', async () => {
    renderCard();
    expect(await screen.findByRole('heading', { level: 1, name: 'Jana Marková' })).toBeInTheDocument();
    expect(screen.getByText(/nar\. 1990/)).toBeInTheDocument();
    expect(screen.getByText('Aktivní')).toBeInTheDocument();
  });

  it('names the next booking as a connected chip that opens it', async () => {
    renderCard();
    await screen.findByRole('heading', { level: 1 });
    const chips = await screen.findByRole('list', { name: 'Propojené' });
    const chip = await within(chips).findByRole('link', { name: /Termín: .*Kontrola/ });
    expect(chip).toHaveAttribute('href', '/kalendar/k1/termin/w1');
  });

  it('offers the booking as the primary action, and a pin', async () => {
    renderCard();
    expect(await screen.findByRole('button', { name: 'Objednat termín' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Připnout: Jana Marková' })).toBeInTheDocument();
  });

  it('pins the card to the person\'s shelf', async () => {
    renderCard();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Připnout: Jana Marková' }));
    expect(getMemory().pinned.map((p) => `${p.kind}:${p.id}`)).toEqual(['patient:p1']);
    expect(screen.getByRole('button', { name: 'Odepnout: Jana Marková' })).toBeInTheDocument();
  });
});

describe('recents', () => {
  it('opening a card remembers it as an id and a name, nothing else', async () => {
    renderCard();
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(getMemory().recents).toHaveLength(1));
    expect(getMemory().recents[0]).toMatchObject({ kind: 'patient', id: 'p1', label: 'Jana Marková' });
    const raw = localStorage.getItem('sm-shelf:u1') ?? '';
    expect(raw).not.toContain('1990');
    expect(raw).not.toContain('Female');
  });

  it('does not remember a patient who could not be opened', async () => {
    getById.mockRejectedValue(new Error('404'));
    renderCard();
    await screen.findByText(/neexistuje, nebo na něj nemáte přístup/);
    expect(getMemory().recents).toEqual([]);
  });
});

describe('Související', () => {
  it('connects the patient to termíny, faktury, dokumenty and klub, each a chip that opens the thing', async () => {
    renderCard();
    const related = await screen.findByRole('region', { name: 'Související' });

    const appointments = await within(related).findByRole('link', { name: /Termín: .*Kontrola/ });
    expect(appointments).toHaveAttribute('href', '/kalendar/k1/termin/w1');
    expect(await within(related).findByRole('link', { name: 'Faktura: FA-1' })).toHaveAttribute('href', '/billing?invoice=i1');
    expect(await within(related).findByRole('link', { name: 'Dokument: Výpis' })).toHaveAttribute('href', '/patients/p1/dokumenty');
    expect(await within(related).findByRole('link', { name: 'Klub: FC Sparta' })).toHaveAttribute('href', '/clubs/c1');
    expect(within(related).getByText('Souhlasy')).toBeInTheDocument();
  });

  it('has no Faktury without billing.manage, and does not ask for them', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view']));
    renderCard();
    const related = await screen.findByRole('region', { name: 'Související' });
    await within(related).findByRole('link', { name: /Termín: .*Kontrola/ });
    expect(within(related).queryByRole('heading', { name: 'Faktury' })).toBeNull();
    expect(getInvoices).not.toHaveBeenCalledWith({ patientId: 'p1' });
  });

  it('turns an empty relation into the next action', async () => {
    fetchUpcomingWindow.mockResolvedValue([]);
    getPatientDocuments.mockResolvedValue([]);
    getInvoices.mockResolvedValue([]);
    renderCard();
    const related = await screen.findByRole('region', { name: 'Související' });
    expect(await within(related).findByText('Žádný termín v příštích dnech.')).toBeInTheDocument();
    expect(within(related).getByRole('link', { name: 'Objednat termín' })).toHaveAttribute('href', '/planovani');
    expect(await within(related).findByText('Zatím žádný dokument.')).toBeInTheDocument();
    expect(await within(related).findByText('Zatím žádná faktura.')).toBeInTheDocument();
  });

  it('says it is still loading rather than claiming there are no documents', async () => {
    getPatientDocuments.mockReturnValue(new Promise(() => undefined));
    renderCard();
    const related = await screen.findByRole('region', { name: 'Související' });
    expect(within(related).queryByText('Zatím žádný dokument.')).toBeNull();
    expect(within(related).getByLabelText('Dokumenty: načítám')).toBeInTheDocument();
  });
});

describe('the overview is shelves', () => {
  it('has a region for each block, in the order a desk reads them', async () => {
    const { container } = renderCard();
    await screen.findByRole('region', { name: 'Související' });
    const names = Array.from(container.querySelectorAll('[data-shelf-overview] section[data-shelf]')).map((s) => s.getAttribute('data-shelf'));
    expect(names).toEqual(['related', 'personal', 'visits', 'results', 'next', 'alerts']);
  });

  it('keeps the tabs on screen (sticky) and marks the open section', async () => {
    renderCard();
    const tab = await screen.findByRole('tab', { name: 'Přehled' });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(tab.closest('[class*="MuiBox-root"]')).not.toBeNull();
  });

  it('draws the paperwork banners above the tabs and not inside a section', async () => {
    checkRequired.mockResolvedValue({
      allRequiredPresent: false,
      requirements: [{ templateId: 't', templateName: 'Výpis', serviceName: 'Prohlídky', appointmentId: 'w1', startUtc: '2099-02-01T08:00:00Z', standing: 'Missing' }],
    });
    renderCard();
    expect(await screen.findByText('Chybí doklady k objednaným termínům')).toBeInTheDocument();
  });
});

describe('on a phone', () => {
  it('pins the primary action at the bottom and swipes through the related cards', async () => {
    setViewport(VIEWPORTS.phone);
    renderCard();
    const pinned = await screen.findByRole('region', { name: 'Hlavní akce' });
    expect(within(pinned).getByRole('button', { name: 'Objednat termín' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Objednat termín' })).toHaveLength(1);
    const related = await screen.findByRole('region', { name: 'Související' });
    expect(related).toHaveAttribute('data-state', 'ready');
  });
});
