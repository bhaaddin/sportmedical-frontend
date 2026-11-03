import { describe, expect, it } from 'vitest';
import { buildIcs, detectCalendarPlatform, foldLine, googleCalendarUrl, icsDataUri, icsStamp } from './calendarLinks';

const event = {
  startUtc: '2026-10-26T08:00:00Z',
  endUtc: '2026-10-26T08:15:00Z',
  title: 'Prohlídka; Praha, Žižkov',
  location: 'Dlouhá 1, Praha',
  description: 'řádek 1\nřádek 2',
  uid: 'abc@sportmedical',
};
const NOW = new Date('2026-10-01T10:00:00Z');

describe('googleCalendarUrl', () => {
  it('uses UTC stamps and encodes text', () => {
    const url = googleCalendarUrl(event);
    expect(url.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE')).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get('dates')).toBe('20261026T080000Z/20261026T081500Z');
    expect(params.get('text')).toBe('Prohlídka; Praha, Žižkov');
    expect(params.get('location')).toBe('Dlouhá 1, Praha');
    expect(params.get('details')).toBe('řádek 1\nřádek 2');
    expect(url).not.toContain('+');
    expect(url).not.toContain(' ');
  });
  it('leaves out empty location and details', () => {
    const url = googleCalendarUrl({ ...event, location: null, description: null });
    expect(new URL(url).searchParams.has('location')).toBe(false);
    expect(new URL(url).searchParams.has('details')).toBe(false);
  });
  it('stamps a local-offset instant as UTC', () => {
    expect(icsStamp('2026-10-26T10:00:00+02:00')).toBe('20261026T080000Z');
  });
});

describe('buildIcs', () => {
  const ics = buildIcs(event, { now: NOW });
  it('is CRLF throughout and has the required Apple headers', () => {
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    for (const line of ['BEGIN:VCALENDAR', 'VERSION:2.0', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'UID:abc@sportmedical', 'DTSTAMP:20261001T100000Z', 'DTSTART:20261026T080000Z', 'DTEND:20261026T081500Z']) {
      expect(ics).toContain(`${line}\r\n`);
    }
    expect(ics).toMatch(/PRODID:.+\r\n/);
  });
  it('escapes text', () => {
    expect(ics).toContain('SUMMARY:Prohlídka\\; Praha\\, Žižkov');
    expect(ics).toContain('DESCRIPTION:řádek 1\\nřádek 2');
  });
  it('adds a one hour alarm, or none when asked', () => {
    expect(ics).toContain('BEGIN:VALARM\r\nTRIGGER:-PT60M\r\nACTION:DISPLAY');
    expect(buildIcs(event, { now: NOW, alarmMinutes: 0 })).not.toContain('VALARM');
  });
  it('folds lines at 75 octets without splitting characters', () => {
    const long = buildIcs({ ...event, description: 'Žluťoučký kůň '.repeat(30) }, { now: NOW });
    const enc = new TextEncoder();
    for (const line of long.split('\r\n')) expect(enc.encode(line).length).toBeLessThanOrEqual(75);
    const unfolded = long.replace(/\r\n /g, '');
    expect(unfolded).toContain('Žluťoučký kůň Žluťoučký kůň');
    expect(long).toContain('\r\n ');
  });
  it('generates a uid when none is given', () => {
    expect(buildIcs({ ...event, uid: undefined }, { now: NOW })).toMatch(/UID:20261026T080000Z-[a-z0-9]*@sportmedical\r\n/);
  });
});

describe('foldLine', () => {
  it('leaves short lines alone', () => expect(foldLine('SUMMARY:x')).toBe('SUMMARY:x'));
});

describe('icsDataUri', () => {
  it('is a text/calendar data URI that round-trips', () => {
    const uri = icsDataUri('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');
    expect(uri.startsWith('data:text/calendar;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(uri.split(',')[1])).toBe('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');
  });
});

describe('detectCalendarPlatform', () => {
  const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
  it('iPhone Safari', () => expect(detectCalendarPlatform({ userAgent: IPHONE_SAFARI })).toBe('ios-safari'));
  it('iPadOS Safari with a Mac user agent (touch)', () => {
    expect(detectCalendarPlatform({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 5 })).toBe('ios-safari');
  });
  it('a real Mac is not iOS', () => {
    expect(detectCalendarPlatform({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 })).toBe('other');
  });
  it('Chrome, Firefox, Edge on iOS', () => {
    for (const token of ['CriOS/125.0.0.0', 'FxiOS/126.0', 'EdgiOS/125.0']) {
      expect(detectCalendarPlatform({ userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) ${token} Mobile/15E148 Safari/604.1` })).toBe('ios-other');
    }
  });
  it('in-app webviews (no Safari token, Instagram)', () => {
    expect(detectCalendarPlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148' })).toBe('ios-other');
    expect(detectCalendarPlatform({ userAgent: `${IPHONE_SAFARI} Instagram 330.0` })).toBe('ios-other');
  });
  it('Android and desktop', () => {
    expect(detectCalendarPlatform({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36', maxTouchPoints: 5 })).toBe('other');
    expect(detectCalendarPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125 Safari/537.36' })).toBe('other');
  });
});
