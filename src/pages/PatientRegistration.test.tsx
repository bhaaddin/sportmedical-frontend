/*
 * "Nový pacient" after the design board.
 *
 * What would have to break for these to fail: the header counting something
 * other than the rules require, Rychlá registrace saving without issuing the
 * patient's completion link (or Úplná issuing one), the sticky footer's
 * "Uložit a pokračovat" not being the gate in front of the POST.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const getOptions = vi.fn();
const register = vi.fn();
const searchPatients = vi.fn();
const inspectIdentity = vi.fn();
const inspectPhone = vi.fn();
const inspectEmail = vi.fn();
const issueLink = vi.fn();

vi.mock('../api/patientRegistry', () => {
  const api = { getOptions, register, searchPatients, inspectIdentity, inspectPhone, inspectEmail };
  class PatientRegistryError extends Error {}
  return { default: api, patientRegistryApi: api, PatientRegistryError };
});
vi.mock('../api/patientPreRegistration', () => ({
  patientPreRegistrationApi: { issueLink },
  default: { issueLink },
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

beforeEach(() => {
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

const fillTheSeven = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Jméno'), 'Filip');
  await user.type(screen.getByLabelText('Příjmení'), 'Fehér');
  /* The birth number fills date of birth and sex by itself. */
  await user.type(screen.getByLabelText('Číslo pojištěnce'), BIRTH_NUMBER);
  await pickOption(user, 'Zdravotní pojišťovna', '111 — Všeobecná zdravotní pojišťovna');
  await user.type(screen.getByLabelText('E-mail'), 'filip@email.cz');
};

describe('the header', () => {
  it('counts the fields the chosen mode requires', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText(/^Úplná registrace — 0 z \d+ údajů$/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Rychlá' }));
    expect(screen.getByText('Rychlá registrace — 0 z 7 údajů')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Jméno'), 'Filip');
    expect(screen.getByText('Rychlá registrace — 1 z 7 údajů')).toBeInTheDocument();
  });

  it('explains in Rychlá what the patient fills in themselves', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Nový pacient', level: 1 });

    expect(screen.queryByText(/Víc teď nepotřebujeme/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rychlá' }));
    expect(screen.getByText(/Víc teď nepotřebujeme/)).toBeInTheDocument();
  });
});

describe('Rychlá registrace', () => {
  it('registers from the seven fields and hands over the completion link', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Nový pacient', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Rychlá' }));

    await fillTheSeven(user);
    expect(screen.getByText('Rychlá registrace — 7 z 7 údajů')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Uložit a pokračovat' }));

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    const request = register.mock.calls[0]![0];
    expect(request.mode).toBe('Quick');
    expect(request.address).toBeNull();
    expect(request.phone).toBeNull();
    expect(request.dateOfBirth).toBe('1990-01-01');
    expect(request.sex).toBe('Male');
    expect(request.administrativeProfile.birthNumber).toBe(BIRTH_NUMBER);

    await waitFor(() => expect(issueLink).toHaveBeenCalledWith('p-new'));
    expect(await screen.findByText('Filip Fehér je zaregistrován')).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/registrace/tok-123`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kopírovat' })).toBeInTheDocument();
    expect(screen.getByText(/odešel na filip@email.cz/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Otevřít kartu pacienta' }));
    expect(await screen.findByText('karta-pacienta')).toBeInTheDocument();
  });

  it('goes to the card when no link can be issued', async () => {
    issueLink.mockRejectedValue(new Error('409'));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Nový pacient', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Rychlá' }));
    await fillTheSeven(user);

    await user.click(screen.getByRole('button', { name: 'Uložit a pokračovat' }));

    expect(await screen.findByText('karta-pacienta')).toBeInTheDocument();
  });

  it('does not save with a required field missing', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Nový pacient', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Rychlá' }));
    await user.type(screen.getByLabelText('Jméno'), 'Filip');

    await user.click(screen.getByRole('button', { name: 'Uložit a pokračovat' }));

    expect(await screen.findByText('Formulář obsahuje chyby. Zkontrolujte zvýrazněná pole.')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });
});

describe('Úplná registrace', () => {
  it('sends the address and the telephone and goes straight to the card', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Nový pacient', level: 1 });

    await fillTheSeven(user);
    await user.type(screen.getByLabelText('Telefon'), '773539001');
    /* Česko by default, named under the field; the number grouped as it is typed. */
    expect(screen.getByTestId('phone-country-note')).toHaveTextContent('Česko');
    expect(screen.getByLabelText('Telefon')).toHaveValue('773 539 001');
    await user.click(screen.getByRole('button', { name: 'vybrat-adresu' }));

    const footer = screen.getByRole('contentinfo');
    await user.click(within(footer).getByRole('button', { name: 'Uložit a pokračovat' }));

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    const request = register.mock.calls[0]![0];
    expect(request.mode).toBe('Standard');
    expect(request.address).toMatchObject({ municipality: 'Kladno', zip: '27201', ruianAddressPointCode: 0 });
    /* One stored string with the dialling code - the server refuses a number without one. */
    expect(request.phone).toMatchObject({ value: '+420773539001', regionCode: 'CZ' });

    expect(await screen.findByText('karta-pacienta')).toBeInTheDocument();
    expect(issueLink).not.toHaveBeenCalled();
  });
});
