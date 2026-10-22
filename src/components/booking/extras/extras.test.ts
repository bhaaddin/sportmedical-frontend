import { describe, expect, it } from 'vitest';
import type { DayAppointment } from '../../../api/bookingContracts';
import { activePresetId, discountedCzk, freeNeedsReason, percentWord, presetsFor, presetTyped } from './discountPresets';
import { otherBookingsThatDay, sameDayText } from './sameDay';
import { looksLikePhone, phoneDigits, phoneMatches } from './phoneMatch';
import { OFF, readConfirmChannel, saveConfirmChannel } from './confirmChannel';
import { firstFreeAfter } from './nearestFree';
import { shortcutOf, type ShortcutKeyEvent } from './shortcutMap';

describe('R15c (a) discount maths', () => {
  it('takes the percentage from the list price, whole Kč, half up, exact', () => {
    expect(discountedCzk(1600, 5)).toBe(1520);
    expect(discountedCzk(1600, 10)).toBe(1440);
    expect(discountedCzk(1250, 5)).toBe(1188); // 1187.5 -> 1188 (a float would give 1187.4999)
    expect(discountedCzk(333, 5)).toBe(316); // 316.35
    expect(discountedCzk(335, 10)).toBe(302); // 301.5 -> 302
    expect(discountedCzk(2500, 7.5)).toBe(2313); // 2312.5 -> 2313
    expect(discountedCzk(990.5, 10)).toBe(891); // 891.45
  });
  it('0 and 100 percent, junk and out-of-range values stay sane', () => {
    expect(discountedCzk(1600, 0)).toBe(1600);
    expect(discountedCzk(1600, 100)).toBe(0);
    expect(discountedCzk(1600, 250)).toBe(0);
    expect(discountedCzk(1600, -5)).toBe(1600);
    expect(discountedCzk(0, 10)).toBe(0);
    expect(discountedCzk(Number.NaN, 10)).toBe(0);
  });
  it('presets: 5 %, 10 %, one per distinct group tier, then Zdarma; tiers of 0 / 5 / 10 / duplicates add nothing', () => {
    const presets = presetsFor(
      [
        { minHeadcount: 10, maxHeadcount: null, percent: 15 },
        { minHeadcount: 5, maxHeadcount: 9, percent: 10 },
        { minHeadcount: 3, maxHeadcount: 4, percent: 7.5 },
        { minHeadcount: 1, maxHeadcount: 2, percent: 0 },
        { minHeadcount: 20, maxHeadcount: null, percent: 15 },
      ],
      { allowFree: true },
    );
    expect(presets.map((p) => p.label)).toEqual(['−5 %', '−10 %', 'Skupina −7,5 %', 'Skupina −15 %', 'Zdarma']);
    expect(presets.find((p) => p.id === 'group-7.5')?.hint).toContain('3–4 osob');
    expect(presetsFor(undefined, { allowFree: false }).map((p) => p.id)).toEqual(['pct-5', 'pct-10']);
  });
  it('a preset fills the typed amount; the one whose result equals the typed amount is the active chip', () => {
    const presets = presetsFor([], { allowFree: true });
    expect(presetTyped(1600, presets[1]!)).toBe('1440');
    expect(activePresetId(1600, '1440', presets)).toBe('pct-10');
    expect(activePresetId(1600, '1 440', presets)).toBe('pct-10');
    expect(activePresetId(1600, '1441', presets)).toBeNull();
    expect(activePresetId(1600, null, presets)).toBeNull();
    expect(activePresetId(null, '0', presets)).toBeNull();
    expect(activePresetId(1600, '0', presets)).toBe('free');
  });
  it('zdarma needs a reason, however the 0 got there', () => {
    expect(freeNeedsReason(0, '')).toBe(true);
    expect(freeNeedsReason(0, '   ')).toBe(true);
    expect(freeNeedsReason(0, 'zaměstnanec')).toBe(false);
    expect(freeNeedsReason(1, '')).toBe(false);
    expect(freeNeedsReason(null, '')).toBe(false);
    expect(percentWord(7.5)).toBe('7,5 %');
  });
});

const appt = (id: string, patientId: string, startUtc: string, over: Partial<DayAppointment> = {}): DayAppointment =>
  ({ id, calendarId: 'c1', patientId, patientName: 'x', activityId: 'a1', activityName: 'Spiroergometrie', startUtc, endUtc: startUtc, status: 0, isRunningLate: false, checkedInUtc: null, paperwork: null, partnerName: null, clubDiscountPercent: null, paymentState: 'none', invoiceId: null, ...over }) as DayAppointment;

