/*
 * Fakturace as the board draws it: the numbers up top come from the invoices
 * the page loads, the filters narrow the list, a patient's name is a link to
 * their card, and a payment goes to the API as the server's enum name.
 *
 * Plus the etapa-2 parts: three layouts (cards on a phone, a table with fewer
 * columns on an iPad, the full table on a desktop), recipient types, invoices
 * waiting for approval and who may approve them, the PDF, and the new-document
 * flow entered from other screens.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../test/viewport';

const getInvoices = vi.fn();
const recordPayment = vi.fn();
const approve = vi.fn();
const reject = vi.fn();
const getInvoicePdf = vi.fn();
const priceQuote = vi.fn();
const createInvoice = vi.fn();
const getClubBlock = vi.fn();
vi.mock('../api/billing', () => ({
  billingApi: { getInvoices, recordPayment, createInvoice, approve, reject, getInvoicePdf, priceQuote, getClubBlock },
}));
const getPatient = vi.fn();
vi.mock('../api/patients', () => ({ patientsApi: { getById: getPatient } }));
const getClub = vi.fn();
vi.mock('../api/clubs', () => ({ clubsApi: { getById: getClub, getAll: vi.fn().mockResolvedValue([]) } }));
const listActivities = vi.fn();
vi.mock('../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../api/calendars', () => ({ calendarsApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('../api/partnerOrders', () => ({ partnerOrdersApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('../components/patients/PatientPicker', () => ({ default: () => <div data-testid="picker" /> }));
vi.mock('../components/NumberSeriesPreview', () => ({ NumberSeriesPreview: () => null }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toast }));

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

/* A group's invoice above somebody's discount limit, and a team's issued one. */
const pending = {
  id: 'x', patientId: '', patientName: '', invoiceNumber: '2026-0420', status: 'PendingApproval',
  recipientType: 'Group', recipientName: 'ČEZ Sport', headcount: 8,
  totalCzk: 10560, paidCzk: 0, remainingCzk: 10560, currency: 'CZK', issueDateUtc: now, dueDateUtc: yearAhead,
  items: [{ id: 'l4', description: 'Komplexní prohlídka', serviceCode: 'KP', quantity: 8, unitPriceCzk: 2200, amountCzk: 17600 }],
  discounts: [
    { kind: 'tier', label: 'Hladina od 6', percent: 10, amountCzk: 1760 },
    { kind: 'club', label: 'Klub', percent: 5, amountCzk: 0 },
    { kind: 'manual', label: 'Ruční sleva', percent: 30, amountCzk: 5280 },
  ],
};
const team = {
  id: 't', patientId: '', patientName: '', invoiceNumber: '2026-0417', status: 'Issued',
  recipientType: 'Team', recipientName: 'FK Slaný', clubId: 'c1', clubName: 'FK Slaný', headcount: 12,
  totalCzk: 23760, paidCzk: 0, remainingCzk: 23760, currency: 'CZK', issueDateUtc: now, dueDateUtc: yearAhead,
  items: [{ id: 'l5', description: 'Komplexní prohlídka', serviceCode: 'KP', quantity: 12, unitPriceCzk: 2200, amountCzk: 26400 }],
  discounts: [{ kind: 'tier', label: 'Velká skupina', percent: 10, amountCzk: 2640 }],
};
const everything = [...invoices, pending, team];

const activity = (id: string, name: string, priceCzk: number) => ({
  id, name, durationMinutes: 30, color: '#0D5C52', publicNote: '', isPubliclyBookable: true,
  requiresReportByEmail: false, requiresClubSharing: false, questionnaireRequirement: 'NotAsked',
  sortOrder: 1, isActive: true, serviceItemId: `item-${id}`, priceCzk, clinicServiceId: null,
  questionnaireDefinitionId: null,
});

const asApprover = () => localStorage.setItem('permissions', JSON.stringify(['billing.manage', 'billing.approve']));

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  localStorage.clear();
  getInvoices.mockReset().mockResolvedValue(invoices);
  recordPayment.mockReset().mockResolvedValue(invoices[0]);
  approve.mockReset().mockResolvedValue({ ...pending, status: 'Issued' });
  reject.mockReset().mockResolvedValue({ ...pending, status: 'Rejected' });
  getInvoicePdf.mockReset().mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }));
  priceQuote.mockReset().mockResolvedValue({
    lines: [{ activityId: 'a1', name: 'Komplexní prohlídka', quantity: 1, unitPriceCzk: 2200, listTotalCzk: 2200 }],
    listTotalCzk: 2200, discounts: [], appliedGroupPercent: 0, totalCzk: 2200, manualAllowedPercent: 10, requiresApproval: false,
  });
  createInvoice.mockReset();
  getClubBlock.mockReset();
  getPatient.mockReset();
  getClub.mockReset();
  listActivities.mockReset().mockResolvedValue({ activities: [activity('act1', 'Komplexní prohlídka', 2200)], warnings: [] });
  toast.success.mockReset();
  toast.error.mockReset();
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:pdf'), revokeObjectURL: vi.fn() });
});

