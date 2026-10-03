/*
 * "Nový pacient" after the design board.
 *
 * What would have to break for these to fail: the header counting something
 * other than the rules require, Rychlá registrace saving without issuing the
 * patient's completion link (or Úplná issuing one), Rychlá registrace asking
 * for a date of birth, the sticky footer's "Uložit a pokračovat" not being the
 * gate in front of the POST, a width getting the wrong layout.
 */
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

describe('the header', () => {
  it('counts the fields the chosen mode requires', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText(/^Úplná registrace — 0 z \d+ údajů$/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Rychlá' }));
    expect(screen.getByText('Rychlá registrace — 0 z 5 údajů')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Jméno'), 'Filip');
    expect(screen.getByText('Rychlá registrace — 1 z 5 údajů')).toBeInTheDocument();
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
  const openQuick = async (user: ReturnType<typeof userEvent.setup>) => {
    renderPage();
    await screen.findByRole('heading', { name: 'Nový pacient', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Rychlá' }));
  };

  it('asks for four things and never for a date of birth', async () => {
    const user = userEvent.setup();
    await openQuick(user);

    expect(screen.getByLabelText('Jméno')).toBeInTheDocument();
    expect(screen.getByLabelText('Příjmení')).toBeInTheDocument();
    expect(screen.getByLabelText('Telefon')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Prohlídka, na kterou volal' })).toBeInTheDocument();

    /* No date of birth, no sex, no insurance, no address - not even as an optional box. */
    expect(screen.queryByLabelText('Datum narození')).not.toBeInTheDocument();
    expect(document.querySelector('[data-field="dateOfBirth"]')).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Pohlaví' })).not.toBeInTheDocument();
    expect(screen.queryByText('Pojištění')).not.toBeInTheDocument();
    expect(screen.queryByText('Adresa')).not.toBeInTheDocument();
  });

  it('offers only the active činnosti, with minutes and the price from the ceník', async () => {
    const user = userEvent.setup();
    await openQuick(user);

    await user.click(screen.getByRole('combobox', { name: 'Prohlídka, na kterou volal' }));
    expect(await screen.findByRole('option', { name: ACTIVITY_OPTION })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Spiroergometrie · 45 min' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Zrušená/ })).not.toBeInTheDocument();
  });

  it('registers without a date of birth and hands over the completion link', async () => {
    const user = userEvent.setup();
    await openQuick(user);

    await fillTheFour(user);
    expect(screen.getByText('Rychlá registrace — 5 z 5 údajů')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Uložit a pokračovat' }));

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    const request = register.mock.calls[0]![0];
    expect(request.mode).toBe('Quick');
    expect(request.address).toBeNull();
    expect(request.dateOfBirth).toBeNull();
    expect(request.sex).toBe('NotSpecified');
    expect(request.administrativeProfile).toBeNull();
    /* The dialling code always travels with the number. */
    expect(request.phone).toMatchObject({ value: '+420773539001', regionCode: 'CZ' });
    expect(request.email.value).toBe('filip@email.cz');

    await waitFor(() => expect(issueLink).toHaveBeenCalledWith('p-new'));
    expect(await screen.findByText('Filip Fehér je zaregistrován')).toBeInTheDocument();
    expect(screen.getByText(/Základní prohlídka/)).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/registrace/tok-123`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kopírovat' })).toBeInTheDocument();
    expect(screen.getByText(/odešel na filip@email.cz/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Otevřít kartu pacienta' }));
    expect(await screen.findByText('karta-pacienta')).toBeInTheDocument();
  });

  it('goes to the card when no link can be issued', async () => {
    issueLink.mockRejectedValue(new Error('409'));
    const user = userEvent.setup();
    await openQuick(user);
    await fillTheFour(user);

    await user.click(screen.getByRole('button', { name: 'Uložit a pokračovat' }));

    expect(await screen.findByText('karta-pacienta')).toBeInTheDocument();
  });

  it('does not save with a required field missing, and never complains about the date of birth', async () => {
    const user = userEvent.setup();
    await openQuick(user);
    await user.type(screen.getByLabelText('Jméno'), 'Filip');

    await user.click(screen.getByRole('button', { name: 'Uložit a pokračovat' }));

    expect(await screen.findByText('Formulář obsahuje chyby. Zkontrolujte zvýrazněná pole.')).toBeInTheDocument();
    expect(screen.getByText('Příjmení je povinné.')).toBeInTheDocument();
    expect(screen.getByText('Vyberte činnost.')).toBeInTheDocument();
    expect(screen.queryByText('Datum narození je povinné.')).not.toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('says so, with "Zkusit znovu", when the činnosti cannot be loaded', async () => {
    listActivities.mockRejectedValueOnce(new Error('500'));
    const user = userEvent.setup();
    await openQuick(user);

    expect(await screen.findByText('Činnosti se nepodařilo načíst.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByRole('combobox', { name: 'Prohlídka, na kterou volal' })).toBeInTheDocument();
    expect(listActivities).toHaveBeenCalledTimes(2);
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

  it('still asks for the date of birth: shown as required, and it refuses to save without it', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Nový pacient', level: 1 });

    expect(screen.getByLabelText('Datum narození')).toBeInTheDocument();
    expect(document.querySelector('[data-field="dateOfBirth"]')?.textContent).toContain('*');

    await user.type(screen.getByLabelText('Jméno'), 'Filip');
    await user.click(screen.getByRole('button', { name: 'Uložit a pokračovat' }));

    expect(await screen.findByText('Datum narození je povinné.')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });
});

describe('the options cannot be loaded', () => {
  it('says what failed and offers "Zkusit znovu"', async () => {
    getOptions.mockReset().mockRejectedValueOnce(new Error('500')).mockResolvedValue({
      titlesBeforeName: [],
      titlesAfterName: [],
      insuranceRegistrationKinds: [{ code: 'CzechPublicHealthInsurance', displayValue: 'České' }],
      czechHealthInsurers: [],
      identityDocumentTypes: [],
      phoneRegions: [],
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Registraci nelze otevřít')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByRole('heading', { name: 'Nový pacient', level: 1 })).toBeInTheDocument();
  });
});

/*
 * The three layouts (brief, rule 3): 390 / 834 / 1440.
 * Each field grid says how it lays out in `data-layout`: "single" is one field
 * per row (the phone), "auto" is the two-column grid that an upright tablet
 * turns back into one column by a CSS media query.
 */
describe.each([
  ['phone', VIEWPORTS.phone],
  ['tablet', VIEWPORTS.tablet],
  ['desktop', VIEWPORTS.desktop],
] as const)('layout at %s', (device, width) => {
  const expectedLayout = device === 'phone' ? 'single' : 'auto';
  const grids = () => Array.from(document.querySelectorAll('[data-layout]'));

  it('lays the fields out for the width, with a PhoneField and the footer where it belongs', async () => {
    setViewport(width);
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Nový pacient', level: 1 });

    expect(document.querySelector('[data-device]')?.getAttribute('data-device')).toBe(device);
    expect(grids().length).toBeGreaterThan(0);
    for (const grid of grids()) {
      expect(grid.getAttribute('data-layout')).toBe(expectedLayout);
    }

    /* The telephone is a PhoneField everywhere: country picker + number. */
    expect(screen.getByLabelText('Telefon')).toBeInTheDocument();
    expect(screen.getByTestId('phone-country-note')).toBeInTheDocument();

    const footer = screen.getByRole('contentinfo');
    expect(footer.getAttribute('data-pinned')).toBe(device === 'phone' ? 'true' : 'false');
    expect(within(footer).getByRole('button', { name: 'Uložit a pokračovat' })).toBeInTheDocument();

    /* Quick mode on every width: no date of birth anywhere. */
    await user.click(screen.getByRole('button', { name: 'Rychlá' }));
    expect(screen.queryByLabelText('Datum narození')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Telefon')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Prohlídka, na kterou volal' })).toBeInTheDocument();
    for (const grid of grids()) {
      expect(grid.getAttribute('data-layout')).toBe(expectedLayout);
    }
  });
});
