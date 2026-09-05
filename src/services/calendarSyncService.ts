interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}

class CalendarSyncService {
  // Generate iCal/ICS content from appointment
  generateICS(event: {
    title: string;
    description?: string;
    start: string;
    end: string;
    location?: string;
  }): string {
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const uid = `${Date.now()}@cgmmedistar`;

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CGM MEDISTAR//Calendar//CS',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${this.formatICSDate(event.start)}`,
      `DTEND:${this.formatICSDate(event.end)}`,
      `SUMMARY:${event.title}`,
      event.description ? `DESCRIPTION:${event.description}` : '',
      event.location ? `LOCATION:${event.location}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');
  }

  // Download ICS file
  downloadICS(event: {
    title: string;
    description?: string;
    start: string;
    end: string;
    location?: string;
  }): void {
    const ics = this.generateICS(event);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Sync appointment to external calendar (API call)
  async syncToGoogle(event: CalendarEvent): Promise<string | null> {
    try {
      const response = await fetch('/api/calendar/sync/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
      if (!response.ok) throw new Error('Sync failed');
      const data = await response.json();
      return data.externalId;
    } catch (error) {
      console.error('Google Calendar sync failed:', error);
      return null;
    }
  }

  async syncToOutlook(event: CalendarEvent): Promise<string | null> {
    try {
      const response = await fetch('/api/calendar/sync/outlook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
      if (!response.ok) throw new Error('Sync failed');
      const data = await response.json();
      return data.externalId;
    } catch (error) {
      console.error('Outlook Calendar sync failed:', error);
      return null;
    }
  }

  async removeSync(externalId: string, provider: 'google' | 'outlook'): Promise<boolean> {
    try {
      const response = await fetch(`/api/calendar/sync/${provider}/${externalId}`, {
        method: 'DELETE',
      });
      return response.ok;
    } catch (error) {
      console.error('Calendar sync removal failed:', error);
      return false;
    }
  }

  private formatICSDate(dateStr: string): string {
    return new Date(dateStr).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }
}

export const calendarSyncService = new CalendarSyncService();
