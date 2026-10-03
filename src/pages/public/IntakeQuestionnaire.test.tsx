/*
 * /dokonceni/:token — the registration the desk started (Etapa 2, decisions
 * 6, 7, 10, 11 and contract C2). The page shows the reservation, the prefilled
 * facts, the deadline; asks for a date of birth only when the server says so;
 * lists only the documents the činnost asks for; asks for the questionnaire
 * only when the server says so; and an expired link (410) is a calm page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { CompletionResult, CompletionView } from '../../api/publicIntake';
import { VIEWPORTS, setViewport } from '../../test/viewport';

const openCompletionResult = vi.fn();

vi.mock('../../api/publicIntake', async () => {
  const actual = await vi.importActual<typeof import('../../api/publicIntake')>('../../api/publicIntake');
  return { ...actual, openCompletionResult };
});

vi.mock('../../api/publicContactCheck', () => ({
  checkPublicEmail: vi.fn().mockResolvedValue({ parses: true }),
  checkPublicPhone: vi.fn().mockResolvedValue(null),
  publicPhoneRegions: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../api/publicQuestionnaire', () => ({
  loadQuestionnaire: vi.fn().mockResolvedValue({ name: 'Zdravotní dotazník', definition: null }),
}));

vi.mock('../../api/consentSettings', () => ({
  useConsentSettings: () => ({
    settings: { communicationVisible: false, communicationTitle: '', communicationDetail: '' },
  }),
}));

vi.mock('../../components/registration/MapyAddressPicker', () => ({
  default: () => <div>ADRESA</div>,
}));

vi.mock('../../components/public/HealthQuestionnaire', () => ({ default: () => null }));

vi.mock('../../api/clinicSettings', async () => {
  const actual = await vi.importActual<typeof import('../../api/clinicSettings')>('../../api/clinicSettings');
  return {
    ...actual,
    readPublicClinic: vi.fn().mockResolvedValue({
      name: 'SportMedical',
      email: 'recepce@example.cz',
      phone: '606 785 271',
      address: 'Jihlavská 1558/21, Praha 4',
      bookingEnabled: true,
    }),
  };
});

const { default: IntakeQuestionnaire } = await import('./IntakeQuestionnaire');

const view = (over: Partial<CompletionView> = {}): CompletionView => ({
  referenceNumber: 'R-1',
  givenName: 'Jan',
  familyName: 'Novák',
  email: 'jan@example.cz',
  phoneE164: '+420773539001',
  deadlineUtc: '2026-10-26T09:00:00Z',
  appointment: {
    activityName: 'Základní sportovní prohlídka',
    serviceName: 'Sportovní lékařské prohlídky',
    startUtc: '2026-10-26T09:00:00Z',
    endUtc: '2026-10-26T09:40:00Z',
    requiredDocuments: [],
  },
  requireDateOfBirth: false,
  questionnaire: 'NotAsked',
  ...over,
});

const ok = (over: Partial<CompletionView> = {}): CompletionResult => ({ status: 'ok', view: view(over) });

const renderCompletion = () =>
  render(
    <MemoryRouter initialEntries={['/dokonceni/tok-1']}>
      <Routes>
        <Route path="/dokonceni/:token" element={<IntakeQuestionnaire />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  window.sessionStorage.clear();
  openCompletionResult.mockReset().mockResolvedValue(ok());
});

describe('the reservation and the prefilled facts', () => {
  it('shows "Vaše rezervace: činnost, datum a čas" and the deadline at the top', async () => {
    renderCompletion();

    const card = await screen.findByTestId('reservation-summary');
    expect(within(card).getByText('Vaše rezervace: Základní sportovní prohlídka, pondělí 26. října v 10:00')).toBeInTheDocument();
    expect(within(card).getByText('Sportovní lékařské prohlídky')).toBeInTheDocument();
    expect(within(card).getByText(/Registraci dokončete do pondělí 26\. října/)).toBeInTheDocument();
    expect(openCompletionResult).toHaveBeenCalledWith('tok-1');
    // The summary sits above the form.
    const form = screen.getByRole('textbox', { name: 'Jméno' });
    expect(card.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('fills the name, e-mail and phone the desk typed, and they stay editable', async () => {
    renderCompletion();

    const given = await screen.findByRole('textbox', { name: 'Jméno' });
    await screen.findByTestId('reservation-summary');
    expect(given).toHaveValue('Jan');
    expect(screen.getByRole('textbox', { name: 'Příjmení' })).toHaveValue('Novák');
    expect(screen.getByRole('textbox', { name: 'E-mail' })).toHaveValue('jan@example.cz');
    expect(screen.getByRole('textbox', { name: 'Telefon' })).toHaveValue('773539001');

    await userEvent.clear(given);
    await userEvent.type(given, 'Honza');
    expect(given).toHaveValue('Honza');
  });

  it('says nothing about a deadline when the server sent none', async () => {
    openCompletionResult.mockResolvedValue(ok({ deadlineUtc: null }));
    renderCompletion();

    await screen.findByTestId('reservation-summary');
    expect(screen.queryByText(/Registraci dokončete do/)).not.toBeInTheDocument();
  });
});

describe('the date of birth', () => {
  it('is optional — and not complained about — when the server does not require it', async () => {
    renderCompletion();
    await screen.findByTestId('reservation-summary');

    expect(screen.getByLabelText('Datum narození (nepovinné)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dokončit registraci' }));

    expect(await screen.findByText('Některé údaje je potřeba opravit. Jsou označené níže.')).toBeInTheDocument();
    expect(screen.queryByText('Datum narození je povinné.')).not.toBeInTheDocument();
  });

  it('is required when the server says so', async () => {
    openCompletionResult.mockResolvedValue(ok({ requireDateOfBirth: true }));
    renderCompletion();
    await screen.findByTestId('reservation-summary');

    expect(screen.getByLabelText('Datum narození')).toBeInTheDocument();
    expect(screen.queryByLabelText('Datum narození (nepovinné)')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dokončit registraci' }));

    expect(await screen.findByText('Datum narození je povinné.')).toBeInTheDocument();
  });
});

describe('documents and the questionnaire', () => {
  it('shows no documents when the činnost asks for none — only the legal consent remains', async () => {
    renderCompletion();
    await screen.findByTestId('reservation-summary');

    expect(screen.queryByText('Dokumenty k této návštěvě')).not.toBeInTheDocument();
    expect(screen.queryByText('Výpis ze zdravotní dokumentace')).not.toBeInTheDocument();
    // The always-required legal consent is still there.
    expect(screen.getByText('Poskytnutí zdravotní služby')).toBeInTheDocument();
    expect(screen.getByText('povinné', { selector: 'span' })).toBeInTheDocument();
  });

  it('lists exactly the documents the činnost asks for', async () => {
    openCompletionResult.mockResolvedValue(ok({
      appointment: {
        activityName: 'Spiroergometrie',
        serviceName: 'Diagnostika',
        startUtc: '2026-10-26T09:00:00Z',
        endUtc: null,
        requiredDocuments: [
          { templateId: 't1', name: 'Informovaný souhlas se spiroergometrií' },
          { templateId: 't2', name: 'Čestné prohlášení o zdravotním stavu' },
        ],
      },
    }));
    renderCompletion();

    const section = (await screen.findByText('Dokumenty k této návštěvě')).closest('section') as HTMLElement;
    expect(within(section).getAllByRole('listitem')).toHaveLength(2);
    expect(within(section).getByText('Informovaný souhlas se spiroergometrií')).toBeInTheDocument();
    expect(within(section).getByText('Čestné prohlášení o zdravotním stavu')).toBeInTheDocument();
  });

  it('does not ask for the questionnaire unless the server says it is required', async () => {
    renderCompletion();
    await screen.findByTestId('reservation-summary');
    expect(screen.queryByRole('button', { name: 'Vyplnit dotazník' })).not.toBeInTheDocument();
  });

  it('asks for it — marked povinný — when the server requires it', async () => {
    openCompletionResult.mockResolvedValue(ok({ questionnaire: 'Required' }));
    renderCompletion();

    expect(await screen.findByRole('button', { name: 'Vyplnit dotazník' })).toBeInTheDocument();
    expect(screen.getByText('Povinný')).toBeInTheDocument();
  });
});

describe('a link that does not open a registration', () => {
  it('410: a calm page — expired, cancelled, call us or choose a new time', async () => {
    openCompletionResult.mockResolvedValue({ status: 'expired', message: null });
    renderCompletion();

    expect(await screen.findByText(
      'Tento odkaz už vypršel. Rezervace byla zrušena, zavolejte nám prosím nebo si vyberte nový termín.',
    )).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vybrat nový termín' })).toHaveAttribute('href', '/objednat');
    // The clinic's phone comes from the public clinic settings.
    const call = await screen.findByRole('link', { name: /Zavolat 606 785 271/ });
    expect(call).toHaveAttribute('href', 'tel:606785271');
    // There is no form to fill in.
    expect(screen.queryByRole('textbox', { name: 'Jméno' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dokončit registraci' })).not.toBeInTheDocument();
  });

  it('404: unknown or used link, with the same two ways forward', async () => {
    openCompletionResult.mockResolvedValue({ status: 'missing' });
    renderCompletion();

    expect(await screen.findByText(/Tento odkaz už není platný nebo byl použit/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vybrat nový termín' })).toBeInTheDocument();
  });

  it('a failed load says what failed and offers "Zkusit znovu"', async () => {
    openCompletionResult.mockResolvedValueOnce({ status: 'error' });
    renderCompletion();

    expect(await screen.findByText(/Registraci se nepodařilo načíst/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByTestId('reservation-summary')).toBeInTheDocument();
    expect(openCompletionResult).toHaveBeenCalledTimes(2);
  });
});

describe('three layouts', () => {
  it('phone: one column, the submit action pinned at the bottom', async () => {
    setViewport(VIEWPORTS.phone);
    renderCompletion();
    await screen.findByTestId('reservation-summary');

    const bar = document.querySelector('[data-pinned="true"]') as HTMLElement | null;
    expect(bar).not.toBeNull();
    expect(within(bar as HTMLElement).getByRole('button', { name: 'Dokončit registraci' })).toBeInTheDocument();
  });

  it.each([['iPad', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]])('%s: the action is inline', async (_name, width) => {
    setViewport(width);
    renderCompletion();
    await screen.findByTestId('reservation-summary');

    expect(document.querySelector('[data-pinned="true"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Dokončit registraci' })).toBeInTheDocument();
  });
});
