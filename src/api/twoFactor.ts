import client from './client';

/*
 * Two-factor authentication for the signed-in user's own account.
 *
 * The backend (`UserAccessController`, routes under /api/v1/account/two-factor)
 * has carried the whole TOTP flow — status, begin setup (secret + otpauth URI),
 * confirm with a code (returns recovery codes), and disable — but no screen
 * reached it, so staff could not turn it on. This is the client behind that
 * screen. The login-challenge half lives in `auth.ts`.
 */

/** Some endpoints answer bare, some wrapped in `{ value }`; tolerate both. */
function unwrap<T>(data: unknown): T {
  if (data && typeof data === 'object' && 'value' in data) {
    return (data as { value: T }).value;
  }
  return data as T;
}

export interface TwoFactorStatus {
  enabled: boolean;
  setupPending: boolean;
}

export interface TwoFactorSetup {
  /** The shared secret, for typing into an authenticator app by hand. */
  secret: string;
  /** otpauth://… — what a QR code would encode. */
  otpauthUri: string;
}

export interface TwoFactorEnabled {
  /** Shown once: the codes for the day the phone is not to hand. */
  recoveryCodes: string[];
}

export const twoFactorApi = {
  status: async (): Promise<TwoFactorStatus> => {
    const res = await client.get('/api/v1/account/two-factor');
    return unwrap<TwoFactorStatus>(res.data);
  },

  /** Begins setup; returns the secret to show once. Does not enable yet. */
  beginSetup: async (): Promise<TwoFactorSetup> => {
    const res = await client.post('/api/v1/account/two-factor/setup', {});
    return unwrap<TwoFactorSetup>(res.data);
  },

  /** Confirms the secret with a live code and switches 2FA on; returns recovery codes. */
  confirm: async (code: string): Promise<TwoFactorEnabled> => {
    const res = await client.post('/api/v1/account/two-factor/confirm', { code });
    return unwrap<TwoFactorEnabled>(res.data);
  },

  /** Switches 2FA off; needs a current code to prove it is the owner. */
  disable: async (code: string): Promise<void> => {
    await client.post('/api/v1/account/two-factor/disable', { code });
  },
};

export default twoFactorApi;
