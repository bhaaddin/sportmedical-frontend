import { client } from './client';

/**
 * An employee, as the application knows one: a login account.
 *
 * There used to be a second record, a "staff member" with a free-text role,
 * phone and department, paired with the account by e-mail. Nothing read it,
 * and archiving it left the login working. The account is the employee now:
 * its role, its per-employee permissions (`userPermissions.ts`), its rota and
 * whether it may sign in at all.
 */
export interface UserAccount {
  userId: string;
  email: string;
  displayName: string;
  role: UserAccountRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAtUtc: string;
  lastLoginAtUtc: string | null;
}

/** The three roles the server has. */
export type UserAccountRole = 'Owner' | 'Administrator' | 'Staff';

export const USER_ACCOUNT_ROLES: readonly UserAccountRole[] = ['Owner', 'Administrator', 'Staff'];

export const ROLE_LABELS: Record<UserAccountRole, string> = {
  Owner: 'Vlastník',
  Administrator: 'Administrátor',
  Staff: 'Personál',
};

/** A new account, or a reset one, with the one-time password to hand over. */
export interface IssuedCredentials {
  account: UserAccount;
  temporaryPassword: string;
}

export const userAccountsApi = {
  list: async (): Promise<UserAccount[]> => {
    const { data } = await client.get<UserAccount[]>('/api/v1/users');
    return Array.isArray(data) ? data : [];
  },

  create: async (request: {
    email: string;
    displayName: string;
    role: UserAccountRole;
  }): Promise<IssuedCredentials> => {
    const { data } = await client.post<IssuedCredentials>('/api/v1/users', request);
    return data;
  },

  resetPassword: async (userId: string): Promise<IssuedCredentials> => {
    const { data } = await client.post<IssuedCredentials>(`/api/v1/users/${userId}/reset-password`);
    return data;
  },

  /**
   * Switching the login off. The server also ends every session the account
   * has open, so a dismissed employee is signed out, not just kept out.
   */
  setActive: async (userId: string, isActive: boolean): Promise<UserAccount> => {
    const { data } = await client.put<UserAccount>(`/api/v1/users/${userId}/active`, { isActive });
    return data;
  },

  assignRole: async (userId: string, role: UserAccountRole): Promise<UserAccount> => {
    const { data } = await client.put<UserAccount>(`/api/v1/users/${userId}/role`, { role });
    return data;
  },
};

/** What the server's refusal code means, in words for the person at the screen. */
export function accountRefusal(error: unknown): string {
  const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
  switch (code) {
    case 'account.last_owner_protected':
      return 'Posledního aktivního vlastníka nejde vypnout ani mu vzít roli.';
    case 'account.email_already_exists':
      return 'Účet s tímto e-mailem už existuje.';
    case 'account.email_invalid':
      return 'E-mail není ve správném tvaru.';
    case 'account.display_name_invalid':
      return 'Vyplňte jméno a příjmení.';
    case 'account.not_found':
      return 'Tenhle účet už neexistuje. Obnovte seznam.';
    case 'access.denied':
      return 'Na tohle nemáte oprávnění.';
    default:
      return 'Požadavek se nepodařilo provést.';
  }
}
