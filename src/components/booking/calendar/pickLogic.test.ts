import { describe, expect, it } from "vitest";
import {
  adjustPicked,
  tapBandStart,
  touchBandMinutes,
  busyIntervals,
  clampPainted,
  ordersRangesOf,
  paintNote,
  pickedCalendarIds,
  pickedMinutesOf,
  pickInRange,
  picksFromRanges,
} from "./pickLogic";
import type { PickedTime } from "./multiSelect";

const t = (h: number, m = 0) => h * 60 + m;
const pick = (id: string, day: string, start: number, end: number, calendarId = "c1"): PickedTime => ({
  id, kind: "time", columnKey: calendarId, calendarId, activityId: null, dayKey: day, range: { start, end },
});

describe("clampPainted", () => {
  const none: { start: number; end: number }[] = [];

  it("lets a free range through whole", () => {
    const r = clampPainted({ range: { start: t(9), end: t(11) }, direction: "down", busy: none });
    expect(r.range).toEqual({ start: t(9), end: t(11) });
    expect(paintNote(r)).toBeNull();
  });

  it("is NEVER cut to the minutes the order needs - what is marked is booked as marked", () => {
    const r = clampPainted({ range: { start: t(9, 40), end: t(19) }, direction: "down", busy: none });
    expect(r.range).toEqual({ start: t(9, 40), end: t(19) });
    expect(paintNote(r)).toBeNull();
  });

  it("dragging upward keeps the whole marked range too", () => {
    const r = clampPainted({ range: { start: t(9), end: t(12) }, direction: "up", busy: none });
    expect(r.range).toEqual({ start: t(9), end: t(12) });
  });

  it("is cut at the first booking in the way", () => {
    const r = clampPainted({ range: { start: t(9), end: t(12) }, direction: "down", busy: [{ start: t(10, 30), end: t(11) }] });
    expect(r.range).toEqual({ start: t(9), end: t(10, 30) });
    expect(r.trimmedBusy).toBe(true);
    expect(paintNote(r)).toMatch(/obsazeno/);
  });

  it("dragging upward is cut at the booking above", () => {
    const r = clampPainted({ range: { start: t(9), end: t(12) }, direction: "up", busy: [{ start: t(9, 30), end: t(10) }] });
    expect(r.range).toEqual({ start: t(10), end: t(12) });
  });

  it("refuses a range that starts on something taken", () => {
    const r = clampPainted({ range: { start: t(10), end: t(11) }, direction: "down", busy: [{ start: t(9), end: t(10, 30) }] });
    expect(r.range).toBeNull();
    expect(r.refused).toBe("busy");
    expect(paintNote(r)).toMatch(/obsazeno/);
  });
});

describe("busyIntervals", () => {
  const row = { isOpen: true, startTime: "08:00:00", endTime: "16:00:00", breakStart: "12:00:00", breakEnd: "12:30:00" };

  it("everything outside the working hours and the break is taken", () => {
    const busy = busyIntervals({ dayKey: "2026-10-26", row, appointments: [], blocks: [], picks: [] });
    expect(busy).toEqual([{ start: 0, end: t(8) }, { start: t(12), end: t(12, 30) }, { start: t(16), end: 24 * 60 }]);
  });

  it("a closed day is taken whole", () => {
    expect(busyIntervals({ dayKey: "2026-10-26", row: { ...row, isOpen: false }, appointments: [], blocks: [], picks: [] })).toEqual([{ start: 0, end: 1440 }]);
  });

  it("an unknown row restricts nothing; own picks are other places, a moved pick is not", () => {
    const picks = [pick("a", "2026-10-26", t(9), t(10)), pick("b", "2026-10-26", t(10), t(11))];
    expect(busyIntervals({ dayKey: "2026-10-26", appointments: [], blocks: [], picks })).toEqual([{ start: t(9), end: t(11) }]);
    expect(busyIntervals({ dayKey: "2026-10-26", appointments: [], blocks: [], picks, ignoreId: "a" })).toEqual([{ start: t(10), end: t(11) }]);
  });

  it("bookings and blocks count, a cancelled booking does not", () => {
    const busy = busyIntervals({
      dayKey: "2026-12-14",
      appointments: [
        { startUtc: "2026-12-14T09:00:00Z", endUtc: "2026-12-14T09:30:00Z", status: 1 },
        { startUtc: "2026-12-14T11:00:00Z", endUtc: "2026-12-14T11:30:00Z", status: 4 },
      ],
      blocks: [{ startUtc: "2026-12-14T13:00:00Z", endUtc: "2026-12-14T14:00:00Z" }],
      picks: [],
    });
    expect(busy).toEqual([{ start: t(10), end: t(10, 30) }, { start: t(14), end: t(15) }]);
  });
});

