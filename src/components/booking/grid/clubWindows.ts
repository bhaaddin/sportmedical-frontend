import type { TimeBlock } from "../../../api/bookingContracts";
import type { DateOnly } from "../../../utils/time";
import { spanOnDay, type MinuteRange } from "./timeRange";

/*
 * Etapa 12 (owner, 10. 10. 2026): "when a team books, it gets the WHOLE day,
 * not divided into segments". The server keeps a club order's day as the
 * windows it can actually occupy - the open stretch before lunch and the one
 * after - so on the grid an all-day order used to read as three pieces: a
 * window, the lunch band, a window. The desk sees one order, so the grid
 * draws one block.
 *
 * Only windows of the SAME order (`clubBlockId`) are joined, and only when
 * what lies between them is nothing but the lunch band (or no gap at all).
 * Two windows the desk deliberately set apart - 09:00-11:00 and 14:00-16:00
 * with free time between - stay two blocks, because that free time is real.
 */

export interface DrawnBlock {
  /** The first window, carrying the id, club, colour and name the block shows. */
  block: TimeBlock;
  /** From the first window's start to the last one's end, on this day. */
  span: MinuteRange;
  /** Every window drawn as this one block, in time order. */
  parts: TimeBlock[];
}

const gapIsOnlyLunch = (gap: MinuteRange, lunch: MinuteRange | null): boolean =>
  gap.end <= gap.start || (lunch !== null && gap.start >= lunch.start && gap.end <= lunch.end);

export function drawnBlocksOfDay(blocks: TimeBlock[], dayKey: DateOnly, lunch: MinuteRange | null): DrawnBlock[] {
  const sorted = blocks
    .map((block) => ({ block, span: spanOnDay(block.startUtc, block.endUtc, dayKey) }))
    .sort((a, b) => a.span.start - b.span.start || a.span.end - b.span.end);
  const drawn: DrawnBlock[] = [];
  for (const { block, span } of sorted) {
    /* The same order's last drawn block - a manual block sorted between two windows must not break the join. */
    const own =
      block.kind === "club" && block.clubBlockId != null
        ? drawn.findLast((d) => d.block.kind === "club" && d.block.clubBlockId === block.clubBlockId)
        : undefined;
    if (own !== undefined && gapIsOnlyLunch({ start: own.span.end, end: span.start }, lunch)) {
      own.span = { start: own.span.start, end: Math.max(own.span.end, span.end) };
      own.parts.push(block);
      continue;
    }
    drawn.push({ block, span: { ...span }, parts: [block] });
  }
  return drawn;
}
