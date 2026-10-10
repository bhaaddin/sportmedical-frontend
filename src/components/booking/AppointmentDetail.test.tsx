/*
 * The appointment detail and its edit mode (board screens 12 and 13), clicked
 * through. The arithmetic is in `appointmentEdit.test.ts`; what only the
 * screen can show is that the header reads the board's way, that an
 * unfinished registration gets its beige card, that "Upravit" opens the edit
 * form with "Uložit změny" disabled until something changed, and that saving
 * a status change goes to the status endpoint and nowhere else.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { setViewport, VIEWPORTS, type ViewportName } from '../../test/viewport';

const get = vi.fn();
const history = vi.fn();
const setStatus = vi.fn();
const reschedule = vi.fn();
const getAvailability = vi.fn();
const range = vi.fn();
const checkRequired = vi.fn();
const issueLink = vi.fn();
const setPrice = vi.fn();

vi.mock('../../api/appointments', () => ({
  appointmentsApi: { get, history, setStatus, reschedule, getAvailability, range, setPrice, cancel: vi.fn() },
}));

vi.mock('../../api/documents', () => ({
  documentsApi: { checkRequired },
}));

vi.mock('../../api/patients', () => ({
  patientsApi: {
    getById: vi.fn().mockResolvedValue({
      id: 'p1', firstName: 'Bohumil', lastName: 'Komárek', fullName: 'Bohumil Komárek',
      dateOfBirth: '1990-01-01', sex: 'M', createdAtUtc: '', updatedAtUtc: '',
    }),
    getProfile: vi.fn().mockResolvedValue({ phone: '+420 773 539 001', email: 'bh@m.com' }),
  },
}));

vi.mock('../../api/activities', () => ({
  activitiesApi: {
    list: vi.fn().mockResolvedValue({
      activities: [
        {
          id: 'a-basic', name: 'Základní prohlídka', slug: 'zakladni', durationMinutes: 30, color: '#0D7377',
          publicNote: '', isPubliclyBookable: true, requiresReportByEmail: false, requiresClubSharing: false,
          questionnaireRequirement: 'NotAsked', sortOrder: 0, isActive: true, serviceItemId: null,
          priceCzk: 1600, clinicServiceId: 's-exam', questionnaireDefinitionId: null,
        },
      ],
      warnings: [],
    }),
  },
}));

vi.mock('../../api/clinicServices', () => ({
  clinicServicesApi: {
    list: vi.fn().mockResolvedValue([
      { id: 's-exam', name: 'Sportovní lékařské prohlídky', description: '', sortOrder: 1, isActive: true, activities: 1, calendars: 1, colorHex: '#0D5C52' },
    ]),
  },
}));

vi.mock('../../api/patientPreRegistration', () => ({
  patientPreRegistrationApi: { issueLink },
}));

vi.mock('../../api/patientPortal', () => ({
  issuePortalLink: vi.fn().mockResolvedValue('tok'),
}));

vi.mock('../../auth/usePermission', () => ({
  usePermission: () => true,
}));

const { AppointmentDetail } = await import('./AppointmentDetail');

/* 26. 10. 2026 is a Monday on CET: 09:30 Prague = 08:30Z. */
const appointment = {
  id: 't1',
  calendarId: 'c1',
  patientId: 'p1',
  activityId: 'a-basic',
  activityName: 'Základní prohlídka',
  startUtc: '2026-10-26T08:30:00Z',
  endUtc: '2026-10-26T09:00:00Z',
  status: 0,
  source: 1,
  workerUserId: null,
  heldUntilUtc: null,
  overrideReason: null,
  note: null,
  checkedInUtc: null,
  paperwork: { ready: false, missing: ['questionnaire_missing'] },
  unregisteredName: null,
  unregisteredPhone: null,
};

