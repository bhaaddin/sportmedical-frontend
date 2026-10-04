/*
 * "Nová klubová objednávka": exactly two choices at 390 / 834 / 1440. A hands over to the caller (the calendar's
 * picking mode); B creates the Invited order and shows the short link with a one-click Zkopírovat.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import type { ViewportName } from '../../../test/viewport';
import { toOrder } from '../../../api/clubOrders';

const { invite, getAllClubs } = vi.hoisted(() => ({ invite: vi.fn(), getAllClubs: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../api/clinicSettings', () => ({ readSettings: vi.fn().mockResolvedValue({ 'pub.siteUrl': 'https://www.sportmedical.cz' }) }));
vi.mock('../../../api/clinicServices', () => ({ clinicServicesApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubs')>();
  return { ...actual, clubsApi: { ...actual.clubsApi, getAll: getAllClubs } };
});
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, invite } };
});

const { ClubOrderEntry } = await import('./ClubOrderEntry');
const { resetPublicSiteBase } = await import('../orders/absoluteLink');

function renderEntry(onPhone = vi.fn(), onClose = vi.fn(), defaultClubId?: string) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ClubOrderEntry open onClose={onClose} onPhone={onPhone} defaultClubId={defaultClubId} />
    </QueryClientProvider>,
  );
  return { onPhone, onClose };
}

beforeEach(() => {
  resetPublicSiteBase();
  invite.mockReset();
  getAllClubs.mockReset().mockResolvedValue([{ id: 'club-1', name: 'FK Slaný', ico: '1', paymentTermsDays: 14, isActive: true, createdAt: '' }]);
});

describe.each(['phone', 'tablet', 'desktop'] as ViewportName[])('two-way chooser · %s', (name) => {
  beforeEach(() => setViewport(VIEWPORTS[name]));

  it('offers exactly the two choices, in a sheet on a phone and a dialog elsewhere', async () => {
    renderEntry();
    const entry = await screen.findByTestId('club-order-entry');
    const buttons = within(entry).getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveTextContent('Vyplním sám (telefonická objednávka)');
    expect(buttons[1]).toHaveTextContent('Poslat odkaz klubu');
    if (name === 'phone') expect(document.querySelector('[data-layout="bottom-sheet"]')).not.toBeNull();
    else expect(document.querySelector('[data-layout="bottom-sheet"]')).toBeNull();
  });

  it('"Vyplním sám" closes the chooser and starts the fast picking mode', async () => {
    const { onPhone, onClose } = renderEntry(vi.fn(), vi.fn(), 'club-1');
    await userEvent.click(await screen.findByTestId('entry-phone'));
    expect(onClose).toHaveBeenCalled();
    expect(onPhone).toHaveBeenCalledWith('club-1');
  });

  it('"Poslat odkaz klubu" creates the Invited order and shows the short public link with a one-click copy', async () => {
    invite.mockResolvedValue(toOrder({ id: 'o-1', clubId: 'club-1', clubName: 'FK Slaný', status: 'Invited', formToken: 'ft', formUrl: '/klub-objednavka/ft' }));
    const user = userEvent.setup();
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const { onPhone } = renderEntry();
    await user.click(await screen.findByTestId('entry-link'));
    const dialog = await screen.findByRole('dialog', { name: 'Poslat odkaz klubu' });
    await user.click(within(dialog).getByLabelText('Klub'));
    await user.click(await screen.findByRole('option', { name: 'FK Slaný' }));
    await user.click(within(dialog).getByRole('button', { name: 'Vytvořit odkaz' }));
    expect(invite).toHaveBeenCalledWith({ clubId: 'club-1' });
    expect(onPhone).not.toHaveBeenCalled();
    const link = await within(dialog).findByTestId('invite-link');
    await waitFor(() => expect(link).toHaveAttribute('data-url', 'https://www.sportmedical.cz/klub-objednavka/ft'));
    expect(link).toHaveTextContent('www.sportmedical.cz/klub-objednavka/ft');
    await user.click(within(dialog).getByRole('button', { name: /Zkopírovat/ }));
    expect(copy).toHaveBeenCalledWith('https://www.sportmedical.cz/klub-objednavka/ft');
  });
});
