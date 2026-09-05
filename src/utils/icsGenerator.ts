interface ICSEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  startTime: Date;
  endTime: Date;
  url?: string;
  organizer?: string;
  attendees?: string[];
}

export function generateICS(events: ICSEvent[]): string {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CGM MEDISTAR//Booking System//CS',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  events.forEach(event => {
    const start = formatICSDate(event.startTime);
    const end = formatICSDate(event.endTime);
    const now = formatICSDate(new Date());

    ics.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@sportmedical-diagnostics.cz`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeICS(event.title)}`,
      `DESCRIPTION:${escapeICS(event.description)}`,
      `LOCATION:${escapeICS(event.location)}`,
    );

    if (event.url) ics.push(`URL:${event.url}`);
    if (event.organizer) ics.push(`ORGANIZER;CN=${escapeICS(event.organizer)}`);

    if (event.attendees) {
      event.attendees.forEach(attendee => {
        ics.push(`ATTENDEE;CN=${escapeICS(attendee)}`);
      });
    }

    ics.push(
      'BEGIN:VALARM',
      'TRIGGER:-PT24H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Připomínka termínu',
      'END:VALARM',
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Termín za 30 minut',
      'END:VALARM',
    );

    ics.push('END:VEVENT');
  });

  ics.push('END:VCALENDAR');

  return ics.join('\r\n');
}

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function downloadICS(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function createBookingICS(event: ICSEvent): void {
  const ics = generateICS([event]);
  downloadICS(ics, `booking-${event.id}.ics`);
}
