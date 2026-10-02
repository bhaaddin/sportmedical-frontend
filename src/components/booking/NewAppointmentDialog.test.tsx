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
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const listCalendars = vi.fn();
const listActivities = vi.fn();
const preview = vi.fn();
const getAvailability = vi.fn();
const create = vi.fn();
const createUnregistered = vi.fn();
const listPatients = vi.fn();
const getProfile = vi.fn();
const preRegister = vi.fn();
const issueLink = vi.fn();
const getAllClubs = vi.fn();

vi.mock('../../api/calendars', () => ({ calendarsApi: { list: listCalendars } }));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../../api/workingHours', () => ({ workingHoursApi: { preview } }));
vi.mock('../../api/appointments', () => ({
  appointmentsApi: { getAvailability, create, createUnregistered },
}));
vi.mock('../../api/patients', () => ({ patientsApi: { list: listPatients, getProfile } }));
vi.mock('../../api/patientPreRegistration', () => ({
  patientPreRegistrationApi: { preRegister, issueLink },
}));
vi.mock('../../services/clubsApi', () => ({ clubsApi: { getAll: getAllClubs } }));

const { NewAppointmentDialog } = await import('./NewAppointmentDialog');

/** Where the club flow lands: the reservation screen reads the slot from `location.state`. */
function ReservationStub() {
  const location = useLocation();
  return <pre data-testid="vyhrazeni-state">{JSON.stringify(location.state)}</pre>;
}

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
          <Route path="/vyhrazeni" element={<ReservationStub />} />
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
  createUnregistered.mockReset().mockResolvedValue({ startUtc: '2026-09-24T07:00:00Z' });
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
    expect(within(who).getByRole('radio', { name: 'Klub' })).not.toBeChecked();
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

  it('"Změnit" from the grid closes the drawer so the slot is picked again there', async () => {
    const { onClose } = renderDialog();
    await userEvent.click(await screen.findByRole('button', { name: 'Změnit' }));
    expect(onClose).toHaveBeenCalled();
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
    expect(getAvailability).toHaveBeenCalledWith('c1', 'a1', '2026-09-24', '2026-09-24');

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

describe('rychlá registrace', () => {
  it('books a caller as a walk-in when there is only a name and a telephone', async () => {
    window.localStorage.setItem(
      'permissions',
      JSON.stringify(['bookings.create', 'patients.view', 'patients.register']),
    );
    renderDialog();

    await userEvent.click(screen.getByRole('radio', { name: 'Rychlá registrace' }));
    expect(screen.getByText('Krok 1 ze 2 — nový pacient')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Jméno a příjmení'), 'Nový Pacient');
    await userEvent.type(screen.getByLabelText('Telefon'), '773 539 001');

    const go = screen.getByRole('button', { name: 'Pokračovat' });
    expect(go).toBeEnabled();
    await userEvent.click(go);

    expect(await screen.findByText('Krok 2 ze 2 — co se bude dělat')).toBeInTheDocument();
    expect(screen.getByText('Nový Pacient')).toBeInTheDocument();
    expect(screen.getByText(/registrace se doplní na místě/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Poslat odkaz/ })).toBeDisabled();
    expect(preRegister).not.toHaveBeenCalled();

    await pickActivity();
    await screen.findByText('Slot je volný. Nekoliduje s žádnou rezervací ani s obědem.');
    await userEvent.click(screen.getByRole('button', { name: 'Objednat termín' }));

    await waitFor(() => expect(createUnregistered).toHaveBeenCalledTimes(1));
    expect(createUnregistered).toHaveBeenCalledWith({
      calendarId: 'c1',
      activityId: 'a1',
      startUtc: '2026-09-24T07:00:00.000Z',
      name: 'Nový Pacient',
      phone: '+420773539001',
      note: null,
      overrideReason: undefined,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('registers a real patient with e-mail and date of birth, then issues the link after booking', async () => {
    window.localStorage.setItem(
      'permissions',
      JSON.stringify(['bookings.create', 'patients.view', 'patients.register']),
    );
    renderDialog();

    await userEvent.click(screen.getByRole('radio', { name: 'Rychlá registrace' }));
    await userEvent.type(screen.getByLabelText('Jméno a příjmení'), 'Nový Pacient');
    await userEvent.type(screen.getByLabelText('Telefon'), '+421 908 123 456');
    await userEvent.type(screen.getByLabelText('E-mail'), 'novy@example.cz');
    fireEvent.change(screen.getByLabelText('Datum narození'), { target: { value: '1990-05-05' } });
    expect(screen.getByText(/Víc teď nepotřebujeme/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Vytvořit a pokračovat' }));

    await waitFor(() =>
      expect(preRegister).toHaveBeenCalledWith({
        firstName: 'Nový',
        lastName: 'Pacient',
        dateOfBirth: '1990-05-05',
        email: 'novy@example.cz',
        phone: '+421908123456',
      }),
    );
    expect(await screen.findByText('Krok 2 ze 2 — co se bude dělat')).toBeInTheDocument();
    expect(screen.getByLabelText('Vybraný pacient Nový Pacient')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Poslat odkaz/ })).toBeChecked();
    /* Nothing is issued before the booking: the e-mail is to name the appointment. */
    expect(issueLink).not.toHaveBeenCalled();

    await pickActivity();
    await screen.findByText('Slot je volný. Nekoliduje s žádnou rezervací ani s obědem.');
    await userEvent.click(screen.getByRole('button', { name: 'Objednat termín' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ patientId: 'np1' })),
    );
    await waitFor(() => expect(issueLink).toHaveBeenCalledWith('np1'));
    expect(await screen.findByText('https://sportmedical.test/r/abc')).toBeInTheDocument();
    expect(screen.getByText(/E-mail s odkazem je ve frontě/)).toBeInTheDocument();
  });

  it('is offered from an empty search with the typed name carried over', async () => {
    window.localStorage.setItem(
      'permissions',
      JSON.stringify(['bookings.create', 'patients.view', 'patients.register']),
    );
    listPatients.mockResolvedValue({ items: [], totalCount: 0 });
    renderDialog();

    await userEvent.type(screen.getByLabelText('Jméno nebo příjmení'), 'Nikdo Takový');
    await userEvent.click(await screen.findByRole('button', { name: 'Rychlá registrace' }));

    expect(screen.getByRole('radio', { name: 'Rychlá registrace' })).toBeChecked();
    expect(screen.getByLabelText('Jméno a příjmení')).toHaveValue('Nikdo Takový');
  });
});

describe('klub', () => {
  it('hands the club and the slot over to the reservation screen', async () => {
    renderDialog();

    await userEvent.click(screen.getByRole('radio', { name: 'Klub' }));
    expect(screen.getByRole('heading', { name: 'Hromadná rezervace pro klub' })).toBeInTheDocument();
    expect(screen.getByText('Krok 1 ze 2 — který klub')).toBeInTheDocument();

    const club = await screen.findByRole('radio', { name: 'FK Slaný' });
    expect(club).toHaveTextContent('Jan Novák · +420 606 112 884');
    expect(screen.getByText('1 klub')).toBeInTheDocument();
    await userEvent.click(club);
    await userEvent.click(screen.getByRole('button', { name: 'Pokračovat' }));

    const state = JSON.parse((await screen.findByTestId('vyhrazeni-state')).textContent ?? '{}');
    expect(state).toEqual({
      calendarId: 'c1',
      startUtc: '2026-09-24T07:00:00.000Z',
      endUtc: '2026-09-24T08:00:00.000Z',
      clubId: 'k1',
    });
  });

  it('carries a club founded on the spot as newClub', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole('radio', { name: 'Klub' }));
    await screen.findByRole('radio', { name: 'FK Slaný' });

    await userEvent.click(screen.getByRole('button', { name: 'Nový klub — není v seznamu' }));
    await userEvent.type(screen.getByLabelText('Název klubu'), 'TJ Sokol Slaný');
    await userEvent.type(screen.getByLabelText('Počet sportovců'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Pokračovat' }));

    const state = JSON.parse((await screen.findByTestId('vyhrazeni-state')).textContent ?? '{}');
    expect(state.clubId).toBeUndefined();
    /* The shape /vyhrazeni reads (ReservationHandoff.newClub): nothing typed is
       left out as undefined, so the reservation form starts with what was given. */
    expect(state.newClub).toEqual({
      name: 'TJ Sokol Slaný',
      headcount: 12,
    });
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
