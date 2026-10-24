/*
 * Komunikace > E-mail: the status card, the test pop-out and its problem codes,
 * and the honest state against an older server - at 390 / 834 / 1440.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import EmailSettingsPage from './EmailSettingsPage';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const get = vi.fn();
const post = vi.fn();
vi.mock('../../api/client', () => ({
  default: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
  client: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
}));

const CONFIGURED = {
  provider: 'brevo', configured: true, fromAddress: 'ordinace@example.cz',
  lastSuccessUtc: '2026-10-24T08:30:00Z', sentLast24Hours: 7, failedLast24Hours: 1, pending: 2,
};
const UNCONFIGURED = { provider: 'smtp', configured: false, fromAddress: null, lastSuccessUtc: null, sentLast24Hours: 0, failedLast24Hours: 0, pending: 4 };

function serve(status: unknown) {
  get.mockImplementation((url: string) => {
    if (url === '/api/v1/settings/email/status') return Promise.resolve({ data: status });
    return Promise.reject({ response: { status: 404 } });
  });
}

const renderPage = () => render(<MemoryRouter initialEntries={['/nastaveni/email']}><EmailSettingsPage /></MemoryRouter>);

async function sendTestAs(address: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Poslat zkušební e-mail' }));
  await user.type(screen.getByLabelText('E-mailová adresa příjemce'), address);
  await user.click(screen.getByRole('button', { name: 'Odeslat' }));
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));
});

describe.each(Object.entries(VIEWPORTS))('E-mail settings at %s (%i px)', (_n, width) => {
  beforeEach(() => setViewport(width));

  it('shows the configured sender with counters and no key field', async () => {
    serve(CONFIGURED);
    renderPage();

    const card = await screen.findByRole('region', { name: 'Stav e-mailu' });
    expect(card).toHaveTextContent('Nastaveno');
    expect(card).toHaveTextContent('Brevo');
    expect(card).toHaveTextContent('ordinace@example.cz');
    expect(card).toHaveTextContent('Odesláno za 24 hodin');
    expect(card).toHaveTextContent('7');
    expect(screen.queryByLabelText(/klíč|api/i)).toBeNull();
    expect(screen.getByRole('list', { name: 'Kontrolní seznam DNS' }).children).toHaveLength(4);
    expect(screen.getByRole('link', { name: /EMAIL-SETUP/ })).toHaveAttribute('href', expect.stringContaining('EMAIL-SETUP.md'));
  });

  it('says plainly when nothing is configured', async () => {
    serve(UNCONFIGURED);
    renderPage();

    expect(await screen.findByText('Nenastaveno')).toBeInTheDocument();
    expect(screen.getByText(/zatím neodesílají/)).toBeInTheDocument();
    expect(screen.getByText('Zatím nic neodešlo')).toBeInTheDocument();
  });

  it('is honest against an older server', async () => {
    get.mockRejectedValue({ response: { status: 404 } });
    renderPage();

    expect(await screen.findByText('Tato verze serveru ještě neumí e-mail přes API.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /zkušební/i })).toBeNull();
  });

  it('sends a test to one address and reports success', async () => {
    serve(CONFIGURED);
    post.mockResolvedValue({ data: { sent: true, provider: 'brevo' } });
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Poslat zkušební e-mail' }));
    expect(screen.getByRole('button', { name: 'Odeslat' })).toBeDisabled();
    await user.type(screen.getByLabelText('E-mailová adresa příjemce'), 'jan@example.cz');
    await user.click(screen.getByRole('button', { name: 'Odeslat' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v1/settings/email/test', { to: 'jan@example.cz' }));
    expect(await screen.findByText(/předán poskytovateli/)).toBeInTheDocument();
  });

  it('words a provider refusal from its problem code', async () => {
    serve(CONFIGURED);
    post.mockRejectedValue({ response: { status: 502, data: { code: 'email.provider_rejected', message: 'x' } } });
    renderPage();

    await sendTestAs('jan@example.cz');

    expect(await screen.findByText(/Poskytovatel e-mailu zprávu odmítl/)).toBeInTheDocument();
  });

  it('words the rate limit', async () => {
    serve(CONFIGURED);
    post.mockRejectedValue({ response: { status: 429, data: null } });
    renderPage();

    await sendTestAs('jan@example.cz');

    expect(await screen.findByRole('alert')).toHaveTextContent(/třikrát za hodinu/);
  });
});
