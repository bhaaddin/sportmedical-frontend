/*
 * What the header strip shows when no club is being planned ("clinic" mode): the clinic's own
 * company data, from the settings the owner already keeps.
 *
 *   Identifikační údaje  company name, IČO, DIČ, address      <- GET /api/v1/settings/company
 *   Vedení               the account with the Owner role      <- GET /api/v1/users
 *   Kontaktní osoba      the clinic's e-mail and telephone    <- company settings
 *
 * Nothing is invented: a value the settings do not hold stays empty and the strip prints its
 * "Doplnit" placeholder. Both reads are permission gated in the application (company settings:
 * `settings.clinic.manage`, accounts: `users.manage`); a person without the permission is not
 * asked, and sees the placeholders and the clinic's name from the planner catalogue.
 */
import { useQuery } from '@tanstack/react-query';
import { COMPANY_SETTINGS_QUERY_KEY, companySettingsApi } from '../../../../api/companySettings';
import { userAccountsApi } from '../../../../api/userAccounts';
import { usePermission } from '../../../../auth/usePermission';
import type { ClubProfile } from '../../../model';

export const COMPANY_SETTINGS_PATH = '/nastaveni/firma-a-faktury';
export const SETTINGS_PATH = '/settings';

export interface ClinicHeaderProfile {
  profile: ClubProfile;
  /** Where "Nastavení společnosti" leads: the company page when the person may open it. */
  settingsPath: string;
  canEditCompany: boolean;
}

const addressOf = (street: string, postalCode: string, city: string): string => {
  const town = [postalCode, city].map((p) => p.trim()).filter(Boolean).join(' ');
  return [street.trim(), town].filter(Boolean).join(', ');
};

/** `enabled: false` (club mode) reads nothing; the profile then only carries the catalogue's clinic name. */
export function useClinicHeaderProfile(clinicName: string, enabled = true): ClinicHeaderProfile {
  const canEditCompany = usePermission('settings.clinic.manage');
  const canSeeAccounts = usePermission('users.manage');

  const company = useQuery({
    queryKey: COMPANY_SETTINGS_QUERY_KEY,
    queryFn: companySettingsApi.get,
    enabled: enabled && canEditCompany,
    retry: false,
    staleTime: 60_000,
  });
  const accounts = useQuery({
    queryKey: ['planner', 'header', 'accounts'],
    queryFn: userAccountsApi.list,
    enabled: enabled && canSeeAccounts,
    retry: false,
    staleTime: 60_000,
  });

  const c = company.data;
  const owner = accounts.data?.find((a) => a.role === 'Owner' && a.isActive);
  const profile: ClubProfile = {
    clubName: (c?.legalName ?? '').trim() || clinicName,
    ico: c?.ico ?? '',
    dic: c?.dic ?? '',
    address: c ? addressOf(c.address, c.postalCode, c.city) : '',
    leaderName: owner?.displayName ?? '',
    leaderEmail: owner?.email ?? '',
    leaderPhone: '',
    contactName: '',
    contactEmail: c?.email ?? '',
    contactPhone: c?.phone ?? '',
    logoUrl: null,
  };
  return { profile, settingsPath: canEditCompany ? COMPANY_SETTINGS_PATH : SETTINGS_PATH, canEditCompany };
}
