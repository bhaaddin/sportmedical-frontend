import client from './client';
import { toBookingError } from './apiError';

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

/**
 * A refusal reaches the screen as a BookingApiError, so the server's own sentence ("Kód není správný.",
 * "Nejdřív začněte nastavení…") is shown. Raw axios errors made `errorText` fall back to the fixed
 * "server error" line for every wrong code.
 */
async function request<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toBookingError(error);
  }
}

export const twoFactorApi = {
  status: (): Promise<TwoFactorStatus> =>
    request(async () => {
      const res = await client.get('/api/v1/account/two-factor');
      return unwrap<TwoFactorStatus>(res.data);
    }),

  /** Begins setup; returns the secret to show once. Does not enable yet. */
  beginSetup: (): Promise<TwoFactorSetup> =>
    request(async () => {
      const res = await client.post('/api/v1/account/two-factor/setup', {});
      return unwrap<TwoFactorSetup>(res.data);
    }),

  /** Confirms the secret with a live code and switches 2FA on; returns recovery codes. */
  confirm: (code: string): Promise<TwoFactorEnabled> =>
    request(async () => {
      const res = await client.post('/api/v1/account/two-factor/confirm', { code });
      return unwrap<TwoFactorEnabled>(res.data);
    }),

  /** Switches 2FA off; needs a current code to prove it is the owner. */
  disable: (code: string): Promise<void> =>
    request(async () => {
      await client.post('/api/v1/account/two-factor/disable', { code });
    }),
};

export default twoFactorApi;
