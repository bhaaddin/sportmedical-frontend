import client from './client';

/* ── The clubs a patient belongs to - `GET /api/clubs/by-patient/{patientId}` (patients.view), active first ── */
export interface PatientClubMembership {
  memberId: string;
  clubId: string;
  clubName: string;
  memberNumber: string | null;
  position: string | null;
  joinedAt: string | null;
  leftAt: string | null;
  isActive: boolean;
}

const orNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

/** Rows without a club id are left out; anything that is not a list is "no clubs". */
export function readPatientClubs(data: unknown): PatientClubMembership[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((raw): PatientClubMembership[] => {
    if (raw === null || typeof raw !== 'object') return [];
    const r = raw as Record<string, unknown>;
    if (typeof r.clubId !== 'string' || r.clubId === '') return [];
    return [{
      memberId: typeof r.memberId === 'string' ? r.memberId : `${r.clubId}`,
      clubId: r.clubId,
      clubName: orNull(r.clubName) ?? 'Klub',
      memberNumber: orNull(r.memberNumber),
      position: orNull(r.position),
      joinedAt: orNull(r.joinedAt),
      leftAt: orNull(r.leftAt),
      isActive: r.isActive !== false,
    }];
  });
}

export const patientClubsKey = (patientId: string) => ['patient-clubs', patientId] as const;

export const patientClubsApi = {
  byPatient: async (patientId: string): Promise<PatientClubMembership[]> =>
    readPatientClubs((await client.get(`/api/clubs/by-patient/${encodeURIComponent(patientId)}`)).data),
};
