/*
 * /objednat is booking only (artboard V-Rezervace): the offer's services as
 * cards, then — for the činnost chosen — a week of free times, a summary and
 * "Pokračovat", which holds the time and goes on to the registration.
 *
 * Rendered at 390 / 834 / 1440: the pinned bottom action on a phone, the day
 * list on an iPad, the seven columns on a desktop.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { BookableService } from '../../api/publicBooking';
import { VIEWPORTS, setViewport } from '../../test/viewport';

const bookableOffer = vi.fn();
const freeDays = vi.fn();
const freeSlots = vi.fn();
const holdSlot = vi.fn();
const rememberHeld = vi.fn();

vi.mock('../../api/publicBooking', async () => {
  const actual = await vi.importActual<typeof import('../../api/publicBooking')>('../../api/publicBooking');
  return { ...actual, bookableOffer, freeDays, freeSlots, holdSlot, rememberHeld };
});

vi.mock('../../api/clinicSettings', async () => {
  const actual = await vi.importActual<typeof import('../../api/clinicSettings')>('../../api/clinicSettings');
  return {
    ...actual,
    readPublicClinic: vi.fn().mockResolvedValue({
      name: 'SportMedical',
      email: 'recepce@example.cz',
      phone: '606 000 000',
      address: 'Jihlavská 1558/21, Praha 4',
      bookingEnabled: true,
    }),
  };
});

const { default: PublicBooking } = await import('./PublicBooking');
const { SlotGoneError } = await import('../../api/publicBooking');

const offer: BookableService[] = [
  {
    id: 'svc-1',
    name: 'Sportovní lékařské prohlídky',
    description: 'Posouzení zdravotní způsobilosti ke sportu.',
    activities: [
      {
        id: 'act-1',
        name: 'Základní sportovní prohlídka',
        durationMinutes: 40,
        publicNote: 'Klidové EKG a základní vyšetření plic.',
        calendarId: 'cal-1',
        priceCzk: 1600,
        requiresReportByEmail: false,
        requiresClubSharing: false,
        questionnaireRequirement: 'Required',
        holdMinutes: 15,
      },
      {
        id: 'act-2',
        name: 'Komplexní sportovní prohlídka',
        durationMinutes: 60,
        publicNote: '',
        calendarId: 'cal-1',
        priceCzk: 2200,
        requiresReportByEmail: false,
        requiresClubSharing: false,
        questionnaireRequirement: 'Required',
        holdMinutes: 15,
      },
    ],
  },
  {
    id: 'svc-2',
    name: 'Zvýhodněné balíčky',
    description: '',
    activities: [
      {
        id: 'act-3',
        name: 'Komplexní prohlídka + Základní diagnostika',
        durationMinutes: 120,
        publicNote: '',
        calendarId: 'cal-2',
        priceCzk: null,
        requiresReportByEmail: false,
        requiresClubSharing: false,
        questionnaireRequirement: 'Optional',
        holdMinutes: 10,
      },
    ],
  },
];

const SLOT = { startUtc: '2026-10-12T08:00:00Z', endUtc: '2026-10-12T09:00:00Z' };

const renderLanding = () =>
  render(
    <MemoryRouter initialEntries={['/objednat']}>
      <Routes>
        <Route path="/objednat" element={<PublicBooking />} />
        <Route path="/dotaznik" element={<div>REGISTRACE</div>} />
      </Routes>
    </MemoryRouter>,
  );

const choose = async (name = 'Komplexní sportovní prohlídka') => {
  await screen.findByText('Základní sportovní prohlídka');
  await userEvent.click(screen.getByRole('button', { name: `Objednat: ${name}` }));
};

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  bookableOffer.mockReset().mockResolvedValue(offer);
  freeDays.mockReset().mockResolvedValue(['2026-10-12', '2026-10-13']);
  freeSlots.mockReset().mockImplementation((_cal: string, _act: string, day: string) =>
    Promise.resolve(day === '2026-10-12' ? [SLOT] : []));
  holdSlot.mockReset().mockResolvedValue({
    token: 'hold-1', ...SLOT, expiresAtUtc: '2099-01-01T00:00:00Z',
  });
  rememberHeld.mockReset();
});

describe('step 1 — the service', () => {
  it('shows every service as a group of cards with the price and length the API sent', async () => {
    renderLanding();

    expect(await screen.findByText('Základní sportovní prohlídka')).toBeInTheDocument();
    expect(screen.getByText('Klidové EKG a základní vyšetření plic.')).toBeInTheDocument();
    expect(screen.getByText('1 600 Kč · 40 min')).toBeInTheDocument();
    expect(screen.getByText('2 200 Kč · 60 min')).toBeInTheDocument();
    // "od" the cheapest činnost of the group.
    expect(screen.getByText('od 1 600 Kč')).toBeInTheDocument();
    // A činnost without a linked price says so rather than inventing one.
    expect(screen.getByText('120 min')).toBeInTheDocument();
    expect(screen.getByText('Zvýhodněná cena')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Vyberte si službu' })).toBeInTheDocument();
  });

  it('is booking only: the website sections live under /web now', async () => {
    renderLanding();
    await screen.findByText('Základní sportovní prohlídka');

    expect(screen.queryByText('Kompletní ceník služeb')).not.toBeInTheDocument();
    expect(screen.queryByText('Na co se ptáte nejčastěji')).not.toBeInTheDocument();
    expect(screen.queryByText('Tři kroky k posudku')).not.toBeInTheDocument();
  });

  it('says so when the clinic offers nothing online, with the clinic\'s own number', async () => {
    bookableOffer.mockResolvedValue([]);
    renderLanding();

    expect(await screen.findByText('Online objednávání právě není otevřené')).toBeInTheDocument();
    expect(screen.getByText('Termín vám rádi domluvíme telefonicky na 606 000 000.')).toBeInTheDocument();
  });

  it('a failed offer says what failed and offers "Zkusit znovu"', async () => {
    bookableOffer.mockRejectedValueOnce(new Error('boom'));
    renderLanding();

    expect(await screen.findByText(/Nabídku se nepodařilo načíst/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByText('Základní sportovní prohlídka')).toBeInTheDocument();
  });
});

describe('step 2 — the time', () => {
  it('"Objednat" on a card asks for the days of that činnost on its own calendar', async () => {
    renderLanding();
    await choose();

    await waitFor(() =>
      expect(freeDays).toHaveBeenCalledWith('cal-1', 'act-2', expect.any(String), expect.any(String)),
    );
    const panel = document.getElementById('rezervace');
    expect(panel).not.toBeNull();
    expect(within(panel as HTMLElement).getByText('Vybrané vyšetření')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Vyberte si termín' })).toBeInTheDocument();
    // The week of the first free day, with its free time.
    expect(await within(panel as HTMLElement).findByText('12. 10.')).toBeInTheDocument();
    await waitFor(() => expect(freeSlots).toHaveBeenCalledWith('cal-1', 'act-2', '2026-10-12'));
    expect(await screen.findByRole('button', { name: /10:00/ })).toBeInTheDocument();
  });

  it('a day with nothing free says "Bez volna", never a holiday it does not know about', async () => {
    renderLanding();
    await choose();

    expect(await screen.findByText('Bez volna')).toBeInTheDocument();
    expect(screen.queryByText(/svátek/i)).not.toBeInTheDocument();
  });

  it('picking a time fills the summary; "Pokračovat" holds it and goes on to the registration', async () => {
    renderLanding();
    await choose();

    const continueButton = screen.getByRole('button', { name: 'Pokračovat' });
    expect(pointerDisabled(continueButton)).toBe(true);

    await userEvent.click(await screen.findByRole('button', { name: /10:00/ }));
    const summary = screen.getByRole('complementary');
    expect(within(summary).getByText('Po 12. 10. · 10:00')).toBeInTheDocument();
    expect(within(summary).getByText('60 minut')).toBeInTheDocument();
    expect(within(summary).getByText('Jihlavská 1558/21, Praha 4')).toBeInTheDocument();
    expect(within(summary).getByText('2 200 Kč')).toBeInTheDocument();
    expect(holdSlot).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Pokračovat' }));

    await waitFor(() => expect(holdSlot).toHaveBeenCalledWith('cal-1', 'act-2', SLOT.startUtc));
    expect(rememberHeld).toHaveBeenCalledWith(expect.objectContaining({ token: 'hold-1', activityId: 'act-2' }));
    expect(await screen.findByText('REGISTRACE')).toBeInTheDocument();
  });

  it('a time somebody else took is refused now, with the server\'s sentence, and asked again', async () => {
    holdSlot.mockRejectedValueOnce(new SlotGoneError('Tento termín byl právě obsazen.'));
    renderLanding();
    await choose();

    await userEvent.click(await screen.findByRole('button', { name: /10:00/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Pokračovat' }));

    expect(await screen.findByText('Tento termín byl právě obsazen.')).toBeInTheDocument();
    await waitFor(() => expect(freeSlots.mock.calls.filter((c) => c[2] === '2026-10-12').length).toBeGreaterThan(1));
    expect(screen.queryByText('REGISTRACE')).not.toBeInTheDocument();
  });

  it('"Změnit službu" goes back to the offer', async () => {
    renderLanding();
    await choose();
    await userEvent.click(screen.getByRole('button', { name: 'Změnit službu' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Vyberte si službu' })).toBeInTheDocument();
  });

  it('says so when no time is free, with the clinic\'s number', async () => {
    freeDays.mockResolvedValue([]);
    renderLanding();
    await choose();

    expect(await screen.findByText(/nemáme volno.*606 000 000/)).toBeInTheDocument();
  });
});

describe('three layouts', () => {
  it('phone: one column, the times as a day list, "Pokračovat" pinned at the bottom', async () => {
    setViewport(VIEWPORTS.phone);
    renderLanding();
    await choose();

    expect(await screen.findByRole('button', { name: /10:00/ })).toBeInTheDocument();
    expect(document.querySelector('[data-layout="list"]')).not.toBeNull();
    const bar = document.querySelector('[data-pinned="true"]');
    expect(bar).not.toBeNull();
    expect(within(bar as HTMLElement).getByRole('button', { name: 'Pokračovat' })).toBeInTheDocument();
    // Only one "Pokračovat" exists.
    expect(screen.getAllByRole('button', { name: 'Pokračovat' })).toHaveLength(1);
  });

  it('iPad: the week as a day list beside the summary, the action inline', async () => {
    setViewport(VIEWPORTS.tablet);
    renderLanding();
    await choose();

    expect(await screen.findByRole('button', { name: /10:00/ })).toBeInTheDocument();
    expect(document.querySelector('[data-layout="list"]')).not.toBeNull();
    expect(document.querySelector('[data-pinned="true"]')).toBeNull();
    expect(within(screen.getByRole('complementary')).getByRole('button', { name: 'Pokračovat' })).toBeInTheDocument();
  });

  it('desktop: the artboard\'s seven columns beside the summary', async () => {
    setViewport(VIEWPORTS.desktop);
    renderLanding();
    await choose();

    expect(await screen.findByRole('button', { name: /10:00/ })).toBeInTheDocument();
    expect(document.querySelector('[data-layout="columns"]')).not.toBeNull();
    expect(document.querySelector('[data-pinned="true"]')).toBeNull();
    // Seven day headers: Pondělí … Neděle.
    expect(screen.getByText('Pondělí')).toBeInTheDocument();
    expect(screen.getByText('Neděle')).toBeInTheDocument();
  });

  it('every time is a target of at least 44 px (the style, since jsdom has no layout)', async () => {
    setViewport(VIEWPORTS.phone);
    renderLanding();
    await choose();

    const time = await screen.findByRole('button', { name: /10:00/ });
    expect(getComputedStyle(time).height).toBe('44px');
  });
});

function pointerDisabled(button: HTMLElement): boolean {
  return (button as HTMLButtonElement).disabled;
}
