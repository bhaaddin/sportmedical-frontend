/*
 * The new-document flow: three recipient types (Osoba needs a patient, Skupina
 * and Tým do not), lines from the price list, the server's quote with its
 * breakdown, the manual-discount limit, and the three layouts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const priceQuote = vi.fn();
const createInvoice = vi.fn();
const getClubBlock = vi.fn();
vi.mock('../../api/billing', () => ({
  billingApi: { priceQuote, createInvoice, getClubBlock },
}));
const getPatient = vi.fn();
vi.mock('../../api/patients', () => ({ patientsApi: { getById: getPatient } }));
const getClub = vi.fn();
const getAllClubs = vi.fn();
vi.mock('../../api/clubs', () => ({ clubsApi: { getById: getClub, getAll: getAllClubs } }));
const listActivities = vi.fn();
vi.mock('../../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../../api/calendars', () => ({ calendarsApi: { list: vi.fn().mockResolvedValue([]) } }));
const listOrders = vi.fn();
vi.mock('../../api/partnerOrders', () => ({ partnerOrdersApi: { list: listOrders } }));
vi.mock('../patients/PatientPicker', () => ({
  default: ({ value, onChange }: { value: { firstName: string; lastName: string } | null; onChange: (p: unknown) => void }) => (
    <button type="button" onClick={() => onChange({ id: 'p9', firstName: 'Jan', lastName: 'Novák' })}>
      {value ? `${value.firstName} ${value.lastName}` : 'Vybrat pacienta'}
    </button>
  ),
}));
vi.mock('../NumberSeriesPreview', () => ({ NumberSeriesPreview: () => null }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const { default: NewInvoiceFlow } = await import('./NewInvoiceFlow');

const activity = (id: string, name: string, priceCzk: number | null, over: Record<string, unknown> = {}) => ({
  id, name, durationMinutes: 30, color: '#0D5C52', publicNote: '', isPubliclyBookable: true,
  requiresReportByEmail: false, requiresClubSharing: false, questionnaireRequirement: 'NotAsked',
  sortOrder: 1, isActive: true, serviceItemId: priceCzk === null ? null : `item-${id}`, priceCzk,
  clinicServiceId: null, questionnaireDefinitionId: null, ...over,
});

const ACTIVITIES = [
  activity('a1', 'Komplexní prohlídka', 2200, { sortOrder: 1 }),
  activity('a2', 'Základní prohlídka', 1600, { sortOrder: 2 }),
  activity('a3', 'Bez ceny', null, { sortOrder: 3 }),
  activity('a4', 'Vyřazená činnost', 900, { sortOrder: 4, isActive: false }),
];

const baseQuote = {
  lines: [{ activityId: 'a1', name: 'Komplexní prohlídka', quantity: 1, unitPriceCzk: 2200, listTotalCzk: 2200 }],
  listTotalCzk: 2200,
  discounts: [],
  appliedGroupPercent: 0,
  totalCzk: 2200,
  manualAllowedPercent: 10,
  requiresApproval: false,
};

const onClose = vi.fn();
const onCreated = vi.fn();

function renderFlow(nav: Record<string, unknown> | null = null) {
  return render(<NewInvoiceFlow open nav={nav} onClose={onClose} onCreated={onCreated} />);
}

const choose = (name: RegExp) => fireEvent.click(screen.getByRole('radio', { name }));
const pickActivity = async (name: string) => {
  const group = await screen.findByRole('group', { name: 'Činnosti z ceníku' });
  fireEvent.click(within(group).getByRole('button', { name: new RegExp(name) }));
};
const sendButton = () => screen.getByRole('button', { name: /^(Vystavit doklad|Odeslat ke schválení)$/ });

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  priceQuote.mockReset().mockResolvedValue(baseQuote);
  createInvoice.mockReset().mockResolvedValue({ id: 'new', status: 'Issued' });
  getClubBlock.mockReset();
  getPatient.mockReset();
  getClub.mockReset();
  getAllClubs.mockReset().mockResolvedValue([
    { id: 'c1', name: 'FK Slaný', discountPercent: 10 },
    { id: 'c2', name: 'SK Kladno', discountPercent: null },
  ]);
  listActivities.mockReset().mockResolvedValue({ activities: ACTIVITIES, warnings: [] });
  listOrders.mockReset().mockResolvedValue([]);
  onClose.mockReset();
  onCreated.mockReset();
});

describe('recipient type', () => {
  it('asks who the document is for first, with three big buttons, and nothing else yet', async () => {
    renderFlow();
    const group = screen.getByRole('radiogroup', { name: 'Komu doklad vystavujete' });
    expect(within(group).getAllByRole('radio').map((r) => r.textContent)).toEqual([
      'OsobaPacient z kartotéky', 'SkupinaFirma nebo volná skupina', 'Tým (klub)Klub z kartotéky klubů',
    ]);
    expect(screen.queryByRole('group', { name: 'Činnosti z ceníku' })).not.toBeInTheDocument();
    expect(screen.getByText('Vyberte, komu doklad vystavujete.')).toBeInTheDocument();
    expect(sendButton()).toBeDisabled();
  });

  it('shows a patient picker for Osoba, a form for Skupina and a club picker for Tým', async () => {
    renderFlow();

    choose(/^Osoba/);
    expect(screen.getByRole('button', { name: 'Vybrat pacienta' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Název skupiny/)).not.toBeInTheDocument();

    choose(/^Skupina/);
    expect(screen.queryByRole('button', { name: 'Vybrat pacienta' })).not.toBeInTheDocument();
    for (const label of [/Název skupiny nebo firmy/, /^IČO/, /^DIČ/, /^Adresa/, /Kontaktní osoba/, /^Telefon/, /^E-mail/, /Počet osob/]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }

    choose(/^Tým/);
    expect(screen.queryByLabelText(/Název skupiny/)).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Klub/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Počet osob/)).toBeInTheDocument();
  });

  it('offers only active činnosti that have a price in the ceník', async () => {
    renderFlow();
    choose(/^Osoba/);
    const group = await screen.findByRole('group', { name: 'Činnosti z ceníku' });
    await waitFor(() => expect(within(group).getAllByRole('button')).toHaveLength(2));
    expect(within(group).getByText(/2\s200 Kč/)).toBeInTheDocument();
    expect(screen.queryByText('Bez ceny')).not.toBeInTheDocument();
    expect(screen.queryByText('Vyřazená činnost')).not.toBeInTheDocument();
  });
});

describe('what each type needs', () => {
  it('Osoba needs a patient; Skupina and Tým do not', async () => {
    renderFlow();
    choose(/^Osoba/);
    await pickActivity('Komplexní');
    await screen.findByText('Celkem k úhradě');
    await waitFor(() => expect(priceQuote).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByLabelText('Počítám cenu')).not.toBeInTheDocument());

    expect(screen.getByText('Vyberte pacienta.')).toBeInTheDocument();
    expect(sendButton()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Vybrat pacienta' }));
    await waitFor(() => expect(sendButton()).toBeEnabled());

    /* Skupina: a name and a headcount, no patient. */
    choose(/^Skupina/);
    await waitFor(() => expect(screen.queryByLabelText('Počítám cenu')).not.toBeInTheDocument());
    expect(sendButton()).toBeDisabled();
    expect(screen.getByText('Zadejte název skupiny.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Název skupiny nebo firmy/), { target: { value: 'ČEZ Sport' } });
    expect(screen.getByText('Zadejte počet osob.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Počet osob/), { target: { value: '8' } });
    await waitFor(() => expect(sendButton()).toBeEnabled());
  });

  it('Tým needs a club and a headcount, and shows the club\'s own discount', async () => {
    const user = userEvent.setup();
    renderFlow();
    choose(/^Tým/);
    await pickActivity('Komplexní');

    await user.click(screen.getByRole('combobox', { name: /Klub/ }));
    await user.click(await screen.findByRole('option', { name: /FK Slaný/ }));
    expect(screen.getByText('Klub: FK Slaný')).toBeInTheDocument();
    expect(screen.getByText(/Vlastní sleva klubu 10\s%/)).toBeInTheDocument();

    expect(screen.getByText('Zadejte počet osob.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Počet osob/), { target: { value: '12' } });
    await waitFor(() => expect(sendButton()).toBeEnabled());
    expect(screen.queryByRole('button', { name: 'Vybrat pacienta' })).not.toBeInTheDocument();
  });

  it('rejects a bad IČO and a bad e-mail of a group', async () => {
    renderFlow();
    choose(/^Skupina/);
    fireEvent.change(screen.getByLabelText(/^IČO/), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: 'nope' } });
    expect(screen.getByText('IČO má 8 číslic.')).toBeInTheDocument();
    expect(screen.getByText(/Zadejte e-mail ve tvaru/)).toBeInTheDocument();
  });
});

