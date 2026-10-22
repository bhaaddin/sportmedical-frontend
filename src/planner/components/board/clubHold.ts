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

export type HoldState = 'waiting' | 'full' | 'expired';

export const HOLD_TEXT = {
  waiting: 'Čeká na hráče',
  full: 'Obsazeno',
  expired: 'Hold vypršel',
  release: 'Uvolnit nevyplněné',
  releaseExpired: 'Uvolnit jen vypršené',
  reserved: (club: string) => `Rezervováno pro klub ${club}`,
  holdUntil: (day: string) => `Držení do ${day}`,
  releaseConfirm: (onlyExpired: boolean) =>
    onlyExpired
      ? 'Uvolní se jen ty části, jejichž držení vypršelo a které nikdo nevyplnil. Zapsaní hráči a jejich termíny se nemění.'
      : 'Uvolní se čas, který hráči nevyplnili: část bez hráčů zmizí, část s hráči se zkrátí po posledního z nich. Zapsaní hráči a jejich termíny se nemění.',
  releaseGo: 'Uvolnit',
  back: 'Zpět',
  releaseFailed: 'Čas se nepodařilo uvolnit. Zkuste to prosím znovu.',
} as const;

/** What the owner is told after the release (contract: windows removed / shortened, minutes given back). */
export function releaseSummary(r: { windowsRemoved: number; windowsShortened: number; minutesReleased: number; stretchesKept: number; blockCancelled: boolean }): string {
  if (r.windowsRemoved === 0 && r.windowsShortened === 0) return 'Není co uvolnit: všechen držený čas je vyplněný, nebo už byl uvolněn.';
  const parts = [`Uvolněno ${r.minutesReleased} min`];
  if (r.windowsRemoved > 0) parts.push(`odstraněno ${r.windowsRemoved}`);
  if (r.windowsShortened > 0) parts.push(`zkráceno ${r.windowsShortened}`);
  if (r.stretchesKept > 0) parts.push(`ponecháno ${r.stretchesKept}`);
  return `${parts.join(', ')}.${r.blockCancelled ? ' Blokace klubu tím zanikla.' : ''}`;
}

/** The sentence for a refused release: the server's own text (it is Czech), else the generic one. */
export function releaseFailedText(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';
  return message !== '' && !/^Request failed/i.test(message) ? message : HOLD_TEXT.releaseFailed;
}

/** The block's hold state, or null when the server says nothing about it (an older build, or a manual block). */
export function holdStateOf(block: Pick<TimeBlock, 'kind' | 'playersMissing' | 'windowEmpty' | 'holdExpired' | 'seats' | 'registered'>): HoldState | null {
  if (block.kind !== 'club') return null;
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

/** "Rezervováno pro klub FK Slaný" (the club's name is the block's; a club-less block says "klub"). */
export const clubReservedText = (block: Pick<TimeBlock, 'clubName'>): string => HOLD_TEXT.reserved(block.clubName?.trim() || 'klub');

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
}

const HEX = /^#[0-9a-fA-F]{6}$/;
export const clubColourOf = (hex: string | null | undefined, fallback = '#6e91a5'): string => (hex && HEX.test(hex) ? hex : fallback);

/** "FK Slaný · KO-12AB · 08:00–16:00 · Čeká na hráče": every part the server told us about, nothing invented. */
export function clubItemText(item: Pick<ClubDayItem, 'club' | 'range' | 'orderCode' | 'hold'>): string {
  return [item.club, item.orderCode, item.range, item.hold ? holdLabel(item.hold) : null].filter(Boolean).join(' · ');
}
