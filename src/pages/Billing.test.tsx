/*
 * Fakturace as the board draws it: the numbers up top come from the invoices
 * the page loads, the filters narrow the table, a patient's name is a link to
 * their card, and a payment goes to the API as the server's enum name.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const getInvoices = vi.fn();
const recordPayment = vi.fn();
vi.mock('../api/billing', () => ({
  billingApi: { getInvoices, recordPayment, createInvoice: vi.fn(), addLineItem: vi.fn() },
}));
const getPatient = vi.fn();
vi.mock('../api/patients', () => ({ patientsApi: { getById: getPatient } }));
const getClub = vi.fn();
vi.mock('../api/clubs', () => ({ clubsApi: { getById: getClub } }));
const listActivities = vi.fn();
vi.mock('../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../api/calendars', () => ({ calendarsApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('../api/partnerOrders', () => ({ partnerOrdersApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('../api/services', () => ({ servicesApi: { getAll: vi.fn().mockResolvedValue([
  { id: 's1', code: 'KP', name: 'Komplexní prohlídka', description: '', durationMinutes: 60, priceCzk: 2200, isActive: true },
]) } }));
vi.mock('../components/patients/PatientPicker', () => ({ default: () => <div data-testid="picker" /> }));
vi.mock('../components/NumberSeriesPreview', () => ({ NumberSeriesPreview: () => null }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const { default: Billing } = await import('./Billing');

const yearAhead = new Date(Date.now() + 365 * 86400_000).toISOString();
const lastWeek = new Date(Date.now() - 7 * 86400_000).toISOString();
const now = new Date().toISOString();

const invoices = [
  {
    id: 'a', patientId: 'p1', patientName: 'Bohumil Komárek', invoiceNumber: '2026-0418', status: 'Issued',
    totalCzk: 2200, paidCzk: 0, remainingCzk: 2200, currency: 'CZK', issueDateUtc: now, dueDateUtc: yearAhead,
    items: [{ id: 'l1', description: 'Komplexní prohlídka', serviceCode: 'KP', quantity: 1, unitPriceCzk: 2200, amountCzk: 2200 }],
  },
  {
    id: 'b', patientId: 'p2', patientName: 'Petra Dvořáková', invoiceNumber: '2026-0416', status: 'Paid',
    totalCzk: 4000, paidCzk: 4000, remainingCzk: 0, currency: 'CZK', issueDateUtc: now, dueDateUtc: yearAhead,
    items: [{ id: 'l2', description: 'Spiroergometrie', serviceCode: 'SE', quantity: 1, unitPriceCzk: 4000, amountCzk: 4000 }],
  },
  {
    id: 'c', patientId: 'p3', patientName: 'Tomáš Kříž', invoiceNumber: '2026-0414', status: 'Issued',
    totalCzk: 1600, paidCzk: 0, remainingCzk: 1600, currency: 'CZK', issueDateUtc: now, dueDateUtc: lastWeek,
    items: [{ id: 'l3', description: 'Základní prohlídka', serviceCode: 'ZP', quantity: 1, unitPriceCzk: 1600, amountCzk: 1600 }],
  },
];

beforeEach(() => {
  getInvoices.mockReset().mockResolvedValue(invoices);
  recordPayment.mockReset().mockResolvedValue(invoices[0]);
});

function renderPage(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/billing', state }]}><Billing /></MemoryRouter>,
  );
}

describe('Fakturace', () => {
  it('computes the KPI cards from the loaded invoices', async () => {
    renderPage();
    await screen.findByText('2026-0418');

    expect(screen.getByText(/^Vyfakturováno v /i)).toBeInTheDocument();
    expect(screen.getByText(/^7\s800 Kč$/)).toBeInTheDocument();
    expect(screen.getByText('3 doklady')).toBeInTheDocument();
    expect(screen.getByText(/^3\s800 Kč$/)).toBeInTheDocument();
    expect(screen.getByText('1 doklad po splatnosti')).toBeInTheDocument();
    /* 7 800 over three patients */
    expect(screen.getByText(/^2\s600 Kč$/)).toBeInTheDocument();
  });

  it('shows the status words and links a patient to their card', async () => {
    renderPage();
    await screen.findByText('2026-0418');

    /* Scoped to the table: the KPI card above is labelled "Nezaplaceno" too. */
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Zaplaceno')).toBeInTheDocument();
    expect(table.getByText('Nezaplaceno')).toBeInTheDocument();
    expect(table.getByText('Po splatnosti')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: 'Bohumil Komárek' });
    expect(link).toHaveAttribute('href', '/patients/p1');
  });

  it('narrows the table with the filter chips and the search box', async () => {
    renderPage();
    await screen.findByText('2026-0418');

    fireEvent.click(screen.getByRole('button', { name: 'Po splatnosti' }));
    expect(screen.queryByText('2026-0418')).not.toBeInTheDocument();
    expect(screen.getByText('2026-0414')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vše' }));
    fireEvent.change(screen.getByPlaceholderText('Číslo dokladu, pacient nebo klub'), { target: { value: 'spiro' } });
    expect(screen.getByText('2026-0416')).toBeInTheDocument();
    expect(screen.queryByText('2026-0418')).not.toBeInTheDocument();
  });

  it('records a payment with the amount left and the method the server names', async () => {
    renderPage();
    await screen.findByText('2026-0418');

    fireEvent.click(screen.getByLabelText('Přijmout platbu 2026-0418'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Částka')).toHaveValue('2200');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Zaevidovat platbu' }));

    await waitFor(() => expect(recordPayment).toHaveBeenCalledWith('a', { amountCzk: 2200, method: 'Cash' }));
    await waitFor(() => expect(getInvoices).toHaveBeenCalledTimes(2));
  });

  it('sends the method and the note the desk chose', async () => {
    renderPage();
    await screen.findByText('2026-0418');

    fireEvent.click(screen.getByLabelText('Přijmout platbu 2026-0418'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Částka'), { target: { value: '1000' } });
    fireEvent.change(within(dialog).getByLabelText('Poznámka'), { target: { value: ' záloha ' } });
    fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: 'Způsob platby' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Kartou' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zaevidovat platbu' }));

    await waitFor(() =>
      expect(recordPayment).toHaveBeenCalledWith('a', { amountCzk: 1000, method: 'Card', note: 'záloha' }));
  });

  it('adds up the cash taken this month and says how much came by card', async () => {
    getInvoices.mockResolvedValue([
      { ...invoices[1], payments: [
        { id: 'x1', amountCzk: 3000, method: 'Cash', paidAtUtc: now, note: null },
        { id: 'x2', amountCzk: 1000, method: 'Card', paidAtUtc: now, note: 'zbytek' },
      ] },
    ]);
    renderPage();
    await screen.findByText('2026-0416');

    expect(screen.getByText('Hotově na místě')).toBeInTheDocument();
    expect(screen.getByText(/^3\s000 Kč$/)).toBeInTheDocument();
    expect(screen.getByText(/^kartou 1\s000 Kč$/)).toBeInTheDocument();
  });

  it('opens a row into its payments', async () => {
    getInvoices.mockResolvedValue([
      { ...invoices[1], payments: [{ id: 'x1', amountCzk: 4000, method: 'ClubBilling', paidAtUtc: now, note: 'faktura klubu' }] },
    ]);
    renderPage();
    await screen.findByText('2026-0416');
    expect(screen.queryByText('faktura klubu')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Platby dokladu 2026-0416'));

    expect(await screen.findByText('faktura klubu')).toBeInTheDocument();
    expect(screen.getByText('Na klub')).toBeInTheDocument();
  });

  it('opens the new-document dialog for a visit with the patient and the price-list item of the činnost', async () => {
    getPatient.mockResolvedValue({ id: 'p9', firstName: 'Jan', lastName: 'Novák' });
    listActivities.mockResolvedValue({ activities: [{ id: 'act1', serviceItemId: 's1' }], warnings: [] });
    renderPage({ patientId: 'p9', appointmentId: 'ap1', activityId: 'act1' });

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(getPatient).toHaveBeenCalledWith('p9'));
    expect(await within(dialog).findByLabelText('Počet Komplexní prohlídka')).toHaveValue(1);
    expect(within(dialog).getByText(/Celkem k úhradě 2\s200 Kč/)).toBeInTheDocument();
  });

  it('draws a club as the odběratel when sent from a club', async () => {
    getClub.mockResolvedValue({ id: 'c1', name: 'FK Slaný' });
    renderPage({ clubId: 'c1' });

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Klub: FK Slaný')).toBeInTheDocument();
  });
});
