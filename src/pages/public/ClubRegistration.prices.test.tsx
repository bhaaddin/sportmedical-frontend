/*
 * "Ceny doplnit všude" (10. 10. 2026) on /klub/:token: every činnost card
 * carries its price; when the order is invoiced to the club the price reads
 * "· hradí klub" instead of asking the athlete to pay; an unpriced činnost says
 * "bez ceny"; the chosen činnost's price stands beside the confirm button and
 * on the success screen. The server's `priceCzk` is accepted beside
 * `unitPriceCzk`, and `paymentMethod` at the offer's root beside `info`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
const { normaliseOffer } = await import('../../api/publicClub');

/* jest-dom collapses every whitespace (the non-breaking one too) before comparing text, so a plain space is what to expect. */
const SP = ' ';

const ACTIVITIES = [
  { activityId: 'a-1', activityName: 'Základní prohlídka', durationMinutes: 15, seats: 10, registered: 3, remaining: 7, unitPriceCzk: 1200 },
  { activityId: 'a-2', activityName: 'Konzultace', durationMinutes: 20, seats: 10, registered: 0, remaining: 10, unitPriceCzk: null },
];

const offer = (over: Partial<ClubOffer> = {}): ClubOffer => ({
  partnerName: 'FK Slaný', calendarId: 'cal-1', activities: ACTIVITIES,
  windows: [{ date: '2026-10-26', startTime: '09:00:00', endTime: '13:00:00', places: 8 }],
  remaining: 7, seats: 20, registered: 3, fromDate: '2026-10-26', toDate: '2026-10-26', ...over,
});

const renderClub = () =>
  render(
    <MemoryRouter initialEntries={['/klub/tok-1']}>
      <Routes><Route path="/klub/:token" element={<ClubRegistration />} /></Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  getClubOffer.mockReset().mockResolvedValue(offer({ paymentMethod: 'ClubInvoice' }));
  claimClubSlot.mockReset().mockResolvedValue({ failure: '', startUtc: '2026-10-26T08:15:00Z', endUtc: '2026-10-26T08:30:00Z', manageToken: null });
});

describe('reading the prices', () => {
  it('accepts `priceCzk` beside `unitPriceCzk`, and the order\'s `paymentMethod` at the root or in `info`', () => {
    const read = normaliseOffer({
      ...offer(),
      paymentMethod: 'ClubInvoice',
      activities: [{ activityId: 'a', name: 'Diagnostika', durationMinutes: 60, seats: 10, registered: 4, priceCzk: 1500 }],
    } as never);
    expect(read.activities[0].unitPriceCzk).toBe(1500);
    expect(read.paymentMethod).toBe('ClubInvoice');

    const fromInfo = normaliseOffer({
      ...offer(),
      info: { clubName: 'FK', serviceName: 'Prohlídky', paymentMethod: 'PerPerson', payerText: '', windows: [] },
    } as never);
    expect(fromInfo.paymentMethod).toBe('PerPerson');
    expect(normaliseOffer(offer() as never).paymentMethod).toBeNull();
  });
});

describe.each(Object.entries(VIEWPORTS))('prices on the cards at %s (%ipx)', (_n, width) => {
  beforeEach(() => setViewport(width));

  it('shows the price with "hradí klub" when the club is invoiced, and "bez ceny" for an unpriced činnost', async () => {
    renderClub();
    const cards = await screen.findAllByTestId('club-activity-card');
    expect(within(cards[0]).getByTestId('club-activity-price')).toHaveTextContent(`1${SP}200${SP}Kč · hradí klub`);
    expect(within(cards[1]).getByTestId('club-activity-price')).toHaveTextContent('bez ceny · hradí klub');
    expect(cards[0]).toHaveTextContent('volno 7 z 10');
  });

  it('shows the bare price when each person pays', async () => {
    getClubOffer.mockResolvedValue(offer({ paymentMethod: 'PerPerson' }));
    renderClub();
    const cards = await screen.findAllByTestId('club-activity-card');
    expect(within(cards[0]).getByTestId('club-activity-price')).toHaveTextContent(`1${SP}200${SP}Kč`);
    expect(within(cards[0]).getByTestId('club-activity-price')).not.toHaveTextContent('hradí klub');
    expect(within(cards[1]).getByTestId('club-activity-price')).toHaveTextContent('bez ceny');
  });

  it('repeats the chosen činnost\'s price beside the confirm button and on the success screen', async () => {
    renderClub();
    expect(screen.queryByTestId('club-chosen-price')).toBeNull();
    await userEvent.click((await screen.findAllByTestId('club-activity-card'))[0]);
    expect(screen.getByTestId('club-chosen-price')).toHaveTextContent(`Základní prohlídka · 1${SP}200${SP}Kč · hradí klub`);

    await userEvent.type(screen.getByRole('textbox', { name: /Jméno a příjmení/ }), 'Jan Novák');
    await userEvent.click(screen.getByRole('button', { name: 'Potvrdit registraci' }));
    expect(await screen.findByText('Máte rezervováno')).toBeInTheDocument();
    expect(screen.getByTestId('booked-price')).toHaveTextContent(`Cena: 1${SP}200${SP}Kč · hradí klub`);
  });
});
