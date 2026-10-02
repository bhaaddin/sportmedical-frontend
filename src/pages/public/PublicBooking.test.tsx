/*
 * The landing's service cards come from the clinic's own offer — name, note,
 * price and length as the API sends them — and "Objednat" on one of them
 * starts the day/slot flow for exactly that činnost and calendar.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { BookableService } from '../../api/publicBooking';

const bookableOffer = vi.fn();
const freeDays = vi.fn();
const freeSlots = vi.fn();
const readPublicPriceList = vi.fn();

vi.mock('../../api/publicBooking', async () => {
  const actual = await vi.importActual<typeof import('../../api/publicBooking')>('../../api/publicBooking');
  return { ...actual, bookableOffer, freeDays, freeSlots, readPublicPriceList };
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

const renderLanding = () =>
  render(
    <MemoryRouter initialEntries={['/objednat']}>
      <Routes>
        <Route path="/objednat" element={<PublicBooking />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  bookableOffer.mockReset().mockResolvedValue(offer);
  freeDays.mockReset().mockResolvedValue(['2026-10-12', '2026-10-13']);
  freeSlots.mockReset().mockResolvedValue([]);
  readPublicPriceList.mockReset().mockResolvedValue([]);
});

describe('the landing page', () => {
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
  });

  it('hides the price-list section when the server has none', async () => {
    renderLanding();
    await screen.findByText('Základní sportovní prohlídka');

    expect(screen.queryByText('Kompletní ceník služeb')).not.toBeInTheDocument();
  });

  it('shows the price list grouped by category when the server publishes one', async () => {
    readPublicPriceList.mockResolvedValue([
      { category: 'InBody', items: [{ code: 'ib', name: 'Základní InBody měření', description: '', priceCzk: 500, durationMinutes: 15 }] },
    ]);
    renderLanding();

    expect(await screen.findByText('Kompletní ceník služeb')).toBeInTheDocument();
    expect(screen.getByText('Základní InBody měření')).toBeInTheDocument();
    expect(screen.getByText('500 Kč')).toBeInTheDocument();
  });

  it('"Objednat" on a card asks for the days of that činnost on its own calendar', async () => {
    renderLanding();
    await screen.findByText('Základní sportovní prohlídka');

    await userEvent.click(screen.getByRole('button', { name: 'Objednat: Komplexní sportovní prohlídka' }));

    await waitFor(() =>
      expect(freeDays).toHaveBeenCalledWith('cal-1', 'act-2', expect.any(String), expect.any(String)),
    );
    const panel = document.getElementById('rezervace');
    expect(panel).not.toBeNull();
    expect(within(panel as HTMLElement).getByText('Vybrané vyšetření')).toBeInTheDocument();
    expect(await within(panel as HTMLElement).findByText(/12\. října/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vybráno: Komplexní sportovní prohlídka' })).toBeInTheDocument();
  });

  it('says so when the clinic offers nothing online, with the clinic\'s own number', async () => {
    bookableOffer.mockResolvedValue([]);
    renderLanding();

    expect(await screen.findByText('Online objednávání právě není otevřené')).toBeInTheDocument();
    expect(screen.getByText('Termín vám rádi domluvíme telefonicky na 606 000 000.')).toBeInTheDocument();
  });
});