describe('the quote', () => {
  it('asks the server, after a pause, with the recipient, headcount and lines', async () => {
    getClub.mockResolvedValue({ id: 'c1', name: 'FK Slaný', discountPercent: 10 });
    renderFlow({ clubId: 'c1' });
    choose(/^Tým/);
    await pickActivity('Komplexní');
    fireEvent.change(await screen.findByLabelText(/Počet osob/), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Počet Komplexní prohlídka'), { target: { value: '12' } });

    await waitFor(() => expect(priceQuote).toHaveBeenCalledWith(
      { recipientType: 'Team', clubId: 'c1', headcount: 12, lines: [{ activityId: 'a1', quantity: 12 }] },
      expect.anything(),
    ), { timeout: 3000 });
    /* Typing a quantity was one question, not one per keystroke. */
    expect(priceQuote.mock.calls.filter(([b]) => b.lines[0].quantity === 12)).toHaveLength(1);
  });

  it('draws the list total, each discount row and the total from the answer', async () => {
    priceQuote.mockResolvedValue({
      ...baseQuote,
      lines: [{ activityId: 'a1', name: 'Komplexní prohlídka', quantity: 12, unitPriceCzk: 2200, listTotalCzk: 26400 }],
      listTotalCzk: 26400,
      discounts: [
        { kind: 'tier', label: 'Velká skupina', percent: 10, amountCzk: 2640 },
        { kind: 'club', label: 'FK Slaný', percent: 5, amountCzk: 0 },
      ],
      appliedGroupPercent: 10,
      totalCzk: 23760,
    });
    renderFlow();
    choose(/^Skupina/);
    fireEvent.change(screen.getByLabelText(/Název skupiny nebo firmy/), { target: { value: 'ČEZ Sport' } });
    fireEvent.change(screen.getByLabelText(/Počet osob/), { target: { value: '12' } });
    await pickActivity('Komplexní');

    const panel = await screen.findByLabelText('Rozpis ceny');
    expect(await within(panel).findByText(/^23\s760 Kč$/, undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(within(panel).getByText('Cena podle ceníku')).toBeInTheDocument();
    expect(within(panel).getAllByText(/^26\s400 Kč$/)).toHaveLength(2);
    const rows = within(panel).getAllByRole('listitem');
    expect(rows.map((r) => r.getAttribute('data-kind'))).toEqual(['tier', 'club']);
    expect(rows[1]).toHaveAttribute('data-unused', 'true');
    expect(within(rows[1]).getByText('nepoužito — vyšší sleva', { exact: false })).toBeInTheDocument();
  });
});

describe('manual discount and approval', () => {
  const overLimit = { ...baseQuote, manualAllowedPercent: 10, requiresApproval: true };

  it('shows the limit and keeps "Vystavit doklad" while within it', async () => {
    renderFlow();
    choose(/^Osoba/);
    fireEvent.click(screen.getByRole('button', { name: 'Vybrat pacienta' }));
    await pickActivity('Komplexní');
    await waitFor(() => expect(sendButton()).toBeEnabled(), { timeout: 3000 });

    expect(screen.getByText(/Váš limit bez schválení: 10\s%/)).toBeInTheDocument();
    expect(sendButton()).toHaveTextContent('Vystavit doklad');
    expect(screen.queryByText('Nad limit — faktura půjde ke schválení')).not.toBeInTheDocument();
  });

  it('above the limit says so in beige and offers "Odeslat ke schválení"', async () => {
    priceQuote.mockImplementation(async (body: { manualDiscountPercent?: number }) =>
      (body.manualDiscountPercent ?? 0) > 10 ? overLimit : baseQuote);
    renderFlow();
    choose(/^Osoba/);
    fireEvent.click(screen.getByRole('button', { name: 'Vybrat pacienta' }));
    await pickActivity('Komplexní');
    await waitFor(() => expect(sendButton()).toBeEnabled(), { timeout: 3000 });

    fireEvent.change(screen.getByLabelText('Ruční sleva v procentech'), { target: { value: '25' } });
    expect(await screen.findByText('Nad limit — faktura půjde ke schválení', undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    await waitFor(() => expect(sendButton()).toHaveTextContent('Odeslat ke schválení'));

    /* An approver reads the reason, so it is required above the limit. */
    expect(sendButton()).toBeDisabled();
    expect(screen.getByText('Uveďte důvod ruční slevy.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Důvod slevy/), { target: { value: 'Stálý klient' } });
    await waitFor(() => expect(sendButton()).toBeEnabled());

    fireEvent.click(sendButton());
    await waitFor(() => expect(createInvoice).toHaveBeenCalledWith({
      recipientType: 'Person',
      patientId: 'p9',
      manualDiscountPercent: 25,
      manualDiscountReason: 'Stálý klient',
      lines: [{ activityId: 'a1', quantity: 1 }],
    }));
    expect(onCreated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('refuses a percent outside 0–100', async () => {
    renderFlow();
    choose(/^Osoba/);
    fireEvent.change(screen.getByLabelText('Ruční sleva v procentech'), { target: { value: '120' } });
    expect(screen.getByText('Zadejte procenta od 0 do 100.')).toBeInTheDocument();
  });

  it('shows the server\'s own words when the quote fails and lets the desk retry', async () => {
    priceQuote.mockRejectedValueOnce(Object.assign(new Error('x'), { isAxiosError: true }));
    renderFlow();
    choose(/^Osoba/);
    await pickActivity('Komplexní');
    expect(await screen.findByText('Cenu se nepodařilo spočítat.', undefined, { timeout: 3000 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByText('Celkem k úhradě', undefined, { timeout: 3000 })).toBeInTheDocument();
  });
});

describe('submitting', () => {
  it('sends a group invoice with the group, the headcount and the lines - and no patient', async () => {
    renderFlow();
    choose(/^Skupina/);
    fireEvent.change(screen.getByLabelText(/Název skupiny nebo firmy/), { target: { value: ' ČEZ Sport ' } });
    fireEvent.change(screen.getByLabelText(/^IČO/), { target: { value: '12345678' } });
    fireEvent.change(screen.getByLabelText(/Kontaktní osoba/), { target: { value: 'Eva' } });
    fireEvent.change(screen.getByLabelText(/Počet osob/), { target: { value: '8' } });
    await pickActivity('Základní');
    await waitFor(() => expect(sendButton()).toBeEnabled(), { timeout: 3000 });
    fireEvent.click(sendButton());

    await waitFor(() => expect(createInvoice).toHaveBeenCalledWith({
      recipientType: 'Group',
      group: { name: 'ČEZ Sport', ico: '12345678', contactPerson: 'Eva' },
      headcount: 8,
      lines: [{ activityId: 'a2', quantity: 1 }],
    }));
  });

  it('sends a team invoice with the club id and the headcount', async () => {
    getClub.mockResolvedValue({ id: 'c1', name: 'FK Slaný', discountPercent: 10 });
    renderFlow({ clubId: 'c1' });
    await screen.findByText('Klub: FK Slaný');
    fireEvent.change(screen.getByLabelText(/Počet osob/), { target: { value: '12' } });
    await pickActivity('Komplexní');
    await waitFor(() => expect(sendButton()).toBeEnabled(), { timeout: 3000 });
    fireEvent.click(sendButton());

    await waitFor(() => expect(createInvoice).toHaveBeenCalledWith({
      recipientType: 'Team', clubId: 'c1', headcount: 12, lines: [{ activityId: 'a1', quantity: 1 }],
    }));
  });
});

describe('entered from another screen', () => {
  it('from a visit: a person, the patient, the visit and the činnost as the first line', async () => {
    getPatient.mockResolvedValue({ id: 'p9', firstName: 'Jan', lastName: 'Novák' });
    renderFlow({ patientId: 'p9', appointmentId: 'ap1', activityId: 'a1' });

    expect(await screen.findByRole('button', { name: 'Jan Novák' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Počet Komplexní prohlídka')).toHaveValue(1);
    expect(screen.getByRole('radio', { name: /^Osoba/ })).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(sendButton()).toBeEnabled(), { timeout: 3000 });
    fireEvent.click(sendButton());
    await waitFor(() => expect(createInvoice).toHaveBeenCalledWith({
      recipientType: 'Person', patientId: 'p9', appointmentId: 'ap1', lines: [{ activityId: 'a1', quantity: 1 }],
    }));
  });

  it('from a club\'s order: a team, the club, and the order\'s činnosti as lines', async () => {
    getClub.mockResolvedValue({ id: 'c1', name: 'FK Slaný', discountPercent: 10 });
    const calendars = await import('../../api/calendars');
    (calendars.calendarsApi.list as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ id: 'cal1' }]);
    listOrders.mockResolvedValue([{ id: 'o1', items: [{ activityId: 'a1', requestedCount: 12 }] }]);
    renderFlow({ clubId: 'c1', partnerOrderId: 'o1' });

    expect(await screen.findByText('Klub: FK Slaný')).toBeInTheDocument();
    expect(await screen.findByLabelText('Počet Komplexní prohlídka')).toHaveValue(12);
    expect(screen.getByLabelText(/Počet osob/)).toHaveValue(12);
    expect(screen.getByRole('radio', { name: /^Tým/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('from the club page: a team, the headcount filled in and the block\'s činnosti as the lines', async () => {
    getClub.mockResolvedValue({ id: 'c1', name: 'FK Slaný', discountPercent: 10 });
    getClubBlock.mockResolvedValue({ id: 'b1', clubId: 'c1', activityIds: ['a1', 'a2'], playerCount: 30 });
    renderFlow({ clubId: 'c1', clubBlockId: 'b1', headcount: 14 });

    expect(await screen.findByLabelText('Počet Komplexní prohlídka')).toHaveValue(14);
    expect(screen.getByLabelText('Počet Základní prohlídka')).toHaveValue(14);
    expect(screen.getByLabelText(/Počet osob/)).toHaveValue(14);
    expect(getClubBlock).toHaveBeenCalledWith('b1');
    expect(screen.getByRole('radio', { name: /^Tým/ })).toHaveAttribute('aria-checked', 'true');

    await waitFor(() => expect(priceQuote).toHaveBeenCalledWith(
      {
        recipientType: 'Team', clubId: 'c1', headcount: 14,
        lines: [{ activityId: 'a1', quantity: 14 }, { activityId: 'a2', quantity: 14 }],
      },
      expect.anything(),
    ), { timeout: 3000 });
  });

  it('takes the block\'s player count when the club page sent none, and the club from the block', async () => {
    getClubBlock.mockResolvedValue({ id: 'b1', clubId: 'c9', clubName: 'SK Kladno', activityIds: ['a1'], playerCount: 30 });
    renderFlow({ clubBlockId: 'b1' });

    expect(await screen.findByText('Klub: SK Kladno')).toBeInTheDocument();
    expect(await screen.findByLabelText('Počet Komplexní prohlídka')).toHaveValue(30);
    expect(screen.getByLabelText(/Počet osob/)).toHaveValue(30);
  });
});

describe('three layouts', () => {
  const dialog = () => screen.getByRole('dialog');

  it('phone: a full-screen flow with the main action pinned at the bottom', async () => {
    setViewport(VIEWPORTS.phone);
    renderFlow();
    expect(dialog()).toHaveClass('MuiDialog-paperFullScreen');
    choose(/^Osoba/);
    const actions = dialog().querySelector('.MuiDialogActions-root') as HTMLElement;
    expect(within(actions).getByRole('button', { name: 'Vystavit doklad' })).toBeInTheDocument();
    expect(within(actions).getByRole('button', { name: 'Zrušit' })).toBeInTheDocument();
    /* The three recipient buttons stack: one per row. */
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('iPad: one column in a dialog, not full screen', () => {
    setViewport(VIEWPORTS.tablet);
    renderFlow();
    expect(dialog()).not.toHaveClass('MuiDialog-paperFullScreen');
    expect(dialog()).toHaveClass('MuiDialog-paperWidthMd');
  });

  it('desktop: a wide dialog with the breakdown beside the form', () => {
    setViewport(VIEWPORTS.desktop);
    renderFlow();
    choose(/^Osoba/);
    expect(dialog()).toHaveClass('MuiDialog-paperWidthLg');
    expect(screen.getByLabelText('Rozpis ceny')).toBeInTheDocument();
  });
});
