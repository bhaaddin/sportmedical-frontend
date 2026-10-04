/*
 * Etapa 5: the setup form of a phone order, opened as an addendum - "Dodatek k objednávce KO-…", the club and the
 * payment are the parent's and locked, and the session handed to the calendar carries `parentOrderId`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { orderCode } from './orderFormat';
import { readPickOrderState } from './pickSession';

const { getAllClubs, listActivities } = vi.hoisted(() => ({ getAllClubs: vi.fn(), listActivities: vi.fn() }));

vi.mock('../../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubs')>();
  return { ...actual, clubsApi: { ...actual.clubsApi, getAll: getAllClubs } };
});
vi.mock('../../../api/clinicServices', () => ({
  clinicServicesApi: { list: vi.fn().mockResolvedValue([{ id: 's-2', name: 'Fyzioterapie', isActive: true, sortOrder: 0 }]) },
}));
vi.mock('../../../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubBlocks')>();
  return { ...actual, fetchBlockableActivities: listActivities };
});

const { PickOrderSetup } = await import('./PickOrderSetup');

const PARENT = { orderId: '80e74a6c-0000-4000-8000-000000000001', clubId: 'club-1', clubName: 'FK Slaný', paymentMethod: 'ClubInvoice' as const };

function mount(parent?: typeof PARENT, onStart = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PickOrderSetup open onClose={vi.fn()} onStart={onStart} parent={parent} />
    </QueryClientProvider>,
  );
  return onStart;
}

beforeEach(() => {
  getAllClubs.mockReset().mockResolvedValue([
    { id: 'club-1', name: 'FK Slaný', ico: '1', paymentTermsDays: 14, isActive: true, createdAt: '' },
    { id: 'club-2', name: 'HC Kladno', ico: '2', paymentTermsDays: 14, isActive: true, createdAt: '' },
  ]);
  listActivities.mockReset().mockResolvedValue([
    { id: 'a-9', name: 'Masáž', durationMinutes: 30, colorHex: '#123456', clinicServiceId: 's-2', parallelCapacity: 2 },
  ]);
});

describe('orderCode', () => {
  it('is the last eight hex digits of the id, upper case', () => {
    expect(orderCode(PARENT.orderId)).toBe('KO-00000001');
  });
});

describe('readPickOrderState with a parent', () => {
  it('reads the parent and takes its club', () => {
    expect(readPickOrderState({ pickOrder: { clubId: 'club-1', parent: PARENT } })).toEqual({ clubId: 'club-1', parent: PARENT });
  });
  it('still reads the plain forms', () => {
    expect(readPickOrderState({ pickOrder: true })).toEqual({});
    expect(readPickOrderState({ pickOrder: { clubId: 'c' } })).toEqual({ clubId: 'c' });
    expect(readPickOrderState({ pickOrder: { parent: { orderId: '' } } })).toEqual({});
  });
});

describe.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)('addendum setup · %s', (_n, width) => {
  beforeEach(() => setViewport(width));

  it('names the parent, locks the club and the payment, and starts a session with parentOrderId', async () => {
    const user = userEvent.setup();
    const onStart = mount(PARENT);
    const setup = await screen.findByTestId('pick-setup');
    expect(within(setup).getByTestId('pick-setup-parent')).toHaveTextContent('Dodatek k objednávce KO-00000001');
    expect(screen.getByRole('dialog', { name: 'Dodatek k objednávce' })).toBeInTheDocument();
    expect(within(setup).getByRole('combobox', { name: 'Klub' })).toBeDisabled();
    for (const radio of within(setup).getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(within(setup).getByRole('radio', { name: /Platí klub/ })).toBeChecked();

    await user.click(within(setup).getByRole('combobox', { name: 'Služba' }));
    await user.click(await screen.findByRole('option', { name: 'Fyzioterapie' }));
    await user.click(await within(setup).findByRole('checkbox', { name: /Masáž/ }));
    await user.type(within(setup).getByRole('textbox', { name: /Počet/ }), '30');
    await user.click(screen.getByRole('button', { name: 'Vybrat termíny v kalendáři' }));
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
    expect(onStart.mock.calls[0][0]).toMatchObject({
      clubId: 'club-1', serviceId: 's-2', paymentMethod: 'ClubInvoice', parentOrderId: PARENT.orderId,
      activities: [{ activityId: 'a-9', seats: 30 }],
    });
  });

  it('without a parent nothing is locked and no parentOrderId is sent', async () => {
    mount();
    const setup = await screen.findByTestId('pick-setup');
    expect(within(setup).queryByTestId('pick-setup-parent')).toBeNull();
    expect(within(setup).getByRole('combobox', { name: 'Klub' })).toBeEnabled();
    for (const radio of within(setup).getAllByRole('radio')) expect(radio).toBeEnabled();
    expect(screen.getByRole('dialog', { name: 'Telefonická objednávka' })).toBeInTheDocument();
  });
});
