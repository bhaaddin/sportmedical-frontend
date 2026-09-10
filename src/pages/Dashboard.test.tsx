/*
 * Cancelled appointments are not today's work, and this is the screen that
 * says how much of it there is.
 *
 * The read behind this tile returns cancelled rows undistinguished, and the
 * tile used to be the raw row count. Measured against the running API on
 * 2026-09-10 that read 13 where the truth was 5 - eight of the thirteen were
 * cancelled. It is the first number anyone sees on opening the application.
 *
 * What would have to break for these to fail: removing the filter, moving it
 * to one render site and not the others, or the reader dropping `status` from
 * the rows it maps.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const getAppointments = vi.fn();
const getAll = vi.fn();

vi.mock('../api/calendar', () => ({ calendarApi: { getAppointments } }));
vi.mock('../api/patients', () => ({ patientsApi: { getAll } }));

/* rAF never fires in a hidden document, and the tile animates its number from
   zero, so drive it deterministically instead of waiting on a real frame. */
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(performance.now() + 10_000);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  getAll.mockReset().mockResolvedValue([]);
  getAppointments.mockReset();
});

const { default: Dashboard } = await import('./Dashboard');

const at = (hour: number, status: string, id: string) => ({
  id,
  patientId: 'p1',
  patientName: 'Jan Novák',
  serviceType: 'Consultation',
  practitionerName: '',
  room: '',
  startTime: `2026-09-29T0${hour}:00:00Z`,
  endTime: `2026-09-29T0${hour}:30:00Z`,
  status,
  notes: '',
});

const tile = async (title: string) => {
  const label = await screen.findByText(title);
  return within(label.closest('.MuiCard-root') as HTMLElement);
};

describe('"Dnes v kalendari"', () => {
  it('counts only the appointments that still stand', async () => {
    getAppointments.mockResolvedValue([
      at(8, 'Scheduled', 'a'),
      at(9, 'Completed', 'b'),
      at(1, 'Cancelled', 'c'),
      at(2, 'Cancelled', 'd'),
      at(3, 'Cancelled', 'e'),
    ]);

    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    const card = await tile('Dnes v kalendáři');
    expect(await card.findByText('2')).toBeInTheDocument();
    expect(card.queryByText('5')).not.toBeInTheDocument();
  });

  /* Asserted by name rather than by the printed time: the row formats with
     getHours(), so the hour it draws depends on the runner's timezone and a
     literal "08:00" would pass or fail by geography. */
  it('does not list a cancelled appointment in the day timeline either', async () => {
    getAppointments.mockResolvedValue([
      { ...at(8, 'Scheduled', 'a'), patientName: 'Zůstává Platný' },
      { ...at(9, 'Cancelled', 'gone'), patientName: 'Zrušený Termín' },
    ]);

    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    expect(await screen.findByText('Zůstává Platný')).toBeInTheDocument();
    expect(screen.queryByText('Zrušený Termín')).not.toBeInTheDocument();
  });

  /*
   * The timeline used to call `.sort()` straight on the state array, which
   * reorders in place - a component rewriting the value it renders from. That
   * is fixed (the sort now runs on a copy), but there is deliberately no test
   * asserting the mutation itself, and the reason is worth writing down.
   *
   * One was written and it was worthless: `setTodayAppointments` stores
   * `appts.filter(...)`, which is already a new array, so the in-place sort
   * only ever reordered an internal copy nothing else could observe. Putting
   * `.sort()` back on the state left all 26 tests green. It asserted something
   * that was true either way.
   *
   * What is left is the behaviour that can actually break: the day comes out
   * in time order whatever order it arrived in. Removing the sort turns this
   * red, which is the whole test the fix can honestly support.
   */
  it('still draws the day in chronological order, whatever order it arrived in', async () => {
    getAppointments.mockResolvedValue([
      { ...at(9, 'Scheduled', 'late'), patientName: 'Druhý Pacient' },
      { ...at(8, 'Scheduled', 'early'), patientName: 'První Pacient' },
    ]);

    const { container } = render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await screen.findByText('První Pacient');

    const text = container.textContent ?? '';
    expect(text.indexOf('První Pacient')).toBeLessThan(text.indexOf('Druhý Pacient'));
  });

  it('shows the empty state when every appointment of the day was cancelled', async () => {
    getAppointments.mockResolvedValue([at(8, 'Cancelled', 'a'), at(9, 'Cancelled', 'b')]);

    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    expect(await screen.findByText('Žádné schůzky na dnešek')).toBeInTheDocument();
  });
});
