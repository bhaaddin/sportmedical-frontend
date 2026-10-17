/*
 * Reservations of a day: club confirmed / individuals confirmed / held for the
 * club / free for the public, the seven-day release, the drawer figures.
 *
 * Port of `bookingState`, `dayReservationSummary`, `bookingBreakdownMarkup`
 * (data), `renderDayEventCard` (data), `renderReservationContent` (data),
 * `renderReservationDrawer` (figures), `openClubOccupancyOverview` (figures)
 * and `commitDemoBooking` / `demoRelease` (as pure transitions).
 *
 * In the product the numbers come from one shared booking database and the
 * release is enforced by the server; these functions only DISPLAY them, with
 * the prototype's arithmetic, from the `PlannerSession` fields.
 */
import { categoryOrFallback, dayEvents, sourceFor } from './context';
import { computeDayPlan } from './dayPlan';
import { addDays, clockDuration, dateOf, printable, weekdayFull } from './time';
import type {
  BookingState,
  BreakdownPart,
  CategoryId,
  ClubProfile,
  DayReservationSummary,
  IsoDate,
  PlannerContext,
  PlannerSession,
} from './types';

/** The club's unfilled places open to the public this many days before the term. */
export const DEFAULT_RELEASE_DAYS_BEFORE = 7;

export function bookingState(
  e: PlannerSession,
  today: IsoDate,
  releaseDaysBefore: number = DEFAULT_RELEASE_DAYS_BEFORE,
): BookingState {
  const source = sourceFor(e);
  const cap = Number(e.capacity) || 0;
  const initial = Math.min(cap, Math.max(0, Number(e.booked) || 0));
  let club = source === 'club' ? (e.clubBooked == null ? initial : Number(e.clubBooked)) : Number(e.clubBooked || 0);
  let publicCount =
    source === 'public' ? (e.publicBooked == null ? initial : Number(e.publicBooked)) : Number(e.publicBooked || 0);
  club = Math.min(cap, Math.max(0, club));
  publicCount = Math.min(cap - club, Math.max(0, publicCount));
  const cutoff = addDays(e.date, -releaseDaysBefore);
  const released = source === 'club' && (e.released === true || today >= cutoff);
  const held = source === 'club' && !released ? Math.max(0, cap - club - publicCount) : 0;
  const free = Math.max(0, cap - club - publicCount - held);
  return { source, cap, club, publicCount, confirmed: club + publicCount, held, free, released, cutoff };
}

export function dayReservationSummary(
  ctx: PlannerContext,
  date: IsoDate,
  releaseDaysBefore: number = DEFAULT_RELEASE_DAYS_BEFORE,
): DayReservationSummary {
  const events = dayEvents(ctx, date);
  const summary: DayReservationSummary = {
    events: events.length, slots: 0, club: 0, publicCount: 0, held: 0, free: 0, confirmed: 0,
    clubEvents: 0, publicEvents: 0, percent: 0,
  };
  for (const e of events) {
    const x = bookingState(e, ctx.today, releaseDaysBefore);
    summary.slots += x.cap;
    summary.club += x.club;
    summary.publicCount += x.publicCount;
    summary.held += x.held;
    summary.free += x.free;
    summary.confirmed += x.confirmed;
    if (x.source === 'club') summary.clubEvents++;
    else summary.publicEvents++;
  }
  summary.percent = summary.slots ? Math.round((summary.confirmed / summary.slots) * 100) : 0;
  return summary;
}

/** The four coloured figures + the occupancy split bar (`bookingBreakdownMarkup`). */
export function bookingBreakdown(x: Pick<DayReservationSummary, 'club' | 'publicCount' | 'held' | 'free' | 'slots'>): BreakdownPart[] {
  const parts = [
    { label: 'Klub potvrzen', count: x.club, tone: '#16e5d8', sub: 'Opravdu přihlášení sportovci' },
    { label: 'Jednotlivci potvrzeni', count: x.publicCount, tone: '#159afa', sub: 'Veřejné rezervace' },
    { label: 'Drženo pro klub', count: x.held, tone: '#b285fb', sub: 'Přednostní kapacita klubu' },
    { label: 'Veřejně volná místa', count: x.free, tone: '#6e91a5', sub: 'Aktuálně dostupné sloty' },
  ];
  return parts.map((k) => ({ ...k, widthPercent: x.slots ? (k.count / x.slots) * 100 : 0 }));
}