describe("adjustPicked", () => {
  const base = { original: { start: t(9), end: t(10) }, step: 10, bounds: { start: t(7), end: t(19) }, busy: [{ start: t(12), end: t(13) }] };

  it("resizes the end", () => {
    expect(adjustPicked({ ...base, mode: "end", delta: 60 })).toEqual({ start: t(9), end: t(11) });
  });

  it("the end stops at the next booking", () => {
    expect(adjustPicked({ ...base, mode: "end", delta: 300 })).toEqual({ start: t(9), end: t(12) });
  });

  it("the end can grow beyond the minutes the order needs", () => {
    expect(adjustPicked({ ...base, mode: "end", delta: 120 })).toEqual({ start: t(9), end: t(12) });
  });

  it("never shrinks below one step", () => {
    expect(adjustPicked({ ...base, mode: "end", delta: -500 })).toEqual({ start: t(9), end: t(9, 10) });
    expect(adjustPicked({ ...base, mode: "start", delta: 500 })).toEqual({ start: t(9, 50), end: t(10) });
  });

  it("moves the whole range, and refuses a move onto something taken", () => {
    expect(adjustPicked({ ...base, mode: "move", delta: 60 })).toEqual({ start: t(10), end: t(11) });
    expect(adjustPicked({ ...base, mode: "move", delta: 150 })).toEqual(base.original);
  });

  it("a move stays inside the grid", () => {
    expect(adjustPicked({ ...base, mode: "move", delta: -1000 })).toEqual({ start: t(7), end: t(8) });
  });
});

describe("picks to ranges", () => {
  it("adds the picked minutes of all days and calendars", () => {
    const items = [pick("1", "2026-12-14", t(9), t(10)), pick("2", "2026-12-15", t(9), t(10, 30), "c2")];
    expect(pickedMinutesOf(items)).toBe(150);
    expect(pickedCalendarIds(items)).toEqual(["c1", "c2"]);
  });

  it("the same window on consecutive days becomes one range; weekday numbering is untouched", () => {
    const items = [pick("1", "2026-12-14", t(9, 40), t(10, 40)), pick("2", "2026-12-15", t(9, 40), t(10, 40)), pick("3", "2026-12-17", t(13), t(14))];
    expect(ordersRangesOf(items, "2026-12-01")).toEqual([
      { fromDate: "2026-12-14", toDate: "2026-12-15", dailyFrom: "09:40", dailyTo: "10:40" },
      { fromDate: "2026-12-17", toDate: "2026-12-17", dailyFrom: "13:00", dailyTo: "14:00" },
    ]);
  });

  it("lays an order's ranges out as one pick per day (editing starts from them)", () => {
    const picks = picksFromRanges([{ fromDate: "2026-12-14", toDate: "2026-12-16", dailyFrom: "09:40", dailyTo: "15:00" }], "c1", (id) => id);
    expect(picks.map((p) => p.dayKey)).toEqual(["2026-12-14", "2026-12-15", "2026-12-16"]);
    expect(picks[0].range).toEqual({ start: t(9, 40), end: t(15) });
  });

  it("finds which picks lie in the range a 409 named", () => {
    const range = { fromDate: "2026-12-14", toDate: "2026-12-15", dailyFrom: "09:00", dailyTo: "10:00" };
    expect(pickInRange(pick("1", "2026-12-15", t(9, 30), t(11)), range)).toBe(true);
    expect(pickInRange(pick("2", "2026-12-16", t(9), t(10)), range)).toBe(false);
    expect(pickInRange(pick("3", "2026-12-14", t(10), t(11)), range)).toBe(false);
  });
});

describe("touch tap bands", () => {
  it("a slot at least 44 px tall is tapped one slot at a time", () => {
    expect(touchBandMinutes(30, 44 / 30)).toBe(30);
  });
  it("a 15-minute step drawn 22 px tall is tapped in 30-minute bands (44 px)", () => {
    expect(touchBandMinutes(15, 44 / 30)).toBe(30);
  });
  it("a 10-minute step drawn 14.7 px tall needs 3 slots", () => {
    expect(touchBandMinutes(10, 44 / 30)).toBe(30);
  });
  it("a tap lands in the band by position", () => {
    expect(tapBandStart(t(9, 20), 30)).toBe(t(9));
    expect(tapBandStart(t(9, 40), 30)).toBe(t(9, 30));
  });
});
