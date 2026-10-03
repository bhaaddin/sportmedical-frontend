/*
 * Kluby a týmy - the arithmetic behind the cards and the club detail
 * (design board 3. 10. 2026, screens 16 and 17).
 *
 * Everything on those two screens is derived from four things the API already
 * answers: the payers (`/api/clubs`) with the discount the administrator gave
 * each one, the partner orders of each calendar (4.7) and the price list
 * through the activities. Nothing here keeps a number of its own: the counts
 * are the server's, the discount is the club's own, and the total is seats ×
 * price with that discount taken off.
 *
 * Pure functions, so the screen test can stay short and this file's test can
 * say exactly which band a headcount lands in.
 */
import type { Club } from '../../api/clubs';
import type { PartnerOrderDetail } from '../../api/partnerOrders';
import type { DayAppointment, PartnerWindow } from '../../api/bookingContracts';
import { pragueDateKey, PRAGUE_TZ, type DateOnly } from '../../utils/time';
import { planSchedule } from '../../components/booking/ClubScheduleReport';

/* ── Money and dates, the board's way ── */

/** "2 200 Kč" - the board writes money with a thin space and no decimals. */
export function formatCzk(amount: number): string {
  return `${Math.round(amount).toLocaleString('cs-CZ')} Kč`;
}

/** Month names in the genitive, as a date is read out: "26. října 2026". */
const MONTHS_GENITIVE = [
  'ledna', 'února', 'března', 'dubna', 'května', 'června',
  'července', 'srpna', 'září', 'října', 'listopadu', 'prosince',
];

const WEEKDAYS_SHORT = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

function splitDate(date: DateOnly): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
}

/** "26. října 2026". Empty for anything that is not a date. */
export function formatLongDate(date: DateOnly | null | undefined): string {
  if (typeof date !== 'string') return '';
  const [y, m, d] = splitDate(date);
  if (!y || !m || !d) return '';
  return `${d}. ${MONTHS_GENITIVE[m - 1] ?? m} ${y}`;
}

/**
 * The board's header line: "26.—27. října 2026". Two dates in one month share
 * the month, two months share the year, two years spell everything out.
 */
export function formatDateRange(from: DateOnly, to: DateOnly): string {
  if (from === to) return formatLongDate(from);
  const [fy, fm, fd] = splitDate(from);
  const [ty, tm, td] = splitDate(to);
  if (fy === ty && fm === tm) return `${fd}.—${td}. ${MONTHS_GENITIVE[fm - 1]} ${fy}`;
  if (fy === ty) return `${fd}. ${MONTHS_GENITIVE[fm - 1]} — ${td}. ${MONTHS_GENITIVE[tm - 1]} ${fy}`;
  return `${formatLongDate(from)} — ${formatLongDate(to)}`;
}

/** "26.—27. 10. 2026" - the shorter form the OBJEDNÁVKA rail uses. */
export function formatShortRange(from: DateOnly, to: DateOnly): string {
  const [fy, fm, fd] = splitDate(from);
  const [ty, tm, td] = splitDate(to);
  if (from === to) return `${fd}. ${fm}. ${fy}`;
  if (fy === ty && fm === tm) return `${fd}.—${td}. ${fm}. ${fy}`;
  return `${fd}. ${fm}. ${fy} — ${td}. ${tm}. ${ty}`;
}

/** "Po 26. 10." for a date-only value. */
export function formatWeekdayDate(date: DateOnly): string {
  const [y, m, d] = splitDate(date);
  const weekday = WEEKDAYS_SHORT[new Date(y, m - 1, d).getDay()];
  return `${weekday} ${d}. ${m}.`;
}

const hhmmFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: PRAGUE_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "08:30" - a UTC instant as a zero-padded Prague wall-clock time. */
export function pragueHHMM(instant: Date | string): string {
  const text = hhmmFormatter.format(typeof instant === 'string' ? new Date(instant) : instant);
  /* Some engines write midnight as 24:00. */
  return text.startsWith('24') ? `00${text.slice(2)}` : text;
}

/** "Po 26. 10. 11:00" for a UTC instant. */
export function formatSlotTime(instantUtc: string): string {
  return `${formatWeekdayDate(pragueDateKey(instantUtc))} ${pragueHHMM(instantUtc)}`;
}

/* ── The club's discount - the administrator's choice ── */

/**
 * Which discount an order gets: the one the administrator set on the club's
 * card, carried by the order as `clubDiscountPercent` and by the club as
 * `discountPercent`. Read, never computed. Until 3. 10. 2026 this screen
 * derived a percentage from a headcount table; the owner's rule is that a
 * headcount earns nothing by itself - the discount is a decision about a club.
 *
 * `null` and `0` both mean "bez slevy"; a value outside 0-100 or not a number
 * is treated as none rather than applied.
 */
