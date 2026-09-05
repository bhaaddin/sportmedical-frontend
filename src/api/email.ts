/* ══════════════════════════════════════════════════════════════
   EMAIL API — Sending emails, calendar invites, follow-ups
   Backend endpoints for email, ICS attachments, and automation.
   ══════════════════════════════════════════════════════════════ */
import client from './client';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  isActive: boolean;
  category: 'appointment' | 'followup' | 'results' | 'system';
}

export interface SendEmailRequest {
  to: string;
  subject: string;
  body: string;
  attachCalendarInvite?: boolean;
  appointmentStart?: string;
  appointmentEnd?: string;
  location?: string;
}

export interface FollowUpSettings {
  enabled: boolean;
  daysAfterVisit: number[];
  templateId?: string;
}

export const emailApi = {
  /* ── Send email ── */
  send: async (data: SendEmailRequest): Promise<void> => {
    await client.post('/api/email/send', data);
  },

  /* ── Send appointment confirmation with ICS ── */
  sendAppointmentConfirmation: async (appointmentId: string): Promise<void> => {
    await client.post(`/api/email/appointment/${appointmentId}/confirm`);
  },

  /* ── Send PDF report ── */
  sendReport: async (patientId: string, reportType: string): Promise<void> => {
    await client.post(`/api/email/patient/${patientId}/report`, { reportType });
  },

  /* ── Templates ── */
  getTemplates: async (): Promise<EmailTemplate[]> => {
    const res = await client.get('/api/email/templates');
    return res.data?.value ?? res.data ?? [];
  },

  /* ── Follow-up settings ── */
  getFollowUpSettings: async (): Promise<FollowUpSettings> => {
    const res = await client.get('/api/email/followup-settings');
    return res.data?.value ?? res.data ?? { enabled: false, daysAfterVisit: [30, 90, 240] };
  },

  updateFollowUpSettings: async (settings: FollowUpSettings): Promise<void> => {
    await client.put('/api/email/followup-settings', settings);
  },

  /* ── Generate ICS file ── */
  generateIcs: async (appointmentId: string): Promise<Blob> => {
    const res = await client.get(`/api/email/ics/${appointmentId}`, { responseType: 'blob' });
    return res.data;
  },
};
