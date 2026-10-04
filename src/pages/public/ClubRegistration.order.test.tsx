/*
 * /klub/:token for an ORDER link: the parents read the information first (club, service, činnosti with
 * price, who pays, reserved days, three steps), register (minor → parent), choose from the day-by-day
 * free slots (earliest preselected), and get a confirmation with a one-click "add another player".
 * A legacy block token (no `info`) keeps the old earliest-slot flow.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ClubFreeSlot, ClubOffer } from '../../api/publicClub';
import { VIEWPORTS, setViewport } from '../../test/viewport';

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
    readPublicClinic: vi.fn().mockResolvedValue({ name: 'SportMedical', email: 'r@example.cz', phone: '606 785 271', address: 'Praha', bookingEnabled: true }),
  };
});

const { default: ClubRegistration } = await import('./ClubRegistration');
const { ClubClaimError, normaliseOffer } = await import('../../api/publicClub');

const offer = (over: Partial<ClubOffer> = {}): ClubOffer => normaliseOffer({
  partnerName: 'FK Slaný',
  calendarId: 'cal-1',
  activities: [{ activityId: 'a-1', activityName: 'Komplexní prohlídka', durationMinutes: 15, seats: 30, registered: 4, remaining: 26, unitPriceCzk: 450, description: 'Přineste sportovní oblečení a kartičku pojištěnce.' }],
  windows: [{ date: '2026-10-26', startTime: '09:00:00', endTime: '13:00:00', places: 26 }],
  remaining: 26,
  seats: 30,
  registered: 4,
  info: {
    clubName: 'FK Slaný', serviceName: 'Sportovní diagnostika', paymentMethod: 'PerPerson', payerText: '',
    windows: [
      { date: '2026-10-26', startLocal: '09:00', endLocal: '13:00' },
      { date: '2026-10-27', startLocal: '09:00', endLocal: '12:00' },
    ],
  },
  ...over,
} as ClubOffer);

const slot = (date: string, hh: string, mm: string): ClubFreeSlot => ({
  date, startLocal: `${hh}:${mm}`, endLocal: `${hh}:${Number(mm) + 15}`,
  startUtc: `${date}T${String(Number(hh) - 2).padStart(2, '0')}:${mm}:00Z`,
  endUtc: `${date}T${String(Number(hh) - 2).padStart(2, '0')}:${Number(mm) + 15}:00Z`,
  calendarName: 'Ordinace Praha',
});
const SLOTS = [slot('2026-10-26', '09', '00'), slot('2026-10-26', '09', '15'), slot('2026-10-27', '10', '00')];

const renderClub = () =>
  render(
    <MemoryRouter initialEntries={['/klub/tok-1']}>
      <Routes><Route path="/klub/:token" element={<ClubRegistration />} /></Routes>
    </MemoryRouter>,
  );

const fillPlayer = async (name = 'Jan Novák', email = 'rodic@email.cz') => {
  await userEvent.type(await screen.findByRole('textbox', { name: /Jméno a příjmení sportovce/ }), name);
  await userEvent.type(screen.getByRole('textbox', { name: /E-mail/ }), email);
};
const confirmBtn = () => screen.getByRole('button', { name: 'Potvrdit registraci' });

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  getClubOffer.mockReset().mockResolvedValue(offer());
  getClubSlots.mockReset().mockResolvedValue(SLOTS);
  claimClubSlot.mockReset().mockResolvedValue({
    failure: '', startUtc: '2026-10-26T07:00:00Z', endUtc: '2026-10-26T07:15:00Z', manageToken: null,
    date: '2026-10-26', startLocal: '09:00', endLocal: '09:15', calendarName: 'Ordinace Praha', activityName: 'Komplexní prohlídka',
  });
});

describe('information first', () => {
  it.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]])(
    '%s: club, service, činnost with length and price, reserved days and three steps',
    async (name, width) => {
      setViewport(width);
      renderClub();

      expect(await screen.findByRole('heading', { name: 'Než se zaregistrujete' })).toBeInTheDocument();
      expect(screen.getByText(/Klub FK Slaný pro vás objednal službu Sportovní diagnostika/)).toBeInTheDocument();
      const activities = screen.getByRole('list', { name: 'Činnosti' });
      expect(within(activities).getByText('Komplexní prohlídka')).toBeInTheDocument();
      expect(within(activities).getByText(/15 min · 450/)).toBeInTheDocument();
      expect(within(activities).getByText(/kartičku pojištěnce/)).toBeInTheDocument();
      expect(screen.getByTestId('club-reserved')).toHaveTextContent('Klub rezervoval: 26., 27. října');
      expect(screen.queryByText('Dny a hodiny, které klub rezervoval')).not.toBeInTheDocument();
      const steps = screen.getByTestId('club-steps');
      expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
      expect(steps).toHaveAttribute('data-layout', name);
    },
  );

  it('per-person payment: who pays in plain words with the price per person', async () => {
    renderClub();
    const note = await screen.findByRole('note', { name: 'Kdo platí' });
    expect(note).toHaveTextContent(/Platí rodiče nebo hráči sami, každý za sebe\. Cena za osobu: 450/);
  });

  it('the club invoice and the server\'s own payerText', async () => {
    getClubOffer.mockResolvedValue(offer({ info: { clubName: 'FK Slaný', serviceName: 'S', paymentMethod: 'ClubInvoice', payerText: '', windows: [] } }));
    renderClub();
    expect(await screen.findByRole('note', { name: 'Kdo platí' })).toHaveTextContent('Platí klub. Vy u nás nic neplatíte.');
  });

  it('prefers the server payerText', async () => {
    getClubOffer.mockResolvedValue(offer({ info: { clubName: 'FK', serviceName: 'S', paymentMethod: 'ClubInvoice', payerText: 'Hradí oddíl z členských příspěvků.', windows: [] } }));
    renderClub();
    expect(await screen.findByRole('note', { name: 'Kdo platí' })).toHaveTextContent('Hradí oddíl z členských příspěvků.');
  });
});

describe('choosing a term', () => {
  it('groups the free slots by day, labels and preselects the nearest one', async () => {
    renderClub();

    await waitFor(() => expect(getClubSlots).toHaveBeenCalledWith('tok-1', 'a-1'));
    const first = await screen.findByRole('button', { name: /09:00 — Nejbližší volný/ });
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('group', { name: /26\. října/ })).toBeInTheDocument();
    expect(screen.getAllByTestId('club-slot')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: /27\. října, 1 volný/ }));
    expect(screen.getAllByTestId('club-slot')).toHaveLength(1);
    expect(first).not.toBeInTheDocument();
    // Moving to another day does not keep the time from the first one.
    expect(screen.getByRole('button', { name: '10:00' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: '10:00' }));
    expect(screen.getByRole('button', { name: '10:00' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('the claim carries the chosen startUtc and the success screen shows when, činnost, place and what to bring', async () => {
    renderClub();
    await fillPlayer();
    await userEvent.click(await screen.findByRole('button', { name: /27\. října, 1 volný/ }));
    await userEvent.click(await screen.findByRole('button', { name: '10:00' }));
    await userEvent.click(confirmBtn());

    await waitFor(() => expect(claimClubSlot).toHaveBeenCalledTimes(1));
    expect(claimClubSlot).toHaveBeenCalledWith('tok-1', expect.objectContaining({
      activityId: 'a-1', name: 'Jan Novák', email: 'rodic@email.cz', startUtc: '2026-10-27T08:00:00Z',
    }));
    expect(claimClubSlot.mock.calls[0][1].parentName).toBeUndefined();
    expect(await screen.findByRole('heading', { name: 'Máte rezervováno' })).toBeInTheDocument();
    expect(screen.getByTestId('booked-when')).toHaveTextContent(/26\. října v 09:00–09:15/);
    expect(screen.getByText('Činnost: Komplexní prohlídka')).toBeInTheDocument();
    expect(screen.getByText('Místo: Ordinace Praha')).toBeInTheDocument();
    expect(screen.getByText(/Přineste sportovní oblečení/)).toBeInTheDocument();
  });

  it('TimeTaken: says so, fetches the slots again and the form stays', async () => {
    claimClubSlot.mockRejectedValueOnce(new ClubClaimError('x', 409, 'TimeTaken'));
    renderClub();
    await fillPlayer();
    await screen.findByRole('button', { name: /09:00 — Nejbližší volný/ });
    expect(getClubSlots).toHaveBeenCalledTimes(1);
    getClubSlots.mockResolvedValue(SLOTS.slice(1));
    await userEvent.click(confirmBtn());

    expect(await screen.findByText(/Tento termín mezi tím někdo obsadil/)).toBeInTheDocument();
    await waitFor(() => expect(getClubSlots).toHaveBeenCalledTimes(2));
    // The day stays selected; the time must be chosen again (nothing is preselected after a clash).
    const again = await screen.findByRole('button', { name: /09:15 — Nejbližší volný/ });
    expect(again).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /26\. října/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /^09:00/ })).not.toBeInTheDocument();
    expect(confirmBtn()).toBeDisabled();
    await userEvent.click(again);
    expect(confirmBtn()).toBeEnabled();
  });

  it.each([
    ['NoFreeSlot', /už není volný žádný termín/],
    ['AlreadyRegistered', /už je registrovaný/],
  ])('%s is told in Czech', async (code, text) => {
    claimClubSlot.mockRejectedValueOnce(new ClubClaimError('server', 409, code));
    renderClub();
    await fillPlayer();
    await screen.findByRole('button', { name: /Nejbližší volný/ });
    await userEvent.click(confirmBtn());
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('no free slot for the činnost: says so and cannot confirm', async () => {
    getClubSlots.mockResolvedValue([]);
    renderClub();
    await fillPlayer();
    expect(await screen.findByText(/není volný žádný termín/)).toBeInTheDocument();
    expect(confirmBtn()).toBeDisabled();
  });

  it('a failed slot load can be retried', async () => {
    getClubSlots.mockRejectedValueOnce(new Error('net'));
    renderClub();
    expect(await screen.findByText('Termíny se nepodařilo načíst.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByRole('button', { name: /Nejbližší volný/ })).toBeInTheDocument();
  });

  it('several činnosti: pick one first (places and price on the card); the slots wait for it', async () => {
    getClubOffer.mockResolvedValue(offer({
      activities: [
        { activityId: 'a-1', activityName: 'Komplexní prohlídka', durationMinutes: 15, seats: 30, registered: 4, remaining: 26, unitPriceCzk: 450 },
        { activityId: 'a-2', activityName: 'Spiroergometrie', durationMinutes: 45, seats: 10, registered: 3, remaining: 7, unitPriceCzk: 1200 },
      ],
    }));
    renderClub();
    const cards = await screen.findAllByTestId('club-activity-card');
    expect(cards[1]).toHaveTextContent(/volno 7 z 10/);
    expect(getClubSlots).not.toHaveBeenCalled();
    await userEvent.click(cards[1]);
    await waitFor(() => expect(getClubSlots).toHaveBeenCalledWith('tok-1', 'a-2'));
  });
});

describe('registering a minor', () => {
  it('asks for the parent only when the player is under 18, and sends it', async () => {
    renderClub();
    await fillPlayer();
    await screen.findByRole('button', { name: /Nejbližší volný/ });
    expect(screen.queryByLabelText(/Jméno rodiče/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Hráč je mladší 18 let' }));
    expect(confirmBtn()).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Jméno rodiče/), 'Petra Nováková');
    expect(confirmBtn()).toBeEnabled();
    await userEvent.click(confirmBtn());

    await waitFor(() => expect(claimClubSlot).toHaveBeenCalled());
    expect(claimClubSlot.mock.calls[0][1]).toEqual(expect.objectContaining({ parentName: 'Petra Nováková' }));
  });

  it('the e-mail is needed for the confirmation', async () => {
    renderClub();
    await userEvent.type(await screen.findByRole('textbox', { name: /Jméno a příjmení sportovce/ }), 'Jan Novák');
    await screen.findByRole('button', { name: /Nejbližší volný/ });
    expect(confirmBtn()).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: /E-mail/ }), 'rodic@email.cz');
    expect(confirmBtn()).toBeEnabled();
  });
});

describe('one more player', () => {
  it('keeps the parent contact, clears the player and refreshes the slots', async () => {
    renderClub();
    await userEvent.type(await screen.findByRole('textbox', { name: /Telefon/ }), '773539001');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Hráč je mladší 18 let' }));
    await userEvent.type(screen.getByLabelText(/Jméno rodiče/), 'Petra Nováková');
    await fillPlayer();
    await screen.findByRole('button', { name: /Nejbližší volný/ });
    await userEvent.click(confirmBtn());

    await userEvent.click(await screen.findByRole('button', { name: 'Přidat další hráče' }));
    expect(await screen.findByRole('textbox', { name: /Jméno a příjmení sportovce/ })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /E-mail/ })).toHaveValue('rodic@email.cz');
    expect(screen.getByLabelText(/Jméno rodiče/)).toHaveValue('Petra Nováková');
    expect(getClubOffer.mock.calls.length).toBeGreaterThanOrEqual(2);
    await waitFor(() => expect(getClubSlots.mock.calls.length).toBeGreaterThanOrEqual(2));
  });
});

describe('legacy block token', () => {
  it('without info or slots: no slot request, the earliest slot is assigned, no minor / note fields', async () => {
    getClubOffer.mockResolvedValue(normaliseOffer({
      partnerName: 'FK Slaný', calendarId: 'c', activities: [{ activityId: 'a-1', activityName: 'Prohlídka', durationMinutes: 15 }],
      windows: [{ date: '2026-10-26', startTime: '09:00:00', endTime: '13:00:00', places: 8 }], remaining: 8,
    } as ClubOffer));
    claimClubSlot.mockResolvedValue({ failure: '', startUtc: '2026-10-26T07:00:00Z', endUtc: '2026-10-26T07:15:00Z', manageToken: null });
    renderClub();

    expect(await screen.findByText('Přesný čas vám přidělíme v rezervovaném okně.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Než se zaregistrujete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Hráč je mladší 18 let' })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: /Jméno a příjmení sportovce/ }), 'Jan Novák');
    await userEvent.click(confirmBtn());

    await waitFor(() => expect(claimClubSlot).toHaveBeenCalledTimes(1));
    expect(claimClubSlot.mock.calls[0][1].startUtc).toBeUndefined();
    expect(getClubSlots).not.toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Máte rezervováno' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Přidat další hráče' })).not.toBeInTheDocument();
  });
});

describe('section numbering follows what is visible', () => {
  const TWO_ACTIVITIES = [
    { activityId: 'a-1', activityName: 'Komplexní prohlídka', durationMinutes: 15, seats: 30, registered: 4, remaining: 26 },
    { activityId: 'a-2', activityName: 'Diagnostika', durationMinutes: 60, seats: 30, registered: 4, remaining: 26 },
  ];
  const numbers = () => screen.getAllByRole('heading').map((h) => h.textContent ?? '').filter((t) => /^\d · /.test(t)).map((t) => t.slice(0, 1));

  it('two činnosti: 1 then 2 (details) until one is chosen, then 3 for the term', async () => {
    getClubOffer.mockResolvedValue(offer({ activities: TWO_ACTIVITIES as never }));
    renderClub();
    await screen.findByRole('heading', { name: '1 · Vyberte činnost' });
    expect(numbers()).toEqual(['1', '2']);
    await userEvent.click((await screen.findAllByTestId('club-activity-card'))[0]);
    await waitFor(() => expect(numbers()).toEqual(['1', '2', '3']));
  });

  it('a single činnost hides the step and starts at 1', async () => {
    renderClub();
    await screen.findByRole('textbox', { name: /Jméno a příjmení sportovce/ });
    expect(numbers()).toEqual(['1', '2']);
  });
});
