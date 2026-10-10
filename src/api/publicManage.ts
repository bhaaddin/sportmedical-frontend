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
  /** Which calendar + činnost this booking is for — needed to fetch new times. */
  calendarId: string | null;
  activityId: string | null;
  /** Until when the patient may still move/cancel it online (clinic setting). */
  canChangeUntilUtc: string | null;
  /**
   * Etapa 12: the price, when the server sends it - the agreed figure, or the
   * list price. Optional because the manage route did not carry money before;
   * the page falls back to the public offer's price for the činnost.
   */
  agreedPriceCzk?: number | null;
  listPriceCzk?: number | null;
}

interface ApiResult<T> {
  success: boolean;
  message: string;
  data: T;
}

/** Why a booking could not be read or cancelled, in words the patient sees. */
export class ManageError extends Error {
  /** True when the appointment is too close to cancel online. */
  readonly tooLate: boolean;

  /** True when there is no such booking — including one already cancelled. */
  readonly notFound: boolean;

  constructor(message: string, { tooLate = false, notFound = false } = {}) {
    super(message);
    this.name = 'ManageError';
    this.tooLate = tooLate;
    this.notFound = notFound;
  }
}

const complain = (error: unknown, fallback: string): ManageError => {
  if (axios.isAxiosError(error)) {
    const said = (error.response?.data as ApiResult<unknown> | undefined)?.message;

    if (error.response?.status === 404) {
      return new ManageError(said ?? 'Tuto rezervaci se nepodařilo najít.', { notFound: true });
    }

    if (error.response?.status === 422) {
      return new ManageError(said ?? fallback, { tooLate: true });
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
 * Moves the booking to a new time (same činnost), and frees the old one.
 *
 * The server re-checks availability, the notice window and double-booking at the
 * moment of the move — so a time that was free when it was shown but taken since
 * is refused here, not silently overwritten. Refused too close to the
 * appointment the same way cancel is; the server's sentence is the one shown.
 */
export const rescheduleBooking = async (
  token: string,
  startUtc: string,
  activityId: string | null,
): Promise<ManagedBooking> => {
  try {
    const { data } = await publicClient.post<ApiResult<ManagedBooking>>(
      `/api/public/booking/manage/${encodeURIComponent(token)}/reschedule`,
      { startUtc, activityId },
    );

    return data.data;
  } catch (error) {
    throw complain(error, 'Termín se nepodařilo přesunout. Vyberte prosím jiný čas.');
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