/* The grid's row for the same appointment: it carries what the detail view does not (G3). */
const dayRow = {
  id: 't1', calendarId: 'c1', patientId: 'p1', activityId: 'a-basic', activityName: 'Základní prohlídka',
  startUtc: '2026-10-26T08:30:00Z', endUtc: '2026-10-26T09:00:00Z', status: 0, isRunningLate: false,
  checkedInUtc: null, paperwork: { ready: false, missing: ['questionnaire_missing'] },
  patientName: 'Bohumil Komárek', partnerName: null, clubDiscountPercent: null,
  paymentState: 'unpaid' as const, invoiceId: 'inv-1',
};

/* `/check` answers for the whole patient; only the rows of THIS appointment belong here. */
const documentCheck = {
  allRequiredPresent: false,
  requirements: [
    {
      templateId: 'tpl-vypis', templateName: 'Výpis ze zdravotní dokumentace', serviceName: 'Sportovní lékařská prohlídka',
      appointmentId: 't1', startUtc: '2026-10-26T08:30:00Z', standing: 'Missing', validUntil: null, daysLeft: null, blocksBooking: false,
    },
    {
      templateId: 'tpl-other', templateName: 'Jiný dokument', serviceName: 'Jiná služba',
      appointmentId: 't2', startUtc: '2026-11-02T08:30:00Z', standing: 'Missing', validUntil: null, daysLeft: null, blocksBooking: false,
    },
  ],
};

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  issueLink.mockReset().mockResolvedValue({
    url: 'https://sportmedical.test/dokonceni/tok',
    path: '/dokonceni/tok',
    token: 'tok',
    referenceNumber: 'R1',
    expiresAtUtc: '2026-10-27T08:30:00Z',
  });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
  get.mockReset().mockResolvedValue(appointment);
  range.mockReset().mockResolvedValue([dayRow]);
  checkRequired.mockReset().mockResolvedValue(documentCheck);
  history.mockReset().mockResolvedValue([
    { action: 0, actorId: 'u1', actorDisplayName: 'Recepce', atUtc: '2026-10-24T20:26:00Z', reason: null, oldValue: null, newValue: null },
  ]);
  setStatus.mockReset().mockResolvedValue(undefined);
  reschedule.mockReset().mockResolvedValue(undefined);
  setPrice.mockReset().mockResolvedValue(undefined);
  getAvailability.mockReset().mockResolvedValue([]);
});

const renderDetail = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const ui: ReactNode = (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AppointmentDetail
          appointmentId="t1"
          calendarId="c1"
          calendar={{ id: 'c1', name: 'Prohlídky', color: '#0D7377' }}
          open
          onClose={() => undefined}
          onChanged={() => undefined}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(ui);
};

