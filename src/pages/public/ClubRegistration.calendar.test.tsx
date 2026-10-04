/*
 * /klub/:token (order link): the calendar for choosing the term — highlighted days with their free
 * count, greyed full days, month arrows limited to months with reserved days, the day's times as
 * chips, the nearest slot preselected only before a choice, three layouts, and the .ics download.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ClubFreeSlot, ClubOffer } from '../../api/publicClub';
import { VIEWPORTS, setViewport } from '../../test/viewport';
import { buildIcs } from './club/ics';
import { monthCells } from './club/TermCalendar';

const getClubOffer = vi.fn();
const claimClubSlot = vi.fn();
const getClubSlots = vi.fn();

vi.mock('../../api/publicClub', async () => {
  const actual = await vi.importActual<typeof import('../../api/publicClub')>('../../api/publicClub');
  return { ...actual, getClubOffer, claimClubSlot, getClubSlots };
});
vi.mock('../../api/clinicSettings', async () => {
  const actual = await vi.importActual<typeof import('../../api/clinicSettings')>('../../api/clinicSettings');
  return {
    ...actual,
    readPublicClinic: vi.fn().mockResolvedValue({ name: 'SportMedical', email: '', phone: '', address: 'Dlouhá 1, Praha', bookingEnabled: true }),
  };
});

const { default: ClubRegistration } = await import('./ClubRegistration');
const { ClubClaimError, normaliseOffer } = await import('../../api/publicClub');

const offer = (): ClubOffer => normaliseOffer({
  partnerName: 'FK Slaný',
  calendarId: 'cal-1',
  activities: [{ activityId: 'a-1', activityName: 'Komplexní prohlídka', durationMinutes: 15, seats: 30, registered: 4, remaining: 26, unitPriceCzk: 450, description: null }],
  windows: [{ date: '2026-10-26', startTime: '09:00:00', endTime: '13:00:00', places: 26 }],
  remaining: 26,
  seats: 30,
  registered: 4,
  info: {
    clubName: 'FK Slaný', serviceName: 'Sportovní diagnostika', paymentMethod: 'ClubInvoice', payerText: '',
    windows: [
      { date: '2026-10-26', startLocal: '09:00', endLocal: '13:00' },
      { date: '2026-10-27', startLocal: '09:00', endLocal: '12:00' },
      { date: '2026-11-02', startLocal: '09:00', endLocal: '12:00' },
      { date: '2026-11-03', startLocal: '09:00', endLocal: '12:00' },
    ],
  },
} as ClubOffer);

const slot = (date: string, hh: number, mm: number): ClubFreeSlot => {
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    date, startLocal: `${p(hh)}:${p(mm)}`, endLocal: `${p(hh)}:${p(mm + 15)}`,
    startUtc: `${date}T${p(hh - 1)}:${p(mm)}:00Z`, endUtc: `${date}T${p(hh - 1)}:${p(mm + 15)}:00Z`, calendarName: 'Ordinace Praha',
  };
};
const SLOTS = [
  slot('2026-10-26', 9, 0), slot('2026-10-26', 9, 15), slot('2026-10-26', 9, 30),
  slot('2026-10-27', 10, 0),
  slot('2026-11-03', 9, 0), slot('2026-11-03', 9, 15),
];

const renderClub = () =>
  render(
    <MemoryRouter initialEntries={['/klub/tok-1']}>
      <Routes><Route path="/klub/:token" element={<ClubRegistration />} /></Routes>
    </MemoryRouter>,
  );

const fillPlayer = async () => {
  await userEvent.type(await screen.findByRole('textbox', { name: /Jméno a příjmení sportovce/ }), 'Jan Novák');
  await userEvent.type(screen.getByRole('textbox', { name: /E-mail/ }), 'rodic@email.cz');
};
const confirmBtn = () => screen.getByRole('button', { name: 'Potvrdit registraci' });

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  getClubOffer.mockReset().mockResolvedValue(offer());
  getClubSlots.mockReset().mockResolvedValue(SLOTS);
  claimClubSlot.mockReset().mockResolvedValue({
    failure: '', startUtc: '2026-10-26T08:00:00Z', endUtc: '2026-10-26T08:15:00Z', manageToken: null,
    date: '2026-10-26', startLocal: '09:00', endLocal: '09:15', calendarName: 'Ordinace Praha', activityName: 'Komplexní prohlídka',
  });
});
afterEach(() => vi.restoreAllMocks());

describe('month grid', () => {
  it('lays a month out Monday first', () => {
    const cells = monthCells('2026-10');
    expect(cells.slice(0, 3)).toEqual([null, null, null]); // 1 Oct 2026 is a Thursday
    expect(cells[3]).toBe('2026-10-01');
    expect(cells.filter((c) => c !== null)).toHaveLength(31);
  });

  it('highlights days with free slots (with the count), greys full reserved days and makes other days inert', async () => {
    renderClub();
    const calendar = await screen.findByTestId('club-calendar');
    expect(screen.getByTestId('club-month')).toHaveTextContent('Říjen 2026');
    expect(within(calendar).getByRole('button', { name: /26\. října, 3 volné/ })).toBeEnabled();
    expect(within(calendar).getByRole('button', { name: /27\. října, 1 volný/ })).toBeEnabled();
    expect(within(calendar).getAllByTestId('club-day')).toHaveLength(2);
    // Nothing else in October is a button: 28 Oct is not a reserved day.
    expect(within(calendar).queryByRole('button', { name: /28\. října/ })).not.toBeInTheDocument();
    expect(within(calendar).queryByText('28')).toBeInTheDocument();
  });

  it('arrows only reach months with reserved days; a reserved day with nothing free is greyed and not tappable', async () => {
    renderClub();
    await screen.findByTestId('club-calendar');
    expect(screen.getByRole('button', { name: 'Předchozí měsíc' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Další měsíc' }));
    expect(screen.getByTestId('club-month')).toHaveTextContent('Listopad 2026');
    expect(screen.getByRole('button', { name: 'Další měsíc' })).toBeDisabled();
    const busy = screen.getByRole('button', { name: /2\. listopadu, obsazeno/ });
    expect(busy).toBeDisabled();
    expect(screen.getByRole('button', { name: /3\. listopadu, 2 volné/ })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Předchozí měsíc' }));
    expect(screen.getByTestId('club-month')).toHaveTextContent('Říjen 2026');
  });
});

describe('day and time', () => {
  it('preselects the nearest slot (and its day) only before a choice; tapping a day shows its chips', async () => {
    renderClub();
    await fillPlayer();
    const nearest = await screen.findByRole('button', { name: /09:00 — Nejbližší volný/ });
    expect(nearest).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /26\. října/ })).toHaveAttribute('data-state', 'selected');
    expect(confirmBtn()).toBeEnabled();
    expect(screen.getAllByTestId('club-slot')).toHaveLength(3);

    await userEvent.click(screen.getByRole('button', { name: /27\. října/ }));
    expect(screen.getAllByTestId('club-slot')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '10:00' })).toHaveAttribute('aria-pressed', 'false');
    expect(confirmBtn()).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '10:00' }));
    expect(confirmBtn()).toBeEnabled();
    expect(screen.getAllByText(/Úterý 27\. října v 10:00/).length).toBeGreaterThan(0);
  });

  it('a chosen time is not replaced by the nearest one when the slots are refreshed', async () => {
    renderClub();
    await fillPlayer();
    await screen.findByRole('button', { name: /09:00 — Nejbližší volný/ });
    await userEvent.click(screen.getByRole('button', { name: /09:30/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Obnovit termíny' }));
    await waitFor(() => expect(getClubSlots).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: /09:30/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('TimeTaken keeps the selected day and refreshes the chips', async () => {
    claimClubSlot.mockRejectedValueOnce(new ClubClaimError('x', 409, 'TimeTaken'));
    renderClub();
    await fillPlayer();
    await screen.findByRole('button', { name: /09:00 — Nejbližší volný/ });
    await userEvent.click(screen.getByRole('button', { name: /3\. listopadu|27\. října/ }));
    await userEvent.click(screen.getByRole('button', { name: '10:00' }));
    getClubSlots.mockResolvedValue(SLOTS.filter((s) => s.startLocal !== '10:00'));
    await userEvent.click(confirmBtn());

    expect(await screen.findByText(/Tento termín mezi tím někdo obsadil/)).toBeInTheDocument();
    // 27 Oct has nothing left, so its day is dropped; the other days stay tappable.
    await waitFor(() => expect(getClubSlots).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: /26\. října, 3 volné/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '10:00' })).not.toBeInTheDocument();
    expect(confirmBtn()).toBeDisabled();
  });

  it('TimeTaken on a day that still has times: the day stays selected, no time is preselected', async () => {
    claimClubSlot.mockRejectedValueOnce(new ClubClaimError('x', 409, 'TimeTaken'));
    renderClub();
    await fillPlayer();
    await screen.findByRole('button', { name: /09:00 — Nejbližší volný/ });
    await userEvent.click(screen.getByRole('button', { name: /09:15/ }));
    getClubSlots.mockResolvedValue(SLOTS.filter((s) => s.startLocal !== '09:15'));
    await userEvent.click(confirmBtn());

    expect(await screen.findByText(/Tento termín mezi tím někdo obsadil/)).toBeInTheDocument();
    await waitFor(() => expect(getClubSlots).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getAllByTestId('club-slot')).toHaveLength(2));
    expect(screen.getByRole('button', { name: /26\. října, 2 volné/ })).toHaveAttribute('data-state', 'selected');
    for (const chip of screen.getAllByTestId('club-slot')) expect(chip).toHaveAttribute('aria-pressed', 'false');
  });

  it('a činnost change reloads the slots', async () => {
    getClubOffer.mockResolvedValue(normaliseOffer({
      ...offer(),
      activities: [
        { activityId: 'a-1', activityName: 'Komplexní prohlídka', durationMinutes: 15, seats: 30, registered: 4, remaining: 26 },
        { activityId: 'a-2', activityName: 'Kontrola', durationMinutes: 10, seats: 30, registered: 0, remaining: 30 },
      ],
    } as unknown as ClubOffer));
    renderClub();
    await userEvent.click(await screen.findByRole('button', { name: /Kontrola/ }));
    await waitFor(() => expect(getClubSlots).toHaveBeenCalledWith('tok-1', 'a-2'));
  });
});

describe('three layouts', () => {
  it.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]])('%s: calendar and times', async (name, width) => {
    setViewport(width);
    renderClub();
    const term = await screen.findByTestId('club-term');
    expect(term).toHaveAttribute('data-layout', name);
    expect(screen.getAllByTestId('club-day')).toHaveLength(2);
    expect(screen.getAllByTestId('club-slot').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /26\. října/ }).length).toBeGreaterThan(0);
  });
});

describe('success screen', () => {
  it('shows date and time, the calendar line and downloads an .ics', async () => {
    const create = vi.fn().mockReturnValue('blob:x');
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    renderClub();
    await fillPlayer();
    await screen.findByRole('button', { name: /09:00 — Nejbližší volný/ });
    await userEvent.click(confirmBtn());

    expect(await screen.findByTestId('booked-when')).toHaveTextContent(/26\. října v 09:00–09:15/);
    expect(screen.getByTestId('booked-calendar-line')).toHaveTextContent('Váš termín uvidí i ordinace v kalendáři');
    await userEvent.click(screen.getByRole('button', { name: 'Přidat do kalendáře' }));
    expect(create).toHaveBeenCalledTimes(1);
    const blob = create.mock.calls[0][0] as Blob;
    expect(blob.type).toContain('text/calendar');
    const text = await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsText(blob); });
    expect(text).toContain('DTSTART:20261026T080000Z');
    expect(text).toContain('DTEND:20261026T081500Z');
    expect(text).toContain('SUMMARY:Komplexní prohlídka');
    expect(text).toContain('LOCATION:Ordinace Praha\\, Dlouhá 1\\, Praha');
  });
});

describe('ics', () => {
  it('builds a valid single-event calendar', () => {
    const ics = buildIcs({ startUtc: '2026-10-26T08:00:00Z', endUtc: '2026-10-26T08:15:00Z', title: 'A; B', location: 'Praha', description: 'a\nb' });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('SUMMARY:A\\; B');
    expect(ics).toContain('DESCRIPTION:a\\nb');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
});
