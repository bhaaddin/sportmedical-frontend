/*
 * R4: the clash is named in Czech; the override exists only for who may make it, only when the server said it is overridable,
 * and never without a reason.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkerBusyNotice } from './WorkerBusyNotice';
import type { WorkerBusy } from '../../api/workerBusy';

const busy = (overridable: boolean): WorkerBusy => ({
  overridable,
  details: {
    conflictKind: 'appointment', conflictId: 'x', calendarId: 'c', calendarName: 'Diagnostika', activityName: 'Spiroergometrie',
    startUtc: '2026-12-09T08:00:00Z', endUtc: '2026-12-09T08:45:00Z', workerUserId: 'u', overridable, conflictCount: null,
  },
});

const grant = (permissions: string[]) => window.localStorage.setItem('permissions', JSON.stringify(permissions));

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe('WorkerBusyNotice', () => {
  it('names the clashing booking: calendar, činnost and time', () => {
    grant([]);
    render(<WorkerBusyNotice busy={busy(false)} onOverride={vi.fn()} />);
    expect(screen.getByTestId('worker-busy-message')).toHaveTextContent('Spiroergometrie v kalendáři Diagnostika, 9. 12. 09:00–09:45');
    expect(screen.queryByTestId('worker-busy-override')).toBeNull();
  });

  it('an owner / administrator may override an overridable clash, with a reason that is not blank', async () => {
    grant(['settings.clinic.manage']);
    const onOverride = vi.fn();
    const user = userEvent.setup();
    render(<WorkerBusyNotice busy={busy(true)} onOverride={onOverride} />);
    const button = screen.getByRole('button', { name: 'Přesto potvrdit (správce)' });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText('Důvod výjimky'), '  Pacient čeká v ordinaci ');
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onOverride).toHaveBeenCalledWith('Pacient čeká v ordinaci');
  });

  it('a receptionist sees the clash and is told only the owner can override it; a public (not overridable) clash has no override at all', () => {
    grant(['bookings.edit']);
    const { unmount } = render(<WorkerBusyNotice busy={busy(true)} onOverride={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Přesto/ })).toBeNull();
    expect(screen.getByText('Přepsat zaneprázdněného pracovníka smí jen správce.')).toBeInTheDocument();
    unmount();
    grant(['settings.clinic.manage']);
    render(<WorkerBusyNotice busy={busy(false)} onOverride={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Přesto/ })).toBeNull();
  });

  it('after the server refused the override itself (403) the box is gone and the refusal is said', () => {
    grant(['settings.clinic.manage']);
    render(<WorkerBusyNotice busy={busy(true)} onOverride={vi.fn()} forbidden />);
    expect(screen.getByTestId('worker-busy-forbidden')).toHaveTextContent('smí jen správce');
    expect(screen.queryByTestId('worker-busy-override')).toBeNull();
  });
});
