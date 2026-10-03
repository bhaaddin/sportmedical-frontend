/*
 * /klub/:token — an athlete registers through the club's link (artboard
 * V-KlubReg): the club's name and colour, the block's period, the places left,
 * a time inside the block, four details. A dead, expired or full link is said
 * plainly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ClubOffer } from '../../api/publicClub';
import { VIEWPORTS, setViewport } from '../../test/viewport';

const getClubOffer = vi.fn();
const claimClubSlot = vi.fn();

vi.mock('../../api/publicClub', async () => {
  const actual = await vi.importActual<typeof import('../../api/publicClub')>('../../api/publicClub');
  return { ...actual, getClubOffer, claimClubSlot };
});

vi.mock('../../api/clinicSettings', async () => {
  const actual = await vi.importActual<typeof import('../../api/clinicSettings')>('../../api/clinicSettings');
  return {
    ...actual,
    readPublicClinic: vi.fn().mockResolvedValue({
      name: 'SportMedical', email: 'recepce@example.cz', phone: '606 785 271', address: 'Praha', bookingEnabled: true,
    }),
  };
});

const { default: ClubRegistration } = await import('./ClubRegistration');
const { ClubLinkDeadError } = await import('../../api/publicClub');

const offer = (over: Partial<ClubOffer> = {}): ClubOffer => ({
  partnerName: 'FK Slaný',
  calendarId: 'cal-1',
  activities: [{ activityId: 'act-1', activityName: 'Komplexní prohlídka', durationMinutes: 15 }],
  windows: [
    { date: '2026-10-26', startTime: '09:00:00', endTime: '13:00:00', places: 8 },
    { date: '2026-10-27', startTime: '09:00:00', endTime: '13:00:00', places: 4 },
  ],
  remaining: 8,
  colorHex: '#2E7D6B',
  seats: 12,
  registered: 4,
  fromDate: '2026-10-26',
  toDate: '2026-10-27',
  ...over,
});

const SLOTS = [
  { startUtc: '2026-10-27T08:00:00Z', endUtc: '2026-10-27T08:15:00Z', free: false },
  { startUtc: '2026-10-27T08:15:00Z', endUtc: '2026-10-27T08:30:00Z', free: true },
  { startUtc: '2026-10-27T08:30:00Z', endUtc: '2026-10-27T08:45:00Z', free: true },
];

const renderClub = () =>
  render(
    <MemoryRouter initialEntries={['/klub/tok-1']}>
      <Routes>
        <Route path="/klub/:token" element={<ClubRegistration />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  getClubOffer.mockReset().mockResolvedValue(offer());
  claimClubSlot.mockReset().mockResolvedValue({
    failure: '', startUtc: '2026-10-27T08:15:00Z', endUtc: '2026-10-27T08:30:00Z', manageToken: null,
  });
});

describe('the offer', () => {
  it('names the club, its colour, the block period and the places left — all from the API', async () => {
    renderClub();

    expect(await screen.findByRole('heading', { level: 1, name: 'Vyberte si čas na prohlídku' })).toBeInTheDocument();
    expect(screen.getByText('FK Slaný')).toBeInTheDocument();
    expect(screen.getByTestId('club-colour')).toHaveStyle({ backgroundColor: '#2E7D6B' });
    expect(screen.getByText(/Blok: 26\.–27\. října 2026/)).toBeInTheDocument();
    const places = screen.getByRole('group', { name: 'Zbývající místa' });
    expect(within(places).getByText('8')).toBeInTheDocument();
    expect(within(places).getByText('/ 12')).toBeInTheDocument();
    expect(within(places).getByRole('progressbar', { name: 'Obsazená místa' })).toHaveAttribute('aria-valuenow', '4');
  });

  it('shows only the remaining places when the server does not say how many there were', async () => {
    getClubOffer.mockResolvedValue(offer({ seats: null, registered: null }));
    renderClub();

    const places = await screen.findByRole('group', { name: 'Zbývající místa' });
    expect(within(places).getByText('8')).toBeInTheDocument();
    expect(within(places).queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('without a list of times, the held days are shown and the time is assigned', async () => {
    renderClub();

    const days = await screen.findByRole('list', { name: 'Rezervované dny' });
    expect(within(days).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Přesný čas vám přidělíme v rezervovaném okně.')).toBeInTheDocument();
  });
});

describe('choosing a time and registering', () => {
  beforeEach(() => {
    getClubOffer.mockResolvedValue(offer({ slots: SLOTS }));
  });

  it('a taken time cannot be chosen; the free ones can', async () => {
    renderClub();

    expect(await screen.findByLabelText('09:00 — obsazeno')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /09:15/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Potvrdit registraci' })).toBeDisabled();
  });

  it('sends the name, e-mail, phone and the chosen time, then confirms', async () => {
    renderClub();

    await userEvent.click(await screen.findByRole('button', { name: /09:15/ }));
    expect(screen.getByRole('button', { name: /09:15/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Úterý 27. října v 09:15')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: /Jméno a příjmení/ }), 'Jan Novák');
    await userEvent.type(screen.getByRole('textbox', { name: 'E-mail' }), 'jan@email.cz');
    await userEvent.click(screen.getByRole('button', { name: 'Potvrdit registraci' }));

    await waitFor(() => expect(claimClubSlot).toHaveBeenCalledTimes(1));
    expect(claimClubSlot).toHaveBeenCalledWith('tok-1', expect.objectContaining({
      activityId: 'act-1', name: 'Jan Novák', email: 'jan@email.cz', startUtc: '2026-10-27T08:15:00Z',
    }));
    expect(await screen.findByText('Máte rezervováno')).toBeInTheDocument();
  });

  it('the server\'s own refusal is shown and the form stays', async () => {
    claimClubSlot.mockRejectedValue(new Error('Tento čas už si vzal někdo jiný.'));
    renderClub();

    await userEvent.click(await screen.findByRole('button', { name: /09:15/ }));
    await userEvent.type(screen.getByRole('textbox', { name: /Jméno a příjmení/ }), 'Jan Novák');
    await userEvent.click(screen.getByRole('button', { name: 'Potvrdit registraci' }));

    expect(await screen.findByText('Tento čas už si vzal někdo jiný.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Potvrdit registraci' })).toBeInTheDocument();
  });
});

describe('the date of birth', () => {
  it('is not asked unless the server says so', async () => {
    renderClub();
    await screen.findByRole('textbox', { name: /Jméno a příjmení/ });
    expect(screen.queryByLabelText(/Datum narození/)).not.toBeInTheDocument();
  });

  it('is asked — and required — when the server says so', async () => {
    getClubOffer.mockResolvedValue(offer({ requireDateOfBirth: true }));
    renderClub();

    expect(await screen.findByLabelText(/Datum narození/)).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: /Jméno a příjmení/ }), 'Jan Novák');
    expect(screen.getByRole('button', { name: 'Potvrdit registraci' })).toBeDisabled();
  });
});

describe('link states', () => {
  it('a dead link says so, with the clinic\'s number', async () => {
    getClubOffer.mockRejectedValue(new ClubLinkDeadError('x'));
    renderClub();

    expect(await screen.findByText(/Tento odkaz už není platný nebo vypršel/)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Zavolat 606 785 271/ })).toBeInTheDocument();
  });

  it('an expired link does not take registrations', async () => {
    getClubOffer.mockResolvedValue(offer({ expiresAtUtc: '2020-01-01T00:00:00Z' }));
    renderClub();

    expect(await screen.findByText('Odkaz vypršel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Potvrdit registraci' })).not.toBeInTheDocument();
  });

  it('a full block says so', async () => {
    getClubOffer.mockResolvedValue(offer({ remaining: 0 }));
    renderClub();

    expect(await screen.findByText('Všechna místa jsou obsazená')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Jméno a příjmení/ })).not.toBeInTheDocument();
  });

  it('a failed load offers "Zkusit znovu"', async () => {
    getClubOffer.mockRejectedValueOnce(new Error('network'));
    renderClub();

    expect(await screen.findByText(/Registraci se nepodařilo načíst/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Vyberte si čas na prohlídku' })).toBeInTheDocument();
  });
});

describe('three layouts', () => {
  it('phone: the confirm action is pinned at the bottom', async () => {
    setViewport(VIEWPORTS.phone);
    renderClub();
    await screen.findByRole('textbox', { name: /Jméno a příjmení/ });

    const bar = document.querySelector('[data-pinned="true"]') as HTMLElement | null;
    expect(bar).not.toBeNull();
    expect(within(bar as HTMLElement).getByRole('button', { name: 'Potvrdit registraci' })).toBeInTheDocument();
  });

  it.each([['iPad', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]])('%s: the action sits in an inline panel', async (_n, width) => {
    setViewport(width);
    renderClub();
    await screen.findByRole('textbox', { name: /Jméno a příjmení/ });

    expect(document.querySelector('[data-pinned="true"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Potvrdit registraci' })).toBeInTheDocument();
  });
});
