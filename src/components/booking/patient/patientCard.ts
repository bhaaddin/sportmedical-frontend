import { useQuery } from '@tanstack/react-query';
import { patientsApi } from '../../../api/patients';
import { toBookingError } from '../../../api/apiError';

/**
 * What the dialog shows about a patient beyond the name: the contacts, the
 * insurer and the address, plus the two identifiers that tell namesakes apart.
 *
 * Read from `GET /api/patients/{id}/profile`, which takes them from the
 * registry. The birth number and the insurance number come back null to anyone
 * without `patients.sensitive_identity.view` - the server decides that. The
 * screen does not show those two rows at all to such a person either (contract
 * 6.7), so a server that one day sent them anyway would still not put them on
 * a receptionist's screen.
 */
export interface PatientCardData {
  phone: string | null;
  email: string | null;
  insuranceNumber: string | null;
  birthNumber: string | null;
  insurerCode: string | null;
  address: string | null;
}

export function readPatientCard(profile: unknown): PatientCardData {
  const r = (profile ?? {}) as Record<string, unknown>;
  const str = (key: string): string | null =>
    typeof r[key] === 'string' && (r[key] as string).trim() !== '' ? (r[key] as string).trim() : null;
  return {
    phone: str('phone'),
    email: str('email'),
    insuranceNumber: str('insuranceNumber'),
    birthNumber: str('birthNumber'),
    insurerCode: str('healthInsurerCode'),
    address: str('address'),
  };
}

export interface CardRow {
  label: string;
  value: string | null;
}

/** The rows of the small card next to a namesake, in the order the owner listed them. */
export function cardRows(card: PatientCardData, maySeeSensitive: boolean): CardRow[] {
  const rows: CardRow[] = [
    { label: 'Telefon', value: card.phone },
    { label: 'E-mail', value: card.email },
  ];
  if (maySeeSensitive) {
    rows.push(
      { label: 'Číslo pojištěnce', value: card.insuranceNumber },
      { label: 'Rodné číslo', value: card.birthNumber },
    );
  }
  return rows;
}

/** The profile of one patient, fetched only while something shows it. */
export function usePatientCard(patientId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['patient-card', patientId],
    queryFn: async () => {
      try {
        return readPatientCard(await patientsApi.getProfile(patientId ?? ''));
      } catch (error) {
        throw toBookingError(error);
      }
    },
    enabled: enabled && patientId !== null,
    staleTime: 60_000,
  });
}
