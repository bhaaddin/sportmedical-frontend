import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * Deliberately NOT the shared `client`, for the same reason as publicBooking:
 * that one attaches a bearer token and sends a 401 to the staff login screen.
 * Somebody opening their own booking link has no account and must never be
 * bounced to a login page — which is exactly what happened to this link until
 * 19. 9. 2026, when it pointed at a route that did not exist.
 */
const publicClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * What a patient may see about their own booking.
 *
 * The činnost, the služba and the time. Not the worker, not the room, not who
 * else is in the calendar — holding a manage token proves somebody has one
 * appointment, not that they may look at the clinic's day.
 */
export interface ManagedBooking {
  appointmentId: string;
  serviceName: string;
  activityName: string;
  startUtc: string;
  endUtc: string;
  isCancelled: boolean;
  /** Which calendar and činnost — what the free-times request needs. */
  calendarId?: string | null;
  activityId?: string | null;
  /**
   * The last moment the patient may still move or cancel online, or null once
   * the booking is cancelled. The clinic's own deadline, from its settings.
   */
  canChangeUntilUtc?: string | null;
  /** The same deadline as a number of hours, for the sentence that explains it. */
  changeDeadlineHours?: number;
}

interface ApiResult<T> {
  success: boolean;
  message: string;
  data: T;
}

/** Why a booking could not be read, moved or cancelled, in words the patient sees. */
export class ManageError extends Error {
  /** True when the appointment is too close to change online. */
  readonly tooLate: boolean;

  /** True when there is no such booking — including one already cancelled. */
  readonly notFound: boolean;

  /** True when the chosen time was taken by somebody else a moment ago. */
  readonly slotGone: boolean;

  constructor(message: string, { tooLate = false, notFound = false, slotGone = false } = {}) {
    super(message);
    this.name = 'ManageError';
    this.tooLate = tooLate;
    this.notFound = notFound;
    this.slotGone = slotGone;
  }
}

/**
 * Whether the patient may still change the booking themselves, right now.
 *
 * Pure so it can be tested against a fixed clock. A missing deadline means the
 * server did not say — an older server — and then the buttons stay, because
 * the server refuses a late change itself with a sentence of its own.
 */
export const canStillChange = (booking: ManagedBooking, now: Date = new Date()): boolean => {
  if (booking.isCancelled) return false;
  if (booking.canChangeUntilUtc === undefined || booking.canChangeUntilUtc === null) return true;
  const until = new Date(booking.canChangeUntilUtc).getTime();
  return Number.isNaN(until) ? true : now.getTime() <= until;
};

const complain = (error: unknown, fallback: string): ManageError => {
  if (axios.isAxiosError(error)) {
    const said = (error.response?.data as ApiResult<unknown> | undefined)?.message;

    if (error.response?.status === 404) {
      return new ManageError(said ?? 'Tuto rezervaci se nepodařilo najít.', { notFound: true });
    }

    if (error.response?.status === 409) {
      return new ManageError(said ?? 'Tento čas byl právě obsazen. Vyberte prosím jiný.', { slotGone: true });
    }

    if (error.response?.status === 422) {
      /* 422 is the server saying "not this, not now": too late, a time no longer
         offered, or a closed booking. The sentence is the server's; `tooLate`
         is set only when it actually says so, so the page does not hide the
         buttons for a slot that merely stopped being free. */
      const late = (said ?? '').includes('pozdě');
      return new ManageError(said ?? fallback, { tooLate: late, slotGone: !late });
    }

    if (said !== undefined && said !== '') {
      return new ManageError(said);
    }
  }

  return new ManageError(fallback);
};

/** The booking behind a manage link. */
export const readBooking = async (token: string): Promise<ManagedBooking> => {
  try {
    const { data } = await publicClient.get<ApiResult<ManagedBooking>>(
      `/api/public/booking/manage/${encodeURIComponent(token)}`,
    );

    return data.data;
  } catch (error) {
    throw complain(error, 'Rezervaci se nepodařilo načíst. Zkuste to prosím za chvíli znovu.');
  }
};

/**
 * Cancels it, and gives the time back to whoever wants it next.
 *
 * Refused too close to the appointment — how close is the clinic's own setting
 * per calendar, so the server's sentence is the one shown rather than a number
 * repeated here.
 */
export const cancelBooking = async (token: string): Promise<ManagedBooking> => {
  try {
    const { data } = await publicClient.post<ApiResult<ManagedBooking>>(
      `/api/public/booking/manage/${encodeURIComponent(token)}/cancel`,
    );

    return data.data;
  } catch (error) {
    throw complain(error, 'Termín se nepodařilo zrušit. Zkuste to prosím znovu.');
  }
};

/**
 * Moves the booking to another free time the clinic offers online.
 *
 * Only a time the public page would show — the server asks the same
 * availability rule — and only while the appointment is at least the clinic's
 * deadline away. The old time is given back in the same transaction that takes
 * the new one, and the desk is told it was the patient.
 */
export const rescheduleBooking = async (
  token: string,
  startUtc: string,
): Promise<ManagedBooking> => {
  try {
    const { data } = await publicClient.post<ApiResult<ManagedBooking>>(
      `/api/public/booking/manage/${encodeURIComponent(token)}/reschedule`,
      { startUtc },
    );

    return data.data;
  } catch (error) {
    throw complain(error, 'Termín se nepodařilo přesunout. Zkuste to prosím znovu.');
  }
};

/**
 * Where the calendar file lives.
 *
 * A plain link rather than a fetch: the browser downloads it and hands it to
 * whatever the patient uses for a calendar, which is the entire point. Fetching
 * it into memory only to hand it back to the browser would add a failure mode
 * and remove nothing.
 */
export const calendarFileUrl = (token: string): string =>
  `${API_BASE}/api/public/booking/manage/${encodeURIComponent(token)}/calendar.ics`;