describe('the appointment detail', () => {
  it('reads the board’s way: time, long date, činnost, chips, price and source', async () => {
    renderDetail();

    expect(await screen.findByText('09:30 — 10:00')).toBeInTheDocument();
    expect(screen.getByText('Pondělí 26. října 2026 · 30 minut')).toBeInTheDocument();
    expect(screen.getByText('Objednán')).toBeInTheDocument();
    expect(screen.getByText('Registrace není dokončena')).toBeInTheDocument();
    expect(screen.getByText('Pacient zatím nevyplnil vstupní dotazník.')).toBeInTheDocument();
    expect(screen.getByText('Web')).toBeInTheDocument();
    expect(await screen.findByText('Bohumil Komárek')).toBeInTheDocument();
    expect((await screen.findByText(/1.600 Kč/)).textContent?.replace(/ /g, ' ')).toBe('1 600 Kč');
    expect(await screen.findByText(/Objednáno — 24\. 10\. 2026/)).toBeInTheDocument();
  });

  it('lists every podklad of this visit at the top, each with its state and its one action', async () => {
    renderDetail();
    const section = await screen.findByTestId('paperwork-section');
    expect(within(section).getByRole('heading', { name: 'Podklady k této prohlídce' })).toBeInTheDocument();

    /* The section is up before the document check answers; wait for its row. */
    await within(section).findByText('Výpis ze zdravotní dokumentace');
    const rows = within(section).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Dokončená registrace'),
      expect.stringContaining('Vstupní dotazník'),
      expect.stringContaining('Výpis ze zdravotní dokumentace'),
    ]);
    expect(within(rows[0]).getByText('✓ V pořádku')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Chybí')).toBeInTheDocument();
    expect(within(rows[1]).getByRole('button', { name: 'Zkopírovat odkaz' })).toBeInTheDocument();
    expect(within(rows[2]).getByText('Chybí')).toBeInTheDocument();
    expect(within(rows[2]).getByText('vyžaduje služba Sportovní lékařská prohlídka · nic není doloženo')).toBeInTheDocument();
    expect(within(rows[2]).getByRole('link', { name: 'Dokumenty pacienta' })).toHaveAttribute('href', '/patients/p1/dokumenty');
    /* Another appointment's document is not this visit's business. */
    expect(within(section).queryByText('Jiný dokument')).not.toBeInTheDocument();

    expect(within(section).getByText('2 chybí')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Pravidla dokumentů' })).toHaveAttribute('href', '/pravidla-dokumentu');
    expect(checkRequired).toHaveBeenCalledWith('p1');

    /* The beige card below is untouched. */
    expect(screen.getByText('Registrace není dokončena')).toBeInTheDocument();
  });

  it('says the documents could not be checked rather than that none are needed', async () => {
    checkRequired.mockRejectedValue(new Error('500'));
    renderDetail();
    const section = await screen.findByTestId('paperwork-section');
    const row = await within(section).findByText('Lékařské dokumenty');
    expect(row.closest('li')).toHaveTextContent('Nelze ověřit');
    expect(row.closest('li')).toHaveTextContent('seznam požadovaných dokumentů se nepodařilo načíst');
    expect(within(section).getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
    expect(within(section).queryByText('Nevyžaduje se')).not.toBeInTheDocument();
  });

  it('says a document is not wanted when the činnost asks for none, and that the legal consents always are', async () => {
    checkRequired.mockResolvedValue({ allRequiredPresent: true, requirements: [] });
    renderDetail();
    const section = await screen.findByTestId('paperwork-section');
    const row = await within(section).findByText('Lékařské dokumenty');
    expect(row.closest('li')).toHaveTextContent('Nevyžaduje se');
    expect(within(section).getByText('Tato činnost nevyžaduje žádné dokumenty.')).toBeInTheDocument();
    expect(within(section).getByTestId('legal-consents')).toHaveTextContent(
      'Zákonné souhlasy (zpracování osobních údajů, souhlas s výkonem) jsou povinné vždy',
    );
  });

  it('lists the documents the činnost asks for, and still the legal consents under them', async () => {
    renderDetail();
    const section = await screen.findByTestId('paperwork-section');
    await within(section).findByText('Výpis ze zdravotní dokumentace');
    expect(within(section).queryByText('Tato činnost nevyžaduje žádné dokumenty.')).not.toBeInTheDocument();
    expect(within(section).getByTestId('legal-consents')).toBeInTheDocument();
  });

  it('reads PLATBA off the day row and offers to open the invoice there is', async () => {
    renderDetail();
    expect(await screen.findByText('Nezaplaceno')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Otevřít doklad' })).toBeInTheDocument();
    expect(range).toHaveBeenCalledWith('2026-10-26', '2026-10-26', ['c1']);
  });

  it('offers to issue an invoice when the visit has none', async () => {
    range.mockResolvedValue([{ ...dayRow, paymentState: 'none', invoiceId: null }]);
    renderDetail();
    expect(await screen.findByText('Bez dokladu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vystavit doklad' })).toBeInTheDocument();
  });


  it('the edit form states the služba and činnost as plain information, not a grid of every činnost', async () => {
    renderDetail();
    await screen.findByText('Základní prohlídka');
    await userEvent.click(screen.getByRole('button', { name: 'Upravit' }));
    await screen.findByText('Úprava rezervace');
    const line = screen.getByTestId('appointment-service-line');
    expect(line).toHaveTextContent('Služba a činnost');
    expect(await within(line).findByText('Sportovní lékařské prohlídky')).toBeInTheDocument();
    expect(line).toHaveTextContent('Základní prohlídka · 30 min');
    /* No toggle grid any more: the činnost is information here, not a choice. */
    expect(screen.queryByRole('group', { name: 'Služba' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Změna služby/)).not.toBeInTheDocument();
  });
  it('opens the edit form from "Upravit" and only enables saving once something changed', async () => {
    renderDetail();
    await screen.findByText('09:30 — 10:00');

    await userEvent.click(screen.getByRole('button', { name: 'Upravit' }));

    expect(await screen.findByText('Úprava rezervace')).toBeInTheDocument();
    expect(screen.getByText('Bohumil Komárek · Po 26. 10. 2026, 09:30')).toBeInTheDocument();
    expect(screen.getByText(/Termín zůstává 09:30 — 10:00/)).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Uložit změny' });
    expect(save).toBeDisabled();

    /* A status change on its own: the status endpoint, and not /time. */
    await userEvent.click(screen.getByRole('combobox', { name: 'Stav' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Potvrzen' }));
    expect(save).toBeEnabled();

    await userEvent.click(save);
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith('c1', 't1', '1'));
    expect(reschedule).not.toHaveBeenCalled();
  });

  it('asks the server whether a new time is free and says so in the slot line (6.1)', async () => {
    getAvailability.mockResolvedValue([
      { startUtc: '2026-10-26T09:00:00Z', endUtc: '2026-10-26T09:30:00Z' },
    ]);
    renderDetail();
    await screen.findByText('09:30 — 10:00');
    await userEvent.click(screen.getByRole('button', { name: 'Upravit' }));
    await screen.findByText('Úprava rezervace');

    const start = screen.getByLabelText('Začátek') as HTMLInputElement;
    await userEvent.clear(start);
    await userEvent.type(start, '10:00');

    const line = await screen.findByRole('status');
    await waitFor(() =>
      expect(within(line).getByText('Nový termín 10:00 — 10:30 je volný. Nekoliduje s žádnou rezervací.')).toBeInTheDocument(),
    );
    expect(getAvailability).toHaveBeenCalledWith('c1', 'a-basic', '2026-10-26', '2026-10-26');

    await userEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(reschedule).toHaveBeenCalledWith('c1', 't1', '2026-10-26T09:00:00.000Z'));
    expect(setStatus).not.toHaveBeenCalled();
  });
});

/* ── Etapa 12: the agreed price, read and corrected ── */

const plain = (s: string | null | undefined) => (s ?? '').replace(/ /g, ' ');

describe.each([['desktop', VIEWPORTS.desktop], ['tablet', VIEWPORTS.tablet], ['phone', VIEWPORTS.phone]] as const)(
  'the price of the visit · %s',
  (_name, width) => {
    beforeEach(() => setViewport(width, width === VIEWPORTS.phone ? 844 : width === VIEWPORTS.tablet ? 1112 : 900));

    it('reads the list price when nothing was agreed, and names the adjustment when something was', async () => {
      get.mockResolvedValue({ ...appointment, agreedPriceCzk: 1200, listPriceCzk: 1600 });
      renderDetail();
      const fact = await screen.findByText(/upraveno/);
      expect(plain(fact.textContent)).toBe('1 200 Kč (upraveno, ceník 1 600 Kč)');
    });

    it('the edit form says "Cena: … (ceník)" next to the služba line and sends a typed amount to /price alone', async () => {
      renderDetail();
      await screen.findByText('Základní prohlídka');
      await userEvent.click(screen.getByRole('button', { name: 'Upravit' }));
      await screen.findByText('Úprava rezervace');

      const line = screen.getByTestId('appointment-service-line');
      expect(plain(within(line).getByTestId('appointment-price-line').textContent)).toBe('Cena: 1 600 Kč (ceník)');

      const field = within(line).getByLabelText('Cena') as HTMLInputElement;
      expect(field.value).toBe('1600');
      expect(within(line).getByTestId('agreed-price-caption')).toHaveTextContent('podle ceníku');
      /* The field is a touch target. */
      expect(field.closest('.MuiInputBase-root')).toHaveStyle({ minHeight: '44px' });

      const save = screen.getByRole('button', { name: 'Uložit změny' });
      expect(save).toBeDisabled();
      await userEvent.clear(field);
      await userEvent.type(field, '1200');
      expect(plain(within(line).getByTestId('agreed-price-caption').textContent)).toBe('upraveno (ceník 1 600 Kč)');
      expect(within(line).getByRole('button', { name: 'Vrátit ceník' })).toBeInTheDocument();
      expect(save).toBeEnabled();

      await userEvent.click(save);
      await waitFor(() => expect(setPrice).toHaveBeenCalledWith('c1', 't1', 1200));
      expect(reschedule).not.toHaveBeenCalled();
      expect(setStatus).not.toHaveBeenCalled();
    });

    it('an adjusted price opens prefilled with the agreed amount, and "Vrátit ceník" sends null', async () => {
      get.mockResolvedValue({ ...appointment, agreedPriceCzk: 1200, listPriceCzk: 1600 });
      renderDetail();
      await screen.findByText('Základní prohlídka');
      await userEvent.click(screen.getByRole('button', { name: 'Upravit' }));
      await screen.findByText('Úprava rezervace');

      const line = screen.getByTestId('appointment-service-line');
      expect(plain(within(line).getByTestId('appointment-price-line').textContent)).toBe('Cena: 1 200 Kč (upraveno, ceník 1 600 Kč)');
      expect((within(line).getByLabelText('Cena') as HTMLInputElement).value).toBe('1200');
      expect(screen.getByRole('button', { name: 'Uložit změny' })).toBeDisabled();

      await userEvent.click(within(line).getByRole('button', { name: 'Vrátit ceník' }));
      expect((within(line).getByLabelText('Cena') as HTMLInputElement).value).toBe('1600');
      expect(within(line).getByTestId('agreed-price-caption')).toHaveTextContent('podle ceníku');
      await userEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));
      await waitFor(() => expect(setPrice).toHaveBeenCalledWith('c1', 't1', null));
    });

    it('a typed amount that is not money keeps saving off', async () => {
      renderDetail();
      await screen.findByText('Základní prohlídka');
      await userEvent.click(screen.getByRole('button', { name: 'Upravit' }));
      await screen.findByText('Úprava rezervace');
      const field = screen.getByLabelText('Cena');
      await userEvent.clear(field);
      await userEvent.type(field, '10%');
      expect(screen.getByTestId('agreed-price-caption')).toHaveTextContent(/Zadejte částku/);
      expect(screen.getByRole('button', { name: 'Uložit změny' })).toBeDisabled();
      expect(setPrice).not.toHaveBeenCalled();
    });
  },
);


/* ── Etapa 2: a desk quick registration whose deadline is still running ── */

const HOUR = 3_600_000;
const inHours = (h: number) => new Date(Date.now() + h * HOUR).toISOString();
const RED_BG = 'rgb(245, 224, 216)';
const BEIGE_BG = 'rgb(251, 241, 231)';

describe('a quick registration waiting for the patient', () => {
  const pending = (hours: number) => ({
    ...appointment,
    paperwork: { ready: false, missing: ['registration_incomplete'] },
    quickRegistrationPending: true,
    registrationDeadlineUtc: inHours(hours),
  });

  it('shows the time left as a beige chip, with the deadline in words', async () => {
    get.mockResolvedValue(pending(20.5));
    renderDetail();
    const card = await screen.findByTestId('quick-pending-card');
    expect(within(card).getByText('Čeká na dokončení registrace · zbývá 21 h')).toHaveStyle({ backgroundColor: BEIGE_BG });
    expect(within(card).getByText(/^Pacient má čas na dokončení registrace do \d+\. \d+\. \d{4} \d{2}:\d{2}$/)).toBeInTheDocument();
    /* One card, not the generic beige warning on top of it. */
    expect(screen.getAllByText('Registrace není dokončena')).toHaveLength(1);
  });

  it('turns the chip red under three hours', async () => {
    get.mockResolvedValue(pending(2.5));
    renderDetail();
    const card = await screen.findByTestId('quick-pending-card');
    expect(within(card).getByText('Čeká na dokončení registrace · zbývá 3 h')).toHaveStyle({ backgroundColor: RED_BG });
  });

  it('re-issues the link through the registration-link endpoint and copies it', async () => {
    get.mockResolvedValue(pending(10));
    renderDetail();
    const card = await screen.findByTestId('quick-pending-card');
    await userEvent.click(within(card).getByRole('button', { name: 'Zkopírovat odkaz' }));

    await waitFor(() => expect(issueLink).toHaveBeenCalledWith('p1'));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://sportmedical.test/dokonceni/tok'),
    );
    expect(await within(card).findByText(/Platí do 27\. 10\. 2026 09:30\./)).toBeInTheDocument();
  });

  it('takes the deadline from the grid row when the single-appointment view has none', async () => {
    get.mockResolvedValue({ ...appointment, paperwork: { ready: false, missing: ['registration_incomplete'] } });
    range.mockResolvedValue([{ ...dayRow, quickRegistrationPending: true, registrationDeadlineUtc: inHours(20.5) }]);
    renderDetail();
    const card = await screen.findByTestId('quick-pending-card');
    expect(await within(card).findByText('Čeká na dokončení registrace · zbývá 21 h')).toBeInTheDocument();
  });

  it('is absent for an ordinary appointment, which keeps the generic beige warning', async () => {
    renderDetail();
    expect(await screen.findByText('Registrace není dokončena')).toBeInTheDocument();
    expect(screen.queryByTestId('quick-pending-card')).not.toBeInTheDocument();
  });

  it.each(['phone', 'tablet', 'desktop'] as ViewportName[])('renders at %s width', async (name) => {
    setViewport(VIEWPORTS[name]);
    get.mockResolvedValue(pending(20.5));
    renderDetail();
    const card = await screen.findByTestId('quick-pending-card');
    expect(within(card).getByRole('button', { name: 'Zkopírovat odkaz' })).toBeInTheDocument();
  });
});

