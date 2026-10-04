import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../test/viewport';

const getOptions = vi.fn();
const register = vi.fn();
const searchPatients = vi.fn();
const inspectIdentity = vi.fn();
const inspectPhone = vi.fn();
const inspectEmail = vi.fn();
const issueLink = vi.fn();
const listActivities = vi.fn();
const getConsentOptions = vi.fn();
const recordConsents = vi.fn();

vi.mock('../api/patientRegistry', () => {
  const api = { getOptions, register, searchPatients, inspectIdentity, inspectPhone, inspectEmail };
  class PatientRegistryError extends Error {}
  return { default: api, patientRegistryApi: api, PatientRegistryError };
});
vi.mock('../api/activities', () => ({
  activitiesApi: { list: listActivities },
  default: { list: listActivities },
}));
vi.mock('../api/patientPreRegistration', () => ({
  patientPreRegistrationApi: { issueLink },
  default: { issueLink },
}));
vi.mock('../api/onSiteConsents', () => ({
  onSiteConsentsApi: { getOptions: getConsentOptions, record: recordConsents },
  default: { getOptions: getConsentOptions, record: recordConsents },
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../components/registration/MapyAddressPicker', () => ({
  default: ({ onSelect }: { onSelect: (v: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSelect({
          label: 'Václavská 2409, Kladno',
          street: 'Václavská',
          number: '2409',
          municipalityPart: null,
          municipality: 'Kladno',
          zip: '27201',
        })}
    >
      vybrat-adresu
    </button>
  ),
}));

const { default: PatientRegistration } = await import('./PatientRegistration');

/* A birth number the classifier reads: 1. 1. 1990, male. */
const BIRTH_NUMBER = '9001010007';

const ACTIVITY_OPTION = 'Základní prohlídka · 30 min · 1 600 Kč';

beforeEach(() => {
  getConsentOptions.mockReset().mockImplementation(async (activityId?: string | null) => ({
    activityId: activityId ?? null,
    options: activityId
      ? [
          { code: 'treatment', label: 'Souhlas se zpracováním údajů', required: true },
          { code: 'club', label: 'Souhlas se sdílením s klubem', required: true },
          { code: 'communication', label: 'Novinky a nabídky', required: false },
        ]
      : [{ code: 'treatment', label: 'Souhlas se zpracováním údajů', required: true }],
  }));
  recordConsents.mockReset().mockResolvedValue({
    patientId: 'p-new', recorded: [], alreadyOnFile: [], missingConsents: [], paperwork: null,
  });
  setViewport(VIEWPORTS.desktop);
  listActivities.mockReset().mockResolvedValue({
    activities: [
      { id: 'act-1', name: 'Základní prohlídka', durationMinutes: 30, priceCzk: 1600, isActive: true },
      { id: 'act-2', name: 'Spiroergometrie', durationMinutes: 45, priceCzk: null, isActive: true },
      { id: 'act-3', name: 'Zrušená činnost', durationMinutes: 15, priceCzk: null, isActive: false },
    ],
    warnings: [],
  });
  getOptions.mockReset().mockResolvedValue({
    titlesBeforeName: [],
    titlesAfterName: [],
    insuranceRegistrationKinds: [
      { code: 'CzechPublicHealthInsurance', displayValue: 'České veřejné zdravotní pojištění' },
      { code: 'NoCzechHealthInsuranceNumber', displayValue: 'Bez českého čísla pojištěnce' },
    ],
    czechHealthInsurers: [{ code: '111', displayValue: '111 — Všeobecná zdravotní pojišťovna' }],
    identityDocumentTypes: [{ code: 'Passport', displayValue: 'Cestovní pas' }],
    phoneRegions: [{ code: 'CZ', displayValue: 'Česko (+420)' }],
  });
  searchPatients.mockReset().mockResolvedValue([]);
  inspectIdentity.mockReset().mockResolvedValue({
    parses: true, insuranceNumber: BIRTH_NUMBER, kind: 'CzechBirthNumber',
    dateOfBirth: '1990-01-01', sex: 'Male', rejectionCode: null,
    dateOfBirthMatchesStated: true, sexMatchesStated: true,
  });
  inspectPhone.mockReset().mockResolvedValue({
    parses: true, isValid: true, isValidForRegion: true, e164: '+420773539001',
    international: '+420 773 539 001', national: '773 539 001', regionCode: 'CZ', detectedRegionCode: 'CZ',
  });
  inspectEmail.mockReset().mockResolvedValue({
    parses: true, canonical: 'filip@email.cz', displayValue: 'filip@email.cz', rejectionCode: null,
  });
  register.mockReset().mockResolvedValue({
    outcome: 'Created', patientId: 'p-new', registrationFingerprint: 'f',
    authorizationScopeFingerprint: null, candidateSetFingerprint: null, candidates: [],
  });
  issueLink.mockReset().mockResolvedValue({
    url: null, path: '/registrace/tok-123', token: 'tok-123', referenceNumber: 'R-1',
    expiresAtUtc: '2026-10-04T10:00:00Z', emailQueued: true, emailWillSend: true, sentTo: 'filip@email.cz',
  });
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/patients/register']}>
      <Routes>
        <Route path="/patients/register" element={<PatientRegistration />} />
        <Route path="/patients/:id" element={<div>karta-pacienta</div>} />
        <Route path="/patients" element={<div>seznam-pacientu</div>} />
      </Routes>
    </MemoryRouter>,
  );

const pickOption = async (user: ReturnType<typeof userEvent.setup>, combobox: string, option: string) => {
  await user.click(screen.getByRole('combobox', { name: combobox }));
  await user.click(await screen.findByRole('option', { name: option }));
};

/* Úplná registrace: the seven fields. */
const fillTheSeven = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Jméno'), 'Filip');
  await user.type(screen.getByLabelText('Příjmení'), 'Fehér');
  /* The birth number fills date of birth and sex by itself. */
  await user.type(screen.getByLabelText('Číslo pojištěnce'), BIRTH_NUMBER);
  await pickOption(user, 'Zdravotní pojišťovna', '111 — Všeobecná zdravotní pojišťovna');
  await user.type(screen.getByLabelText('E-mail'), 'filip@email.cz');
};

/* Rychlá registrace: the four things - name, telephone, e-mail, činnost. */
const fillTheFour = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Jméno'), 'Filip');
  await user.type(screen.getByLabelText('Příjmení'), 'Fehér');
  await user.type(screen.getByLabelText('Telefon'), '773539001');
  await user.type(screen.getByLabelText('E-mail'), 'filip@email.cz');
  await pickOption(user, 'Prohlídka, na kterou volal', ACTIVITY_OPTION);
};

