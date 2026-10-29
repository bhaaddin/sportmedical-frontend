/* "Poslat zprávu": template pick, dry run ("Náhled"), confirm, send - against a mocked API. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SendMessageButton } from './SendMessage';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const get = vi.fn();
const post = vi.fn();
vi.mock('../../api/client', () => {
  const client = { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) };
  return { default: client, client };
});

const base = { category: 'vlastni', description: '', bodyHtml: '<p>x</p>', placeholders: [], isCustomized: false, version: 1, isCustom: true, autoSend: null };
const LIST = [
  { ...base, code: 'vlastni-posun', name: 'Posun dne', subject: 'Posun', audience: 'club' },
  { ...base, code: 'vlastni-omluva', name: 'Omluva pacientům', subject: 'Omluva', audience: 'patient' },
  { ...base, code: 'vlastni-oba', name: 'Obecné oznámení', subject: 'Oznámení', audience: 'any' },
  { ...base, code: 'booking-confirmation', name: 'Potvrzení', subject: 's', audience: 'patient', isCustom: false, autoSend: true },
];
const DRY = { recipients: 12, skippedWithoutEmail: 2, subject: 'Posun tréninku', bodyHtml: '<p>Dobrý den</p>', queued: 0 };

const renderButton = (target: { kind: 'patient' | 'club'; id: string }) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <SendMessageButton target={target} />
  </QueryClientProvider>,
);

beforeEach(() => {
  get.mockReset(); post.mockReset(); localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['communication.manage']));
  setViewport(VIEWPORTS.desktop);
  get.mockResolvedValue({ data: LIST });
});

describe('SendMessageButton', () => {
  it('is not drawn without communication.manage', () => {
    localStorage.setItem('permissions', JSON.stringify([]));
    renderButton({ kind: 'patient', id: 'p1' });
    expect(screen.queryByRole('button', { name: 'Poslat zprávu' })).toBeNull();
  });

  it('offers a club only its own and "any" custom messages, then dry-runs and sends with a confirm', async () => {
    const user = userEvent.setup();
    post.mockImplementation((_url: string, body: { dryRun: boolean }) => Promise.resolve({ data: body.dryRun ? DRY : { ...DRY, queued: 10 } }));
    renderButton({ kind: 'club', id: 'c1' });
    await user.click(screen.getByRole('button', { name: 'Poslat zprávu' }));
    const dialog = await screen.findByRole('dialog', { name: 'Poslat zprávu' });

    expect(within(dialog).getByRole('button', { name: 'Odeslat' })).toBeDisabled();
    await user.click(await within(dialog).findByRole('combobox', { name: 'Zpráva' }));
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options).toEqual(['Posun dne', 'Obecné oznámení']);
    await user.click(screen.getByRole('option', { name: 'Posun dne' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Včetně hráčů' }));
    await user.click(within(dialog).getByRole('button', { name: 'Náhled' }));

    expect(await within(dialog).findByText('Příjemců: 12, bez e-mailu: 2')).toBeInTheDocument();
    expect(post).toHaveBeenLastCalledWith('/api/email-templates/vlastni-posun/send', { target: { kind: 'club', id: 'c1', includePlayers: true }, dryRun: true });
    expect(within(dialog).getByTitle('Náhled e-mailu')).toHaveAttribute('sandbox', '');

    await user.click(within(dialog).getByRole('button', { name: 'Odeslat' }));
    const confirm = await screen.findByRole('dialog', { name: 'Odeslat zprávu?' });
    expect(post).toHaveBeenCalledTimes(1); // nothing sent before the confirmation
    await user.click(within(confirm).getByRole('button', { name: 'Odeslat' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post).toHaveBeenLastCalledWith('/api/email-templates/vlastni-posun/send', { target: { kind: 'club', id: 'c1', includePlayers: true }, dryRun: false });
    expect(await screen.findByText('Zařazeno k odeslání: 10')).toBeInTheDocument();
  });

  it('forgets the preview when the choice changes, so a stale count is never sent', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ data: DRY });
    renderButton({ kind: 'club', id: 'c1' });
    await user.click(screen.getByRole('button', { name: 'Poslat zprávu' }));
    const dialog = await screen.findByRole('dialog', { name: 'Poslat zprávu' });
    await user.click(await within(dialog).findByRole('combobox', { name: 'Zpráva' }));
    await user.click(await screen.findByRole('option', { name: 'Posun dne' }));
    await user.click(within(dialog).getByRole('button', { name: 'Náhled' }));
    await within(dialog).findByText(/Příjemců: 12/);
    await user.click(within(dialog).getByRole('checkbox', { name: 'Včetně hráčů' }));
    expect(within(dialog).queryByText(/Příjemců/)).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Odeslat' })).toBeDisabled();
  });

  it('says calmly that the server cannot do it yet (404)', async () => {
    const user = userEvent.setup();
    post.mockRejectedValue(new AxiosError('x', 'ERR', undefined, undefined, { status: 404, data: {} } as never));
    renderButton({ kind: 'patient', id: 'p1' });
    await user.click(screen.getByRole('button', { name: 'Poslat zprávu' }));
    const dialog = await screen.findByRole('dialog', { name: 'Poslat zprávu' });
    await user.click(await within(dialog).findByRole('combobox', { name: 'Zpráva' }));
    await user.click(await screen.findByRole('option', { name: 'Omluva pacientům' }));
    await user.click(within(dialog).getByRole('button', { name: 'Náhled' }));
    expect(await within(dialog).findByText(/server zatím neumí/i)).toBeInTheDocument();
  });
});
