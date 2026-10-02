import type { MinuteRange } from './timeRange';

/*
 * The sidebar's "Nová objednávka" lands on the calendar and opens the booking
 * drawer on the next free half hour - as if the receptionist had dragged it
 * herself. This picks that half hour: from now, rounded up to the grid step,
 * skipping anything already on the calendar, inside the day's working hours.
 *
 * It only chooses what to *prefill*. Whether the time can really be booked is
 * still the server's answer in the dialog (6.1); this never claims a slot is
 * free, it only avoids proposing one that is visibly taken.
 */
export function nextFreeSlot(
  nowMinute: number,
  step: number,
  busy: readonly MinuteRange[],
  duration = 30,
  bounds: MinuteRange = { start: 0, end: 24 * 60 },
): MinuteRange | null {
  const slot = step > 0 ? step : 30;
  const roundUp = (minute: number) => Math.ceil(minute / slot) * slot;
  let start = roundUp(Math.max(nowMinute, bounds.start));
  while (start + duration <= bounds.end) {
    const end = start + duration;
    const clash = busy.find((b) => b.start < end && b.end > start);
    if (!clash) return { start, end };
    start = Math.max(roundUp(clash.end), start + slot);
  }
  return null;
}
