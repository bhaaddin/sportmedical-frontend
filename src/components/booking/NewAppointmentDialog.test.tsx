/*
 * Booking from the grid, in the board's two-step drawer: the time is already
 * chosen, so the drawer opens at "kdo přijde" with the slot card filled, and
 * step 2 books exactly the instant the server offered - or, when it did not,
 * offers only what it did.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../test/viewport';

/* Typing through MUI is slow on a loaded machine; these are whole-flow tests. */
vi.setConfig({ testTimeout: 20000 });

const listCalendars = vi.fn();
const listActivities = vi.fn();
const preview = vi.fn();
const getAvailability = vi.fn();
const create = vi.fn();
const createUnregistered = vi.fn();
const createQuick = vi.fn();
const listPatients = vi.fn();
const getProfile = vi.fn();
const getById = vi.fn();
const preRegister = vi.fn();
const issueLink = vi.fn();
const getAllClubs = vi.fn();
const getOnSiteOptions = vi.fn();
const recordOnSite = vi.fn();

vi.mock('../../api/onSiteConsents', () => ({ onSiteConsentsApi: { getOptions: getOnSiteOptions, record: recordOnSite }, default: { getOptions: getOnSiteOptions, record: recordOnSite } }));
vi.mock('../../api/calendars', () => ({ calendarsApi: { list: listCalendars } }));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../../api/workingHours', () => ({ workingHoursApi: { preview } }));
vi.mock('../../api/appointments', () => ({
  appointmentsApi: { getAvailability, create, createUnregistered, createQuick },
}));
vi.mock('../../api/patients', () => ({ patientsApi: { list: listPatients, getProfile, getById } }));
vi.mock('../../api/patientPreRegistration', () => ({
  patientPreRegistrationApi: { preRegister, issueLink },
}));
/* The drawer books patients only (Etapa 4 D8): the clubs register is never read here. */
vi.mock('../../services/clubsApi', () => ({ clubsApi: { getAll: getAllClubs } }));

const { NewAppointmentDialog } = await import('./NewAppointmentDialog');

function renderDialog(props: Partial<Parameters<typeof NewAppointmentDialog>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onBooked = vi.fn();
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <NewAppointmentDialog
                open
                onClose={onClose}
                onBooked={onBooked}
                initialCalendarId="c1"
                initialStart="2026-09-24T09:00"
                initialEnd="2026-09-24T10:00"
                {...props}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onBooked, onClose };
}

async function pickPatient() {
  await userEvent.type(screen.getByLabelText('Jméno nebo příjmení'), 'Fehér');
  await userEvent.click(await screen.findByText('Filip Fehér'));
  await userEvent.click(screen.getByRole('button', { name: 'Pokračovat' }));
  expect(await screen.findByText('Krok 2 ze 2 — co se bude dělat')).toBeInTheDocument();
}

async function pickActivity(name = 'Prohlídka') {
  await userEvent.click(await screen.findByRole('radio', { name }));
}

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'patients.view']));
  listCalendars.mockReset().mockResolvedValue([
    { id: 'c1', name: 'Sportovní prohlídka', isActive: true },
    { id: 'c2', name: 'Sportovní diagnostika', isActive: true },
  ]);
  listActivities.mockReset().mockResolvedValue({
    activities: [
      { id: 'a1', name: 'Prohlídka', durationMinutes: 30, isActive: true, priceCzk: 1600 },
      { id: 'a2', name: 'Diagnostika', durationMinutes: 90, isActive: true, priceCzk: null },
    ],
    warnings: [],
  });
  preview.mockReset().mockResolvedValue([
    { date: '2026-09-24', isOpen: true, closedBecause: null, offeredActivityIds: ['a1'] },
  ]);
  getAvailability.mockReset().mockResolvedValue([
    { startUtc: '2026-09-24T07:00:00Z', endUtc: '2026-09-24T07:30:00Z' },
    { startUtc: '2026-09-24T07:30:00Z', endUtc: '2026-09-24T08:00:00Z' },
  ]);
  create.mockReset().mockResolvedValue({
    appointment: { startUtc: '2026-09-24T07:00:00Z' },
    warnings: [],
  });
  getOnSiteOptions.mockReset().mockResolvedValue({ activityId: 'a1', options: [{ code: 'treatment', label: 'Souhlas s poskytnutím služeb', required: true }] });
  recordOnSite.mockReset().mockResolvedValue({ patientId: 'np1', recorded: [], alreadyOnFile: [], missingConsents: [], paperwork: null });
  createUnregistered.mockReset().mockResolvedValue({ startUtc: '2026-09-24T07:00:00Z' });
  createQuick.mockReset().mockResolvedValue({
    appointment: {
      id: 'q1',
      startUtc: '2026-09-24T07:00:00Z',
      endUtc: '2026-09-24T07:30:00Z',
      activityName: 'Prohlídka',
      registrationDeadlineUtc: '2026-09-25T07:00:00Z',
      quickRegistrationPending: true,
    },
    patientId: 'np1',
    completionLink: {
      url: 'https://sportmedical.test/dokonceni/tok123',
      token: 'tok123',
      expiresAtUtc: '2026-09-25T07:00:00Z',
    },
    registrationDeadlineUtc: '2026-09-25T07:00:00Z',
  });
  listPatients.mockReset().mockResolvedValue({
    items: [
      {
        id: 'p1',
        firstName: 'Filip',
        lastName: 'Fehér',
        fullName: 'Filip Fehér',
        dateOfBirth: '1990-01-01',
        phone: '+420 777 123 456',
      },
    ],
    totalCount: 1,
  });
  getProfile.mockReset().mockResolvedValue({ phone: '+420 777 123 456', email: 'filip@example.cz' });
  preRegister.mockReset().mockResolvedValue({ patientId: 'np1' });
  getById.mockReset().mockResolvedValue({ id: 'np1', firstName: 'Nový', lastName: 'Pacient', fullName: 'Nový Pacient' });
  issueLink.mockReset().mockResolvedValue({
    url: 'https://sportmedical.test/r/abc',
    path: '/r/abc',
    token: 'abc',
    referenceNumber: 'R1',
    expiresAtUtc: '2026-09-25T07:00:00Z',
    emailQueued: true,
  });
  getAllClubs.mockReset().mockResolvedValue([
    {
      id: 'k1',
      name: 'FK Slaný',
      ico: '123',
      contactPerson: 'Jan Novák',
      contactPhone: '+420 606 112 884',
      discountPercent: 10,
      athleteCount: 62,
      paymentTermsDays: 14,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ]);
});

