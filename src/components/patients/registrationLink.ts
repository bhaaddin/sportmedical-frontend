/*
 * The completion link's status, as data with no component around it: the
 * query the card and the booking detail share, and the chip they both draw.
 * Kept out of the panel file so fast refresh keeps working there.
 */
import { useQuery } from '@tanstack/react-query';
import { REGISTRATION_LINK_QUERY_KEY, preRegistrationApi } from '../../api/preRegistration';
import type { RegistrationLinkStatus } from '../../api/preRegistration';

export const PRE_REGISTRATION_CHIP = 'Předregistrace';

/** Where the link stands, as a chip the card and the booking detail can show. Null when there is nothing to say. */
export function registrationChip(status: RegistrationLinkStatus | undefined): { label: string; color: 'warning' | 'error' } | null {
  if (status === undefined) return null;
  if (status.state === 'pending') return { label: PRE_REGISTRATION_CHIP, color: 'warning' };
  if (status.state === 'expired') return { label: `${PRE_REGISTRATION_CHIP} — odkaz vypršel`, color: 'error' };
  return null;
}

/** The link's status for one patient, shared by the card and the booking detail. */
export function useRegistrationLink(patientId: string | null | undefined) {
  return useQuery({
    queryKey: REGISTRATION_LINK_QUERY_KEY(patientId ?? ''),
    queryFn: () => preRegistrationApi.linkStatus(patientId ?? ''),
    enabled: patientId !== null && patientId !== undefined && patientId !== '',
    staleTime: 30_000,
  });
}

