/*
 * /klub/:token when the desk allowed only some činnosti per window (Etapa 10): the info block says which činnost a day
 * is for ("Pondělí 26. 10. · Spiroergometrie"), the term calendar shows for the chosen činnost only the days that allow
 * it (a day reserved for another činnost is not greyed as "obsazeno"), the server filters the slots, and a link without
 * `activityIds` behaves as before. Three layouts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ClubFreeSlot, ClubOffer } from '../../api/publicClub';
import { VIEWPORTS, setViewport } from '../../test/viewport';

const getClubOffer = vi.fn();
const getClubSlots = vi.fn();
const claimClubSlot = vi.fn();

vi.mock('../../api/publicClub', async () => {
  const actual = await vi.importActual<typeof import('../../api/publicClub')>('../../api/publicClub');
  return { ...actual, getClubOffer, getClubSlots, claimClubSlot };
});
vi.mock('../../api/clinicSettings', async () => {
  const actual = await vi.importActual<typeof import('../../api/clinicSettings')>('../../api/clinicSettings');
  return {
    ...actual,
    readPublicClinic: vi.fn().mockResolvedValue({ name: 'SportMedical', email: '', phone: '', address: 'Praha', bookingEnabled: true }),
  };
});

const { default: ClubRegistration } = await import('./ClubRegistration');
const { normaliseOffer } = await import('../../api/publicClub');
const { reservedDayLines, reservedDaysFor } = await import('./club/InfoPanel');

const ACTIVITIES = [
  { activityId: 'a-1', activityName: 'Komplexní prohlídka', durationMinutes: 60, seats: 6, registered: 0, remaining: 6, unitPriceCzk: 900, description: null },
  { activityId: 'a-2', activityName: 'Spiroergometrie', durationMinutes: 60, seats: 4, registered: 0, remaining: 4, unitPriceCzk: 1200, description: null },
];

const offer = (restricted: boolean): ClubOffer => normaliseOffer({
  partnerName: 'FK Slaný',
  calendarId: 'cal-1',
  activities: ACTIVITIES,
  windows: [
    { date: '2026-10-26', startTime: '09:00:00', endTime: '13:00:00', places: 4, ...(restricted ? { activityIds: ['a-2'] } : {}) },
    { date: '2026-10-27', startTime: '09:00:00', endTime: '13:00:00', places: 6, ...(restricted ? { activityIds: ['a-1'] } : {}) },
  ],
  remaining: 10,
  seats: 10,
  registered: 0,
  info: {
    clubName: 'FK Slaný', serviceName: 'Sportovní lékařské prohlídky', paymentMethod: 'ClubInvoice', payerText: '',
    windows: [
      { date: '2026-10-26', startLocal: '09:00', endLocal: '13:00', ...(restricted ? { activityIds: ['a-2'] } : {}) },
      { date: '2026-10-27', startLocal: '09:00', endLocal: '13:00', ...(restricted ? { activityIds: ['a-1'] } : {}) },
    ],
  },
} as ClubOffer);

const slot = (date: string, hh: number): ClubFreeSlot => ({
  date, startLocal: `${String(hh).padStart(2, '0')}:00`, endLocal: `${String(hh + 1).padStart(2, '0')}:00`,
  startUtc: `${date}T${String(hh - 1).padStart(2, '0')}:00:00Z`, endUtc: `${date}T${String(hh).padStart(2, '0')}:00:00Z`, calendarName: 'Ordinace',
});

/* The server answers per činnost: only the windows that allow it (here: spiro on Monday, komplexní on Tuesday). */
const slotsFor = (_token: string, activityId: string): ClubFreeSlot[] =>
  activityId === 'a-2' ? [slot('2026-10-26', 9), slot('2026-10-26', 10)] : [slot('2026-10-27', 9)];

const renderClub = () =>
  render(
    <MemoryRouter initialEntries={['/klub/tok-1']}>
      <Routes><Route path="/klub/:token" element={<ClubRegistration />} /></Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  getClubOffer.mockReset().mockResolvedValue(offer(true));
  getClubSlots.mockReset().mockImplementation(async (token: string, activityId: string) => slotsFor(token, activityId));
  claimClubSlot.mockReset();
});