describe('step 1 — kdo přijde', () => {
  it('opens at the patient with the slot card filled and "Z databáze" chosen', async () => {
    renderDialog();

    expect(screen.getByRole('heading', { name: 'Objednat termín' })).toBeInTheDocument();
    expect(screen.getByText('Krok 1 ze 2 — kdo přijde')).toBeInTheDocument();
    expect(await screen.findByText('Čtvrtek 24. 9. 2026 · 09:00 — 10:00')).toBeInTheDocument();
    expect(screen.getByText('60 minut volno · Sportovní prohlídka')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Změnit' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Čas od')).not.toBeInTheDocument();

    const who = screen.getByRole('radiogroup', { name: 'Kdo se objednává' });
    expect(within(who).getByRole('radio', { name: 'Z databáze' })).toBeChecked();
    expect(within(who).getByRole('radio', { name: 'Rychlá registrace' })).not.toBeChecked();
    expect(within(who).getAllByRole('radio')).toHaveLength(2);
    expect(within(who).queryByRole('radio', { name: 'Klub' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pokračovat' })).toBeDisabled();
  });

  it('finds the patient in the database and shows the row with the telephone', async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText('Jméno nebo příjmení'), 'Fehér');
    const list = await screen.findByRole('list', { name: 'Nalezení pacienti' });
    expect(within(list).getByText('Filip Fehér')).toBeInTheDocument();
    expect(within(list).getByText('nar. 1. 1. 1990 · +420 777 123 456')).toBeInTheDocument();
    expect(screen.getByText('1 nalezen')).toBeInTheDocument();

    await userEvent.click(within(list).getByText('Filip Fehér'));
    expect(await screen.findByLabelText('Vybraný pacient Filip Fehér')).toHaveTextContent(
      '+420 777 123 456 · filip@example.cz',
    );
    expect(screen.getByRole('button', { name: 'Pokračovat' })).toBeEnabled();
  });

  it('"Změnit" offers the quick choices, and "Vybrat v kalendáři" closes the drawer', async () => {
    const { onClose } = renderDialog();
    await userEvent.click(await screen.findByRole('button', { name: 'Změnit' }));
    const menu = screen.getByRole('menu', { name: 'Změnit termín' });
    expect(within(menu).getByRole('menuitem', { name: 'Zítra' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Příští týden' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Jiné datum a čas' })).toBeInTheDocument();
    /* Nobody answers "next free" here, so it is not offered. */
    expect(within(menu).queryByRole('menuitem', { name: 'Příští volný termín' })).not.toBeInTheDocument();
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Vybrat v kalendáři' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('"Zítra" and "Příští týden" move the slot card a day and a week on, keeping the time', async () => {
    renderDialog();
    expect(await screen.findByText('Čtvrtek 24. 9. 2026 · 09:00 — 10:00')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Změnit' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Zítra' }));
    expect(screen.getByText('Pátek 25. 9. 2026 · 09:00 — 10:00')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Změnit' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Příští týden' }));
    expect(screen.getByText('Pátek 2. 10. 2026 · 09:00 — 10:00')).toBeInTheDocument();
    /* The day's offer is asked again for the new date. */
    await waitFor(() => expect(preview).toHaveBeenCalledWith('c1', '2026-10-02', '2026-10-02'));
  });

  it('"Příští volný termín" asks the calendar and takes what it answers', async () => {
    const onFindNextFree = vi.fn().mockResolvedValue({ date: '2026-09-28', time: '08:00', end: '08:30' });
    renderDialog({ onFindNextFree });
    await userEvent.click(await screen.findByRole('button', { name: 'Změnit' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Příští volný termín' }));
    await waitFor(() => expect(onFindNextFree).toHaveBeenCalledWith({ date: '2026-09-24', time: '09:00' }, 'c1'));
    expect(await screen.findByText('Pondělí 28. 9. 2026 · 08:00 — 08:30')).toBeInTheDocument();
  });

  it('says so when there is no free slot in the month ahead', async () => {
    const onFindNextFree = vi.fn().mockResolvedValue(null);
    renderDialog({ onFindNextFree });
    await userEvent.click(await screen.findByRole('button', { name: 'Změnit' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Příští volný termín' }));
    expect(await screen.findByText('V příštích 31 dnech kalendář nenabízí žádný volný termín.')).toBeInTheDocument();
    expect(screen.getByText('Čtvrtek 24. 9. 2026 · 09:00 — 10:00')).toBeInTheDocument();
  });

  it('"Jiné datum a čas" shows the fields', async () => {
    renderDialog();
    await userEvent.click(await screen.findByRole('button', { name: 'Změnit' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Jiné datum a čas' }));
    expect(screen.getByLabelText('Datum')).toHaveValue('2026-09-24');
    expect(screen.getByLabelText('Čas od')).toHaveValue('09:00');
  });

  it('says why a closed day offers nothing', async () => {
    preview.mockResolvedValue([
      { date: '2026-09-28', isOpen: false, closedBecause: 'holiday', offeredActivityIds: [] },
    ]);
    renderDialog({ initialStart: '2026-09-28T09:00', initialEnd: '2026-09-28T10:00' });

    const alert = await screen.findByText(/V tento den kalendář nenabízí žádnou činnost/);
    expect(alert).toHaveTextContent('V tento den kalendář nenabízí žádnou činnost: svátek.');
  });
});

describe('step 2 — co se bude dělat', () => {
  it('offers the day\'s činnosti first, the rest behind the link, and books the offered instant', async () => {
    const { onBooked } = renderDialog();
    await pickPatient();

    expect(screen.getByLabelText('Vybraný pacient Filip Fehér')).toBeInTheDocument();
    const group = await screen.findByRole('radiogroup', { name: 'Činnost' });
    expect(within(group).getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Prohlídka',
    ]);
    expect(within(group).getByText('1 600 Kč')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Zobrazit všechny činnosti z ceníku' }));
    expect(within(group).getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Prohlídka',
      'Diagnostika',
    ]);
    expect(within(group).getByText(/dnes se nenabízí/)).toBeInTheDocument();

    await pickActivity();

    expect(
      await screen.findByText('Slot je volný. Nekoliduje s žádnou rezervací ani s obědem.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Datum')).toHaveValue('2026-09-24');
    expect(screen.getByLabelText('Čas od')).toHaveValue('09:00');
    expect(screen.getByLabelText('Trvání')).toHaveValue('30 min');
    expect(screen.getByLabelText('Čas do')).toHaveValue('09:30');
    expect(screen.getByText('Celkem k úhradě').nextSibling).toHaveTextContent('1 600 Kč');
    expect(getAvailability).toHaveBeenCalledWith('c1', 'a1', '2026-09-24', '2026-09-24', { staffStarts: true });

    await userEvent.type(screen.getByLabelText('Poznámka'), 'Přijde dřív');
    await userEvent.click(screen.getByRole('button', { name: 'Objednat termín' }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith({
      patientId: 'p1',
      calendarId: 'c1',
      activityId: 'a1',
      startUtc: '2026-09-24T07:00:00.000Z',
      source: 0,
      note: 'Přijde dřív',
      overrideReason: undefined,
    });
    expect(onBooked).toHaveBeenCalled();
    expect(await screen.findByText('Termín je objednaný')).toBeInTheDocument();
    /* The link was not asked for, so none was issued. */
    expect(issueLink).not.toHaveBeenCalled();
  });

  it('offers only the server\'s times when the chosen one is taken', async () => {
    renderDialog({ initialStart: '2026-09-24T08:00', initialEnd: '2026-09-24T08:30' });
    await pickPatient();
    await pickActivity();

    expect(await screen.findByText(/V 08:00 tuto činnost nabídnout nelze/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Objednat termín' })).toBeDisabled();
    /* Without bookings.edit there is no way past the offer at all. */
    expect(screen.queryByRole('button', { name: 'Objednat mimo nabídku' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '09:30' }));

    expect(
      await screen.findByText('Slot je volný. Nekoliduje s žádnou rezervací ani s obědem.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Čas do')).toHaveValue('10:00');
    await userEvent.click(screen.getByRole('button', { name: 'Objednat termín' }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ startUtc: '2026-09-24T07:30:00.000Z' }),
      ),
    );
  });

  it('lets bookings.edit book past the offer only with a typed reason', async () => {
    window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'bookings.edit']));
    renderDialog({ initialStart: '2026-09-24T08:00', initialEnd: undefined });
    await pickPatient();
    await pickActivity();

    await userEvent.click(await screen.findByRole('button', { name: 'Objednat mimo nabídku' }));
    const book = screen.getByRole('button', { name: 'Přetlačit a objednat' });
    expect(book).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Důvod přetlačení'), 'Pacient přijede z Brna');
    await userEvent.click(book);

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          startUtc: '2026-09-24T06:00:00.000Z',
          overrideReason: 'Pacient přijede z Brna',
        }),
      ),
    );
  });

  it('goes back to step 1 with ‹ and keeps the patient', async () => {
    renderDialog();
    await pickPatient();
    await userEvent.click(screen.getByRole('button', { name: 'Zpět' }));
    expect(await screen.findByText('Krok 1 ze 2 — kdo přijde')).toBeInTheDocument();
    expect(screen.getByLabelText('Vybraný pacient Filip Fehér')).toBeInTheDocument();
  });
});

const QUICK_PERMISSIONS = ['bookings.create', 'patients.view', 'patients.register'];

/** Axios-shaped refusal, the way the booking endpoint answers it. */
async function refusal(status: number, data: unknown) {
  const { AxiosError, AxiosHeaders } = await import('axios');
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', String(status), config as never, undefined, {
    status,
    statusText: '',
    headers: {},
    config: config as never,
    data,
  });
}

