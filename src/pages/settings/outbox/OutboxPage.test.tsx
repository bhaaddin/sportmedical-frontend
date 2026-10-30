import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import OutboxPage, { plainText } from './OutboxPage';
import { setViewport, VIEWPORTS } from '../../../test/viewport';

const get = vi.fn();
const post = vi.fn();
vi.mock('../../../api/client', () => ({
  default: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
  client: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
}));

const failed = { id: 'm1', to: 'zz@example.cz', subject: 'ZZ test předmět', body: '<p>Dobrý den</p><p>text</p>', status: 'failed', statusLabel: 'selhalo', attempts: 3, lastError: 'timeout', createdAtUtc: '2026-10-30T08:00:00Z', sentAtUtc: null, templateCode: 'x' };

const renderPage = () => render(<MemoryRouter><OutboxPage /></MemoryRouter>);

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));
  setViewport(VIEWPORTS.desktop);
});

describe('Fronta e-mailů', () => {
  it('turns markup into plain text', () => {
    expect(plainText('<p>Ahoj</p><script>x()</script>')).toBe('Ahoj');
  });

  it('lists, opens a failed message and sends it again', async () => {
    get.mockImplementation((url: string) => url === '/api/system/outbox'
      ? Promise.resolve({ data: { items: [failed], pending: 0, senderConfigured: true } })
      : Promise.reject({ response: { status: 404 } }));
    post.mockResolvedValue({ data: { ...failed, status: 'pending', statusLabel: 'čeká', attempts: 0 } });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /ZZ test předmět/ }));
    expect(await screen.findByLabelText('Text zprávy')).toHaveTextContent('Dobrý den');
    await userEvent.click(screen.getByRole('button', { name: 'Odeslat znovu' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/system/outbox/m1/retry'));
  });

  it('says calmly that the server has no queue yet', async () => {
    get.mockImplementation(() => Promise.reject({ response: { status: 404 } }));
    renderPage();
    expect(await screen.findByText(/zatím není na serveru/)).toBeInTheDocument();
  });
});