describe('R15c (c) same-day detection', () => {
  const rows = [
    appt('b', 'p1', '2026-12-10T13:00:00Z', { activityName: 'Komplexní prohlídka' }),
    appt('a', 'p1', '2026-12-10T08:00:00Z'),
    appt('c', 'p1', '2026-12-10T09:00:00Z', { status: 4 }), // cancelled
    appt('d', 'p2', '2026-12-10T09:00:00Z'),
    appt('e', 'p1', '2026-12-11T09:00:00Z'), // another day
    appt('f', 'p1', '2026-12-09T23:30:00Z'), // 00:30 on the 10th in Prague
  ];
  it('lists the other live bookings of the patient on that Prague day, in time order', () => {
    const list = otherBookingsThatDay(rows, 'p1', '2026-12-10');
    expect(list.map((x) => [x.id, x.time])).toEqual([['f', '00:30'], ['a', '09:00'], ['b', '14:00']]);
  });
  it('leaves out the booking being edited, other patients and an empty patient id', () => {
    expect(otherBookingsThatDay(rows, 'p1', '2026-12-10', 'a').map((x) => x.id)).toEqual(['f', 'b']);
    expect(otherBookingsThatDay(rows, '', '2026-12-10')).toEqual([]);
    expect(otherBookingsThatDay(rows, 'p3', '2026-12-10')).toEqual([]);
  });
  it('words it with the first booking and the count of the rest', () => {
    expect(sameDayText([])).toBe('');
    expect(sameDayText(otherBookingsThatDay(rows, 'p2', '2026-12-10'))).toBe('Pacient už má ten den rezervaci: 10:00 Spiroergometrie.');
    expect(sameDayText(otherBookingsThatDay(rows, 'p1', '2026-12-10'))).toBe('Pacient už má ten den rezervaci: 00:30 Spiroergometrie a 2 další.');
  });
});

describe('R15c (f) phone matching', () => {
  it('reduces every spelling of a Czech number to the national digits', () => {
    for (const typed of ['777 123 456', '+420 777 123 456', '00420777123456', '(777) 123-456', '420777123456']) expect(phoneDigits(typed)).toBe('777123456');
    expect(phoneDigits('+421 900 111 222')).toBe('421900111222');
  });
  it('a query is a phone only when it is digits and phone punctuation, 4 digits or more', () => {
    expect(looksLikePhone('777 123')).toBe(true);
    expect(looksLikePhone('+420777')).toBe(true);
    expect(looksLikePhone('123')).toBe(false);
    expect(looksLikePhone('Novák 777')).toBe(false);
    expect(looksLikePhone('')).toBe(false);
  });
  it('a row matches by the typed digits, with or without prefix and spaces', () => {
    expect(phoneMatches('+420 777 123 456', '777123')).toBe(true);
    expect(phoneMatches('777123456', '+420 777 123 456')).toBe(true);
    expect(phoneMatches('+420 602 111 222', '777123')).toBe(false);
    expect(phoneMatches(null, '777123')).toBe(false);
    expect(phoneMatches('777123456', '12')).toBe(false);
  });
});

describe('R15c (g) the remembered confirmation channel', () => {
  const store = (initial: Record<string, string> = {}) => {
    const data = { ...initial };
    return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), removeItem: (k: string) => void delete data[k] };
  };
  it('defaults to off for nobody, nothing stored, junk, and a throwing storage', () => {
    expect(readConfirmChannel(null, store())).toEqual(OFF);
    expect(readConfirmChannel('u1', store())).toEqual(OFF);
    expect(readConfirmChannel('u1', store({ 'sm.booking.confirmChannel.u1': 'not json' }))).toEqual(OFF);
    expect(readConfirmChannel('u1', store({ 'sm.booking.confirmChannel.u1': '{"sms":"yes","email":1}' }))).toEqual(OFF);
    expect(readConfirmChannel('u1', { getItem: () => { throw new Error('blocked'); } })).toEqual(OFF);
  });
  it('remembers per user, stores only two booleans, and off removes the key', () => {
    const s = store();
    saveConfirmChannel('u1', { sms: false, email: true }, s);
    saveConfirmChannel('u2', { sms: true, email: false }, s);
    expect(readConfirmChannel('u1', s)).toEqual({ sms: false, email: true });
    expect(readConfirmChannel('u2', s)).toEqual({ sms: true, email: false });
    expect(Object.values(s.data).every((v) => /^\{"sms":(true|false),"email":(true|false)\}$/.test(v))).toBe(true);
    saveConfirmChannel('u1', OFF, s);
    expect(Object.keys(s.data)).toEqual(['sm.booking.confirmChannel.u2']);
    expect(() => saveConfirmChannel('u1', { sms: true, email: true }, { setItem: () => { throw new Error('full'); }, removeItem: () => undefined })).not.toThrow();
  });
});