export function clubDiscountOf(
  club: { discountPercent?: number | null } | null,
  order: { clubDiscountPercent?: number | null } | null,
): number | null {
  const candidates = [order?.clubDiscountPercent, club?.discountPercent];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value > 0 && value <= 100 ? value : null;
    }
  }
  return null;
}

/** "−10 %" or "—". The minus is the typographic one the board draws. */
export function formatDiscount(percent: number | null): string {
  if (percent === null || percent <= 0) return '—';
  return `−${percent.toLocaleString('cs-CZ')} %`;
}

/** The rail's wording: "−10 %" or "Bez slevy". */
export function describeDiscount(percent: number | null): string {
  return percent === null || percent <= 0 ? 'Bez slevy' : formatDiscount(percent);
}

/* ── Clubs and their orders ── */

const fold = (text: string | null | undefined): string =>
  (text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * The orders that belong to one club. By `clubId` when the order carries one;
 * otherwise by name, because every order made before the club link existed
 * (2. 10. 2026) has only the partner's name to go on.
 */
export function ordersOfClub(club: Club, orders: readonly PartnerOrderDetail[]): PartnerOrderDetail[] {
  const name = fold(club.name);
  return orders.filter((o) =>
    o.clubId !== null ? o.clubId === club.id : name !== '' && fold(o.partnerName) === name,
  );
}

/** The window range of an order, or null when it has no windows yet. */
export function orderDateRange(order: { windows: readonly { date: DateOnly }[] }): { from: DateOnly; to: DateOnly } | null {
  if (order.windows.length === 0) return null;
  const dates = order.windows.map((w) => w.date).sort();
  return { from: dates[0], to: dates[dates.length - 1] };
}

export type ClubStatus = 'active' | 'done' | 'none';

/**
 * Whether an order still has anything to do: it is not revoked, has not run
 * out, and either has places left to fill or a held day still ahead. A club
 * with such an order is "Aktivní rezervace"; one whose orders are all behind
 * it is "Dokončeno"; one with none is "Bez objednávky".
 */
export function isOrderActive(order: PartnerOrderDetail, today: DateOnly, nowUtc: Date = new Date()): boolean {
  if (order.isRevoked) return false;
  if (order.expiresAt !== null && new Date(order.expiresAt).getTime() < nowUtc.getTime()) {
    /* An expired link with every place taken is simply finished; one with
       places left is finished too - nobody can take them any more. */
    return false;
  }
  const range = orderDateRange(order);
  const daysAhead = range !== null && range.to >= today;
  const placesLeft = order.requestedCount > order.bookedCount;
  return daysAhead || (placesLeft && range === null);
}

export function clubStatus(orders: readonly PartnerOrderDetail[], today: DateOnly, nowUtc: Date = new Date()): ClubStatus {
  if (orders.length === 0) return 'none';
  return orders.some((o) => isOrderActive(o, today, nowUtc)) ? 'active' : 'done';
}

/**
 * The order the detail opens on: the active one with the nearest held day,
 * else the most recent one. Newer first, so a club that books every autumn
 * shows this autumn.
 */
export function primaryOrder(orders: readonly PartnerOrderDetail[], today: DateOnly, nowUtc: Date = new Date()): PartnerOrderDetail | null {
  if (orders.length === 0) return null;
  const byRange = (o: PartnerOrderDetail) => orderDateRange(o)?.from ?? '';
  const active = orders.filter((o) => isOrderActive(o, today, nowUtc)).sort((a, b) => byRange(a).localeCompare(byRange(b)));
  if (active.length > 0) return active[0];
  return [...orders].sort((a, b) => byRange(b).localeCompare(byRange(a)))[0];
}

/** "62 sportovců" comes from what the club asked for, not from a member list. */
export function headcountOf(order: PartnerOrderDetail | null): number | null {
  if (order === null || order.requestedCount <= 0) return null;
  return order.requestedCount;
}

/* ── The order's money ── */

export interface OrderTotal {
  seats: number;
  /** Price per seat before the discount, or null when any item has no price. */
  unitPrice: number | null;
  percent: number | null;
  /** seats × price with the discount taken off; null when a price is missing. */
  total: number | null;
  /** The explaining line: "12 × 2 200 Kč se slevou 10 %". */
  explain: string;
}

/**
 * Seats × price, less the club's own discount. An order with several činnosti
 * sums each line; when the lines have different prices the explanation lists
 * them rather than inventing an average.
 */
export function orderTotal(
  order: PartnerOrderDetail,
  priceOf: (activityId: string) => number | null,
  discountPercent: number | null,
): OrderTotal {
  const seats = order.items.reduce((n, i) => n + i.requestedCount, 0);
  const percent = discountPercent !== null && discountPercent > 0 ? discountPercent : null;
  const factor = percent === null ? 1 : 1 - percent / 100;

  let gross = 0;
  let priced = true;
  for (const item of order.items) {
    const price = priceOf(item.activityId);
    if (price === null) {
      priced = false;
      break;
    }
    gross += price * item.requestedCount;
  }

  const prices = new Set(order.items.map((i) => priceOf(i.activityId)));
  const single = prices.size === 1 ? [...prices][0] : null;
  const unitPrice = priced && single !== null ? single : null;
  const total = priced && seats > 0 ? gross * factor : null;

  const withDiscount = percent === null ? '' : ` se slevou ${percent.toLocaleString('cs-CZ')} %`;
  const explain =
    seats === 0
      ? 'Zatím bez míst'
      : !priced
        ? 'Některá činnost nemá cenu v ceníku'
        : unitPrice !== null
          ? `${seats} × ${formatCzk(unitPrice)}${withDiscount}`
          : `${order.items
              .map((i) => `${i.requestedCount} × ${formatCzk(priceOf(i.activityId) ?? 0)}`)
              .join(' + ')}${withDiscount}`;

  return { seats, unitPrice, percent, total, explain };
}

/* ── The REZERVOVANÁ MÍSTA table ── */

export type SeatState = 'registered' | 'missingQuestionnaire' | 'waiting';

export interface SeatRow {
  key: string;
  /** The athlete, or null for a place nobody has taken yet. */
  name: string | null;
  activityName: string;
  /** "Po 26. 10. 11:00", or '' when nothing is planned for the place yet. */
  when: string;
  state: SeatState;
  appointmentId: string | null;
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** An appointment that lies inside one of the order's held windows. */
export function isInsideWindows(appointment: DayAppointment, windows: readonly PartnerWindow[]): boolean {
  const day = pragueDateKey(appointment.startUtc);
  const start = minutesOf(pragueHHMM(appointment.startUtc));
  return windows.some(
    (w) => w.date === day && start >= minutesOf(w.startTime) && start < minutesOf(w.endTime),
  );
}

/** Cancelled is 4 in the booking status table; the board never lists those. */
const CANCELLED = 4;

/**
 * The rows design-17 draws: every athlete who took a place inside the held
 * windows, then the places still open, each on the time the schedule plan
 * would give it. The appointments inside the windows are the club's, because
 * a held window is not on public sale - that is what holding it means.
 */
export function seatRows(order: PartnerOrderDetail, appointments: readonly DayAppointment[]): SeatRow[] {
  const taken = appointments
    .filter((a) => a.status !== CANCELLED && isInsideWindows(a, order.windows))
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc))
    .map<SeatRow>((a) => ({
      key: a.id,
      name: a.patientName ?? null,
      activityName: a.activityName,
      when: formatSlotTime(a.startUtc),
      state: a.paperwork !== null && !a.paperwork.ready ? 'missingQuestionnaire' : 'registered',
      appointmentId: a.id,
    }));

  /* The open places, timed by the same plan the printed rozpis uses. */
  const plan = planSchedule(order);
  const planned = plan.windows.flatMap((w) =>
    w.slots.map((s) => ({ when: `${formatWeekdayDate(w.date)} ${s.time}`, activityName: s.activityName })),
  );
  const open = Math.max(0, order.requestedCount - taken.length);
  const free: SeatRow[] = [];
  for (let i = 0; i < open; i += 1) {
    const slot = planned[i];
    free.push({
      key: `free-${i}`,
      name: null,
      activityName: slot?.activityName ?? order.items[0]?.activityName ?? '',
      when: slot?.when ?? '',
      state: 'waiting',
      appointmentId: null,
    });
  }

  return [...taken, ...free];
}

export type ClubFilter = 'all' | 'active' | 'none';

/** The three chips: Všechny · S aktivní rezervací · Bez objednávky. */
export function matchesFilter(status: ClubStatus, filter: ClubFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'active') return status === 'active';
  return status === 'none';
}

/** Name or contact person, accent-insensitive. */
export function matchesSearch(club: Club, query: string): boolean {
  const q = fold(query);
  if (q === '') return true;
  return fold(club.name).includes(q) || fold(club.contactPerson).includes(q) || fold(club.contactPhone).includes(q);
}
