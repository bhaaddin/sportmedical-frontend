import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * Deliberately NOT the shared `client`: that one attaches a bearer token and
 * sends a 401 to the staff login screen. Somebody booking an appointment has no
 * token and must never be bounced to a login page.
 */
const publicClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/** One činnost a stranger may book. */
export interface BookableActivity {
  id: string;
  name: string;
  durationMinutes: number;
  /** The clinic's own text about this one. Empty when they have not written any. */
  publicNote: string;
  /** Which calendar runs it — needed to ask for times. */
  calendarId: string;
  /**
   * Which optional consents this činnost will not be booked without. The
   * clinic's setting, per činnost.
   *
   * Consent to the examination itself is not here: it is required by law for
   * everything. Nor is marketing — consent that must be given to get an
   * appointment is not freely given.
   */
  requiresReportByEmail: boolean;
  requiresClubSharing: boolean;
}

export interface BookableService {
  id: string;
  name: string;
  description: string;
  activities: BookableActivity[];
}

/** A free time. Two instants and nothing else — see the controller. */
export interface BookableSlot {
  startUtc: string;
  endUtc: string;
}

export interface HeldSlot {
  token: string;
  startUtc: string;
  endUtc: string;
  expiresAtUtc: string;
}

interface ApiResult<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * What the clinic offers, read from the admin's own calendars.
 *
 * Empty is a real answer: nothing marked publicly bookable means the clinic is
 * not taking online bookings, and the page says so rather than showing a
 * spinner for ever.
 */
export const bookableOffer = async (): Promise<BookableService[]> => {
  const { data } = await publicClient.get<ApiResult<BookableService[]>>(
    '/api/public/booking/offer',
  );

  return data.data ?? [];
};

/** Which days between two dates have at least one free time. */
export const freeDays = async (
  calendarId: string,
  activityId: string,
  from: string,
  to: string,
): Promise<string[]> => {
  const { data } = await publicClient.get<ApiResult<string[]>>('/api/public/booking/days', {
    params: { calendarId, activityId, from, to },
  });

  return data.data ?? [];
};

/** The free times on one day. */
export const freeSlots = async (
  calendarId: string,
  activityId: string,
  date: string,
): Promise<BookableSlot[]> => {
  const { data } = await publicClient.get<ApiResult<BookableSlot[]>>('/api/public/booking/slots', {
    params: { calendarId, activityId, date },
  });

  return data.data ?? [];
};

/** Why a slot could not be held, in the words the patient sees. */
export class SlotGoneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlotGoneError';
  }
}

/**
 * Keeps a slot while the patient registers.
 *
 * The time is genuinely taken from this moment — the hold is a row under the
 * same constraint that stops two appointments colliding — and it lapses by
 * itself if the registration is abandoned.
 *
 * 409 and 422 both mean somebody else got there first, or the time stopped
 * being offered while it was being chosen. They are one error here because the
 * patient does the same thing about either: pick another time.
 */
export const holdSlot = async (
  calendarId: string,
  activityId: string,
  startUtc: string,
): Promise<HeldSlot> => {
  try {
    const { data } = await publicClient.post<ApiResult<HeldSlot>>('/api/public/booking/hold', {
      calendarId,
      activityId,
      startUtc,
    });

    return data.data;
  } catch (error) {
    if (axios.isAxiosError(error) && (error.response?.status === 409 || error.response?.status === 422)) {
      throw new SlotGoneError(
        (error.response.data as ApiResult<unknown> | undefined)?.message
        ?? 'Tento termín byl právě obsazen.',
      );
    }

    throw error;
  }
};

/**
 * Gives a held slot back.
 *
 * Never throws: the caller is abandoning the slot, and a failure to say so is
 * not worth interrupting them for — the hold lapses by itself in fifteen
 * minutes either way.
 */
export const releaseSlot = async (token: string): Promise<void> => {
  try {
    await publicClient.delete(`/api/public/booking/hold/${encodeURIComponent(token)}`);
  } catch {
    /* Deliberately silent. See above. */
  }
};

/* ── The slot being carried from the booking page to the registration ── */

const HELD_KEY = 'smd.booking.held.v1';

/** What the registration page needs to know about the slot it is finishing. */
export interface HeldBooking {
  token: string;
  startUtc: string;
  endUtc: string;
  expiresAtUtc: string;
  serviceName: string;
  activityName: string;
  activityId: string;
  calendarId: string;
  /** Carried to the registration so it knows which consents it must insist on. */
  requiresReportByEmail: boolean;
  requiresClubSharing: boolean;
}

/**
 * The booking page holds a slot and the registration page finishes it, and they
 * are two screens. This is how the slot crosses between them.
 *
 * `sessionStorage` rather than `localStorage`: a held slot belongs to the tab
 * that is booking it and lasts fifteen minutes. Finding yesterday's abandoned
 * hold in a new window and being told a time is waiting would be a lie, and
 * reading it out of a URL would let one person hand another their hold.
 */
export const rememberHeld = (booking: HeldBooking): void => {
  try {
    window.sessionStorage.setItem(HELD_KEY, JSON.stringify(booking));
  } catch {
    /* Private window, or storage refused. The registration still works; it
       simply will not know a slot is waiting, which is the honest fallback. */
  }
};

export const readHeld = (): HeldBooking | null => {
  try {
    const raw = window.sessionStorage.getItem(HELD_KEY);
    if (raw === null) return null;

    const held = JSON.parse(raw) as HeldBooking;

    // A hold that has run out is not a hold. Saying so here keeps every screen
    // from having to check the clock for itself.
    return new Date(held.expiresAtUtc).getTime() > Date.now() ? held : null;
  } catch {
    return null;
  }
};

export const forgetHeld = (): void => {
  try {
    window.sessionStorage.removeItem(HELD_KEY);
  } catch {
    /* Nothing to do, and nothing worth telling anybody. */
  }
};
