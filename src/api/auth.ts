import client from './client';

export interface LoginResponse {
  accessToken: string;
  expiresAtUtc: string;
  account: {
    userId: string;
    email: string;
    displayName: string;
    role: string;
    isActive: boolean;
    mustChangePassword: boolean;
    createdAtUtc: string;
    lastLoginAtUtc: string | null;
  };
  permissions: string[];
}

/**
 * The password was right and the account also asks for a code from the
 * authenticator app. No session yet: the challenge token is what the second
 * call carries, and it lives five minutes.
 */
export interface SecondFactorChallenge {
  secondFactorRequired: true;
  challengeToken: string;
  expiresAtUtc: string;
}

export type SignInOutcome = LoginResponse | SecondFactorChallenge;

export function needsSecondFactor(outcome: SignInOutcome): outcome is SecondFactorChallenge {
  return (outcome as SecondFactorChallenge).secondFactorRequired === true;
}

export interface TwoFactorStatus {
  enabled: boolean;
  /** A secret was issued and never confirmed - it protects nothing yet. */
  setupPending: boolean;
}

/** Shown once: the secret for typing by hand and the URI the QR code is drawn from. */
export interface TwoFactorSetup {
  secret: string;
  otpauthUri: string;
}

export const authApi = {
  login: async (email: string, password: string): Promise<SignInOutcome> => {
    const res = await client.post('/api/v1/session', { email, password });
    return res.data?.value ?? res.data;
  },

  /** Step two of a sign-in: the challenge from `login` and the code the phone shows. */
  completeSecondFactor: async (challengeToken: string, code: string): Promise<LoginResponse> => {
    const res = await client.post('/api/v1/session/second-factor', { challengeToken, code });
    return res.data?.value ?? res.data;
  },

  logout: async (): Promise<void> => {
    await client.delete('/api/v1/session');
  },

  activate: async (data: { email: string; temporaryPassword: string; newPassword: string; newPasswordConfirmation: string }): Promise<void> => {
    await client.post('/api/v1/accounts/activate', data);
  },

  twoFactorStatus: async (): Promise<TwoFactorStatus> => {
    const { data } = await client.get<TwoFactorStatus>('/api/v1/account/two-factor');
    return data;
  },

  beginTwoFactorSetup: async (): Promise<TwoFactorSetup> => {
    const { data } = await client.post<TwoFactorSetup>('/api/v1/account/two-factor/setup');
    return data;
  },

  /** Confirms with a code from the app. Answers the recovery codes, shown once. */
  confirmTwoFactor: async (code: string): Promise<string[]> => {
    const { data } = await client.post<{ recoveryCodes: string[] }>('/api/v1/account/two-factor/confirm', { code });
    return data.recoveryCodes;
  },

  /** Needs a current code, so a stolen session cannot switch it off. */
  disableTwoFactor: async (code: string): Promise<void> => {
    await client.post('/api/v1/account/two-factor/disable', { code });
  },
};

/** What a second-factor refusal means, in words for the person at the screen. */
export function twoFactorRefusal(error: unknown): string {
  const data = (error as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
  switch (data?.code) {
    case 'two_factor.code_invalid':
      return 'Kód nesouhlasí. Zadejte aktuální kód z ověřovací aplikace, nebo jeden ze záložních kódů.';
    case 'two_factor.challenge_expired':
      return 'Ověření vypršelo nebo bylo příliš mnoho pokusů. Zadejte znovu heslo.';
    case 'two_factor.already_enabled':
      return 'Dvoufázové ověření už je zapnuté.';
    case 'two_factor.not_enabled':
      return 'Dvoufázové ověření není zapnuté.';
    case 'two_factor.setup_not_started':
      return 'Nejdřív začněte nastavení a načtěte QR kód.';
    default:
      return data?.message || 'Požadavek se nepodařilo provést.';
  }
}
