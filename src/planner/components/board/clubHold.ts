/*
 * R13 - a club's held time in the MAIN calendar: what state it is in, and who it belongs to when somebody tries to book into it.
 *
 * The owner: the day a team was ordered must not look empty - the time is hatched "for some time" so staff do not book it, and every
 * view says which club ordered it. The club must fill its players in later; the hold lasts until they have, or the hold period
 * (`holdUntilDaysBefore`, Nastavení klubů) runs out. Contract fields on a `kind:"club"` block (all optional - an older server sends
 * none and the block is drawn as before):
 *
 *   playersMissing / windowEmpty / holdExpired / holdUntilUtc / seats / registered / orderCode / clubOrderId
 *
 * Pure rules, no DOM. `holdExpired` only REPORTS: nothing is deleted by it (the owner releases the unfilled part by hand).
 */
import type { TimeBlock } from '../../../api/bookingContracts';
import { spanOnDay, touchesDay, type MinuteRange } from '../../../components/booking/grid/timeRange';

export type HoldState = 'waiting' | 'full' | 'expired' | 'requested' | 'offered';

export const HOLD_TEXT = {
  waiting: 'Čeká na hráče',
  full: 'Obsazeno',
  expired: 'Hold vypršel',
  /* R22: time given to a club that asked for it / that the desk offered, no block yet */
  requested: 'Čeká na potvrzení',
  offered: 'Čeká na odpověď',
  reserved: (club: string) => `Rezervováno pro klub ${club}`,
  holdUntil: (day: string) => `Držení do ${day}`,
  /** R22: what the window of a pending hold says in place of the club's name */
  pendingTitle: (kind: 'requested' | 'offered', club: string) => (kind === 'requested' ? `Rezervováno pro klub ${club}` : `Nabídnuto klubu ${club}`),
  /** R22: the offered day only warns */
  offeredWarn: (club: string) => `Nabídnuto klubu ${club}`,
} as const;

/** The block's hold state, or null when the server says nothing about it (an older build, or a manual block). */
export function holdStateOf(block: Pick<TimeBlock, 'kind' | 'playersMissing' | 'windowEmpty' | 'holdExpired' | 'seats' | 'registered'> & { pendingHold?: 'requested' | 'offered' | undefined }): HoldState | null {
  if (block.kind !== 'club') return null;
  if (block.pendingHold) return block.pendingHold;
  if (block.holdExpired === true) return 'expired';
  if (block.playersMissing === true) return 'waiting';
  if (block.playersMissing === false) return 'full';
  /* no flag: derive it from the counts when the server sent them */
  if (typeof block.seats === 'number' && typeof block.registered === 'number' && block.seats > 0) return block.registered >= block.seats ? 'full' : 'waiting';
  return null;
}

export const holdLabel = (state: HoldState): string => HOLD_TEXT[state];

/** "7/22 zapsáno" for a block that carries the counts; null otherwise. */
export function seatsLabel(block: Pick<TimeBlock, 'seats' | 'registered'>): string | null {
  return typeof block.seats === 'number' && block.seats > 0 ? `${block.registered ?? 0}/${block.seats} zapsáno` : null;
}

/** The club block that holds `range` on `day`, if any (the first, by start). */
export function clubHolding(blocks: readonly TimeBlock[], day: string, range: MinuteRange): TimeBlock | null {
  const hit = blocks
    .filter((b) => b.kind === 'club' && touchesDay(b.startUtc, b.endUtc, day))
    .map((block) => ({ block, span: spanOnDay(block.startUtc, block.endUtc, day) }))
    .filter(({ span }) => range.start < span.end && span.start < range.end)
    .sort((a, b) => a.span.start - b.span.start)[0];
  return hit?.block ?? null;
}

/** The offered-day stand-in that touches `range` on `day`: it never refuses a booking, it only warns (the club may decline). */
export function offeredHolding(blocks: readonly TimeBlock[], day: string, range: MinuteRange): TimeBlock | null {
  return clubHolding(blocks.filter((b) => b.pendingHold === 'offered'), day, range);
}

/** "Rezervováno pro klub FK Slaný" (the club's name is the block's; a club-less block says "klub"). */
export const clubReservedText = (block: Pick<TimeBlock, 'clubName'> & { pendingHold?: 'requested' | 'offered' | undefined }): string =>
  block.pendingHold === 'requested' ? `${HOLD_TEXT.reserved(block.clubName?.trim() || 'klub')} · ${HOLD_TEXT.requested.toLowerCase()}` : HOLD_TEXT.reserved(block.clubName?.trim() || 'klub');

/** One club window of a day as the month tile, the phone list and the mini calendar show it. */
export interface ClubDayItem {
  key: string;
  club: string;
  /** `#RRGGBB` of the club. */
  colour: string;
  /** "08:00–16:00" */
  range: string;
  orderCode: string | null;
  orderId: string | null;
  hold: HoldState | null;
  /** R16b: the činnosti inside the club's frame on this day (distinct, in time order); empty when the server named none. */
  activities: { id: string; name: string; colour: string }[];
}

const HEX = /^#[0-9a-fA-F]{6}$/;
export const clubColourOf = (hex: string | null | undefined, fallback = '#6e91a5'): string => (hex && HEX.test(hex) ? hex : fallback);

/** "FK Slaný · KO-12AB · 08:00–16:00 · Čeká na hráče": every part the server told us about, nothing invented. */
export function clubItemText(item: Pick<ClubDayItem, 'club' | 'range' | 'orderCode' | 'hold'>): string {
  return [item.club, item.orderCode, item.range, item.hold ? holdLabel(item.hold) : null].filter(Boolean).join(' · ');
}
