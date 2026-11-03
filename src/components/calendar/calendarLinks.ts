/*
 * Everything "add to calendar" needs that is not a component: the one .ics builder, the Google
 * Calendar link, and the platform check that decides how the file is handed to the patient.
 * Pure functions, so every rule is unit-tested without a browser.
 */

export interface CalendarEvent {
  startUtc: string;
  endUtc: string;
  title: string;
  location?: string | null;
  description?: string | null;
  /** Stable id so the same booking replaces itself in the calendar instead of duplicating. */
  uid?: string;
}

export interface IcsOptions {
  /** Reminder before the start, in minutes; 0 or negative = none. Default 60 (one hour). */
  alarmMinutes?: number;
  /** DTSTAMP; injectable for tests. */
  now?: Date;
  prodId?: string;
}

/** UTC instant as an iCalendar stamp: 20260929T083000Z. */
export const icsStamp = (iso: string | Date): string =>
  new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export const escapeIcsText = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');

const encoder = new TextEncoder();

/** Folds a content line at 75 octets (RFC 5545 3.1); continuation lines start with one space, never split a UTF-8 character. */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let used = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (used + size > 75) {
      parts.push(current);
      current = ' ';
      used = 1;
    }
    current += ch;
    used += size;
  }
  parts.push(current);
  return parts.join('\r\n');
}

const fallbackUid = (event: CalendarEvent): string => {
  const slug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);
  return `${icsStamp(event.startUtc)}-${slug || 'termin'}@sportmedical`;
};

/** A one-event iCalendar file Apple Calendar, Google and Outlook all accept (CRLF, folded, UTC, PUBLISH). */
export function buildIcs(event: CalendarEvent, options: IcsOptions = {}): string {
  const alarm = options.alarmMinutes ?? 60;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${options.prodId ?? '-//SportMedical//Termin//CS'}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid ?? fallbackUid(event)}`,
    `DTSTAMP:${icsStamp(options.now ?? new Date())}`,
    `DTSTART:${icsStamp(event.startUtc)}`,
    `DTEND:${icsStamp(event.endUtc)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${escapeIcsText(event.description)}`] : []),
    ...(alarm > 0
      ? ['BEGIN:VALARM', `TRIGGER:-PT${Math.round(alarm)}M`, 'ACTION:DISPLAY', `DESCRIPTION:${escapeIcsText(event.title)}`, 'END:VALARM']
      : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

/** The "add this to Google Calendar" link; times are UTC so every time zone shows the right hour. */
export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${icsStamp(event.startUtc)}/${icsStamp(event.endUtc)}`,
  });
  if (event.location) params.set('location', event.location);
  if (event.description) params.set('details', event.description);
  return `https://calendar.google.com/calendar/render?${params.toString().replace(/\+/g, '%20')}`;
}

/** `data:` URI of the file; Safari on iPhone/iPad opens it with the "add event" sheet. */
export const icsDataUri = (ics: string): string => `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;

export type CalendarPlatform = 'ios-safari' | 'ios-other' | 'other';

export interface PlatformProbe {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}

/**
 * iPhone, iPod and iPad - including iPadOS, whose Safari reports a Mac user agent (told apart by
 * touch). On iOS only Safari itself can hand a calendar file to Calendar; Chrome, Firefox, Edge
 * and the in-app browsers (Gmail, Instagram, Facebook...) cannot.
 */
export function detectCalendarPlatform(probe: PlatformProbe): CalendarPlatform {
  const ua = probe.userAgent;
  const touch = (probe.maxTouchPoints ?? 0) > 1;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch) || (probe.platform === 'MacIntel' && touch);
  if (!ios) return 'other';
  const thirdParty = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo|FBAN|FBAV|Instagram|Line\/|Snapchat|MicroMessenger|Twitter/.test(ua);
  const webView = !/Safari\//.test(ua); // a WKWebView leaves out the "Safari/" token
  return thirdParty || webView ? 'ios-other' : 'ios-safari';
}

export const currentCalendarPlatform = (): CalendarPlatform =>
  typeof navigator === 'undefined'
    ? 'other'
    : detectCalendarPlatform({ userAgent: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints });

/** Blob download with an .ics name (desktop, Android). */
export function downloadIcsFile(ics: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
