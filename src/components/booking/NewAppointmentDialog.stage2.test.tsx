/*
 * Stage 2 in the booking dialog:
 *   R17  "Objednat pacienta sem": the chosen time is the lunch (never in the offer), the booking goes to `into-lunch`, not to the ordinary call;
 *   R4   a booking the server refuses with `worker.busy` names the clash and gives the owner the override with a reason.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { BookingApiError } from '../../api/apiError';

vi.setConfig({ testTimeout: 30000 });

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
const bookIntoLunch = vi.fn();
const getOnSiteOptions = vi.fn();

vi.mock('../../api/onSiteConsents', () => ({ onSiteConsentsApi: { getOptions: getOnSiteOptions, record: vi.fn() }, default: { getOptions: getOnSiteOptions, record: vi.fn() } }));
vi.mock('../../api/calendars', () => ({ calendarsApi: { list: listCalendars } }));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../../api/workingHours', () => ({ workingHoursApi: { preview } }));
vi.mock('../../api/appointments', () => ({ appointmentsApi: { getAvailability, create, createUnregistered, createQuick } }));
vi.mock('../../api/patients', () => ({ patientsApi: { list: listPatients, getProfile, getById } }));
vi.mock('../../api/patientPreRegistration', () => ({ patientPreRegistrationApi: { preRegister: vi.fn(), issueLink: vi.fn() } }));
vi.mock('../../services/clubsApi', () => ({ clubsApi: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../api/lunchExceptions', async (importActual) => {
  const actual = await importActual<typeof import('../../api/lunchExceptions')>();
  return { ...actual, lunchExceptionsApi: { ...actual.lunchExceptionsApi, bookIntoLunch } };
});

const { NewAppointmentDialog } = await import('./NewAppointmentDialog');

function renderDialog(props: Partial<Parameters<typeof NewAppointmentDialog>[0]> = {}) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={<NewAppointmentDialog open onClose={vi.fn()} onBooked={vi.fn()} initialCalendarId="c1" initialStart="2026-09-24T09:00" initialEnd="2026-09-24T09:30" {...props} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function pickPatient() {
  await userEvent.type(screen.getByLabelText('Jméno nebo příjmení'), 'Fehér');
  await userEvent.click(await screen.findByText('Filip Fehér'));
  await userEvent.click(screen.getByRole('button', { name: 'Pokračovat' }));
  expect(await screen.findByText('Krok 2 ze 2 — co se bude dělat')).toBeInTheDocument();
}
const pickActivity = async () => userEvent.click(await screen.findByRole('radio', { name: 'Prohlídka' }));

const busy = (overridable: boolean) =>
  new BookingApiError('conflict', 409, 'Pracovník je v tuto dobu zaneprázdněn.', {
    code: 'worker.busy',
    details: { conflictKind: 'appointment', calendarName: 'Diagnostika', activityName: 'Spiroergometrie', startUtc: '2026-09-24T07:00:00Z', endUtc: '2026-09-24T07:45:00Z', overridable },
  });

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'patients.view']));
  listCalendars.mockReset().mockResolvedValue([{ id: 'c1', name: 'Sportovní prohlídka', isActive: true }]);
  listActivities.mockReset().mockResolvedValue({ activities: [{ id: 'a1', name: 'Prohlídka', durationMinutes: 30, isActive: true, priceCzk: 1600 }], warnings: [] });
  preview.mockReset().mockResolvedValue([{ date: '2026-09-24', isOpen: true, closedBecause: null, offeredActivityIds: ['a1'] }]);
  /* the offer never lists the lunch: 12:00 Prague (10:00Z) is not in it */
  getAvailability.mockReset().mockResolvedValue([{ startUtc: '2026-09-24T07:00:00Z', endUtc: '2026-09-24T07:30:00Z' }]);
  create.mockReset().mockResolvedValue({ appointment: { startUtc: '2026-09-24T07:00:00Z' }, warnings: [] });
  createUnregistered.mockReset().mockResolvedValue({ startUtc: '2026-09-24T10:00:00Z' });
  createQuick.mockReset();
  bookIntoLunch.mockReset().mockResolvedValue({ appointment: { startUtc: '2026-09-24T10:00:00Z' }, warnings: [] });
  getOnSiteOptions.mockReset().mockResolvedValue({ activityId: 'a1', options: [] });
  listPatients.mockReset().mockResolvedValue({ items: [{ id: 'p1', firstName: 'Filip', lastName: 'Fehér', fullName: 'Filip Fehér', dateOfBirth: '1990-01-01', phone: '+420 777 123 456' }], totalCount: 1 });
  getProfile.mockReset().mockResolvedValue({ phone: '+420 777 123 456', email: 'filip@example.cz' });
  getById.mockReset().mockResolvedValue({ id: 'p1', firstName: 'Filip', lastName: 'Fehér', fullName: 'Filip Fehér' });
});

