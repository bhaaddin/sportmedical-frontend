/*
 * Dnešní přehled as shelves (route 33): which shelves stand, what each says when it is empty (always the next action),
 * the one step a row offers and what it writes, the permissions (no step without bookings.edit, no register lookup and no
 * patient link without patients.view), the paperwork shelf only when the server answered, and the three layouts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import type { DayAppointment } from '../../api/bookingContracts';

const daySummary = vi.fn();
const range = vi.fn();
const setStatus = vi.fn();
const listCalendars = vi.fn();
const listActivities = vi.fn();
const getById = vi.fn();
const dialog = vi.fn();

vi.mock('../../api/appointments', () => ({ appointmentsApi: { daySummary, range, setStatus } }));
vi.mock('../../api/calendars', () => ({ calendarsApi: { list: listCalendars } }));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../../api/patients', () => ({ patientsApi: { getById } }));
vi.mock('../../components/booking/NewAppointmentDialog', () => ({
  NewAppointmentDialog: (props: { initialCalendarId?: string }) => {
    dialog(props);
    return <div data-testid="new-appointment" />;
  },
}));

const { default: DayOverviewPage } = await import('./DayOverviewPage');

const HOUR = 60 * 60 * 1000;
const row = (id: string, status: number, startOffsetHours: number, over: Partial<DayAppointment> = {}): DayAppointment => ({
  id,
  calendarId: 'c1',
  patientId: '',
  patientName: `Pacient ${id}`,
  activityId: 'act-1',
  activityName: 'Základní prohlídka',
  startUtc: new Date(Date.now() + startOffsetHours * HOUR).toISOString(),
  endUtc: new Date(Date.now() + startOffsetHours * HOUR + HOUR / 2).toISOString(),
  status,
  isRunningLate: false,
  checkedInUtc: null,
  paperwork: null,
  listPriceCzk: 1600,
  ...over,
});

const summary = (over: Record<string, unknown> = {}) => ({
  date: '2026-10-24',
  booked: 3, arrived: 1, runningLate: 0, didNotCome: 0, cancelled: 0,
  byActivity: [{ id: 'act-1', name: 'Základní prohlídka', count: 3 }],
  byCalendar: [{ id: 'c1', name: 'Ordinace 1', count: 3 }],
  workingMinutes: 480, bookedMinutes: 90, unusedMinutes: 390, freeMinutesLeft: 240,
  paperwork: null, nextAppointment: null, absent: [],
  ...over,
});

const CALENDARS = [
  { id: 'c1', name: 'Ordinace 1', color: '#999', isActive: true },
  { id: 'c2', name: 'Ordinace 2', color: '#888', isActive: true },
];

function allow(...permissions: string[]) {
  localStorage.setItem('permissions', JSON.stringify(permissions));
}

beforeEach(() => {
  allow('bookings.edit', 'bookings.create', 'patients.view');
  listCalendars.mockReset().mockResolvedValue(CALENDARS);
  daySummary.mockReset().mockResolvedValue(summary());
  listActivities.mockReset().mockResolvedValue({ activities: [] });
  getById.mockReset().mockResolvedValue({ id: 'p9', firstName: 'Jana', lastName: 'Marková', fullName: 'Jana Marková' });
  setStatus.mockReset().mockResolvedValue(undefined);
  dialog.mockReset();
  range.mockReset().mockResolvedValue([
    row('late', 0, -1),                     // should be here, is not
    row('here', 2, -0.25),                  // arrived: the waiting room
    row('next', 1, 2, { patientId: 'p9', patientName: null }), // later today, registered, no name on the row
    row('gone', 4, 3),                      // cancelled: not part of the day's work
  ]);
  setViewport(VIEWPORTS.desktop);
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <DayOverviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const shelf = (name: string) => screen.findByRole('region', { name });

describe('Dnešní přehled - the shelves', () => {
  it('is one page with one h1 and the day\'s shelves: numbers, waiting room, late, capacity, one per calendar', async () => {
    const { container } = renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Dnešní přehled' })).toBeInTheDocument();
    await shelf('Čekárna');
    await waitFor(() => expect(container.querySelector('[data-shelf="summary"]')).toHaveAttribute('data-state', 'ready'));
    const ids = [...container.querySelectorAll('section[data-shelf]')].map((s) => s.getAttribute('data-shelf'));
    expect(ids).toEqual(['summary', 'waiting', 'late', 'capacity', 'calendar-c1', 'calendar-c2']);
    /* The five tallies are the server's, late is counted here from the clock. */
    const summaryShelf = await shelf('Den v číslech');
    expect(within(summaryShelf).getAllByRole('listitem')).toHaveLength(5);
  });

  it('puts each row where it belongs: arrived in Čekárna, late in Mají zpoždění, the rest of the day in its calendar', async () => {
    renderPage();
    const waiting = await shelf('Čekárna');
    expect(await within(waiting).findByText('Pacient here')).toBeInTheDocument();
    expect(within(waiting).queryByText('Pacient late')).toBeNull();
    const late = await shelf('Mají zpoždění');
    expect(within(late).getByText('Pacient late')).toBeInTheDocument();
    const column = await shelf('Ordinace 1');
    /* Three that stand; the cancelled one is not part of the day's work. */
    await waitFor(() => expect(within(column).getAllByRole('listitem')).toHaveLength(3));
    expect(within(column).queryByText('Pacient gone')).toBeNull();
    expect(within(column).getByText('Má zpoždění')).toBeInTheDocument();
  });

  it('names a registered patient with a link to the card, fetched once because the row had no name', async () => {
    renderPage();
    const column = await shelf('Ordinace 1');
    const link = await within(column).findByRole('link', { name: 'Jana Marková' });
    expect(link).toHaveAttribute('href', '/patients/p9');
    expect(getById).toHaveBeenCalledTimes(1);
    /* The činnost opens the appointment's own page. */
    expect(within(column).getAllByRole('link', { name: 'Základní prohlídka' })[0]).toHaveAttribute('href', '/kalendar/c1/termin/late');
  });

  it('offers only the next step and writes exactly that status', async () => {
    renderPage();
    const late = await shelf('Mají zpoždění');
    await userEvent.click(await within(late).findByRole('button', { name: /^Přišel: Pacient late/ }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith('c1', 'late', '2'));

    await userEvent.click(within(late).getByRole('button', { name: /^Nepřišel: Pacient late/ }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith('c1', 'late', '5'));

    const waiting = await shelf('Čekárna');
    await userEvent.click(within(waiting).getByRole('button', { name: /^Dokončit: Pacient here/ }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith('c1', 'here', '3'));

    /* Somebody early: the calendar's column offers "Přišel" for a visit that is not late yet. */
    const column = await shelf('Ordinace 1');
    expect(within(column).getByRole('button', { name: /^Přišel: Jana Marková/ })).toBeInTheDocument();
  });

  it('an empty shelf offers the next action, never a bare "nothing"', async () => {
    range.mockResolvedValue([]);
    renderPage();
    const waiting = await shelf('Čekárna');
    expect(await within(waiting).findByText('Nikdo nečeká.')).toBeInTheDocument();
    expect(within(waiting).getByRole('link', { name: 'Celý den v kalendáři' })).toHaveAttribute('href', '/planovani');
    const late = await shelf('Mají zpoždění');
    expect(within(late).getByRole('link', { name: 'Celý den v kalendáři' })).toBeInTheDocument();
    /* An empty calendar books into itself. */
    const column = await shelf('Ordinace 2');
    await userEvent.click(within(column).getByRole('button', { name: 'Objednat sem' }));
    expect(await screen.findByTestId('new-appointment')).toBeInTheDocument();
    expect(dialog).toHaveBeenLastCalledWith(expect.objectContaining({ initialCalendarId: 'c2' }));
  });

  it('draws the paperwork shelf only when the server answered, with what is missing', async () => {
    const first = renderPage();
    await shelf('Čekárna');
    expect(screen.queryByRole('region', { name: 'Podklady' })).toBeNull();
    first.unmount();

    daySummary.mockResolvedValue(summary({
      paperwork: { ready: 2, missing: 1, who: [{ appointmentId: 'late', patientId: '', calendarId: 'c1', activityName: 'Základní prohlídka', startUtc: new Date().toISOString(), missing: ['questionnaire_missing'] }] },
    }));
    renderPage();
    const paperwork = await shelf('Podklady');
    expect(within(paperwork).getByText('Chybí dotazník')).toBeInTheDocument();
    expect(within(paperwork).getByText('Pacient late')).toBeInTheDocument();
  });

  it('says a failed day once and does not draw the calendars as empty', async () => {
    range.mockRejectedValue(new Error('500'));
    const { container } = renderPage();
    const waiting = await shelf('Čekárna');
    expect(await within(waiting).findByRole('alert')).toHaveTextContent('Dnešní termíny se nepodařilo načíst.');
    expect(container.querySelector('[data-shelf^="calendar-"]')).toBeNull();
  });

  it('with no calendar chosen the numbers say so and offer them all back', async () => {
    renderPage();
    await shelf('Čekárna');
    await userEvent.click(await screen.findByRole('button', { name: /Ordinace 1/, pressed: true }));
    await userEvent.click(screen.getByRole('button', { name: /Ordinace 2/, pressed: true }));
    const summaryShelf = await shelf('Den v číslech');
    expect(within(summaryShelf).getByText('Vyberte alespoň jeden kalendář.')).toBeInTheDocument();
    await userEvent.click(within(summaryShelf).getByRole('button', { name: 'Zobrazit všechny' }));
    expect(await screen.findByRole('region', { name: 'Ordinace 1' })).toBeInTheDocument();
  });
});

describe('Dnešní přehled - permissions', () => {
  it('without bookings.edit and bookings.create there is no step and no booking button', async () => {
    allow('patients.view');
    renderPage();
    const late = await shelf('Mají zpoždění');
    await within(late).findByText('Pacient late');
    expect(screen.queryByRole('button', { name: /^Přišel/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Dokončit/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Objednat termín' })).toBeNull();
  });

  it('without patients.view nothing is asked of the register and a name is plain text', async () => {
    allow('bookings.edit');
    renderPage();
    const column = await shelf('Ordinace 1');
    await within(column).findByText('Pacient late');
    expect(getById).not.toHaveBeenCalled();
    expect(within(column).queryByRole('link', { name: /Pacient/ })).toBeNull();
  });
});

describe('Dnešní přehled - the three layouts', () => {
  it.each([
    ['phone', VIEWPORTS.phone],
    ['tablet', VIEWPORTS.tablet],
    ['desktop', VIEWPORTS.desktop],
  ])('on a %s the booking action is drawn once and the rows are lists, not tables', async (name, width) => {
    setViewport(width);
    const { container } = renderPage();
    await shelf('Čekárna');
    expect(screen.getAllByRole('button', { name: 'Objednat termín' })).toHaveLength(1);
    if (name === 'phone') expect(container.querySelector('[data-pinned="true"]')).not.toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    /* The day stepper is 44 px everywhere (a thumb under 1280). */
    expect(screen.getByRole('button', { name: 'Předchozí den' })).toHaveStyle({ height: '44px' });
  });
});
