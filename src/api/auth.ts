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
 * The password was right but the account also asks for a one-time code. No
 * session exists yet; the browser keeps `challengeToken` for the second call.
 */
export interface SecondFactorChallenge {
  secondFactorRequired: true;
  challengeToken: string;
  expiresAtUtc: string;
}

export type LoginResult = LoginResponse | SecondFactorChallenge;

export function isSecondFactorChallenge(result: LoginResult): result is SecondFactorChallenge {
  return (result as SecondFactorChallenge).secondFactorRequired === true;
}

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResult> => {
    const res = await client.post('/api/v1/session', { email, password });
    return res.data?.value ?? res.data;
  },

  /** Second step of a sign-in with 2FA on: the challenge token and the code. */
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
};
