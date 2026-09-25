/*
 * What the history calls a line: the action, and — when the patient did it
 * through their own link — the patient's wording. The server writes those
 * lines under a fixed actor with `actorKind: "patient"`; the screen must not
 * go looking for an employee by that id and print "neznámý uživatel".
 */
import { describe, it, expect } from 'vitest';
import { historyLineKey, historyLineSchema } from './bookingContracts';

describe('historyLineKey', () => {
  it('names a move by the patient as theirs', () => {
    expect(historyLineKey({ action: 2, actorKind: 'patient' })).toBe('booking.history.patientRescheduled');
  });

  it('names a cancellation by the patient as theirs', () => {
    expect(historyLineKey({ action: 3, actorKind: 'patient' })).toBe('booking.history.patientCancelled');
  });

  it('leaves the desk’s own lines as they were', () => {
    expect(historyLineKey({ action: 2, actorKind: 'staff' })).toBe('booking.history.rescheduled');
    expect(historyLineKey({ action: 3, actorKind: 'staff' })).toBe('booking.history.cancelled');
    expect(historyLineKey({ action: 0, actorKind: 'staff' })).toBe('booking.history.booked');
  });

  it('renders an unknown action as unknown rather than dropping the row', () => {
    expect(historyLineKey({ action: 99, actorKind: 'patient' })).toBeNull();
  });

  it('reads a line from an older server as a staff line', () => {
    const line = historyLineSchema.parse({
      action: 2,
      actorId: '2f1e6c3a-0000-4000-8000-000000000001',
      actorDisplayName: 'Recepce',
      atUtc: '2026-09-24T07:00:00Z',
    });
    expect(line.actorKind).toBe('staff');
  });
});
