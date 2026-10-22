/*
 * R13 - the mini calendar marks the days a club holds time on (club name and colour, hold state in the day's label).
 *
 * Source: `GET /api/v1/club-blocks?from&to&status=Active` - ONE read for the shown month. A block spans `fromDate`..`toDate`; a closed
 * day inside the span (weekend, holiday) holds no club time and is not marked. Pure, no DOM.
 */
import type { ClubBlockView } from '../../../api/clubBlocks';
import type { DayMark, IsoDate } from '../../model';
import type { Catalogue } from '../../../components/booking/calendar/model';
import { frameActivities, type FrameActivity } from '../board/clubFrame';
import { clubColourOf, holdStateOf, type HoldState } from '../board/clubHold';

export interface MiniClubMark {
  key: string;
  club: string;
  colour: string;
  orderCode: string | null;
  hold: HoldState | null;
  /** R16b: the činnosti inside the club's frame that day (from the block's `activityIds`), empty when none are named. */
  activities: FrameActivity[];
}

export function clubDaysOf(days: readonly IsoDate[], blocks: readonly ClubBlockView[], marks: Readonly<Record<string, DayMark>>, catalogue?: Catalogue): Map<IsoDate, MiniClubMark[]> {
  const out = new Map<IsoDate, MiniClubMark[]>();
  for (const day of days) {
    if (marks[day]?.closed) continue;
    const here = blocks
      .filter((b) => b.status === 'Active' && b.fromDate !== '' && b.fromDate <= day && day <= (b.toDate || b.fromDate))
      .map<MiniClubMark>((b) => ({
        key: b.id,
        club: b.clubName || 'Klub',
        colour: clubColourOf(b.colorHex),
        orderCode: b.orderCode ?? null,
        activities: catalogue ? frameActivities(b.activityIds, catalogue) : [],
        hold: holdStateOf({
          kind: 'club',
          playersMissing: b.playersMissing ?? null,
          windowEmpty: null,
          holdExpired: b.holdExpired ?? null,
          seats: b.seats,
          registered: b.registered,
        }),
      }));
    if (here.length > 0) out.set(day, here);
  }
  return out;
}
