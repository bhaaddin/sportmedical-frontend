/*
 * E-mailové šablony: the editor saves through the API, refuses a symbol the
 * e-mail does not know before the server has to, previews with sample values
 * and says plainly when a test send has no SMTP to go through.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const list = vi.fn();
const save = vi.fn();
const preview = vi.fn();
const reset = vi.fn();
const sendTest = vi.fn();

vi.mock('../../api/emailTemplates', async () => {
  const actual = await vi.importActual<typeof import('../../api/emailTemplates')>('../../api/emailTemplates');
  return { ...actual, emailTemplatesApi: { list, save, preview, reset, sendTest } };
});

const { default: EmailTemplatesPage } = await import('./EmailTemplatesPage');

const template = {
  code: 'booking-confirmation',
  name: 'Potvrzení termínu (objednala recepce)',
  category: 'rezervace',
  description: 'Odchází pacientovi, když mu recepce založí termín.',
  subject: 'Potvrzení termínu {{termin.datum_cas}} — {{klinika.nazev}}',
  bodyHtml: '<p>Dobrý den, {{pacient.jmeno}}</p>',
  placeholders: [
    { key: 'pacient.jmeno', description: 'Křestní jméno pacienta.', sample: 'Jan', isHtml: false },
    { key: 'termin.datum_cas', description: 'Datum a čas termínu.', sample: 'čt 24. 9. 2026 09:00', isHtml: false },
    { key: 'klinika.nazev', description: 'Název ordinace.', sample: 'SportMedical', isHtml: false },
  ],
  isCustomized: false,
  version: 1,
  updatedAt: null,
};

beforeEach(() => {
  list.mockReset().mockResolvedValue([template]);
  save.mockReset().mockResolvedValue({ ...template, isCustomized: true, version: 2 });
  preview.mockReset().mockResolvedValue({ subject: 'Potvrzení termínu čt 24. 9. 2026 09:00 — SportMedical', bodyHtml: '<p>Dobrý den, Jan</p>' });
  reset.mockReset().mockResolvedValue(template);
  sendTest.mockReset();
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <EmailTemplatesPage />
    </QueryClientProvider>,
  );

describe('the e-mail template editor', () => {
  it('lists every template with its subject and whether it was edited', async () => {
    renderPage();

    expect(await screen.findByText('Potvrzení termínu (objednala recepce)')).toBeInTheDocument();
    expect(screen.getByText('Původní znění')).toBeInTheDocument();
    expect(screen.getByText(/Potvrzení termínu \{\{termin.datum_cas\}\}/)).toBeInTheDocument();
  });

  it('refuses a symbol the e-mail does not know, before the server has to', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByLabelText('Upravit šablonu Potvrzení termínu (objednala recepce)'));
    const body = screen.getByLabelText('Text e-mailu (HTML)');
    await user.clear(body);
    await user.type(body, '<p>{{{{pacient.rodne_cislo}}</p>');

    expect(await screen.findByText(/nezná symbol \{\{pacient.rodne_cislo\}\}/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
    expect(save).not.toHaveBeenCalled();
  });

  it('saves the wording through the API and previews unsaved text with sample values', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByLabelText('Upravit šablonu Potvrzení termínu (objednala recepce)'));
    const body = screen.getByLabelText('Text e-mailu (HTML)');
    await user.clear(body);
    await user.type(body, '<p>Dobrý den, {{{{pacient.jmeno}}, přijďte.</p>');

    await user.click(screen.getByRole('button', { name: 'Zobrazit náhled' }));
    await waitFor(() => expect(preview).toHaveBeenCalledWith('booking-confirmation', expect.objectContaining({ bodyHtml: '<p>Dobrý den, {{pacient.jmeno}}, přijďte.</p>' })));
    expect(await screen.findByTestId('preview-body')).toHaveTextContent('Dobrý den, Jan');

    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith('booking-confirmation', {
      subject: template.subject,
      bodyHtml: '<p>Dobrý den, {{pacient.jmeno}}, přijďte.</p>',
    }));
    expect(await screen.findByText(/Šablona uložena/)).toBeInTheDocument();
  });

  it('says so when a test send has no SMTP to go through', async () => {
    sendTest.mockRejectedValue({
      response: { status: 409, data: { code: 'email_template.smtp_not_configured', message: 'Odesílání e-mailů není nastaveno (Email:SmtpHost).' } },
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Poslat testovací e-mail' }));

    expect(await screen.findByText(/Odesílání e-mailů není nastaveno/)).toBeInTheDocument();
  });
});
