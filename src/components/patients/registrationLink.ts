/*
 * The completion link's status, as data with no component around it: the
 * query the card and the booking detail share, and the chip they both draw.
 * Kept out of the panel file so fast refresh keeps working there.
 */
import { useQuery } from '@tanstack/react-query';
import { REGISTRATION_LINK_QUERY_KEY, preRegistrationApi } from '../../api/preRegistration';
import type { RegistrationLinkStatus } from '../../api/preRegistration';

export const PRE_REGISTRATION_CHIP = 'Předregistrace';

/**
 * Where the registration stands, as a chip the card and the booking detail
 * can show. Null when there is nothing to say.
 *
 * "Předregistrace" is the registry's word, not the link's: a patient with no
 * address or insurance on file is pre-registered whether a link was issued
 * (pending), ran out (expired) or was never issued at all (none — the quick
 * path created the patient and the dialog was closed, or the issue failed).
 * Once the registry is complete the server answers `none` with
 * `registrationIncomplete: false`, and the chip goes.
 */
export function registrationChip(status: RegistrationLinkStatus | undefined): { label: string; color: 'warning' | 'error' } | null {
  if (status === undefined) return null;
  if (status.state === 'pending') return { label: PRE_REGISTRATION_CHIP, color: 'warning' };
  if (status.state === 'expired') return { label: `${PRE_REGISTRATION_CHIP} — odkaz vypršel`, color: 'error' };
  if (status.state === 'none' && status.registrationIncomplete) return { label: `${PRE_REGISTRATION_CHIP} — bez odkazu`, color: 'warning' };
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

