/*
 * The patient-facing forms read their wording from the editable slots (Média a texty): the
 * default is what was shown before, the admin's text replaces it, and the legal REQUIREMENT
 * (the consent to the examination) stays in code. Rendered at the three widths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { CompletionResult } from '../../api/publicIntake';
import { SITE_CONTENT_KEY } from '../../api/siteContent';
import { DEFAULT_SITE_CONTENT } from '../../site/defaults';
import { VIEWPORTS, setViewport } from '../../test/viewport';

const openCompletionResult = vi.fn();

vi.mock('../../api/publicIntake', async () => {
  const actual = await vi.importActual<typeof import('../../api/publicIntake')>('../../api/publicIntake');
  return { ...actual, openCompletionResult };
});
vi.mock('../../api/publicContactCheck', () => ({
  checkPublicEmail: vi.fn().mockResolvedValue({ parses: true }),
  checkPublicPhone: vi.fn().mockResolvedValue(null),
  publicPhoneRegions: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../api/publicQuestionnaire', () => ({
  loadQuestionnaire: vi.fn().mockResolvedValue({ name: 'Zdravotní dotazník', definition: null }),
}));
vi.mock('../../api/consentSettings', () => ({
  useConsentSettings: () => ({ settings: { communicationVisible: false, communicationTitle: '', communicationDetail: '' } }),
}));
vi.mock('../../components/registration/MapyAddressPicker', () => ({ default: () => <div>ADRESA</div> }));
vi.mock('../../components/public/HealthQuestionnaire', () => ({ default: () => null }));
vi.mock('../../api/clinicSettings', async () => {
  const actual = await vi.importActual<typeof import('../../api/clinicSettings')>('../../api/clinicSettings');
  return {
    ...actual,
    readPublicClinic: vi.fn().mockResolvedValue({ name: 'Klinika', email: 'kontakt@example.cz', phone: '', address: '', bookingEnabled: true }),
  };
});
// The site-content request fails in a unit test: the slots must then keep what is in the cache / their defaults.
vi.mock('../../web/http', async () => {
  const actual = await vi.importActual<typeof import('../../web/http')>('../../web/http');
  return { ...actual, webHttp: { get: vi.fn().mockRejectedValue(new Error('offline')) } };
});

const { default: IntakeQuestionnaire } = await import('./IntakeQuestionnaire');

const result = (): CompletionResult => ({
  status: 'ok',
  view: {
    referenceNumber: 'R-1', givenName: 'Jan', familyName: 'Novák', email: 'jan@example.cz', phoneE164: '+420773539001',
    deadlineUtc: '2026-10-26T09:00:00Z',
    appointment: {
      activityName: 'Činnost A', serviceName: 'Služba B', startUtc: '2026-10-26T09:00:00Z', endUtc: '2026-10-26T09:40:00Z', requiredDocuments: [],
    },
    requireDateOfBirth: false, questionnaire: 'NotAsked',
  },
});

const renderForm = (slots: Record<string, string> = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(SITE_CONTENT_KEY, {
    ...DEFAULT_SITE_CONTENT,
    slots: Object.fromEntries(Object.entries(slots).map(([k, text]) => [k, { kind: 'text', text }])),
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/dokonceni/tok-1']}>
        <Routes><Route path="/dokonceni/:token" element={<IntakeQuestionnaire />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  window.sessionStorage.clear();
  openCompletionResult.mockReset().mockResolvedValue(result());
});

describe.each(Object.entries(VIEWPORTS))('the consent block at %s (%i px)', (_name, width) => {
  beforeEach(() => setViewport(width));

  it('shows the default wording, with the clinic e-mail filled in', async () => {
    renderForm();
    // A completion link has no held slot, so the generic wording of the examination consent applies.
    expect(await screen.findByText('Poskytnutí zdravotní služby')).toBeInTheDocument();
    expect(screen.getByText(/Souhlasím s poskytnutím zdravotní služby, kterou si objednám/)).toBeInTheDocument();
    expect(screen.getByText('CO DĚLÁME ZE ZÁKONA — NEPTÁME SE NA TO')).toBeInTheDocument();
    expect(screen.getByText(/kdykoli odvolat na kontakt@example\.cz\./)).toBeInTheDocument();
    expect(screen.getByText('Údaje putují šifrovaně a vidí je jen naše ordinace.')).toBeInTheDocument();
  });

  it("shows the admin's wording instead, and keeps the examination consent required", async () => {
    renderForm({
      'formulare.consent.statutory.heading': 'ZE ZÁKONA',
      'formulare.consent.treatment.detail.generic': 'Podepisuji výkon.',
      'formulare.consent.rights.text': 'Odvolání: {email}',
    });
    expect(await screen.findByText('ZE ZÁKONA')).toBeInTheDocument();
    expect(screen.getByText('Podepisuji výkon.')).toBeInTheDocument();
    expect(screen.getByText('Odvolání: kontakt@example.cz')).toBeInTheDocument();
    // The requirement is code, not wording: the consent row is still marked required.
    expect(screen.getAllByText(/povinn/i).length).toBeGreaterThan(0);
  });
});
