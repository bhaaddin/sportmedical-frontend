import client from './client';

/**
 * The desk's quick path, called straight from the booking dialog: a patient
 * from four facts, then their personal completion link. The patient fills in
 * everything else (address/RÚIAN, birth number, consents) through the link,
 * so nothing of that is asked over the telephone.
 *
 * Backend:
 *   POST /api/patients/pre-registrations          -> creates a provisional patient
 *   POST /api/patients/{id}/registration-link      -> issues the 24 h link
 */

export interface PreRegisterInput {
  firstName: string;
  lastName: string;
  /** ISO yyyy-MM-dd. */
  dateOfBirth: string;
  email: string;
  phone?: string;
}

export interface IssuedLink {
  /** The full URL when the public site address is configured on the server, else null. */
  url: string | null;
  /** Always present: the relative path, so the caller can build the URL itself. */
  path: string;
  token: string;
  referenceNumber: string;
  expiresAtUtc: string;
  emailQueued?: boolean;
  emailWillSend?: boolean;
  /** The address the link's e-mail went to, when one was queued. */
  sentTo?: string | null;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for very old runtimes; the server accepts any well-formed GUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const patientPreRegistrationApi = {
  /** Creates a provisional patient and returns its id (the id we generated). */
  async preRegister(input: PreRegisterInput): Promise<{ patientId: string }> {
    const patientId = newId();
    await client.post('/api/patients/pre-registrations', {
      patientId,
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
      email: input.email,
      phone: input.phone && input.phone.trim() !== '' ? input.phone.trim() : null,
    });
    return { patientId };
  },

  /** Issues (or re-issues) the completion link for a provisional patient. */
  async issueLink(patientId: string): Promise<IssuedLink> {
    const res = await client.post(`/api/patients/${patientId}/registration-link`, {});
    return res.data as IssuedLink;
  },
};

export default patientPreRegistrationApi;