const consentBoxes = () => within(screen.getByTestId('on-site-consents')).getAllByRole('checkbox');

describe.each(['phone', 'tablet', 'desktop'] as const)('Souhlasy podepsané na místě at %s width', (name) => {
  beforeEach(() => setViewport(VIEWPORTS[name]));

  it('Rychlá: offers the server list for the chosen činnost, all unticked', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Nový pacient', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Rychlá' }));
    expect(await screen.findByText('Souhlasy podepsány na místě (papírově)')).toBeInTheDocument();
    /* No činnost yet: just the treatment consent. */
    await waitFor(() => expect(consentBoxes()).toHaveLength(1));
    expect(getConsentOptions).toHaveBeenCalledWith(null);

    await pickOption(user, 'Prohlídka, na kterou volal', ACTIVITY_OPTION);
    await waitFor(() => expect(consentBoxes()).toHaveLength(3));
    expect(getConsentOptions).toHaveBeenLastCalledWith('act-1');
    consentBoxes().forEach((box) => expect(box).not.toBeChecked());
    expect(screen.getByText(/Novinky a nabídky \(nepovinný\)/)).toBeInTheDocument();
  });
});

describe('recording the consents with the registration', () => {
  it('Rychlá: records ticked consents for the new patient and the činnost, after the registration', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Nový pacient', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Rychlá' }));
    await fillTheFour(user);
    await waitFor(() => expect(consentBoxes()).toHaveLength(3));
    await user.click(consentBoxes()[0]);
    await user.click(consentBoxes()[1]);
    await user.type(within(screen.getByTestId('on-site-consents')).getByLabelText('Poznámka'), 'papír');
    await user.click(screen.getByRole('button', { name: 'Uložit a pokračovat' }));

    await waitFor(() => expect(recordConsents).toHaveBeenCalledTimes(1));
    expect(recordConsents).toHaveBeenCalledWith('p-new', {
      activityId: 'act-1', consents: ['treatment', 'club'], note: 'papír',
    });
    expect(register.mock.invocationCallOrder[0]).toBeLessThan(recordConsents.mock.invocationCallOrder[0]);
    expect(await screen.findByText('Souhlasy podepsané na místě byly zapsány.')).toBeInTheDocument();
  });

  it('Rychlá: ticking nothing makes no consent call', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Nový pacient', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Rychlá' }));
    await fillTheFour(user);
    await user.click(screen.getByRole('button', { name: 'Uložit a pokračovat' }));
    await waitFor(() => expect(register).toHaveBeenCalled());
    await screen.findByText('Filip Fehér je zaregistrován');
    expect(recordConsents).not.toHaveBeenCalled();
  });

  it('Rychlá: a failed recording warns, keeps the registration and its link', async () => {
    recordConsents.mockRejectedValue({ response: { data: { code: 'consent.on_site.not_offered', message: 'Nenabízí se.' } } });
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Nový pacient', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Rychlá' }));
    await fillTheFour(user);
    await waitFor(() => expect(consentBoxes()).toHaveLength(3));
    await user.click(consentBoxes()[0]);
    await user.click(screen.getByRole('button', { name: 'Uložit a pokračovat' }));

    expect(await screen.findByText(/souhlasy se nepodařilo zapsat/)).toBeInTheDocument();
    expect(screen.getByText('Filip Fehér je zaregistrován')).toBeInTheDocument();
    expect(issueLink).toHaveBeenCalledWith('p-new');
  });

  it('Úplná: records with no činnost, then goes to the card', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Nový pacient', level: 1 });
    await fillTheSeven(user);
    await user.type(screen.getByLabelText('Telefon'), '773539001');
    await user.click(screen.getByRole('button', { name: 'vybrat-adresu' }));
    await waitFor(() => expect(consentBoxes()).toHaveLength(1));
    await user.click(consentBoxes()[0]);
    await user.click(screen.getByRole('button', { name: 'Uložit a pokračovat' }));

    await waitFor(() => expect(recordConsents).toHaveBeenCalledWith('p-new', {
      activityId: null, consents: ['treatment'], note: null,
    }));
    expect(await screen.findByText('karta-pacienta')).toBeInTheDocument();
  });
});