afterEach(() => vi.restoreAllMocks());

function renderPage(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/billing', state }]}><Billing /></MemoryRouter>,
  );
}

const rowOf = (number: string) => screen.getByText(number).closest('tr') as HTMLElement;

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

  it('says what failed when the invoices cannot be loaded, and tries again on request', async () => {
    getInvoices.mockRejectedValueOnce(new Error('offline'));
    renderPage();

    expect(await screen.findByText('Doklady se nepodařilo načíst.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByText('2026-0418')).toBeInTheDocument();
  });
});

describe('three layouts', () => {
  it('phone: one card per invoice, KPI cards, scrolling filter chips and no table', async () => {
    setViewport(VIEWPORTS.phone);
    getInvoices.mockResolvedValue(everything);
    renderPage();
    await screen.findByText('2026-0418');

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Doklady' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    for (const label of ['Nezaplaceno', 'Hotově na místě', 'Průměr na pacienta']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    const chips = screen.getByRole('group', { name: 'Filtr dokladů' });
    expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Vše', 'Nezaplacené', 'Po splatnosti', 'Kluby', 'Ke schválení1',
    ]);
    expect(screen.getByRole('button', { name: 'Přijmout platbu 2026-0418' })).toBeInTheDocument();

    /* A card opens into its detail. */
    fireEvent.click(screen.getByLabelText('Platby dokladu 2026-0420'));
    expect(await screen.findByText('Zatím žádné platby.')).toBeInTheDocument();
  });

  it('phone: the new-document flow is a full screen', async () => {
    setViewport(VIEWPORTS.phone);
    renderPage();
    await screen.findByText('2026-0418');
    fireEvent.click(screen.getByRole('button', { name: /Nový doklad/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveClass('MuiDialog-paperFullScreen');
  });

  it('iPad: a table with fewer columns - the date and the items move under the number and the name', async () => {
    setViewport(VIEWPORTS.tablet);
    getInvoices.mockResolvedValue(everything);
    renderPage();
    await screen.findByText('2026-0418');

    const headers = within(screen.getByRole('table')).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Číslo', 'Odběratel', 'Částka', 'Stav', 'Akce']);
    expect(within(rowOf('2026-0417')).getByText('12× Komplexní prohlídka · −10 %')).toBeInTheDocument();
  });

  it('desktop: the full table - ČÍSLO · ODBĚRATEL · POLOŽKY · DATUM · ČÁSTKA · STAV', async () => {
    getInvoices.mockResolvedValue(everything);
    renderPage();
    await screen.findByText('2026-0418');

    const headers = within(screen.getByRole('table')).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Číslo', 'Odběratel', 'Položky', 'Datum', 'Částka', 'Stav', 'Akce']);
    expect(screen.queryByRole('list', { name: 'Doklady' })).not.toBeInTheDocument();
  });
});

describe('who an invoice is for', () => {
  it('names a patient, a group and a club, each with its type chip, and links patient and club', async () => {
    getInvoices.mockResolvedValue(everything);
    renderPage();
    await screen.findByText('2026-0418');

    const person = rowOf('2026-0418');
    expect(within(person).getByText('Osoba')).toBeInTheDocument();
    expect(within(person).getByRole('link', { name: 'Bohumil Komárek' })).toHaveAttribute('href', '/patients/p1');

    const group = rowOf('2026-0420');
    expect(within(group).getByText('ČEZ Sport')).toBeInTheDocument();
    expect(within(group).getByText('Skupina')).toBeInTheDocument();
    expect(within(group).queryByRole('link')).not.toBeInTheDocument();

    const club = rowOf('2026-0417');
    expect(within(club).getByText('Tým')).toBeInTheDocument();
    expect(within(club).getByRole('link', { name: 'FK Slaný' })).toHaveAttribute('href', '/clubs');
  });

  it('finds a group by its name in the search box', async () => {
    getInvoices.mockResolvedValue(everything);
    renderPage();
    await screen.findByText('2026-0418');
    fireEvent.change(screen.getByPlaceholderText('Číslo dokladu, pacient nebo klub'), { target: { value: 'čez' } });
    expect(screen.getByText('2026-0420')).toBeInTheDocument();
    expect(screen.queryByText('2026-0418')).not.toBeInTheDocument();
  });

  it('the Kluby filter shows the team invoice only', async () => {
    getInvoices.mockResolvedValue(everything);
    renderPage();
    await screen.findByText('2026-0418');
    fireEvent.click(screen.getByRole('button', { name: 'Kluby' }));
    expect(screen.getByText('2026-0417')).toBeInTheDocument();
    expect(screen.queryByText('2026-0418')).not.toBeInTheDocument();
  });
});

describe('waiting for approval', () => {
  it('reads Čeká na schválení in beige; payment is disabled and says why', async () => {
    getInvoices.mockResolvedValue(everything);
    renderPage();
    await screen.findByText('2026-0418');

    const row = rowOf('2026-0420');
    expect(within(row).getByText('Čeká na schválení')).toBeInTheDocument();
    const pay = within(row).getByRole('button', { name: 'Přijmout platbu 2026-0420' });
    expect(pay).toBeDisabled();
    expect(pay.closest('span[title]')).toHaveAttribute('title', 'Doklad čeká na schválení — platbu zatím nelze přijmout.');
    /* The other rows can still be paid. */
    expect(within(rowOf('2026-0418')).getByRole('button', { name: 'Přijmout platbu 2026-0418' })).toBeEnabled();
  });

  it('the Ke schválení filter shows only those, with their count', async () => {
    getInvoices.mockResolvedValue(everything);
    renderPage();
    await screen.findByText('2026-0418');

    fireEvent.click(screen.getByRole('button', { name: 'Ke schválení1' }));
    expect(screen.getByText('2026-0420')).toBeInTheDocument();
    expect(screen.queryByText('2026-0418')).not.toBeInTheDocument();
  });

  it('without billing.approve there is no Schválit, no Zamítnout and no KE SCHVÁLENÍ number', async () => {
    getInvoices.mockResolvedValue(everything);
    renderPage();
    await screen.findByText('2026-0418');

    expect(screen.queryByRole('button', { name: /^Schválit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Zamítnout/ })).not.toBeInTheDocument();
    expect(screen.queryByText('nad limitem ruční slevy')).not.toBeInTheDocument();
  });

  it('with billing.approve: the KPI card counts them and Schválit approves', async () => {
    asApprover();
    getInvoices.mockResolvedValue(everything);
    renderPage();
    await screen.findByText('2026-0418');

    expect(screen.getByText('nad limitem ruční slevy')).toBeInTheDocument();
    /* Only the waiting row has the buttons. */
    expect(screen.getAllByRole('button', { name: /^Schválit/ })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Schválit 2026-0420' }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith('x'));
    await waitFor(() => expect(getInvoices).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenCalledWith('Doklad schválen');
  });

  it('Zamítnout needs a reason before it sends', async () => {
    asApprover();
    getInvoices.mockResolvedValue(everything);
    renderPage();
    await screen.findByText('2026-0418');

    fireEvent.click(screen.getByRole('button', { name: 'Zamítnout 2026-0420' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Zamítnout doklad' });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText(/Důvod zamítnutí/), { target: { value: '   ' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Důvod zamítnutí/), { target: { value: ' Sleva nad rámec dohody ' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(reject).toHaveBeenCalledWith('x', 'Sleva nad rámec dohody'));
    await waitFor(() => expect(getInvoices).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenCalledWith('Doklad zamítnut');
  });

  it('approve and reject work on a phone card too', async () => {
    setViewport(VIEWPORTS.phone);
    asApprover();
    getInvoices.mockResolvedValue(everything);
    renderPage();
    await screen.findByText('2026-0418');

    fireEvent.click(screen.getByRole('button', { name: 'Schválit 2026-0420' }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith('x'));
    expect(screen.getByRole('button', { name: 'Zamítnout 2026-0420' })).toBeInTheDocument();
  });

  it('shows the server\'s refusal when approval fails', async () => {
    asApprover();
    approve.mockRejectedValue(new Error('403'));
    getInvoices.mockResolvedValue(everything);
    renderPage();
    await screen.findByText('2026-0418');

    fireEvent.click(screen.getByRole('button', { name: 'Schválit 2026-0420' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Doklad se nepodařilo schválit'));
  });

  it('opens into the discount breakdown, the lower of tier and club struck through', async () => {
    getInvoices.mockResolvedValue(everything);
    renderPage();
    await screen.findByText('2026-0418');

    fireEvent.click(screen.getByLabelText('Platby dokladu 2026-0420'));
    const rows = await screen.findAllByRole('listitem');
    const byKind = Object.fromEntries(rows.map((r) => [r.getAttribute('data-kind'), r]));
    expect(byKind.tier).toHaveAttribute('data-unused', 'false');
    expect(byKind.club).toHaveAttribute('data-unused', 'true');
    expect(within(byKind.club).getByText(/nepoužito — vyšší sleva/)).toBeInTheDocument();
    expect(byKind.manual).toHaveAttribute('data-unused', 'false');
    expect(screen.getByText('Počet osob: 8')).toBeInTheDocument();
  });

  it('shows why a rejected invoice was rejected', async () => {
    getInvoices.mockResolvedValue([{ ...pending, status: 'Rejected', rejectedReason: 'Nad dohodnutou slevu' }]);
    renderPage();
    await screen.findByText('2026-0420');
    expect(within(rowOf('2026-0420')).getByText('Zamítnuto')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Platby dokladu 2026-0420'));
    expect(await screen.findByText('Zamítnuto — Nad dohodnutou slevu')).toBeInTheDocument();
  });
});

describe('PDF', () => {
  it('fetches the invoice PDF with the token and opens it in a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    renderPage();
    await screen.findByText('2026-0418');

    fireEvent.click(screen.getByRole('button', { name: 'PDF 2026-0418' }));
    await waitFor(() => expect(getInvoicePdf).toHaveBeenCalledWith('a'));
    await waitFor(() => expect(open).toHaveBeenCalledWith('blob:pdf', '_blank'));
  });

  it('is there on a phone card and for an invoice that waits for approval', async () => {
    setViewport(VIEWPORTS.phone);
    vi.spyOn(window, 'open').mockReturnValue({} as Window);
    getInvoices.mockResolvedValue(everything);
    renderPage();
    await screen.findByText('2026-0418');
    expect(screen.getAllByRole('button', { name: /^PDF / })).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'PDF 2026-0420' }));
    await waitFor(() => expect(getInvoicePdf).toHaveBeenCalledWith('x'));
  });

  it('says so when the PDF cannot be loaded', async () => {
    getInvoicePdf.mockRejectedValue(new Error('500'));
    renderPage();
    await screen.findByText('2026-0418');
    fireEvent.click(screen.getByRole('button', { name: 'PDF 2026-0418' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('PDF se nepodařilo načíst'));
  });
});

describe('the new document, entered from another screen', () => {
  it('opens a blank flow from the button, asking who the document is for', async () => {
    renderPage();
    await screen.findByText('2026-0418');
    fireEvent.click(screen.getByRole('button', { name: /Nový doklad/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByRole('radio').map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false']);
  });

  it('opens the flow for a visit with the patient and the činnost as the first line', async () => {
    getPatient.mockResolvedValue({ id: 'p9', firstName: 'Jan', lastName: 'Novák' });
    renderPage({ patientId: 'p9', appointmentId: 'ap1', activityId: 'act1' });

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(getPatient).toHaveBeenCalledWith('p9'));
    expect(await within(dialog).findByLabelText('Počet Komplexní prohlídka')).toHaveValue(1);
    expect(within(dialog).getByRole('radio', { name: /^Osoba/ })).toHaveAttribute('aria-checked', 'true');
    expect(await within(dialog).findByText(/^2\s200 Kč$/, { selector: 'p' })).toBeInTheDocument();
  });

  it('draws a club as the odběratel when sent from a club', async () => {
    getClub.mockResolvedValue({ id: 'c1', name: 'FK Slaný' });
    renderPage({ clubId: 'c1' });

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Klub: FK Slaný')).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: /^Tým/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('opens a team invoice with the headcount and the block\'s činnosti when sent from the club page', async () => {
    getClub.mockResolvedValue({ id: 'c1', name: 'FK Slaný' });
    getClubBlock.mockResolvedValue({ id: 'b1', clubId: 'c1', activityIds: ['act1'], playerCount: 30 });
    renderPage({ clubId: 'c1', clubBlockId: 'b1', headcount: 14 });

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByLabelText('Počet Komplexní prohlídka')).toHaveValue(14);
    expect(within(dialog).getByLabelText(/Počet osob/)).toHaveValue(14);
    expect(getClubBlock).toHaveBeenCalledWith('b1');
  });

  it('only scrolls to a document it is linked to, without opening the flow', async () => {
    getInvoices.mockResolvedValue(everything);
    renderPage({ invoiceId: 'x' });
    await screen.findByText('2026-0420');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Čeká na schválení — ruční sleva je nad limitem. Doklad čeká na schválení — platbu zatím nelze přijmout.')).toBeInTheDocument();
  });

  it('refreshes the list after a document is made', async () => {
    createInvoice.mockResolvedValue({ id: 'new', status: 'Issued' });
    getPatient.mockResolvedValue({ id: 'p9', firstName: 'Jan', lastName: 'Novák' });
    renderPage({ patientId: 'p9', activityId: 'act1' });

    const dialog = await screen.findByRole('dialog');
    const send = await within(dialog).findByRole('button', { name: 'Vystavit doklad' });
    await waitFor(() => expect(send).toBeEnabled(), { timeout: 3000 });
    fireEvent.click(send);

    await waitFor(() => expect(createInvoice).toHaveBeenCalledWith({
      recipientType: 'Person', patientId: 'p9', lines: [{ activityId: 'act1', quantity: 1 }],
    }));
    await waitFor(() => expect(getInvoices).toHaveBeenCalledTimes(2));
  });
});