describe('reading and wording', () => {
  it('reads activityIds on windows and info windows; absent means all', () => {
    const read = offer(true);
    expect(read.windows[0].activityIds).toEqual(['a-2']);
    expect(read.info?.windows[1].activityIds).toEqual(['a-1']);
    const plain = offer(false);
    expect(plain.windows[0].activityIds).toBeUndefined();
    expect(plain.info?.windows[0].activityIds).toBeUndefined();
  });

  it('lists a day per line with its činnost only when something is restricted', () => {
    const info = offer(true).info;
    expect(reservedDayLines(info?.windows ?? [], ACTIVITIES)).toEqual(['Pondělí 26. 10. · Spiroergometrie', 'Úterý 27. 10. · Komplexní prohlídka']);
    expect(reservedDayLines(offer(false).info?.windows ?? [], ACTIVITIES)).toBeNull();
    /* a window naming every činnost is not restricted */
    expect(reservedDayLines([{ date: '2026-10-26', startLocal: '09:00', endLocal: '12:00', activityIds: ['a-1', 'a-2'] }], ACTIVITIES)).toBeNull();
  });

  it('the days that count for a činnost', () => {
    const windows = offer(true).info?.windows ?? [];
    expect(reservedDaysFor(windows, 'a-2')).toEqual(['2026-10-26']);
    expect(reservedDaysFor(windows, 'a-1')).toEqual(['2026-10-27']);
    expect(reservedDaysFor(windows, '')).toEqual(['2026-10-26', '2026-10-27']);
  });
});

describe.each(Object.entries(VIEWPORTS))('the players page at %s (%ipx)', (_n, width) => {
  beforeEach(() => setViewport(width));

  it('says in the info block which činnost each day is for', async () => {
    renderClub();
    const days = await screen.findByTestId('club-reserved-days');
    expect(within(days).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Pondělí 26. 10. · Spiroergometrie',
      'Úterý 27. 10. · Komplexní prohlídka',
    ]);
  });

  it('Spiroergometrie shows only Monday, Komplexní only Tuesday; the other day is not greyed as full', async () => {
    renderClub();
    const user = userEvent.setup();
    const cards = await screen.findAllByTestId('club-activity-card');
    await user.click(cards[1]);
    const calendar = await screen.findByTestId('club-calendar');
    await waitFor(() => expect(within(calendar).getAllByTestId('club-day')).toHaveLength(1));
    expect(within(calendar).getByRole('button', { name: /26\. října, 2 volné/ })).toBeEnabled();
    expect(within(calendar).queryByRole('button', { name: /27\. října/ })).not.toBeInTheDocument();
    expect(within(calendar).queryAllByTestId('club-day-busy')).toHaveLength(0);
    expect(getClubSlots).toHaveBeenLastCalledWith('tok-1', 'a-2');

    await user.click(screen.getAllByTestId('club-activity-card')[0]);
    await waitFor(() => expect(getClubSlots).toHaveBeenLastCalledWith('tok-1', 'a-1'));
    await waitFor(() => expect(within(screen.getByTestId('club-calendar')).getByRole('button', { name: /27\. října, 1 volný/ })).toBeEnabled());
    expect(within(screen.getByTestId('club-calendar')).queryByRole('button', { name: /26\. října/ })).not.toBeInTheDocument();
    expect(within(screen.getByTestId('club-calendar')).queryAllByTestId('club-day-busy')).toHaveLength(0);
  });

  it('a link without activityIds behaves as before: one sentence, every reserved day counts for every činnost', async () => {
    getClubOffer.mockResolvedValue(offer(false));
    getClubSlots.mockImplementation(async () => [slot('2026-10-26', 9)]);
    renderClub();
    const cards = await screen.findAllByTestId('club-activity-card');
    expect(screen.queryByTestId('club-reserved-days')).not.toBeInTheDocument();
    expect(screen.getByTestId('club-reserved')).toHaveTextContent('Klub rezervoval: 26., 27. října');
    await userEvent.click(cards[1]);
    const calendar = await screen.findByTestId('club-calendar');
    await waitFor(() => expect(within(calendar).getAllByTestId('club-day')).toHaveLength(1));
    /* Tuesday is reserved for everybody and has nothing free: greyed, as it always was. */
    expect(within(calendar).getAllByTestId('club-day-busy')).toHaveLength(1);
  });
});
