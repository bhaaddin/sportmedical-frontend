/*
 * One patient's appointments, and the line between what is coming and what has
 * been.
 *
 * The split is the part that can be quietly wrong. A cancelled appointment
 * still in the future is the case: it is not "coming" - nobody is expected -
 * and putting it at the top of a list somebody reads as "who is due in" is how
 * a receptionist prepares for a patient who is not arriving.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const get = vi.fn();
vi.mock('../../api/client', () => ({ default: { get } }));
/* The price of each činnost comes off the catalogue, by name (Etapa 12). */
const listActivities = vi.fn();
vi.mock('../../api/activities', () => ({ activitiesApi: { list: listActivities } }));

const outletContext: { patient: { id: string; firstName: string; lastName: string }; upcoming?: unknown[] } = {
  patient: { id: 'p1', firstName: 'Eva', lastName: 'Adresova' },
};
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useOutletContext: () => outletContext };
});

const { default: PatientAppointmentsPage, splitAppointments, isCancelled, APPOINTMENT_STATUS_LABEL } =
  await import('./PatientAppointmentsPage');

const NOW = new Date('2026-09-13T10:00:00Z');

const appointment = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  patientId: 'p1',
  eventName: 'Kontrola',
  startTime: '2026-09-20T08:00:00Z',
  endTime: '2026-09-20T08:30:00Z',
  status: 'Scheduled',
  notes: '',
  ...over,
}) as Parameters<typeof isCancelled>[0];

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  delete outletContext.upcoming;
  get.mockReset().mockResolvedValue({ data: { data: [] } });
  listActivities.mockReset().mockResolvedValue({ activities: [{ id: 'act-1', name: 'Kontrola', priceCzk: 900 }] });
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <PatientAppointmentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('splitting at now', () => {
  it('puts a future appointment among the upcoming', () => {
    const { upcoming, past } = splitAppointments([appointment()], NOW);
    expect(upcoming).toHaveLength(1);
    expect(past).toHaveLength(0);
  });

  it('puts a past one in the history', () => {
    const { upcoming, past } = splitAppointments(
      [appointment({ startTime: '2026-09-01T08:00:00Z' })],
      NOW,
    );
    expect(upcoming).toHaveLength(0);
    expect(past).toHaveLength(1);
  });

  /*
   * The case worth the test. Nobody is expected, so it must not sit in the
   * list somebody reads as "who is due in" - it belongs with the history,
   * where it is still visible.
   */
  it('keeps a cancelled future appointment out of the upcoming list', () => {
    const { upcoming, past } = splitAppointments(
      [appointment({ status: 'Cancelled' })],
      NOW,
    );
    expect(upcoming).toHaveLength(0);
    expect(past).toHaveLength(1);
  });

  /*
   * The `past` half matters as much as the `upcoming` half. Asserting only
   * that it is missing from the top would pass just as well if the
   * appointment were dropped entirely - and a no-show that vanishes takes
   * the fact that somebody did not turn up with it.
   */
  it('treats a no-show the same way, and keeps it in the history', () => {
    const { upcoming, past } = splitAppointments([appointment({ status: 'NoShow' })], NOW);
    expect(upcoming).toHaveLength(0);
    expect(past.map((a) => a.status)).toEqual(['NoShow']);
  });

  /* Soonest first among what is coming - the next one is the one being asked
     about. Newest first in the history, where the last visit is. */
  it('orders the upcoming soonest first and the history newest first', () => {
    const { upcoming, past } = splitAppointments(
      [
        appointment({ id: 'later', startTime: '2026-10-01T08:00:00Z' }),
        appointment({ id: 'sooner', startTime: '2026-09-15T08:00:00Z' }),
        appointment({ id: 'old', startTime: '2026-01-01T08:00:00Z' }),
        appointment({ id: 'recent', startTime: '2026-09-10T08:00:00Z' }),
      ],
      NOW,
    );
    expect(upcoming.map((a) => a.id)).toEqual(['sooner', 'later']);
    expect(past.map((a) => a.id)).toEqual(['recent', 'old']);
  });

  it('drops an appointment with an unreadable time rather than crashing', () => {
    const { upcoming, past } = splitAppointments([appointment({ startTime: 'kdysi' })], NOW);
    expect(upcoming).toHaveLength(0);
    expect(past).toHaveLength(0);
  });
});

