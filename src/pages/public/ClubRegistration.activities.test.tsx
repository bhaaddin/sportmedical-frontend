/*
 * /klub/:token with more than one činnost: the athlete chooses it first (cards
 * with the places left), a full one is disabled, the claim carries activityId,
 * a 409 "all places taken" is said calmly and marks the card full. A block with
 * one činnost skips the step.
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
    readPublicClinic: vi.fn().mockResolvedValue({ name: 'SportMedical', email: 'r@example.cz', phone: '606 785 271', address: 'Praha', bookingEnabled: true }),
  };
});

const { default: ClubRegistration } = await import('./ClubRegistration');
const { ClubClaimError, normaliseOffer } = await import('../../api/publicClub');

const TWO = [
  { activityId: 'a-1', activityName: 'Základní sportovní prohlídka', durationMinutes: 15, seats: 10, registered: 3, remaining: 7 },
  { activityId: 'a-2', activityName: 'Diagnostika', durationMinutes: 60, seats: 60, registered: 60, remaining: 0 },
];

const offer = (over: Partial<ClubOffer> = {}): ClubOffer => ({
  partnerName: 'FK Slaný', calendarId: 'cal-1', activities: TWO,
  windows: [{ date: '2026-10-26', startTime: '09:00:00', endTime: '13:00:00', places: 8 }],
  remaining: 7, colorHex: '#2E7D6B', seats: 70, registered: 63, fromDate: '2026-10-26', toDate: '2026-10-26', ...over,
});

const renderClub = () =>
  render(
    <MemoryRouter initialEntries={['/klub/tok-1']}>
      <Routes><Route path="/klub/:token" element={<ClubRegistration />} /></Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  getClubOffer.mockReset().mockResolvedValue(offer());
  claimClubSlot.mockReset().mockResolvedValue({ failure: '', startUtc: '2026-10-26T08:15:00Z', endUtc: '2026-10-26T08:30:00Z', manageToken: null });
});

describe('reading the server offer', () => {
  it('accepts `name` for a činnost and works out remaining from seats and registered', () => {
    const read = normaliseOffer({ ...offer(), activities: [{ activityId: 'a', name: 'Diagnostika', durationMinutes: 60, seats: 10, registered: 4 }] as never });
    expect(read.activities[0]).toMatchObject({ activityName: 'Diagnostika', seats: 10, registered: 4, remaining: 6 });
  });
});

describe.each(Object.entries(VIEWPORTS))('two činnosti at %s (%ipx)', (_n, width) => {
  beforeEach(() => setViewport(width));

  it('shows a card per činnost with places left; the full one is disabled and says Obsazeno', async () => {
    renderClub();
    const cards = await screen.findAllByTestId('club-activity-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Základní sportovní prohlídka');
    expect(cards[0]).toHaveTextContent('15 min na sportovce');
    expect(cards[0]).toHaveTextContent('volno 7 z 10');
    expect(cards[0]).toBeEnabled();
    expect(cards[1]).toBeDisabled();
    expect(cards[1]).toHaveTextContent('Obsazeno');
    expect(screen.getByRole('heading', { name: '1 · Vyberte činnost' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Potvrdit registraci' })).toBeDisabled();
  });

  it('claims with the chosen activityId', async () => {
    renderClub();
    await userEvent.click((await screen.findAllByTestId('club-activity-card'))[0]);
    expect(screen.getAllByTestId('club-activity-card')[0]).toHaveAttribute('aria-pressed', 'true');
    await userEvent.type(screen.getByRole('textbox', { name: /Jméno a příjmení/ }), 'Jan Novák');
    await userEvent.click(screen.getByRole('button', { name: 'Potvrdit registraci' }));
    await waitFor(() => expect(claimClubSlot).toHaveBeenCalledTimes(1));
    expect(claimClubSlot).toHaveBeenCalledWith('tok-1', expect.objectContaining({ activityId: 'a-1', name: 'Jan Novák' }));
    expect(await screen.findByText('Máte rezervováno')).toBeInTheDocument();
  });

  it('a 409 "places taken" is shown calmly and the chosen card turns full', async () => {
    claimClubSlot.mockRejectedValue(new ClubClaimError('Na tuto činnost už nejsou volná místa.', 409, 'activity_full'));
    renderClub();
    await userEvent.click((await screen.findAllByTestId('club-activity-card'))[0]);
    await userEvent.type(screen.getByRole('textbox', { name: /Jméno a příjmení/ }), 'Jan Novák');
    await userEvent.click(screen.getByRole('button', { name: 'Potvrdit registraci' }));

    expect(await screen.findByText('Na tuto činnost už nejsou volná místa.')).toBeInTheDocument();
    const cards = screen.getAllByTestId('club-activity-card');
    expect(cards[0]).toBeDisabled();
    expect(within(cards[0]).getByText(/Obsazeno/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Potvrdit registraci' })).toBeDisabled();
  });

  it('a 409 for a taken time does not mark the činnost full', async () => {
    claimClubSlot.mockRejectedValue(new ClubClaimError('Tento čas už si vzal někdo jiný.', 409, 'slot_taken'));
    renderClub();
    await userEvent.click((await screen.findAllByTestId('club-activity-card'))[0]);
    await userEvent.type(screen.getByRole('textbox', { name: /Jméno a příjmení/ }), 'Jan Novák');
    await userEvent.click(screen.getByRole('button', { name: 'Potvrdit registraci' }));
    expect(await screen.findByText('Tento čas už si vzal někdo jiný.')).toBeInTheDocument();
    expect(screen.getAllByTestId('club-activity-card')[0]).toBeEnabled();
  });
});

describe('one činnost', () => {
  it('is preselected and the step is skipped', async () => {
    getClubOffer.mockResolvedValue(offer({ activities: [TWO[0]], remaining: 7 }));
    renderClub();
    expect(await screen.findByRole('heading', { name: '1 · Vyberte si termín' })).toBeInTheDocument();
    expect(screen.queryByTestId('club-activity-card')).toBeNull();
    await userEvent.type(screen.getByRole('textbox', { name: /Jméno a příjmení/ }), 'Jan Novák');
    await userEvent.click(screen.getByRole('button', { name: 'Potvrdit registraci' }));
    await waitFor(() => expect(claimClubSlot).toHaveBeenCalledWith('tok-1', expect.objectContaining({ activityId: 'a-1' })));
  });
});

describe('every činnost full', () => {
  it('says all places are taken', async () => {
    getClubOffer.mockResolvedValue(offer({ activities: [TWO[1]], remaining: 5 }));
    renderClub();
    expect(await screen.findByRole('heading', { name: 'Všechna místa jsou obsazená' })).toBeInTheDocument();
  });
});
