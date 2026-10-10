import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DayAppointment } from '../../../api/bookingContracts';
import { appointmentsApi } from '../../../api/appointments';
import { subscribeMoveNotice, type MoveNotice } from '../grid/moveDrag';
import type { GridMoveRequest } from '../grid/TimeGrid';
import { MoveConfirmDialog } from './MoveConfirmDialog';

vi.mock('../../../api/appointments', () => ({
  appointmentsApi: { reschedule: vi.fn() },
}));

/*
 * The small popover beside a moved card (the owner's picture, 10. 10. 2026):
 * one question, the notify checkbox, "Přesunout" and "Zrušit". With `onConfirm`
 * the caller commits; without it the dialog reschedules by itself, so the
 * page's older use keeps working.
 */

const appointment: DayAppointment = {
  id: 'k4',
  calendarId: 'c2',
  patientId: 'p1',
  patientName: 'Karel Zeman',
  activityId: 'a3',
  activityName: 'Spiroergometrie',
  startUtc: '2026-10-26T08:00:00Z',
  endUtc: '2026-10-26T09:00:00Z',
  status: 0,
  isRunningLate: false,
  checkedInUtc: null,
  paperwork: null,
  partnerName: null,
  clubDiscountPercent: null,
  paymentState: 'none',
  invoiceId: null,
};

const move: GridMoveRequest = {
  appointment,
  calendarId: 'c2',
  dayKey: '2026-10-26',
  start: '2026-10-26T11:00',
  end: '2026-10-26T12:00',
  startUtc: '2026-10-26T10:00:00.000Z',
  endUtc: '2026-10-26T11:00:00.000Z',
  notifyPatient: true,
};

function renderDialog(props: Partial<Parameters<typeof MoveConfirmDialog>[0]> = {}) {
  const anchor = document.createElement('div');
  document.body.appendChild(anchor);
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MoveConfirmDialog move={move} anchorEl={anchor} onClose={onClose} {...props} />
    </QueryClientProvider>,
  );
  return { onClose, anchor };
}

const notices: MoveNotice[] = [];
let unsubscribe = () => undefined as void;
beforeEach(() => {
  notices.length = 0;
  unsubscribe = subscribeMoveNotice((n) => notices.push(n));
});
afterEach(() => {
  unsubscribe();
  window.sessionStorage.clear();
  vi.mocked(appointmentsApi.reschedule).mockReset();
});

describe('MoveConfirmDialog', () => {
  it('is a popover with a caret beside the card: title, question, who and old → new, checkbox on, two buttons', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Přesunutí rezervace' });
    expect(dialog).toHaveAttribute('aria-labelledby', 'move-title');
    expect(within(dialog).getByText('Opravdu chcete změnit čas této rezervace?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('move-confirm-times')).toHaveTextContent('Karel Zeman · 09:00 → 11:00–12:00');
    expect(within(dialog).getByRole('checkbox', { name: 'Upozornit klienta na změnu' })).toBeChecked();
    expect(within(dialog).getByRole('button', { name: 'Přesunout' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Zrušit' })).toBeInTheDocument();
    expect(screen.getByTestId('move-confirm-caret')).toBeInTheDocument();
    expect(screen.getByTestId('move-confirm')).toHaveClass('MuiPopover-root');
  });

  it('spells the dates when the move crosses a day', () => {
    renderDialog({ move: { ...move, dayKey: '2026-10-27', startUtc: '2026-10-27T10:00:00.000Z', endUtc: '2026-10-27T11:00:00.000Z' } });
    expect(screen.getByTestId('move-confirm-times')).toHaveTextContent('Karel Zeman · 26. 10. 2026 09:00 → 27. 10. 2026 11:00–12:00');
  });

  it('"Zrušit", Esc and a click outside all cancel', () => {
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Zrušit' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Přesunutí rezervace' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
    const backdrop = document.querySelector('.MuiBackdrop-root');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('"Přesunout" hands the request with notifyPatient off the checkbox to onConfirm and remembers the choice', () => {
    const onConfirm = vi.fn();
    const { onClose } = renderDialog({ onConfirm });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Upozornit klienta na změnu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Přesunout' }));
    expect(onConfirm).toHaveBeenCalledWith({ ...move, notifyPatient: false });
    /* A void return: the caller took over; the dialog neither closes nor toasts by itself. */
    expect(onClose).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('sm.move.notifyPatient')).toBe('0');
    expect(appointmentsApi.reschedule).not.toHaveBeenCalled();
  });

  it('remembers the last choice for the next move of the session', () => {
    window.sessionStorage.setItem('sm.move.notifyPatient', '0');
    renderDialog({ move: { ...move, notifyPatient: undefined as unknown as boolean } });
    expect(screen.getByRole('checkbox', { name: 'Upozornit klienta na změnu' })).not.toBeChecked();
  });

  it('a promise from onConfirm is awaited: the notice goes out and the dialog closes on success', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const { onClose } = renderDialog({ onConfirm });
    fireEvent.click(screen.getByRole('button', { name: 'Přesunout' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(notices).toEqual([{ text: 'Termín přesunut · pacientovi odesíláme oznámení', tone: 'info' }]);
  });

  it('without onConfirm it reschedules by itself (the page\'s older use) and emits the toast', async () => {
    vi.mocked(appointmentsApi.reschedule).mockResolvedValue(undefined);
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Přesunout' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(appointmentsApi.reschedule).toHaveBeenCalledWith('c2', 'k4', '2026-10-26T10:00:00.000Z');
    expect(notices.map((n) => n.text)).toEqual(['Termín přesunut · pacientovi odesíláme oznámení']);
  });

  it('a refusal keeps the popover open with the server\'s sentence', async () => {
    const { BookingApiError } = await import('../../../api/apiError');
    vi.mocked(appointmentsApi.reschedule).mockRejectedValue(new BookingApiError('conflict', 409, 'Čas už mezitím někdo obsadil.'));
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Přesunout' }));
    expect(await screen.findByText('Čas už mezitím někdo obsadil.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(notices).toEqual([]);
  });

  it('without an anchor it opens centred (the page\'s older use still works)', () => {
    renderDialog({ anchorEl: null });
    expect(screen.getByRole('dialog', { name: 'Přesunutí rezervace' })).toBeInTheDocument();
    expect(screen.queryByTestId('move-confirm-caret')).not.toBeInTheDocument();
  });
});