describe('R17: "Objednat pacienta sem" books into the lunch', () => {
  it('a time the offer does not list is bookable here, and goes to into-lunch with the patient, never to the ordinary booking', async () => {
    renderDialog({ initialStart: '2026-09-24T12:00', initialEnd: '2026-09-24T12:30', intoLunch: true });
    await pickPatient();
    await pickActivity();
    expect(await screen.findByText('Slot je volný. Nekoliduje s žádnou rezervací ani s obědem.')).toBeInTheDocument();
    expect(screen.queryByTestId('chosen-time-not-offered')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Objednat termín' }));
    await waitFor(() => expect(bookIntoLunch).toHaveBeenCalledTimes(1));
    expect(bookIntoLunch).toHaveBeenCalledWith('c1', {
      patientId: 'p1',
      activityId: 'a1',
      startUtc: '2026-09-24T10:00:00.000Z',
      note: null,
      agreedPriceCzk: null,
    });
    expect(create).not.toHaveBeenCalled();
    expect(await screen.findByText('Termín je objednaný')).toBeInTheDocument();
  });

  it('an ordinary booking is unchanged: the ordinary call, a time the offer lacks is not bookable', async () => {
    renderDialog({ initialStart: '2026-09-24T12:00', initialEnd: '2026-09-24T12:30' });
    await pickPatient();
    await pickActivity();
    expect(await screen.findByTestId('chosen-time-not-offered')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Objednat termín' })).toBeDisabled();
    expect(bookIntoLunch).not.toHaveBeenCalled();
  });
});

describe('R4: worker.busy on a booking', () => {
  it('names the clash; a receptionist gets no override', async () => {
    create.mockRejectedValue(busy(true));
    renderDialog();
    await pickPatient();
    await pickActivity();
    await userEvent.click(await screen.findByRole('button', { name: 'Objednat termín' }));
    const notice = await screen.findByTestId('worker-busy');
    expect(within(notice).getByTestId('worker-busy-message')).toHaveTextContent('Spiroergometrie v kalendáři Diagnostika');
    expect(within(notice).queryByTestId('worker-busy-override')).toBeNull();
  });

  it('the owner repeats the booking with a reason (overrideReason travels with the retry)', async () => {
    window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'bookings.edit', 'settings.clinic.manage', 'patients.view']));
    create.mockRejectedValueOnce(busy(true)).mockResolvedValue({ appointment: { startUtc: '2026-09-24T07:00:00Z' }, warnings: [] });
    renderDialog();
    await pickPatient();
    await pickActivity();
    await userEvent.click(await screen.findByRole('button', { name: 'Objednat termín' }));
    const notice = await screen.findByTestId('worker-busy');
    await userEvent.type(within(notice).getByLabelText('Důvod výjimky'), 'Pacient čeká');
    await userEvent.click(within(notice).getByRole('button', { name: 'Přesto potvrdit (správce)' }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(create.mock.calls[1]![0]).toMatchObject({ overrideReason: 'Pacient čeká' });
    expect(await screen.findByText('Termín je objednaný')).toBeInTheDocument();
  });

  it('403 worker.busy.override_forbidden after an override says only the owner may', async () => {
    window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'bookings.edit', 'settings.clinic.manage', 'patients.view']));
    create.mockRejectedValueOnce(busy(true)).mockRejectedValueOnce(new BookingApiError('forbidden', 403, undefined, { code: 'worker.busy.override_forbidden' }));
    renderDialog();
    await pickPatient();
    await pickActivity();
    await userEvent.click(await screen.findByRole('button', { name: 'Objednat termín' }));
    const notice = await screen.findByTestId('worker-busy');
    await userEvent.type(within(notice).getByLabelText('Důvod výjimky'), 'x');
    await userEvent.click(within(notice).getByRole('button', { name: 'Přesto potvrdit (správce)' }));
    expect(await screen.findByTestId('worker-busy-forbidden')).toBeInTheDocument();
  });
});
