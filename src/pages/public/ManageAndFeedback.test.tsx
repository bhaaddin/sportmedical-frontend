/*
 * The two small link pages — /rezervace/:token (manage a booking) and
 * /hodnoceni/:token (rate a visit) — in the public frame, at 390 / 834 / 1440.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { VIEWPORTS, setViewport } from '../../test/viewport';

const readBooking = vi.fn();
const submitFeedback = vi.fn();
/* The public offer, for the price of the booking's činnost (Etapa 12). */
const bookableOffer = vi.fn();

vi.mock('../../api/publicBooking', async () => {
  const actual = await vi.importActual<typeof import('../../api/publicBooking')>('../../api/publicBooking');
  return { ...actual, bookableOffer };
});

vi.mock('../../api/publicManage', async () => {
  const actual = await vi.importActual<typeof import('../../api/publicManage')>('../../api/publicManage');
  return { ...actual, readBooking };
});

vi.mock('../../api/feedback', async () => {
  const actual = await vi.importActual<typeof import('../../api/feedback')>('../../api/feedback');
  return { ...actual, submitFeedback };
});

vi.mock('../../api/clinicSettings', async () => {
  const actual = await vi.importActual<typeof import('../../api/clinicSettings')>('../../api/clinicSettings');
  return {
    ...actual,
    readPublicClinic: vi.fn().mockResolvedValue({ name: 'SportMedical', email: '', phone: '606 785 271', address: '', bookingEnabled: true }),
  };
});

const { default: ManageBooking } = await import('./ManageBooking');
const { default: FeedbackPage } = await import('./FeedbackPage');

const booking = {
  appointmentId: 'a1',
  serviceName: 'Sportovní lékařské prohlídky',
  activityName: 'Základní sportovní prohlídka',
  startUtc: '2026-10-26T09:00:00Z',
  endUtc: '2026-10-26T09:40:00Z',
  isCancelled: false,
  calendarId: 'cal-1',
  activityId: 'act-1',
  canChangeUntilUtc: null,
};

const renderManage = () =>
  render(
    <MemoryRouter initialEntries={['/rezervace/tok']}>
      <Routes><Route path="/rezervace/:token" element={<ManageBooking />} /></Routes>
    </MemoryRouter>,
  );

const renderFeedback = () =>
  render(
    <MemoryRouter initialEntries={['/hodnoceni/tok']}>
      <Routes><Route path="/hodnoceni/:token" element={<FeedbackPage />} /></Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  readBooking.mockReset().mockResolvedValue(booking);
  submitFeedback.mockReset().mockResolvedValue(undefined);
  bookableOffer.mockReset().mockResolvedValue([
    { id: 's1', name: 'Prohlídky', description: '', activities: [{ id: 'act-1', name: 'Základní sportovní prohlídka', priceCzk: 1600 }] },
  ]);
});

describe('/rezervace/:token', () => {
  it.each([['phone', VIEWPORTS.phone], ['iPad', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]])('%s: shows the booking, the calendar file and the cancel', async (_n, width) => {
    setViewport(width);
    renderManage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Vaše rezervace' })).toBeInTheDocument();
    expect(await screen.findByText(/Základní sportovní prohlídka/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Přidat do kalendáře/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zrušit termín' })).toBeInTheDocument();
    // The old hard-coded document reminder is gone: documents are the činnost's setting now.
    expect(screen.queryByText(/výpis ze zdravotní dokumentace/i)).not.toBeInTheDocument();
  });

  /* Etapa 12, "ceny všude": the patient sees what they pay - the booking's own
     price when the server sends one, the public offer's otherwise; an agreed
     price as the plain amount, never the list it was adjusted from. */
  it('shows the price from the public offer when the booking carries none', async () => {
    renderManage();
    expect(await screen.findByTestId('price-line')).toHaveTextContent('Cena: 1 600 Kč');
    expect(bookableOffer).toHaveBeenCalledTimes(1);
  });

  it('shows an agreed price plain, without asking the offer', async () => {
    readBooking.mockResolvedValue({ ...booking, agreedPriceCzk: 1200, listPriceCzk: 1600 });
    renderManage();
    expect(await screen.findByTestId('price-line')).toHaveTextContent('Cena: 1 200 Kč');
    expect(screen.getByTestId('price-line')).not.toHaveTextContent('upraveno');
    expect(bookableOffer).not.toHaveBeenCalled();
  });

  it('says "Cena na dotaz" when nobody knows a price', async () => {
    bookableOffer.mockResolvedValue([]);
    renderManage();
    expect(await screen.findByTestId('price-line')).toHaveTextContent('Cena na dotaz');
  });

  it('a link that finds nothing says so, with the clinic\'s number', async () => {
    readBooking.mockRejectedValue(new Error('x'));
    renderManage();

    expect(await screen.findByText('Rezervaci jsme nenašli')).toBeInTheDocument();
    expect(await screen.findByText(/Zavolejte nám prosím na 606 785 271/)).toBeInTheDocument();
  });
});

describe('/hodnoceni/:token', () => {
  it('phone: "Odeslat hodnocení" is pinned at the bottom and waits for a rating', async () => {
    setViewport(VIEWPORTS.phone);
    renderFeedback();

    const bar = document.querySelector('[data-pinned="true"]') as HTMLElement | null;
    expect(bar).not.toBeNull();
    expect(within(bar as HTMLElement).getByRole('button', { name: 'Odeslat hodnocení' })).toBeDisabled();
  });

  it.each([['iPad', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]])('%s: inline action; rating then send', async (_n, width) => {
    setViewport(width);
    renderFeedback();

    expect(document.querySelector('[data-pinned="true"]')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: '4 Stars' }));
    await userEvent.click(screen.getByRole('button', { name: 'Odeslat hodnocení' }));

    expect(submitFeedback).toHaveBeenCalledWith('tok', { rating: 4, comment: undefined });
    expect(await screen.findByText('Děkujeme')).toBeInTheDocument();
  });
});