/* ── Etapa 2: the three layouts ── */

describe('the detail on each device', () => {
  it('desktop (1440): a dialog 880 px wide, the actions in a rail on the right', async () => {
    renderDetail();
    await screen.findByText('09:30 — 10:00');
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('data-layout', 'dialog-880');
    expect(dialog).toHaveStyle({ maxWidth: '880px' });
    expect(screen.queryByTestId('docked-actions')).not.toBeInTheDocument();
    expect(screen.getByText('Příchod')).toBeInTheDocument();
    expect(screen.getByText('Termín')).toBeInTheDocument();
    for (const name of ['Přišel', 'Nepřišel', 'Upravit', 'Přesunout', 'Zrušit termín']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    /* The history and the way out are in the footer, as drawn. */
    expect(screen.getByText('Historie')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Zavřít' })).toHaveLength(2);
  });

  it('tablet (834): a centred dialog, not full screen, the rail still beside the content', async () => {
    setViewport(VIEWPORTS.tablet);
    renderDetail();
    await screen.findByText('09:30 — 10:00');
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('data-layout', 'dialog-centered');
    expect(dialog).not.toHaveStyle({ width: '100%', height: '100%' });
    expect(screen.queryByTestId('docked-actions')).not.toBeInTheDocument();
    expect(screen.getByText('Příchod')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upravit' })).toBeInTheDocument();
  });

  it('phone (390): the whole screen with the five actions docked at the bottom, each 48 px tall', async () => {
    setViewport(VIEWPORTS.phone, 844);
    renderDetail();
    await screen.findByText('09:30 — 10:00');
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('data-layout', 'full-screen');
    expect(dialog).toHaveStyle({ width: '100%', height: '100%' });

    const dock = screen.getByTestId('docked-actions');
    for (const name of ['Přišel', 'Nepřišel', 'Upravit', 'Přesunout', 'Zrušit termín']) {
      const button = within(dock).getByRole('button', { name });
      expect(button).toHaveStyle({ minHeight: '48px' });
    }
    /* No rail on a phone: its labels are not there, the buttons are in the dock. */
    expect(screen.queryByText('Příchod')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Přišel' })).toHaveLength(1);
    /* The history scrolls with the content instead of sitting in a footer. */
    expect(await screen.findByText(/Objednáno — 24\. 10\. 2026/)).toBeInTheDocument();
    /* One close button, in the corner, 44 px. */
    const close = within(dialog).getByRole('button', { name: 'Zavřít' });
    expect(close).toHaveStyle({ width: '44px', height: '44px' });
  });

  it('phone: arriving goes through the status endpoint from the dock', async () => {
    setViewport(VIEWPORTS.phone, 844);
    renderDetail();
    await screen.findByText('09:30 — 10:00');
    await userEvent.click(within(screen.getByTestId('docked-actions')).getByRole('button', { name: 'Přišel' }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith('c1', 't1', '2', undefined));
  });

  it('phone: cancelling asks for its reason inside the dock, so it is not hidden up in the scroll', async () => {
    setViewport(VIEWPORTS.phone, 844);
    renderDetail();
    await screen.findByText('09:30 — 10:00');
    const dock = screen.getByTestId('docked-actions');
    await userEvent.click(within(dock).getByRole('button', { name: 'Zrušit termín' }));
    expect(within(dock).getByLabelText('Důvod')).toBeInTheDocument();
    expect(within(dock).getByText(/Zrušení se nedá vzít zpět/)).toBeInTheDocument();
  });

  it('phone: a patient\'s contact buttons are 44 px', async () => {
    setViewport(VIEWPORTS.phone, 844);
    renderDetail();
    await screen.findByText('Bohumil Komárek');
    for (const name of ['Zavolat', 'Napsat e-mail', 'Otevřít kartu pacienta']) {
      expect(screen.getByRole('link', { name })).toHaveStyle({ width: '44px', height: '44px' });
    }
  });

  it('phone: the edit form is full screen, one field per row, saving docked at the bottom', async () => {
    setViewport(VIEWPORTS.phone, 844);
    renderDetail();
    await screen.findByText('09:30 — 10:00');
    await userEvent.click(within(screen.getByTestId('docked-actions')).getByRole('button', { name: 'Upravit' }));

    expect(await screen.findByText('Úprava rezervace')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('data-layout', 'full-screen');
    const fields = screen.getByLabelText('Datum').closest('div[class*="MuiBox"]')?.parentElement as HTMLElement;
    expect(fields).toHaveStyle({ gridTemplateColumns: '1fr' });

    const dock = screen.getByTestId('docked-actions');
    const save = within(dock).getByRole('button', { name: 'Uložit změny' });
    expect(save).toBeDisabled();
    expect(save).toHaveStyle({ minHeight: '48px' });
    expect(within(dock).getByRole('button', { name: 'Zahodit změny' })).toBeInTheDocument();
    expect(within(dock).getByRole('button', { name: 'Zrušit termín' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('combobox', { name: 'Stav' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Potvrzen' }));
    expect(save).toBeEnabled();
    await userEvent.click(save);
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith('c1', 't1', '1'));
  });

  it('desktop: the edit form keeps its four fields in a row and its footer', async () => {
    renderDetail();
    await screen.findByText('09:30 — 10:00');
    await userEvent.click(screen.getByRole('button', { name: 'Upravit' }));
    await screen.findByText('Úprava rezervace');
    expect(screen.queryByTestId('docked-actions')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zahodit změny' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uložit změny' })).toBeDisabled();
  });
});
