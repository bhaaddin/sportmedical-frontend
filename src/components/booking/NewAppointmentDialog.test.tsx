/*
 * Booking from the grid: the time is already chosen, so the dialog opens at
 * the patient, says "od 09:00 do 10:00", and books exactly the instant the
 * server offered - or, when it did not, offers only what it did.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const listCalendars = vi.fn();
const listActivities = vi.fn();
const preview = vi.fn();
const getAvailability = vi.fn();
const create = vi.fn();
const listPatients = vi.fn();
const getProfile = vi.fn();

vi.mock('../../api/calendars', () => ({ calendarsApi: { list: listCalendars } }));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../../api/workingHours', () => ({ workingHoursApi: { preview } }));
vi.mock('../../api/appointments', () => ({ appointmentsApi: { getAvailability, create } }));
vi.mock('../../api/patients', () => ({ patientsApi: { list: listPatients, getProfile } }));

const { NewAppointmentDialog } = await import('./NewAppointmentDialog');

function renderDialog(props: Partial<Parameters<typeof NewAppointmentDialog>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onBooked = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NewAppointmentDialog
          open
          onClose={() => {}}
          onBooked={onBooked}
          initialCalendarId="c1"
          initialStart="2026-09-24T09:00"
          initialEnd="2026-09-24T10:00"
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onBooked };
}

async function pickPatientAndActivity() {
  await userEvent.type(screen.getByLabelText('Jméno nebo příjmení'), 'Fehér');
  await userEvent.click(await screen.findByText('Filip Fehér'));
  await userEvent.click(await screen.findByRole('combobox', { name: 'Činnost' }));
  await userEvent.click(await screen.findByRole('option', { name: /Prohlídka/ }));
}

beforeEach(() => {
  window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'patients.view']));
  listCalendars.mockReset().mockResolvedValue([
    { id: 'c1', name: 'Sportovní prohlídka', isActive: true },
    { id: 'c2', name: 'Sportovní diagnostika', isActive: true },
  ]);
  listActivities.mockReset().mockResolvedValue({
    activities: [
      { id: 'a1', name: 'Prohlídka', durationMinutes: 30, isActive: true },
      { id: 'a2', name: 'Diagnostika', durationMinutes: 90, isActive: true },
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
  listPatients.mockReset().mockResolvedValue({
    items: [{ id: 'p1', firstName: 'Filip', lastName: 'Fehér', fullName: 'Filip Fehér', dateOfBirth: '1990-01-01' }],
    totalCount: 1,
  });
  getProfile.mockReset().mockResolvedValue({ phone: '+420 777 123 456', email: 'filip@example.cz' });
});

describe('booking from the grid', () => {
  it('opens at the patient with the calendar and "od 09:00 do 10:00" already chosen', async () => {
    renderDialog();

    expect(screen.getByRole('heading', { name: 'Vyhledávání z databáze' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Klient' })).not.toBeInTheDocument();
    expect(await screen.findByText(/čtvrtek 24\. 9\. 2026 · od 09:00 do 10:00/)).toBeInTheDocument();
    expect(screen.getByText('Sportovní prohlídka')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Změnit' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Čas od')).not.toBeInTheDocument();
  });

  it('fills the patient in, offers only the day\'s činnosti and books the offered instant', async () => {
    const { onBooked } = renderDialog();

    await userEvent.type(screen.getByLabelText('Jméno nebo příjmení'), 'Fehér');
    await userEvent.click(await screen.findByText('Filip Fehér'));
    expect(await screen.findByDisplayValue('+420 777 123 456')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Filip')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Fehér')).toBeInTheDocument();
    expect(screen.getByDisplayValue('filip@example.cz')).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('combobox', { name: 'Činnost' }));
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Prohlídka · 30 min']);
    await userEvent.click(options[0]);

    expect(await screen.findByText('Čas je volný.')).toBeInTheDocument();
    expect(screen.getByText('Termín od 09:00 do 09:30 (30 min)')).toBeInTheDocument();
    expect(screen.getByText('Vybraný úsek v kalendáři: od 09:00 do 10:00.')).toBeInTheDocument();
    expect(getAvailability).toHaveBeenCalledWith('c1', 'a1', '2026-09-24', '2026-09-24');

    await userEvent.click(screen.getByRole('button', { name: 'Objednat' }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith({
      patientId: 'p1',
      calendarId: 'c1',
      activityId: 'a1',
      startUtc: '2026-09-24T07:00:00.000Z',
      source: 0,
      note: null,
      overrideReason: undefined,
    });
    expect(onBooked).toHaveBeenCalled();
    expect(await screen.findByText('Termín je objednaný')).toBeInTheDocument();
  });

  it('offers only the server\'s times when the chosen one is taken', async () => {
    renderDialog({ initialStart: '2026-09-24T08:00', initialEnd: '2026-09-24T08:30' });
    await pickPatientAndActivity();

    expect(
      await screen.findByText(/V 08:00 tuto činnost nabídnout nelze/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Objednat' })).toBeDisabled();
    /* Without bookings.edit there is no way past the offer at all. */
    expect(screen.queryByRole('button', { name: 'Objednat mimo nabídku' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '09:30' }));

    expect(await screen.findByText('Čas je volný.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Objednat' }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ startUtc: '2026-09-24T07:30:00.000Z' }),
      ),
    );
  });

  it('lets bookings.edit book past the offer only with a typed reason', async () => {
    window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'bookings.edit']));
    renderDialog({ initialStart: '2026-09-24T08:00', initialEnd: undefined });
    await pickPatientAndActivity();

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

  it('says why a closed day offers nothing', async () => {
    preview.mockResolvedValue([
      { date: '2026-09-28', isOpen: false, closedBecause: 'holiday', offeredActivityIds: [] },
    ]);
    renderDialog({ initialStart: '2026-09-28T09:00', initialEnd: '2026-09-28T10:00' });

    const alert = await screen.findByText(/V tento den kalendář nenabízí žádnou činnost/);
    expect(alert).toHaveTextContent('V tento den kalendář nenabízí žádnou činnost: svátek.');
  });
});

describe('booking without a time chosen', () => {
  it('asks for the calendar, date and time first', async () => {
    renderDialog({ initialCalendarId: undefined, initialStart: undefined, initialEnd: undefined, initialDate: '2026-09-24' });

    expect(await screen.findByLabelText('Čas od')).toBeInTheDocument();
    expect(screen.getByLabelText('Datum')).toHaveValue('2026-09-24');
    expect(screen.getByRole('combobox', { name: 'Kalendář' })).toBeInTheDocument();
    expect(screen.getByText('Nejprve vyberte kalendář, datum a čas.')).toBeInTheDocument();
  });
});