/** Type the four facts and choose the činnost; the slot's offer is asked of the server after that. */
async function fillQuick(
  facts: { name?: string; phone?: string; email?: string; activity?: string | null } = {},
) {
  const { name = 'Nový Pacient', phone = '773539001', email = 'novy@example.cz', activity = 'Prohlídka' } = facts;
  await userEvent.click(screen.getByRole('radio', { name: 'Rychlá registrace' }));
  await userEvent.type(screen.getByLabelText('Jméno a příjmení'), name);
  await userEvent.type(screen.getByLabelText('Telefon'), phone);
  await userEvent.type(screen.getByLabelText('E-mail'), email);
  if (activity !== null) {
    await userEvent.click(screen.getByRole('combobox', { name: 'Prohlídka, na kterou volal' }));
    await userEvent.click(await screen.findByRole('option', { name: new RegExp(`^${activity} —`) }));
  }
}

describe('rychlá registrace — čtyři údaje', () => {
  beforeEach(() => {
    window.localStorage.setItem('permissions', JSON.stringify(QUICK_PERMISSIONS));
  });

  it('asks for exactly four things and never for a date of birth', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole('radio', { name: 'Rychlá registrace' }));

    expect(screen.getByText('Rychlá registrace — nový pacient')).toBeInTheDocument();
    expect(screen.getByText('Nový pacient — čtyři údaje')).toBeInTheDocument();
    expect(screen.getByLabelText('Jméno a příjmení')).toBeInTheDocument();
    expect(screen.getByLabelText('Telefon')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Prohlídka, na kterou volal' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Datum narození')).not.toBeInTheDocument();
    expect(screen.queryByText(/Datum narození/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Víc teď nepotřebujeme/)).toBeInTheDocument();
    /* The slot is chosen, so there is no second step to continue to. */
    expect(screen.getByRole('button', { name: 'Vytvořit rezervaci' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Pokračovat' })).not.toBeInTheDocument();
  });

  it('lists the činnosti with price and minutes from the price list', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole('radio', { name: 'Rychlá registrace' }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Prohlídka, na kterou volal' }));
    expect(await screen.findByRole('option', { name: /^Prohlídka — 1.600.Kč · 30 min$/ })).toBeInTheDocument();
    /* The rest of the price list follows, marked as not offered today. */
    expect(screen.getByRole('option', { name: /^Diagnostika — .* · 90 min · dnes se nenabízí$/ })).toBeInTheDocument();
  });

  it('records the consents signed on paper for the new patient once the quick booking succeeds', async () => {
    renderDialog();
    await fillQuick();
    await screen.findByText('Slot je volný. Nekoliduje s žádnou rezervací ani s obědem.');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Souhlas s poskytnutím služeb' }));
    await userEvent.click(screen.getByRole('button', { name: 'Vytvořit rezervaci' }));
    await waitFor(() => expect(createQuick).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(recordOnSite).toHaveBeenCalledWith('np1', { activityId: 'a1', consents: ['treatment'], note: null }));
  });

  it('records nothing when no paper consent is ticked', async () => {
    renderDialog();
    await fillQuick();
    await screen.findByText('Slot je volný. Nekoliduje s žádnou rezervací ani s obědem.');
    await userEvent.click(screen.getByRole('button', { name: 'Vytvořit rezervaci' }));
    await waitFor(() => expect(createQuick).toHaveBeenCalledTimes(1));
    expect(recordOnSite).not.toHaveBeenCalled();
  });

  it('books the chosen slot with one call and shows the deadline, the link and what is prefilled', async () => {
    const { onBooked } = renderDialog();
    await fillQuick();
    expect(
      await screen.findByText('Slot je volný. Nekoliduje s žádnou rezervací ani s obědem.'),
    ).toBeInTheDocument();
    expect(getAvailability).toHaveBeenCalledWith('c1', 'a1', '2026-09-24', '2026-09-24', { staffStarts: true });

    await userEvent.click(screen.getByRole('button', { name: 'Vytvořit rezervaci' }));

    await waitFor(() => expect(createQuick).toHaveBeenCalledTimes(1));
    expect(createQuick).toHaveBeenCalledWith('c1', {
      activityId: 'a1',
      startUtc: '2026-09-24T07:00:00.000Z',
      firstName: 'Nový',
      lastName: 'Pacient',
      /* The dialling code travels with the number. */
      phone: '+420773539001',
      email: 'novy@example.cz',
      overrideReason: undefined,
    });
    /* No second booking path, no separate pre-registration, no walk-in. */
    expect(create).not.toHaveBeenCalled();
    expect(createUnregistered).not.toHaveBeenCalled();
    expect(preRegister).not.toHaveBeenCalled();
    expect(onBooked).toHaveBeenCalled();

    expect(await screen.findByRole('heading', { name: 'Rezervace vytvořena' })).toBeInTheDocument();
    /* 2026-09-25T07:00Z is 09:00 in Prague; the length comes from the server, not from a literal. */
    expect(screen.getByText('Pacient má čas na dokončení registrace do 25. 9. 2026 09:00')).toBeInTheDocument();
    expect(screen.queryByText(/24 hodin/)).not.toBeInTheDocument();
    expect(screen.getByTestId('quick-completion-link')).toHaveTextContent(
      'https://sportmedical.test/dokonceni/tok123',
    );
    /* What the patient will find prefilled. */
    const prefilled = screen.getByText('Pacient už má vyplněno').parentElement as HTMLElement;
    expect(within(prefilled).getByText('Nový Pacient')).toBeInTheDocument();
    expect(within(prefilled).getByText('+420773539001')).toBeInTheDocument();
    expect(within(prefilled).getByText('novy@example.cz')).toBeInTheDocument();
    expect(within(prefilled).getByText(/Prohlídka — 1.600.Kč · 30 min/)).toBeInTheDocument();
    /* Nothing was sent - and the page says so. */
    expect(screen.getByText('Odkaz zatím odešlete sami — odesílání zpráv se připravuje.')).toBeInTheDocument();
    expect(issueLink).not.toHaveBeenCalled();
  });

  it('copies the link with the big Kopírovat button and says so in a toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderDialog();
    await fillQuick();
    await userEvent.click(await screen.findByRole('button', { name: 'Vytvořit rezervaci' }));
    await screen.findByRole('heading', { name: 'Rezervace vytvořena' });

    await userEvent.click(screen.getByRole('button', { name: 'Kopírovat' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://sportmedical.test/dokonceni/tok123'));
    expect(await screen.findByText('Odkaz zkopírován do schránky')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zkopírováno' })).toBeInTheDocument();
  });

  it('builds the link from the token when the server knows no public address', async () => {
    createQuick.mockResolvedValue({
      appointment: { id: 'q1', startUtc: '2026-09-24T07:00:00Z', endUtc: '2026-09-24T07:30:00Z', activityName: 'Prohlídka' },
      patientId: 'np1',
      completionLink: { url: null, token: 'tok123', expiresAtUtc: '2026-09-25T07:00:00Z' },
      registrationDeadlineUtc: '2026-09-25T07:00:00Z',
    });
    renderDialog();
    await fillQuick();
    await userEvent.click(await screen.findByRole('button', { name: 'Vytvořit rezervaci' }));
    expect(await screen.findByTestId('quick-completion-link')).toHaveTextContent(
      `${window.location.origin}/dokonceni/tok123`,
    );
  });

  it('"Objednat další" starts over at the mode cards', async () => {
    renderDialog();
    await fillQuick();
    await userEvent.click(await screen.findByRole('button', { name: 'Vytvořit rezervaci' }));
    await screen.findByRole('heading', { name: 'Rezervace vytvořena' });
    await userEvent.click(screen.getByRole('button', { name: 'Objednat další' }));
    expect(await screen.findByRole('radiogroup', { name: 'Kdo se objednává' })).toBeInTheDocument();
  });

  it('keeps the button off until all four are filled, and says what is wrong with the obvious', async () => {
    renderDialog();
    await fillQuick({ name: 'Filip', email: 'x@', activity: null });
    await userEvent.click(screen.getByLabelText('Jméno a příjmení'));
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Vytvořit rezervaci' })).toBeDisabled();
    expect(screen.getByText('Zadejte jméno i příjmení.')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('E-mail'));
    await userEvent.tab();
    expect(screen.getByText('E-mail nevypadá správně.')).toBeInTheDocument();
  });

  it('shows the server refusal at the box it names, keeping the form as typed', async () => {
    createQuick.mockRejectedValue(
      await refusal(400, {
        code: 'appointments.quick.phone_unusable',
        message: 'Telefon není platné číslo. Zadejte ho s předvolbou.',
        errors: { field: ['phone'] },
      }),
    );
    renderDialog();
    await fillQuick();
    await userEvent.click(await screen.findByRole('button', { name: 'Vytvořit rezervaci' }));

    expect(await screen.findByText('Telefon není platné číslo. Zadejte ho s předvolbou.')).toBeInTheDocument();
    expect(screen.getByLabelText('Telefon')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Jméno a příjmení')).toHaveValue('Nový Pacient');
    expect(screen.queryByRole('heading', { name: 'Rezervace vytvořena' })).not.toBeInTheDocument();
  });

  it('points a refused e-mail and a refused činnost at their own boxes', async () => {
    createQuick.mockRejectedValueOnce(
      await refusal(422, { code: 'appointments.quick.email_invalid', message: 'E-mail je neplatný.', errors: { field: ['email'] } }),
    );
    renderDialog();
    await fillQuick();
    await userEvent.click(await screen.findByRole('button', { name: 'Vytvořit rezervaci' }));
    expect(await screen.findByText('E-mail je neplatný.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true');

    /* Typing again clears the refusal; the next one lands on the činnost. */
    createQuick.mockRejectedValueOnce(
      await refusal(422, { code: 'appointments.quick.activity_not_offered', errors: { field: ['activityId'] } }),
    );
    await userEvent.type(screen.getByLabelText('E-mail'), 'x');
    await waitFor(() => expect(screen.queryByText('E-mail je neplatný.')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Vytvořit rezervaci' }));
    expect(
      await screen.findByText('Tuto prohlídku v daný čas nelze nabídnout. Vyberte jinou, nebo jiný čas.'),
    ).toBeInTheDocument();
  });

  it('takes a slot somebody else got first calmly: the offer reloads and the form stays', async () => {
    createQuick.mockRejectedValue(await refusal(409, { message: 'Termín mezitím někdo obsadil.' }));
    renderDialog();
    await fillQuick();
    await screen.findByText('Slot je volný. Nekoliduje s žádnou rezervací ani s obědem.');
    const offers = getAvailability.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Vytvořit rezervaci' }));

    expect(await screen.findByText('Termín mezitím někdo obsadil.')).toBeInTheDocument();
    await waitFor(() => expect(getAvailability.mock.calls.length).toBeGreaterThan(offers));
    expect(screen.getByLabelText('Jméno a příjmení')).toHaveValue('Nový Pacient');
  });

  it('shows a refusal that names no box as one plain message', async () => {
    createQuick.mockRejectedValue(await refusal(500, {}));
    renderDialog();
    await fillQuick();
    await userEvent.click(await screen.findByRole('button', { name: 'Vytvořit rezervaci' }));
    expect(await screen.findByText('Pacienta se nepodařilo založit. Zkuste to prosím znovu.')).toBeInTheDocument();
  });

  it('books past the offer only for bookings.edit, with a typed reason', async () => {
    window.localStorage.setItem('permissions', JSON.stringify([...QUICK_PERMISSIONS, 'bookings.edit']));
    renderDialog({ initialStart: '2026-09-24T08:00', initialEnd: undefined });
    await fillQuick();

    expect(await screen.findByText(/V 08:00 tuto činnost nabídnout nelze/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vytvořit rezervaci' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Objednat mimo nabídku' }));
    const go = screen.getByRole('button', { name: 'Přetlačit a objednat' });
    expect(go).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Důvod přetlačení'), 'Pacient přijede z Brna');
    await userEvent.click(go);
    await waitFor(() =>
      expect(createQuick).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ startUtc: '2026-09-24T06:00:00.000Z', overrideReason: 'Pacient přijede z Brna' }),
      ),
    );
  });

  it('types the telephone with the country picker and sends one dialling-code string', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole('radio', { name: 'Rychlá registrace' }));
    expect(screen.getByTestId('phone-country-note')).toHaveTextContent('Česko');
    await userEvent.type(screen.getByLabelText('Telefon'), '773539001');
    expect(screen.getByLabelText('Telefon')).toHaveValue('773 539 001');
    await userEvent.click(screen.getByRole('button', { name: /Předvolba \+420/ }));
    await userEvent.type(screen.getByLabelText('Hledat zemi nebo předvolbu'), '421');
    await userEvent.click(screen.getByRole('menuitem', { name: /Slovensko/ }));
    expect(screen.getByTestId('phone-country-note')).toHaveTextContent('Slovensko');

    await userEvent.type(screen.getByLabelText('Jméno a příjmení'), 'Nový Pacient');
    await userEvent.type(screen.getByLabelText('E-mail'), 'novy@example.cz');
    await userEvent.click(screen.getByRole('combobox', { name: 'Prohlídka, na kterou volal' }));
    await userEvent.click(await screen.findByRole('option', { name: /^Prohlídka —/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Vytvořit rezervaci' }));
    await waitFor(() =>
      expect(createQuick).toHaveBeenCalledWith('c1', expect.objectContaining({ phone: '+421773539001' })),
    );
  });

  it('is offered from an empty search with the typed name carried over', async () => {
    listPatients.mockResolvedValue({ items: [], totalCount: 0 });
    renderDialog();

    await userEvent.type(screen.getByLabelText('Jméno nebo příjmení'), 'Nikdo Takový');
    await userEvent.click(await screen.findByRole('button', { name: 'Rychlá registrace' }));

    expect(screen.getByRole('radio', { name: 'Rychlá registrace' })).toBeChecked();
    expect(screen.getByLabelText('Jméno a příjmení')).toHaveValue('Nikdo Takový');
  });
});

describe('no clubs in the patient drawer (D8)', () => {
  it('has no club mode, no club search and never reads the clubs register', async () => {
    renderDialog();
    expect(screen.queryByRole('radio', { name: 'Klub' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/klub/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hromadná rezervace pro klub/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nový klub/ })).not.toBeInTheDocument();
    expect(getAllClubs).not.toHaveBeenCalled();
  });
});

describe('jen zablokovat čas bez pacienta', () => {
  it('books the slot under the event name with nobody behind it', async () => {
    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Jen zablokovat čas bez pacienta' }));
    expect(screen.getByText('Krok 1 ze 2 — bez pacienta')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Název události (nepovinné)'), 'Školení');
    await userEvent.click(screen.getByRole('button', { name: 'Pokračovat' }));

    expect(await screen.findByText('Krok 2 ze 2 — co se bude dělat')).toBeInTheDocument();
    await pickActivity();
    await screen.findByText('Slot je volný. Nekoliduje s žádnou rezervací ani s obědem.');
    await userEvent.click(screen.getByRole('button', { name: 'Objednat termín' }));

    await waitFor(() =>
      expect(createUnregistered).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Školení', phone: null }),
      ),
    );
  });
});

describe('booking without a time chosen', () => {
  it('asks for the calendar, date and time first', async () => {
    renderDialog({ initialCalendarId: undefined, initialStart: undefined, initialEnd: undefined, initialDate: '2026-09-24' });

    expect(await screen.findByLabelText('Čas od')).toBeInTheDocument();
    expect(screen.getByLabelText('Datum')).toHaveValue('2026-09-24');
    expect(screen.getByRole('combobox', { name: 'Kalendář' })).toBeInTheDocument();
    expect(screen.getByText('Nejprve vyberte kalendář, datum a čas.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pokračovat' })).toBeDisabled();
  });
});

/* ── Etapa 5: the desk's own starts and "Jiný čas" ── */
describe('staff starts and "Jiný čas"', () => {
  /* 07:40Z is 09:40 in Prague: the next start 10 minutes after a 30-minute booking that ended at 09:30. */
  const withChained = () =>
    getAvailability.mockResolvedValue([
      { startUtc: '2026-09-24T07:30:00Z', endUtc: '2026-09-24T08:00:00Z', kinds: ['blockStart', 'step'] },
      { startUtc: '2026-09-24T07:40:00Z', endUtc: '2026-09-24T08:10:00Z', kinds: ['chained'] },
    ]);

  it('asks for the staff list and labels a chained start "po předchozí rezervaci"', async () => {
    withChained();
    renderDialog({ initialStart: '2026-09-24T08:00', initialEnd: '2026-09-24T08:30' });
    await pickPatient();
    await pickActivity();

    expect(await screen.findByText(/V 08:00 tuto činnost nabídnout nelze/)).toBeInTheDocument();
    expect(getAvailability).toHaveBeenCalledWith('c1', 'a1', '2026-09-24', '2026-09-24', { staffStarts: true });
    expect(screen.getByRole('button', { name: '09:40' })).toBeInTheDocument();
    const labels = screen.getAllByTestId('chained-label');
    expect(labels).toHaveLength(1);
    expect(labels[0]).toHaveTextContent('po předchozí rezervaci');
  });

  it('books a chained start straight away, as an offered one', async () => {
    withChained();
    renderDialog({ initialStart: '2026-09-24T09:40', initialEnd: '2026-09-24T10:10' });
    await pickPatient();
    await pickActivity();

    expect(await screen.findByText('Slot je volný. Nekoliduje s žádnou rezervací ani s obědem.')).toBeInTheDocument();
    expect(screen.getByTestId('chained-note')).toHaveTextContent('Začíná hned po předchozí rezervaci');
    await userEvent.click(screen.getByRole('button', { name: 'Objednat termín' }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ startUtc: '2026-09-24T07:40:00.000Z', overrideReason: undefined })),
    );
  });

  it('"Jiný čas": any minute typed is booked without an override reason', async () => {
    withChained();
    renderDialog({ initialStart: '2026-09-24T08:00', initialEnd: '2026-09-24T08:30' });
    await pickPatient();
    await pickActivity();
    await screen.findByText(/V 08:00 tuto činnost nabídnout nelze/);
    expect(screen.getByRole('button', { name: 'Objednat termín' })).toBeDisabled();

    const free = screen.getByTestId('free-time');
    await userEvent.type(within(free).getByLabelText('Jiný čas'), '10:05');
    await userEvent.click(within(free).getByRole('button', { name: 'Použít tento čas' }));

    expect(await screen.findByText(/Čas 10:05 je mimo nabídku/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Objednat termín' }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ startUtc: '2026-09-24T08:05:00.000Z', overrideReason: undefined })),
    );
  });

  it('"Jiný čas": refuses text that is not HH:mm and books nothing', async () => {
    withChained();
    renderDialog({ initialStart: '2026-09-24T08:00', initialEnd: '2026-09-24T08:30' });
    await pickPatient();
    await pickActivity();
    const free = await screen.findByTestId('free-time');
    await userEvent.type(within(free).getByLabelText('Jiný čas'), '25:99');
    expect(within(free).getByText('Zadejte čas ve tvaru HH:mm, například 09:40.')).toBeInTheDocument();
    expect(within(free).getByRole('button', { name: 'Použít tento čas' })).toBeDisabled();
    expect(create).not.toHaveBeenCalled();
  });

  it('"Jiný čas": shows the server\'s own text when the whole length does not fit (422)', async () => {
    withChained();
    const { BookingApiError } = await import('../../api/apiError');
    create.mockRejectedValue(new BookingApiError('domainRule', 422, 'Do tohoto času se celá délka činnosti nevejde.'));
    renderDialog({ initialStart: '2026-09-24T08:00', initialEnd: '2026-09-24T08:30' });
    await pickPatient();
    await pickActivity();
    const free = await screen.findByTestId('free-time');
    await userEvent.type(within(free).getByLabelText('Jiný čas'), '15:50');
    await userEvent.click(within(free).getByRole('button', { name: 'Použít tento čas' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Objednat termín' }));
    expect(await screen.findByText('Do tohoto času se celá délka činnosti nevejde.')).toBeInTheDocument();
  });

  it('"Jiný čas": a 409 from the server is shown as the usual conflict and the offer reloads', async () => {
    withChained();
    const { BookingApiError } = await import('../../api/apiError');
    create.mockRejectedValue(new BookingApiError('conflict', 409, 'Tento čas už obsadila jiná rezervace.'));
    renderDialog({ initialStart: '2026-09-24T08:00', initialEnd: '2026-09-24T08:30' });
    await pickPatient();
    await pickActivity();
    const free = await screen.findByTestId('free-time');
    await userEvent.type(within(free).getByLabelText('Jiný čas'), '10:05');
    await userEvent.click(within(free).getByRole('button', { name: 'Použít tento čas' }));
    const calls = getAvailability.mock.calls.length;
    await userEvent.click(await screen.findByRole('button', { name: 'Objednat termín' }));
    expect(await screen.findByText('Tento čas už obsadila jiná rezervace.')).toBeInTheDocument();
    await waitFor(() => expect(getAvailability.mock.calls.length).toBeGreaterThan(calls));
  });
});
