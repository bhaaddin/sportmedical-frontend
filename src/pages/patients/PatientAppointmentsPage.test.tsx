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
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const get = vi.fn();
vi.mock('../../api/client', () => ({ default: { get } }));

const outletContext = { patient: { id: 'p1', firstName: 'Eva', lastName: 'Adresova' } };
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
  get.mockReset().mockResolvedValue({ data: { data: [] } });
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <PatientAppointmentsPage />
    </MemoryRouter>,
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

  it('treats a no-show the same way', () => {
    const { upcoming } = splitAppointments([appointment({ status: 'NoShow' })], NOW);
    expect(upcoming).toHaveLength(0);
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
