/* A one-event iCalendar file built in the browser from the booking (no backend). */

export interface IcsEvent {
  startUtc: string;
  endUtc: string;
  title: string;
  location?: string | null;
  description?: string | null;
  uid?: string;
}

const stamp = (utc: string): string => new Date(utc).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const escapeText = (text: string): string => text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export function buildIcs(event: IcsEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SportMedical//Klubova registrace//CS',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid ?? `${stamp(event.startUtc)}-club@sportmedical`}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(event.startUtc)}`,
    `DTEND:${stamp(event.endUtc)}`,
    `SUMMARY:${escapeText(event.title)}`,
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.join('\r\n')}\r\n`;
}

/** Offers the file to the browser as a download. */
export function downloadIcs(event: IcsEvent, fileName = 'termin.ics'): void {
  const url = URL.createObjectURL(new Blob([buildIcs(event)], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
