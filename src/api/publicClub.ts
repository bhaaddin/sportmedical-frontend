import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * The club self-registration link an athlete follows at `/klub/:token`.
 *
 * Deliberately NOT the shared `client`: that one attaches a staff bearer token
 * and bounces a 401 to the login screen. An athlete following a club link has no
 * account and must never be sent to a staff login.
 */
const publicClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

interface ApiResult<T> {
  success: boolean;
  message: string;
  data: T;
}

/** One činnost the club ordered, as the athlete picks from. */
export interface ClubActivity {
  activityId: string;
  activityName: string;
  durationMinutes: number;
}

/** A day the clinic held for the club, and how many athletes still fit in it. */
export interface ClubWindow {
  date: string;
  startTime: string;
  endTime: string;
  places: number;
}

/** One free time inside the club's block, when the server offers a choice of them. */
export interface ClubSlot {
  startUtc: string;
  endUtc: string;
  /** False when a team-mate already took it. */
  free: boolean;
}

/** What the club link resolves to: nothing sensitive, no token, no contacts. */
export interface ClubOffer {
  partnerName: string;
  calendarId: string;
  activities: ClubActivity[];
  windows: ClubWindow[];
  remaining: number;
  /*
   * Etapa 2 (contract C4, ClubBlockView): all optional — an older server omits
   * them and the page then shows only what it has.
   */
  /** The club's colour (#RRGGBB), stable per club. */
  colorHex?: string | null;
  /** How many places the block holds and how many are taken (registered / seats). */
  seats?: number | null;
  registered?: number | null;
  /** The block's period, yyyy-MM-dd. */
  fromDate?: string | null;
  toDate?: string | null;
  /** Until when the link takes registrations. */
  expiresAtUtc?: string | null;
  /** The clinic's switch: ask the athlete for a date of birth. */
  requireDateOfBirth?: boolean | null;
  /** The block's free times, when the athlete may choose one; otherwise the server assigns it. */
  slots?: ClubSlot[] | null;
}

/** The slot an athlete's claim got. */
export interface ClubClaim {
  failure: string;
  startUtc: string | null;
  endUtc: string | null;
  manageToken: string | null;
}

/** A dead, revoked or expired link, told apart from a network failure. */
export class ClubLinkDeadError extends Error {}

/**
 * The link an athlete follows for one club order, as the staff screen shows and
 * copies it: this app's own origin and the `/klub/:token` route above. One
 * place, so the clubs page and anything that e-mails the link agree on it.
 */
export const clubRegistrationLink = (token: string, origin: string = window.location.origin): string =>
  `${origin.replace(/\/+$/, '')}/klub/${encodeURIComponent(token)}`;

/**
 * What the club link offers. `null` is never returned: a dead link throws
 * {@link ClubLinkDeadError} so the page can say "the link is not live" rather
 * than show an empty offer that looks like a club with nothing to book.
 */
export const getClubOffer = async (token: string): Promise<ClubOffer> => {
  try {
    const { data } = await publicClient.get<ApiResult<ClubOffer>>(
      `/api/public/club/${encodeURIComponent(token)}`,
    );
    return data.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new ClubLinkDeadError(
        (error.response.data as ApiResult<unknown> | undefined)?.message ??
          'Odkaz není platný nebo vypršel.',
      );
    }
    throw error;
  }
};

export interface ClaimInput {
  activityId: string;
  name: string;
  phone?: string;
  note?: string;
  email?: string;
  /** yyyy-MM-dd; sent only when the clinic asks for it. */
  dateOfBirth?: string;
  /** The free time the athlete chose, when the offer lists times to choose from. */
  startUtc?: string;
}

/**
 * Claims a slot for the athlete. The server generates the exact time inside the
 * club's held days. A refusal (full, no free time, taken) comes back as an
 * `Error` with the server's own Czech message, so the page shows it plainly.
 */
export const claimClubSlot = async (token: string, input: ClaimInput): Promise<ClubClaim> => {
  try {
    const { data } = await publicClient.post<ApiResult<ClubClaim>>(
      `/api/public/club/${encodeURIComponent(token)}/claim`,
      input,
    );
    return data.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const message =
        (error.response.data as ApiResult<unknown> | undefined)?.message ??
        'Rezervaci se nepodařilo dokončit.';
      throw new Error(message);
    }
    throw error;
  }
};