export interface DayEventCardModel {
  id: string;
  categoryId: CategoryId;
  name: string;
  tone: string;
  timeRange: string;
  slotsLabel: string;
  tag: 'KLUBOVÝ TERMÍN' | 'VEŘEJNÝ TERMÍN';
  confirmed: number;
  cap: number;
  /** "🔒 4 pro klub" / "3 volných" / "Obsazeno" */
  statusText: string;
  progressPercent: number;
  canAddClub: boolean;
  canAddPublic: boolean;
}

export function dayEventCardModel(
  ctx: PlannerContext,
  e: PlannerSession,
  releaseDaysBefore: number = DEFAULT_RELEASE_DAYS_BEFORE,
): DayEventCardModel {
  const st = bookingState(e, ctx.today, releaseDaysBefore);
  const c = categoryOrFallback(ctx, e.categoryId);
  return {
    id: e.id,
    categoryId: e.categoryId,
    name: c.name,
    tone: c.color,
    timeRange: `${e.start}–${e.end}`,
    slotsLabel: `${e.capacity} rezervovatelných slotů`,
    tag: st.source === 'club' ? 'KLUBOVÝ TERMÍN' : 'VEŘEJNÝ TERMÍN',
    confirmed: st.confirmed,
    cap: st.cap,
    statusText: st.held ? '🔒 ' + st.held + ' pro klub' : st.free ? st.free + ' volných' : 'Obsazeno',
    progressPercent: st.cap ? Math.round((st.confirmed / st.cap) * 100) : 0,
    canAddClub: st.source === 'club' && !!(st.held || st.free),
    canAddPublic: !!st.free,
  };
}

export interface ReservationDrawerModel {
  date: IsoDate;
  /** "Pátek, 20. 11." */
  title: string;
  summary: DayReservationSummary;
  /** Ring in the hero: share of confirmed places. */
  confirmedPercent: number;
  /** "Naplánovaných 3 h z referenční kapacity 12 h (25 %)." */
  heroText: string;
  breakdown: BreakdownPart[];
  release: { pending: boolean; cutoff: IsoDate | null; cutoffLabel: string | null; before: string; after: string };
  /** Overview tab: one row per činnost of the day. */
  timing: { categoryId: CategoryId; name: string; color: string; duration: string; slotsLabel: string }[];
  plannedLabel: string;
  cards: DayEventCardModel[];
  /** "Simulovat uvolnění" is offered on the bookings tab when a club hold is still waiting. */
  hasPendingHold: boolean;
}

export function reservationDrawerModel(
  ctx: PlannerContext,
  date: IsoDate,
  releaseDaysBefore: number = DEFAULT_RELEASE_DAYS_BEFORE,
): ReservationDrawerModel {
  const n = dayReservationSummary(ctx, date, releaseDaysBefore);
  const p = computeDayPlan(ctx, date);
  const events = dayEvents(ctx, date);
  const upcoming = events.filter((e) => {
    const s = bookingState(e, ctx.today, releaseDaysBefore);
    return s.source === 'club' && s.held > 0;
  });
  const releaseOn = upcoming.length ? bookingState(upcoming[0]!, ctx.today, releaseDaysBefore).cutoff : null;
  const d = dateOf(date);
  const days = `${releaseDaysBefore} dní`;
  return {
    date,
    title: `${weekdayFull(date)}, ${d.getDate()}. ${d.getMonth() + 1}.`,
    summary: n,
    confirmedPercent: n.slots ? Math.round((n.confirmed / n.slots) * 100) : 0,
    heroText: `Potvrzené rezervace konkrétních osob. Naplánovaných ${clockDuration(p.minutes)} z referenční kapacity ${clockDuration(ctx.dayBudgetMinutes)} (${p.percent} %).`,
    breakdown: bookingBreakdown(n),
    release: releaseOn
      ? {
          pending: true,
          cutoff: releaseOn,
          cutoffLabel: printable(dateOf(releaseOn)),
          before: `Neobsazená klubová místa se ${days} před termínem (`,
          after: ') zpřístupní také veřejnosti. Termíny a prstenec se nemění.',
        }
      : {
          pending: false,
          cutoff: null,
          cutoffLabel: null,
          before: 'Klubové blokace jsou již uvolněné nebo pro daný den nejsou žádné čekající blokace. Naplánované termíny zůstávají zachované.',
          after: '',
        },
    timing: p.slices.map((x) => ({
      categoryId: x.categoryId,
      name: categoryOrFallback(ctx, x.categoryId).name,
      color: categoryOrFallback(ctx, x.categoryId).color,
      duration: clockDuration(x.minutes),
      slotsLabel: `${x.slots} slotů`,
    })),
    plannedLabel: clockDuration(p.minutes),
    cards: events.map((e) => dayEventCardModel(ctx, e, releaseDaysBefore)),
    hasPendingHold: upcoming.length > 0,
  };
}