describe('R15c (b) the nearest free start of a činnost', () => {
  const slots = [{ startUtc: '2026-12-11T09:00:00Z' }, { startUtc: '2026-12-10T10:30:00Z' }, { startUtc: '2026-12-10T08:00:00Z' }];
  it('is the earliest offered start strictly after the moment, in clinic time', () => {
    expect(firstFreeAfter(slots, Date.parse('2026-12-10T07:00:00Z'))).toEqual({ date: '2026-12-10', time: '09:00', startUtc: '2026-12-10T08:00:00Z' });
    expect(firstFreeAfter(slots, Date.parse('2026-12-10T08:00:00Z'))?.startUtc).toBe('2026-12-10T10:30:00Z');
    expect(firstFreeAfter(slots, Date.parse('2026-12-11T09:00:00Z'))).toBeNull();
    expect(firstFreeAfter([], 0)).toBeNull();
  });
});

const ev = (key: string, over: Partial<ShortcutKeyEvent> = {}): ShortcutKeyEvent => ({ key, ctrlKey: false, metaKey: false, altKey: false, target: { tagName: 'BODY', closest: () => null }, ...over });

describe('R15c (e) the shortcut map', () => {
  it('maps the documented keys, case-insensitively', () => {
    expect(['n', 'N', 't', 'ArrowLeft', 'ArrowRight', 'd', 'W', 'm', '/', '?'].map((k) => shortcutOf(ev(k)))).toEqual(['new', 'new', 'today', 'prev', 'next', 'day', 'week', 'month', 'search', 'help']);
  });
  it('works with a non-Latin layout through the physical key', () => {
    expect(shortcutOf(ev('Dead', { code: 'KeyN' }))).toBe('new');
    expect(shortcutOf(ev('ž', { code: 'Digit7' }))).toBeNull();
  });
  it('Ctrl+K / Cmd+K is the search, also while typing; other Ctrl/Alt chords belong to the browser', () => {
    const input = { tagName: 'INPUT', closest: () => null };
    expect(shortcutOf(ev('k', { ctrlKey: true }))).toBe('search');
    expect(shortcutOf(ev('K', { metaKey: true, target: input }))).toBe('search');
    expect(shortcutOf(ev('n', { ctrlKey: true }))).toBeNull();
    expect(shortcutOf(ev('t', { altKey: true }))).toBeNull();
  });
  it('is silent while typing: fields, editable content, dialogs, menus, composition', () => {
    for (const target of [
      { tagName: 'INPUT', closest: () => null },
      { tagName: 'TEXTAREA', closest: () => null },
      { tagName: 'SELECT', closest: () => null },
      { tagName: 'DIV', isContentEditable: true, closest: () => null },
      { tagName: 'BUTTON', closest: () => ({}) }, // inside a dialog / menu
    ]) {
      expect(shortcutOf(ev('n', { target }))).toBeNull();
      expect(shortcutOf(ev('/', { target }))).toBeNull();
      expect(shortcutOf(ev('ArrowLeft', { target }))).toBeNull();
    }
    expect(shortcutOf(ev('n', { isComposing: true }))).toBeNull();
  });
  it('other keys do nothing', () => {
    expect(['x', 'Enter', ' ', 'Escape', '1'].map((k) => shortcutOf(ev(k)))).toEqual([null, null, null, null, null]);
  });
});

describe('the palette event used by the "/" shortcut', () => {
  it('is the UniversalSearch event (the hook does not import that module, so the string is pinned here)', async () => {
    const { OPEN_SEARCH_EVENT } = await import('../../UniversalSearch');
    expect(OPEN_SEARCH_EVENT).toBe('sm-open-search');
  });
});
