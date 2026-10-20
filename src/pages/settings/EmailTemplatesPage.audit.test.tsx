/*
 * SMS a e-maily: picking a template, editing it, inserting placeholders, previewing, saving,
 * resetting and the test-send - and the mistakes the server would let through.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { BookingApiError } from '../../api/apiError';

const { list, save, reset, preview, testSend } = vi.hoisted(() => ({
  list: vi.fn(), save: vi.fn(), reset: vi.fn(), preview: vi.fn(), testSend: vi.fn(),
}));
vi.mock('../../api/emailTemplates', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/emailTemplates')>();
  const api = { list, save, reset, preview, testSend, get: vi.fn() };
  return { ...actual, emailTemplatesApi: api, default: api };
});
vi.mock('../../components/settings/changesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../components/settings/changesApi')>();
  return { ...actual, fetchSettingChanges: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
});

import EmailTemplatesPage from './EmailTemplatesPage';

const placeholders = [
  { key: 'pacient.jmeno', description: 'Křestní jméno', sample: 'Jan', isHtml: false },
  { key: 'klinika.nazev', description: 'Název ordinace', sample: 'Ordinace Příklad', isHtml: false },
];
const confirmation = {
  code: 'booking-confirmation', name: 'Potvrzení termínu', category: 'rezervace', description: 'Odchází pacientovi po objednání.',
  subject: 'Potvrzení {{klinika.nazev}}', bodyHtml: '<p>Dobrý den, {{pacient.jmeno}}</p>', placeholders, isCustomized: false, version: 1,
};
const cancelled = { ...confirmation, code: 'booking-cancelled', name: 'Zrušení termínu', description: 'Odchází při zrušení.', subject: 'Zrušeno', bodyHtml: '<p>Zrušeno</p>', isCustomized: true };

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/nastaveni/sablony-emailu']}>
        <EmailTemplatesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const open = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(await screen.findByText(name));
  return { subject: screen.getByLabelText('Předmět') as HTMLInputElement, body: screen.getByLabelText('Text e-mailu (HTML)') as HTMLTextAreaElement };
};
const saveButton = () => screen.getByRole('button', { name: 'Uložit' });
const testButton = () => screen.getByRole('button', { name: 'Poslat test sobě' });

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  list.mockReset().mockResolvedValue([confirmation, cancelled]);
  save.mockReset().mockImplementation(async (_code: string, subject: string, bodyHtml: string) => ({ ...confirmation, subject, bodyHtml, isCustomized: true }));
  reset.mockReset().mockResolvedValue({ ...confirmation, isCustomized: false });
  preview.mockReset().mockResolvedValue({ subject: 'Potvrzení Ordinace Příklad', bodyHtml: '<p>Dobrý den, Jan</p>' });
  testSend.mockReset().mockResolvedValue({ sentTo: 'admin@example.cz', subject: 'Potvrzení' });
});

describe('SMS a e-maily', () => {
  it('lists the templates, marks the customised one and asks for a pick before showing an editor', async () => {
    renderPage();
    expect(await screen.findByText('Potvrzení termínu')).toBeInTheDocument();
    expect(screen.getByText('Zrušení termínu')).toBeInTheDocument();
    expect(screen.getByText('upraveno')).toBeInTheDocument();
    expect(screen.getByText('Vyberte vlevo šablonu, kterou chcete upravit.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Předmět')).toBeNull();
  });

  it('puts the stored wording in the editor', async () => {
    const user = userEvent.setup();
    renderPage();
    const { subject, body } = await open(user, 'Potvrzení termínu');
    expect(subject.value).toBe('Potvrzení {{klinika.nazev}}');
    expect(body.value).toBe('<p>Dobrý den, {{pacient.jmeno}}</p>');
  });

  it('keeps Uložit off until the wording changes', async () => {
    const user = userEvent.setup();
    renderPage();
    const { subject } = await open(user, 'Potvrzení termínu');
    expect(saveButton()).toBeDisabled();
    await user.type(subject, '!');
    expect(saveButton()).toBeEnabled();
  });

  it.each([['Předmět'], ['Text e-mailu (HTML)']])('will not save an empty %s', async (label) => {
    const user = userEvent.setup();
    renderPage();
    await open(user, 'Potvrzení termínu');
    fireEvent.change(screen.getByLabelText(label), { target: { value: '   ' } });
    expect(saveButton()).toBeDisabled();
  });

  it('saves subject and body for this template and tells the person', async () => {
    const user = userEvent.setup();
    renderPage();
    const { subject } = await open(user, 'Potvrzení termínu');
    await user.type(subject, ' (nové)');
    await user.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledWith('booking-confirmation', 'Potvrzení {{klinika.nazev}} (nové)', '<p>Dobrý den, {{pacient.jmeno}}</p>'));
    expect(await screen.findByText('Šablona uložena.')).toBeInTheDocument();
  });

  it('a double click on Uložit is one request', async () => {
    const user = userEvent.setup();
    let release: (value: unknown) => void = () => undefined;
    save.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    renderPage();
    const { subject } = await open(user, 'Potvrzení termínu');
    await user.type(subject, 'x');
    await user.dblClick(saveButton());
    expect(save).toHaveBeenCalledTimes(1);
    release({ ...confirmation });
  });

  it('inserts a placeholder in double braces at the cursor', async () => {
    const user = userEvent.setup();
    renderPage();
    const { body } = await open(user, 'Potvrzení termínu');
    body.setSelectionRange(3, 3);
    await user.click(screen.getByText('klinika.nazev', { selector: '.MuiChip-label' }));
    expect(body.value).toBe('<p>{{klinika.nazev}}Dobrý den, {{pacient.jmeno}}</p>');
  });

  it('inserts double braces even when the body holds a stray single brace (CSS, a typo)', async () => {
    const user = userEvent.setup();
    renderPage();
    const { body } = await open(user, 'Potvrzení termínu');
    fireEvent.change(body, { target: { value: '<style>p {color:red}</style>' } });
    body.setSelectionRange(0, 0);
    await user.click(screen.getByText('pacient.jmeno', { selector: '.MuiChip-label' }));
    expect(body.value.startsWith('{{pacient.jmeno}}')).toBe(true);
    expect(body.value).not.toMatch(/(^|[^{])\{pacient/);
  });

  it('warns about a single-brace token and will not save it (the server would send it as written)', async () => {
    const user = userEvent.setup();
    renderPage();
    await open(user, 'Potvrzení termínu');
    fireEvent.change(screen.getByLabelText('Předmět'), { target: { value: 'Ahoj {pacient.jmeno}' } });
    expect(screen.getByRole('alert')).toHaveTextContent('{pacient.jmeno}');
    expect(saveButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Předmět'), { target: { value: 'Ahoj {{pacient.jmeno}}' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(saveButton()).toBeEnabled();
  });

  it('shows the server\'s sentence when it refuses an unknown placeholder, and keeps the text', async () => {
    const user = userEvent.setup();
    save.mockRejectedValue(new BookingApiError('validation', 400, 'Šablona používá zástupný symbol, který tento e-mail nezná: {{neexistuje}}.'));
    renderPage();
    const { subject } = await open(user, 'Potvrzení termínu');
    fireEvent.change(subject, { target: { value: 'x {{neexistuje}}' } });
    await user.click(saveButton());
    expect(await screen.findByText(/zástupný symbol, který tento e-mail nezná/)).toBeInTheDocument();
    expect(subject.value).toBe('x {{neexistuje}}');
  });

  it('previews the wording on screen, not the stored one, in a sandboxed frame', async () => {
    const user = userEvent.setup();
    renderPage();
    const { subject } = await open(user, 'Potvrzení termínu');
    await user.type(subject, ' nový');
    await user.click(screen.getByRole('button', { name: 'Náhled' }));
    await waitFor(() => expect(preview).toHaveBeenCalledWith('booking-confirmation', 'Potvrzení {{klinika.nazev}} nový', '<p>Dobrý den, {{pacient.jmeno}}</p>'));
    const dialog = await screen.findByRole('dialog');
    const frame = within(dialog).getByTitle('Náhled e-mailu') as HTMLIFrameElement;
    expect(frame.getAttribute('sandbox')).toBe('');
    expect(frame.getAttribute('srcdoc')).toContain('Dobrý den, Jan');
  });

  it('sends a test only from what is saved: it is off while there are unsaved edits, with the reason', async () => {
    const user = userEvent.setup();
    renderPage();
    const { subject } = await open(user, 'Potvrzení termínu');
    expect(testButton()).toBeEnabled();
    await user.type(subject, 'x');
    expect(testButton()).toBeDisabled();
    await user.hover(testButton().parentElement as HTMLElement);
    expect(await screen.findByText('Test se posílá z uložené šablony. Nejdřív uložte změny.')).toBeInTheDocument();
  });

  it('sends the test of the saved template and names the address it went to', async () => {
    const user = userEvent.setup();
    renderPage();
    await open(user, 'Potvrzení termínu');
    await user.click(testButton());
    await waitFor(() => expect(testSend).toHaveBeenCalledWith('booking-confirmation'));
    expect(await screen.findByText('Testovací e-mail odeslán na admin@example.cz.')).toBeInTheDocument();
  });

  it('only a customised template can be put back, and doing so says so', async () => {
    const user = userEvent.setup();
    renderPage();
    await open(user, 'Potvrzení termínu');
    expect(screen.getByRole('button', { name: 'Vrátit původní znění' })).toBeDisabled();
    await user.click(screen.getByText('Zrušení termínu'));
    expect(screen.getByRole('button', { name: 'Vrátit původní znění' })).toBeEnabled();
  });

  it('puts the shipped wording back and shows it', async () => {
    const user = userEvent.setup();
    reset.mockResolvedValue({ ...cancelled, subject: 'Původní předmět', bodyHtml: '<p>Původní</p>', isCustomized: false });
    renderPage();
    await open(user, 'Zrušení termínu');
    await user.click(screen.getByRole('button', { name: 'Vrátit původní znění' }));
    await waitFor(() => expect(reset).toHaveBeenCalledWith('booking-cancelled'));
    expect(await screen.findByText('Šablona vrácena na původní znění.')).toBeInTheDocument();
    expect((screen.getByLabelText('Předmět') as HTMLInputElement).value).toBe('Původní předmět');
  });

  it('switching to another template drops the unsaved edit and shows the other one\'s wording', async () => {
    const user = userEvent.setup();
    renderPage();
    const { subject } = await open(user, 'Potvrzení termínu');
    await user.type(subject, 'rozepsáno');
    await user.click(screen.getByText('Zrušení termínu'));
    expect((screen.getByLabelText('Předmět') as HTMLInputElement).value).toBe('Zrušeno');
    expect(saveButton()).toBeDisabled();
  });

  it('lists the placeholders of the chosen template with their meaning on hover', async () => {
    const user = userEvent.setup();
    renderPage();
    await open(user, 'Potvrzení termínu');
    expect(screen.getByText('Zástupné údaje — kliknutím vložíte na místo kurzoru:')).toBeInTheDocument();
    await user.hover(screen.getByText('pacient.jmeno', { selector: '.MuiChip-label' }));
    expect(await screen.findByText(/Křestní jméno — např\. „Jan“/)).toBeInTheDocument();
  });

  it('says there are no templates rather than drawing an empty list', async () => {
    list.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Zatím tu nejsou žádné šablony e-mailů.')).toBeInTheDocument();
  });

  it('says the list could not be loaded', async () => {
    list.mockRejectedValue(new BookingApiError('server', 500));
    renderPage();
    expect(await screen.findByRole('button', { name: /znovu/i })).toBeInTheDocument();
  });

  it.each(Object.entries(VIEWPORTS))('draws at %s (%i px)', async (_name, width) => {
    setViewport(width);
    const user = userEvent.setup();
    renderPage();
    await open(user, 'Potvrzení termínu');
    expect(saveButton()).toBeInTheDocument();
    expect(testButton()).toBeInTheDocument();
  });
});