export interface ClubOccupancyRow {
  id: string;
  date: IsoDate;
  dateLabel: string;
  timeRange: string;
  tone: string;
  name: string;
  note: 'Uvolněno pro veřejnost' | 'Přednostně pro klub' | 'Obsazeno';
  clubLabel: string;
  progressPercent: number;
  focused: boolean;
}

export interface ClubOccupancyModel {
  clubName: string;
  totals: { capacity: number; club: number; publicCount: number; held: number; free: number };
  termCount: number;
  rows: ClubOccupancyRow[];
}

/** `openClubOccupancyOverview`: all club terms with their fill, chronological. */
export function clubOccupancyModel(
  ctx: PlannerContext,
  profile: Pick<ClubProfile, 'clubName'>,
  focusDate: IsoDate | null,
  releaseDaysBefore: number = DEFAULT_RELEASE_DAYS_BEFORE,
): ClubOccupancyModel {
  const events = ctx.sessions
    .filter((e) => sourceFor(e) === 'club')
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const totals = events.reduce(
    (r, e) => {
      const q = bookingState(e, ctx.today, releaseDaysBefore);
      r.capacity += q.cap;
      r.club += q.club;
      r.publicCount += q.publicCount;
      r.held += q.held;
      r.free += q.free;
      return r;
    },
    { capacity: 0, club: 0, publicCount: 0, held: 0, free: 0 },
  );
  const rows: ClubOccupancyRow[] = events.map((e) => {
    const d = bookingState(e, ctx.today, releaseDaysBefore);
    const c = categoryOrFallback(ctx, e.categoryId);
    return {
      id: e.id,
      date: e.date,
      dateLabel: printable(dateOf(e.date)),
      timeRange: `${e.start}–${e.end}`,
      tone: c.color,
      name: c.name,
      note: d.released ? 'Uvolněno pro veřejnost' : d.held ? 'Přednostně pro klub' : 'Obsazeno',
      clubLabel: `${d.club} / ${d.cap}`,
      progressPercent: d.cap ? Math.round(((d.club + d.publicCount) / d.cap) * 100) : 0,
      focused: focusDate === e.date,
    };
  });
  return { clubName: profile.clubName, totals, termCount: events.length, rows };
}

export interface BookingChange {
  ok: boolean;
  sessions: PlannerSession[];
  /** Czech toast for the desk, empty when nothing changed. */
  message: string;
}

/**
 * "+ Klub" / "+ Jednotlivec" of the drawer (`commitDemoBooking`): one more
 * confirmed place. Refuses when the rules do not allow it.
 */
export function addBooking(
  sessions: readonly PlannerSession[],
  id: string,
  kind: 'club' | 'public',
  today: IsoDate,
  releaseDaysBefore: number = DEFAULT_RELEASE_DAYS_BEFORE,
): BookingChange {
  const e = sessions.find((x) => x.id === id);
  if (!e) return { ok: false, sessions: [...sessions], message: '' };
  const previous = bookingState(e, today, releaseDaysBefore);
  const wantsClub = kind === 'club';
  if (wantsClub && previous.source !== 'club') return { ok: false, sessions: [...sessions], message: '' };
  if (wantsClub && !(previous.held || previous.free)) return { ok: false, sessions: [...sessions], message: '' };
  if (!wantsClub && !previous.free) return { ok: false, sessions: [...sessions], message: '' };
  const clubBooked = previous.club + (wantsClub ? 1 : 0);
  const publicBooked = previous.publicCount + (wantsClub ? 0 : 1);
  return {
    ok: true,
    sessions: sessions.map((x) =>
      x.id === id ? { ...x, clubBooked, publicBooked, booked: clubBooked + publicBooked } : x,
    ),
    message: wantsClub ? 'Demo: přidána rezervace sportovce klubu' : 'Demo: přidána veřejná rezervace',
  };
}

/** "Simulovat uvolnění blokací" - mark every club term of the day as released. */
export function releaseDay(sessions: readonly PlannerSession[], date: IsoDate): BookingChange {
  return {
    ok: true,
    sessions: sessions.map((e) => (e.date === date && sourceFor(e) === 'club' ? { ...e, released: true } : e)),
    message: 'Demo: zbývající klubové blokace jsou nyní veřejně dostupné.',
  };
}

