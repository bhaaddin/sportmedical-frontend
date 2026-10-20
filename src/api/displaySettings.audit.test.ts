/*
 * Settings audit (20. 10. 2026) - the client side of Kalendář a mřížka and the
 * pause between examinations: what is sent, what is kept, which key the
 * consumers read it through.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('./client', () => ({ default: { get, put }, client: { get, put } }));

const {
  CALENDAR_DISPLAY_OFFLINE, CALENDAR_DISPLAY_QUERY_KEY, HOVER_FIELDS_THE_CARD_DRAWS, HOVER_FIELD_FALLBACK,
  gridSpan, hoverChoices, readCalendarDisplay, saveCalendarDisplay,
} = await import('./displaySettings');
const { BOOKING_SLOTS_QUERY_KEY, readBookingSlots, saveBookingSlots, toBookingSlots } = await import('./bookingSlots');
const { REFERENCE_KEYS } = await import('./queryClient');

const choice = (key: string, sensitive = false) => ({ key, label: key.toUpperCase(), help: `help ${key}`, sensitive });

beforeEach(() => {
  get.mockReset();
  put.mockReset();
});

describe('hoverChoices', () => {
  it('keeps the server order and labels, and drops what the booking card cannot draw', () => {
    const catalogue = [choice('phone'), choice('note'), choice('patientName'), choice('insurer', true), choice('history'), choice('birthDate', true), choice('price')];
    expect(hoverChoices(catalogue).map((c) => c.key)).toEqual(['phone', 'patientName', 'birthDate']);
    expect(hoverChoices(catalogue)[0]).toMatchObject({ label: 'PHONE', help: 'help phone' });
  });

  it('uses the built-in list when the server sent none or an empty one', () => {
    expect(hoverChoices(undefined)).toEqual(HOVER_FIELD_FALLBACK);
    expect(hoverChoices([])).toEqual(HOVER_FIELD_FALLBACK);
  });

  it('the built-in list is exactly what the card draws, so the two cannot drift apart unnoticed', () => {
    expect(HOVER_FIELD_FALLBACK.map((c) => c.key).sort()).toEqual([...HOVER_FIELDS_THE_CARD_DRAWS].sort());
  });

  it('marks the identity facts as sensitive in the fallback, as the server does', () => {
    expect(HOVER_FIELD_FALLBACK.filter((c) => c.sensitive).map((c) => c.key)).toEqual(['birthDate']);
  });

  it('never offers price or registrationStatus (the server answers 400 "karta neumí zobrazit")', () => {
    expect(HOVER_FIELDS_THE_CARD_DRAWS).not.toContain('price');
    expect(HOVER_FIELDS_THE_CARD_DRAWS).not.toContain('registrationStatus');
  });
});

describe('the request', () => {
  const body = { settings: { defaultView: 'week' }, views: ['week'], slotLengths: [15], defaults: {} };

  it('reads and writes /api/v1/settings/calendar-display', async () => {
    get.mockResolvedValue({ data: body });
    put.mockResolvedValue({ data: body });
    await readCalendarDisplay();
    expect(get).toHaveBeenCalledWith('/api/v1/settings/calendar-display');
    const settings = { ...CALENDAR_DISPLAY_OFFLINE, lunchFrom: '12:00', lunchTo: '12:30' };
    await saveCalendarDisplay(settings);
    expect(put).toHaveBeenCalledWith('/api/v1/settings/calendar-display', settings);
  });

  it('sends the lunch break back untouched', async () => {
    put.mockResolvedValue({ data: body });
    await saveCalendarDisplay({ ...CALENDAR_DISPLAY_OFFLINE, lunchFrom: '11:30', lunchTo: '12:15' });
    expect(put.mock.calls[0][1]).toMatchObject({ lunchFrom: '11:30', lunchTo: '12:15' });
  });

  it('hands the server response over as it came, hover catalogue included', async () => {
    get.mockResolvedValue({ data: { ...body, hoverFieldCatalogue: [choice('phone')] } });
    expect((await readCalendarDisplay()).hoverFieldCatalogue).toEqual([choice('phone')]);
  });
});

describe('who reads the setting, and through which key', () => {
  it('is cached under a "settings" key, which every non-booking write marks stale', () => {
    expect(CALENDAR_DISPLAY_QUERY_KEY[0]).toBe('settings');
    expect(REFERENCE_KEYS as readonly string[]).toContain('settings');
    expect(BOOKING_SLOTS_QUERY_KEY[0]).toBe('settings');
  });

  it('the offline fallback is a complete, valid settings object', () => {
    expect(CALENDAR_DISPLAY_OFFLINE.dayStartHour).toBeLessThan(CALENDAR_DISPLAY_OFFLINE.dayEndHour);
    for (const colour of [CALENDAR_DISPLAY_OFFLINE.nowLineColor, CALENDAR_DISPLAY_OFFLINE.holidayColor, CALENDAR_DISPLAY_OFFLINE.lunchColor]) {
      expect(colour).toMatch(/^#[0-9A-F]{6}$/);
    }
    expect(CALENDAR_DISPLAY_OFFLINE.hoverFields.every((key) => HOVER_FIELDS_THE_CARD_DRAWS.includes(key))).toBe(true);
  });
});

describe('gridSpan with the saved day', () => {
  it('shows a booking at 6:30 on a grid that starts at 7 (a setting may hide empty time, never a patient)', () => {
    expect(gridSpan({ dayStartHour: 7, dayEndHour: 19 }, null, [{ start: 6, end: 7 }])).toEqual({ start: 6, end: 19 });
  });

  it('never returns an empty span, even for a start after the end', () => {
    const span = gridSpan({ dayStartHour: 20, dayEndHour: 8 }, null);
    expect(span.end).toBeGreaterThan(span.start);
  });
});

describe('booking slots (pause between examinations)', () => {
  it('reads an absent field as the default 0 and the range as 0 to 240', () => {
    expect(toBookingSlots({})).toEqual({ settings: { examinationPauseMinutes: 0 }, defaults: { examinationPauseMinutes: 0 }, minMinutes: 0, maxMinutes: 240 });
  });

  it('reads what the server sent, including a range it changed', () => {
    expect(toBookingSlots({ settings: { examinationPauseMinutes: 10 }, defaults: { examinationPauseMinutes: 5 }, minMinutes: 5, maxMinutes: 60 })).toEqual({
      settings: { examinationPauseMinutes: 10 }, defaults: { examinationPauseMinutes: 5 }, minMinutes: 5, maxMinutes: 60,
    });
  });

  it('ignores a value that is not a number', () => {
    expect(toBookingSlots({ settings: { examinationPauseMinutes: '10' }, minMinutes: null }).settings.examinationPauseMinutes).toBe(0);
  });

  it('GETs and PUTs /api/v1/settings/booking-slots with just the one field', async () => {
    get.mockResolvedValue({ data: { settings: { examinationPauseMinutes: 10 } } });
    put.mockResolvedValue({ data: { settings: { examinationPauseMinutes: 15 } } });
    expect((await readBookingSlots()).settings.examinationPauseMinutes).toBe(10);
    expect((await saveBookingSlots({ examinationPauseMinutes: 15 })).settings.examinationPauseMinutes).toBe(15);
    expect(get).toHaveBeenCalledWith('/api/v1/settings/booking-slots');
    expect(put).toHaveBeenCalledWith('/api/v1/settings/booking-slots', { examinationPauseMinutes: 15 });
  });
});
