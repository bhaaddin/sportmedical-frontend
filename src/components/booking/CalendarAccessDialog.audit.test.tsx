/*
 * Settings audit (20. 10. 2026) - Přístupy (who sees a calendar), the dialog behind Kalendáře.
 *
 * Server facts (dev API, PUT /api/calendars/{id}/access { userIds }):
 *   the owner is locked ("role") and stays whatever the list holds; [] and an unknown id both answer 200 with the
 *   same locked list; a body without userIds is 400. Only ONE account exists on the dev database, so the
 *   multi-person behaviour is held here against the screen's own rules, not against the server.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../../test/auditHarness';

const getAccess = vi.fn();
const setAccess = vi.fn();
vi.mock('../../api/calendars', () => ({ calendarsApi: { getAccess, setAccess } }));

const { CalendarAccessDialog } = await import('./CalendarAccessDialog');

const calendar = { id: 'c1', name: 'Diagnostika', color: '#0D5C52', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 0, clinicServiceId: 's1', publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null };
const ROWS = [
  { userId: 'owner', displayName: 'MUDr. Novák', role: 'Owner', hasAccess: true, lockedBy: 'role' },
  { userId: 'u2', displayName: 'Adam Bílý', role: 'Staff', hasAccess: true, lockedBy: null },
  { userId: 'u3', displayName: 'Bára Černá', role: 'Staff', hasAccess: false, lockedBy: null },
  { userId: 'u4', displayName: 'Cyril Dvořák', role: 'Staff', hasAccess: true, lockedBy: 'assignedWorker' },
];

const mount = (onClose = vi.fn()) => ({ onClose, ...renderScreen(<CalendarAccessDialog calendar={calendar} open onClose={onClose} />) });

beforeEach(() => {
  getAccess.mockReset().mockResolvedValue(structuredClone(ROWS));
  setAccess.mockReset().mockResolvedValue(structuredClone(ROWS));
});

describe('reading', () => {
  it('names the calendar in the title and ticks who has access', async () => {
    mount();
    expect(await screen.findByRole('dialog', { name: /Kdo vidí kalendář „Diagnostika“/ })).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: 'Adam Bílý' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Bára Černá' })).not.toBeChecked();
  });

  it('shows the locked rows ticked and disabled, with the reason', async () => {
    mount();
    const owner = await screen.findByRole('checkbox', { name: 'MUDr. Novák' });
    expect(owner).toBeChecked();
    expect(owner).toBeDisabled();
    expect(screen.getByText('Vlastník a administrátor mají přístup vždy')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Cyril Dvořák' })).toBeDisabled();
    expect(screen.getByText('Pracovník je přiřazen ke dni tohoto kalendáře')).toBeInTheDocument();
  });

  it('says there is nobody when there is nobody', async () => {
    getAccess.mockResolvedValue([]);
    mount();
    expect(await screen.findByText('Nejsou k dispozici žádní uživatelé.')).toBeInTheDocument();
  });

  it('says it could not read the list and reads again on request', async () => {
    getAccess.mockRejectedValueOnce(new Error('down')).mockResolvedValue(structuredClone(ROWS));
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: /Zkusit znovu/ }));
    expect(await screen.findByRole('checkbox', { name: 'Adam Bílý' })).toBeInTheDocument();
  });
});

describe('saving', () => {
  it('sends only the people explicitly granted - never a locked row, which could not be taken away anyway', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('checkbox', { name: 'Bára Černá' }));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(setAccess).toHaveBeenCalledWith('c1', ['u2', 'u3']));
  });

  it('unticking somebody removes them from the list', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('checkbox', { name: 'Adam Bílý' }));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(setAccess).toHaveBeenCalledWith('c1', []));
  });

  it('a locked row cannot be toggled', async () => {
    const user = userEvent.setup();
    mount();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'MUDr. Novák' }));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(setAccess).toHaveBeenCalledWith('c1', ['u2']));
  });

  it('closes after a save and reads the access list again (the worker pickers read the same key)', async () => {
    const user = userEvent.setup();
    const view = mount();
    const spy = vi.spyOn(view.queryClient, 'invalidateQueries');
    await user.click(await screen.findByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(view.onClose).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith({ queryKey: ['calendar-access', 'c1'] });
  });

  it('keeps the dialog open and shows the refusal when the save fails', async () => {
    const { BookingApiError } = await import('../../api/apiError');
    setAccess.mockRejectedValue(new BookingApiError('forbidden', 403));
    const user = userEvent.setup();
    const view = mount();
    await user.click(await screen.findByRole('button', { name: 'Uložit' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(view.onClose).not.toHaveBeenCalled();
  });

  it('sends one request for a double click', async () => {
    let finish: (value: unknown) => void = () => undefined;
    setAccess.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    mount();
    await user.dblClick(await screen.findByRole('button', { name: 'Uložit' }));
    expect(setAccess).toHaveBeenCalledTimes(1);
    finish(ROWS);
  });
});
