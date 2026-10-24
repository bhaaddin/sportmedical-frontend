/*
 * R15c (g) - the confirmation channel the desk chose (SMS / e-mail link) is remembered per signed-in user in this browser.
 * The safe default is OFF: a missing, unreadable or foreign value is "off". Only two booleans are stored under a key that carries
 * the user id - never a name, phone number or address. Reading and writing never throw (private windows, blocked storage).
 */
export interface ConfirmChannel {
  sms: boolean;
  email: boolean;
}

export const OFF: ConfirmChannel = { sms: false, email: false };
const key = (userId: string): string => `sm.booking.confirmChannel.${userId}`;

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readConfirmChannel(userId: string | null | undefined, storage: Pick<Storage, 'getItem'> | null = safeStorage()): ConfirmChannel {
  if (!userId || !storage) return OFF;
  try {
    const raw = storage.getItem(key(userId));
    if (raw === null) return OFF;
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return OFF;
    const p = parsed as Record<string, unknown>;
    return { sms: p.sms === true, email: p.email === true };
  } catch {
    return OFF;
  }
}

export function saveConfirmChannel(userId: string | null | undefined, value: ConfirmChannel, storage: Pick<Storage, 'setItem' | 'removeItem'> | null = safeStorage()): void {
  if (!userId || !storage) return;
  try {
    if (!value.sms && !value.email) storage.removeItem(key(userId));
    else storage.setItem(key(userId), JSON.stringify({ sms: value.sms, email: value.email }));
  } catch {
    /* storage refused: the choice simply is not remembered */
  }
}

/** The signed-in user's id as the sign-in stored it, or null (nothing stored, unreadable). */
export function storedUserId(): string | null {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem('user');
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    const id = parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>).id : null;
    return typeof id === 'string' && id !== '' ? id : null;
  } catch {
    return null;
  }
}