describe('what counts as cancelled', () => {
  it('is a cancellation or a no-show, and nothing else', () => {
    expect(isCancelled(appointment({ status: 'Cancelled' }))).toBe(true);
    expect(isCancelled(appointment({ status: 'NoShow' }))).toBe(true);
    expect(isCancelled(appointment({ status: 'Scheduled' }))).toBe(false);
    expect(isCancelled(appointment({ status: 'Completed' }))).toBe(false);
  });
});

describe('the page', () => {
  /* There is no way to ask the server for one patient's appointments, so the
     filtering happens here - and has to be right. */
  it('shows only this patient, out of everybody the server sends', async () => {
    get.mockResolvedValue({
      data: { data: [
        appointment({ id: 'mine', eventName: 'Moje kontrola' }),
        appointment({ id: 'theirs', patientId: 'p2', eventName: 'Cizí kontrola' }),
      ] },
    });

    renderPage();

    expect(await screen.findByText('Moje kontrola')).toBeInTheDocument();
    expect(screen.queryByText('Cizí kontrola')).not.toBeInTheDocument();
  });

  it('says so by name when there is nothing coming', async () => {
    renderPage();
    expect(await screen.findByText(/Eva nemá objednaný žádný termín/)).toBeInTheDocument();
  });

  /* Raw English on a Czech screen is the fault this project has now had three
     times over. */
  it('names every status the contract has, in Czech', () => {
    for (const status of ['Scheduled', 'Confirmed', 'CheckedIn', 'Completed', 'Cancelled', 'NoShow']) {
      expect(APPOINTMENT_STATUS_LABEL[status]).toBeDefined();
      expect(APPOINTMENT_STATUS_LABEL[status]).not.toBe(status);
    }
  });

  it('falls back to showing an unknown status rather than a blank', async () => {
    get.mockResolvedValue({ data: { data: [appointment({ status: 'Prekvapeni' })] } });

    renderPage();

    expect(await screen.findByText('Prekvapeni')).toBeInTheDocument();
  });

  it('says so when the list cannot be fetched', async () => {
    get.mockRejectedValue(new Error('offline'));

    renderPage();

    expect(await screen.findByText(/Termíny se nepodařilo načíst/)).toBeInTheDocument();
  });
});

/*
 * Etapa 12, "ceny všude": every row says what it costs. The clinic-wide list
 * carries no money, so the price is the catalogue's figure for the činnost's
 * name - and "bez ceny" for a name the catalogue does not know.
 */
