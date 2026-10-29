/* Zprávy: groups, the on/off switch, a custom message, the alarm chips, and the calm notice on a server without the endpoints. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import MessagesPage from './MessagesPage';
import { alarmLabel, normaliseAlarms, placeholdersFor } from './messagesModel';
import { setViewport, VIEWPORTS } from '../../../test/viewport';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const del = vi.fn();
vi.mock('../../../api/client', () => {
  const client = {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    put: (...a: unknown[]) => put(...a),
    delete: (...a: unknown[]) => del(...a),
  };
  return { default: client, client };
});

const ph = (key: string) => ({ key, description: key, sample: 'x', isHtml: false });
const t = (over: Record<string, unknown>) => ({
  category: 'x', description: 'Popis', subject: 'Předmět', bodyHtml: '<p>t</p>', placeholders: [ph('Jmeno')],
  isCustomized: false, version: 1, isCustom: false, autoSend: true, audience: 'patient', ...over,
});
const LIST = [
  t({ code: 'booking-confirmation', name: 'Potvrzení rezervace' }),
  t({ code: 'club-block-moved', name: 'Klub: blok přesunut', audience: 'club', placeholders: [ph('Klub')] }),
  t({ code: 'vlastni-posun', name: 'Posun dne', isCustom: true, autoSend: null, audience: 'club' }),
];

const notFound = () => new AxiosError('x', 'ERR', undefined, undefined, { status: 404, data: {} } as never);

function serve(list: unknown[] | 'missing') {
  get.mockImplementation((url: string) => {
    if (url === '/api/email-templates') return list === 'missing' ? Promise.reject(notFound()) : Promise.resolve({ data: list });
    if (url === '/api/email-templates/calendar') return Promise.resolve({ data: { alarmMinutes: [1440, 60] } });
    return Promise.reject(notFound());
  });
}

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/nastaveni/zpravy']}><MessagesPage /></MemoryRouter>
  </QueryClientProvider>,
);

beforeEach(() => {
  [get, post, put, del].forEach((m) => m.mockReset());
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['communication.manage']));
  setViewport(VIEWPORTS.desktop);
  put.mockResolvedValue({ data: null });
});

describe('Zprávy', () => {
  it('groups the built-in messages and lists the custom ones apart', async () => {
    serve(LIST);
    renderPage();
    const auto = await screen.findByRole('list', { name: 'Automatické zprávy' });
    expect(within(auto).getByText('Pacienti')).toBeInTheDocument();
    expect(within(auto).getByText('Kluby')).toBeInTheDocument();
    expect(within(auto).getByText('Klub: blok přesunut')).toBeInTheDocument();
    expect(within(auto).queryByText('Posun dne')).toBeNull();
    expect(within(screen.getByRole('list', { name: 'Vlastní zprávy' })).getByText('Posun dne')).toBeInTheDocument();
  });

  it('keeps reminders and sending for someone with clinic settings only, without asking for templates', async () => {
    localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));
    serve(LIST);
    renderPage();
    expect(await screen.findByText('Kalendář a připomínky')).toBeInTheDocument();
    expect(screen.getByText('Odesílání')).toBeInTheDocument();
    expect(screen.queryByText('Automatické zprávy')).toBeNull();
    expect(screen.queryByText('Vlastní zprávy')).toBeNull();
    expect(get).not.toHaveBeenCalledWith('/api/email-templates');
    expect(get).not.toHaveBeenCalledWith('/api/email-templates/calendar');
  });

  it('switches automatic sending with PUT /{code}/auto-send', async () => {
    serve(LIST);
    renderPage();
    const toggle = await screen.findByRole('switch', { name: 'Posílat automaticky: Potvrzení rezervace' });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    await waitFor(() => expect(put).toHaveBeenCalledWith('/api/email-templates/booking-confirmation/auto-send', { enabled: false }));
  });

  it('removes an alarm and saves the rest, and caps the list at four', async () => {
    serve(LIST);
    renderPage();
    await screen.findByText('1 den předem');
    await userEvent.click(screen.getByTitle('Odebrat: 1 hodina předem'));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/api/email-templates/calendar', { alarmMinutes: [1440] }));
  });

  it('creates a custom message', async () => {
    serve(LIST);
    post.mockResolvedValue({ data: t({ code: 'vlastni-novy', name: 'Nový', isCustom: true, autoSend: null }) });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Nová zpráva' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nová zpráva' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Název zprávy/ }), 'Nový');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Předmět' }), 'Ahoj');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Text zprávy/ }), 'Text');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vytvořit' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/email-templates', { name: 'Nový', subject: 'Ahoj', bodyHtml: 'Text', audience: 'patient' }));
  });

  it('shows a calm notice instead of crashing when the server has no such endpoint yet', async () => {
    serve('missing');
    renderPage();
    expect(await screen.findByText(/Server tuto funkci zatím nemá/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nová zpráva' })).toBeNull();
  });
});

describe('model', () => {
  it('words an alarm in Czech', () => {
    expect([0, 15, 60, 180, 1440, 2880, 10080, 90].map(alarmLabel)).toEqual([
      'V čase události', '15 minut předem', '1 hodina předem', '3 hodiny předem', '1 den předem', '2 dny předem', '1 týden předem', '90 minut předem',
    ]);
  });
  it('orders alarms longest first without repeats', () => {
    expect(normaliseAlarms([60, 1440, 60])).toEqual([1440, 60]);
  });
  it('offers a new message the placeholders the server fills for its audience', () => {
    expect(placeholdersFor('club').map((p) => p.key)).toEqual(['prijemce.jmeno', 'klub.nazev']);
    expect(placeholdersFor('patient').map((p) => p.key)).toEqual(['prijemce.jmeno', 'pacient.jmeno', 'pacient.prijmeni']);
    expect(placeholdersFor('any').map((p) => p.key)).toEqual(['prijemce.jmeno']);
  });
});
