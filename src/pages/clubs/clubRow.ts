/*
 * One club with everything its card and its detail need, worked out once.
 * Pure, so the page stays a page and the test can pin the rules.
 */
import type { Club } from '../../api/clubs';
import type { ClubBlockView } from '../../api/clubBlocks';
import type { PartnerOrderDetail } from '../../api/partnerOrders';
import type { DateOnly } from '../../utils/time';
import { clubColorOf } from '../../components/clubs/blockLogic';
import { blockSeatTotals, sumSeats } from '../../components/clubs/panel/seats';
import {
  clubDiscountOf, clubStatus, headcountOf, ordersOfClub, primaryOrder,
} from './clubOrders';
import type { ClubStatus } from './clubOrders';

export interface ClubRow {
  club: Club;
  orders: PartnerOrderDetail[];
  /** The club's blocks, active first, then by first day. */
  blocks: ClubBlockView[];
  status: ClubStatus;
  order: PartnerOrderDetail | null;
  /** From the order, else the headcount of the club's active blocks. */
  headcount: number | null;
  /** The administrator's number for this club - never derived from the headcount. */
  percent: number | null;
  /** Places the club holds in its live blocks (all činnosti) and how many athletes took one; null without blocks. */
  seatTotals: { seats: number; registered: number } | null;
  /** The club's calendar colour, when the server has given one. */
  color: string | null;
}

/** Active blocks first, then the nearest first day. */
export function sortBlocks(blocks: readonly ClubBlockView[]): ClubBlockView[] {
  return [...blocks].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'Active' ? -1 : 1;
    return a.fromDate.localeCompare(b.fromDate);
  });
}

/**
 * A block is "active" for the club's status chip while it is not cancelled and
 * its last day has not passed.
 */
export const isBlockLive = (block: ClubBlockView, today: DateOnly): boolean =>
  block.status === 'Active' && block.toDate >= today;

export function buildClubRow(
  club: Club,
  orders: readonly PartnerOrderDetail[],
  allBlocks: readonly ClubBlockView[],
  today: DateOnly,
): ClubRow {
  const own = ordersOfClub(club, orders);
  const order = primaryOrder(own, today);
  const blocks = sortBlocks(allBlocks.filter((b) => b.clubId === club.id));
  const live = blocks.filter((b) => isBlockLive(b, today));

  const orderStatus = clubStatus(own, today);
  const status: ClubStatus = live.length > 0 ? 'active' : orderStatus === 'none' && blocks.length > 0 ? 'done' : orderStatus;

  const fromOrder = headcountOf(order);
  const fromBlocks = live.reduce((n, b) => n + b.playerCount, 0);

  return {
    club,
    orders: own,
    blocks,
    status,
    order,
    headcount: fromOrder ?? (fromBlocks > 0 ? fromBlocks : null),
    percent: clubDiscountOf(club, order),
    seatTotals: live.length > 0 ? sumSeats(live.map(blockSeatTotals)) : null,
    color: clubColorOf(club, allBlocks),
  };
}