describe('the price on every row', () => {
  const rows = () => [
    appointment({ id: 'next', eventName: 'Kontrola', startTime: '2099-01-01T08:00:00Z', endTime: '2099-01-01T08:30:00Z' }),
    appointment({ id: 'gone', eventName: 'Neznámá činnost', status: 'Completed', startTime: '2020-01-01T08:00:00Z', endTime: '2020-01-01T08:30:00Z' }),
  ];

  it.each([['desktop', VIEWPORTS.desktop], ['tablet', VIEWPORTS.tablet]])('%s: on the upcoming card, and a Cena column in the history', async (_n, width) => {
    setViewport(width);
    get.mockResolvedValue({ data: { data: rows() } });

    renderPage();

    const upcoming = await screen.findByRole('region', { name: 'Nadcházející' });
    expect(within(upcoming).getByRole('listitem')).toHaveTextContent('900 Kč');
    const history = await screen.findByRole('table', { name: 'Historie termínů' });
    expect(within(history).getByRole('columnheader', { name: 'Cena' })).toBeInTheDocument();
    expect(within(history).getByTestId('row-price')).toHaveTextContent('bez ceny');
  });

  it('phone: the price is a line of the card', async () => {
    setViewport(VIEWPORTS.phone);
    get.mockResolvedValue({ data: { data: rows() } });

    renderPage();

    expect(await screen.findByText('Kontrola')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Nadcházející' })).getByRole('listitem')).toHaveTextContent('900 Kč');
    const prices = await screen.findAllByTestId('row-price');
    expect(prices.map((p) => p.textContent?.replace(/ /g, ' '))).toEqual(['bez ceny']);
  });
});

/* The shelf page (docs/ui-shelf-system.md): Nadcházející, Minulé, Zrušené. */
describe('the shelves', () => {
  const renderRouted = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/patients/p1/terminy']}>
          <Routes>
            <Route path="/patients/p1/terminy" element={<PatientAppointmentsPage />} />
            <Route path="/planovani" element={<p>Kalendář otevřen</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  it('draws the upcoming and the past shelves, and no cancelled one when nothing was cancelled', async () => {
    get.mockResolvedValue({ data: { data: [
      appointment({ id: 'next', startTime: '2099-01-01T08:00:00Z', endTime: '2099-01-01T08:30:00Z' }),
      appointment({ id: 'old', status: 'Completed', startTime: '2020-01-01T08:00:00Z', endTime: '2020-01-01T08:30:00Z' }),
    ] } });
    renderPage();

    const upcoming = await screen.findByRole('region', { name: 'Nadcházející' });
    expect(within(upcoming).getByLabelText('Počet: 1')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Minulé' })).getByLabelText('Počet: 1')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Zrušené' })).toBeNull();
  });

  it('puts cancellations and no-shows on their own shelf, out of the history', async () => {
    get.mockResolvedValue({ data: { data: [
      appointment({ id: 'gone', status: 'Cancelled', eventName: 'Zrušená kontrola', startTime: '2099-01-01T08:00:00Z', endTime: '2099-01-01T08:30:00Z' }),
      appointment({ id: 'away', status: 'NoShow', startTime: '2020-01-01T08:00:00Z', endTime: '2020-01-01T08:30:00Z' }),
    ] } });
    renderPage();

    const cancelled = await screen.findByRole('region', { name: 'Zrušené' });
    expect(within(cancelled).getByText('Zrušená kontrola')).toBeInTheDocument();
    expect(within(cancelled).getByLabelText('Počet: 2')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Minulé' })).getByText('Zatím tu žádný proběhlý termín není.')).toBeInTheDocument();
  });

  it('opens an upcoming booking exactly when the card knows its calendar', async () => {
    outletContext.upcoming = [{ id: 'next', calendarId: 'cal-7' }];
    get.mockResolvedValue({ data: { data: [
      appointment({ id: 'next', startTime: '2099-01-01T08:00:00Z', endTime: '2099-01-01T08:30:00Z' }),
    ] } });
    renderPage();

    const card = await within(await screen.findByRole('region', { name: 'Nadcházející' })).findByRole('link');
    expect(card).toHaveAttribute('href', '/kalendar/cal-7/termin/next');
  });

  it('offers to book when nothing is coming, and books this patient', async () => {
    const user = userEvent.setup();
    renderRouted();

    const upcoming = await screen.findByRole('region', { name: 'Nadcházející' });
    await user.click(within(upcoming).getByRole('button', { name: 'Objednat termín' }));
    expect(await screen.findByText('Kalendář otevřen')).toBeInTheDocument();
  });

  it('pins nothing of its own on a phone (the card header pins "Objednat termín")', async () => {
    setViewport(VIEWPORTS.phone);
    renderPage();
    await screen.findByRole('region', { name: 'Nadcházející' });
    expect(document.querySelector('[data-pinned="true"]')).toBeNull();
  });
});
