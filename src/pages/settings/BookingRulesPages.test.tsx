import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../../test/auditHarness';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { parseAttendance, parseBookingChanges } from '../../api/bookingRulesSettings';

const { getBookingChanges, saveBookingChanges, getAttendance, saveAttendance } = vi.hoisted(() => ({
  getBookingChanges: vi.fn(), saveBookingChanges: vi.fn(), getAttendance: vi.fn(), saveAttendance: vi.fn(),
}));

vi.mock('../../auth/usePermission', () => ({ usePermission: () => true, usePermissions: () => [] }));
vi.mock('../../api/bookingRulesSettings', async (original) => ({
  ...(await original<typeof import('../../api/bookingRulesSettings')>()),
  bookingRulesApi: { getBookingChanges, saveBookingChanges, getAttendance, saveAttendance },
}));

const { BookingChangesPage, AttendancePage, ruleProblem } = await import('./BookingRulesPages');

const rule = (value: number) => ({ value, defaultValue: 24, min: 1, max: 72 });

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  getBookingChanges.mockReset().mockResolvedValue(rule(24));
  saveBookingChanges.mockReset().mockResolvedValue(rule(12));
  getAttendance.mockReset().mockRejectedValue({ response: { status: 404 } });
});

describe('the two clinic rules', () => {
  it('parses both server shapes', () => {
    expect(parseBookingChanges({ settings: { patientChangeDeadlineHours: 6 }, defaults: { patientChangeDeadlineHours: 24 }, minHours: 1, maxHours: 72 }))
      .toEqual({ value: 6, defaultValue: 24, min: 1, max: 72 });
    expect(parseAttendance({ settings: { noShowAfterMinutes: 15, patientChangeDeadlineHours: 2 }, minimumNoShowAfterMinutes: 5, maximumNoShowAfterMinutes: 120, defaults: { noShowAfterMinutes: 15 } }))
      .toEqual({ value: 15, defaultValue: 15, min: 5, max: 120 });
    expect(() => parseAttendance({})).toThrow();
  });

  it('names the bounds in the problem sentence', () => {
    expect(ruleProblem('abc', 1, 72, 'hodin')).toBe('Zadejte celé číslo.');
    expect(ruleProblem('100', 1, 72, 'hodin')).toBe('Zadejte hodnotu od 1 do 72 hodin.');
    expect(ruleProblem('12', 1, 72, 'hodin')).toBeNull();
  });

  it('saves a changed deadline within the bounds', async () => {
    const user = userEvent.setup();
    renderScreen(<BookingChangesPage />);
    const field = await screen.findByLabelText('Nejpozději před začátkem');
    await user.clear(field);
    await user.type(field, '12');
    await user.click(await screen.findByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(saveBookingChanges).toHaveBeenCalledWith(12));
  });

  it('does not offer save for a value outside the bounds', async () => {
    const user = userEvent.setup();
    renderScreen(<BookingChangesPage />);
    const field = await screen.findByLabelText('Nejpozději před začátkem');
    await user.clear(field);
    await user.type(field, '500');
    expect(await screen.findByText('Zadejte hodnotu od 1 do 72 hodin.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Uložit' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('says calmly that an older server has no attendance rule', async () => {
    renderScreen(<AttendancePage />);
    expect(await screen.findByText(/Server toto nastavení zatím nemá/)).toBeTruthy();
  });
});
