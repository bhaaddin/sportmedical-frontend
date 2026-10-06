import { describe, expect, it } from "vitest";
import { clubRanges } from "./multiSelect";
import type { PickedTime } from "./multiSelect";
import { ordersRangesOf, pickedWindowsOf, picksFromRanges } from "./pickLogic";

const t = (h: number, m = 0) => h * 60 + m;
const TODAY = "2026-10-01";
const pick = (id: string, day: string, start: number, end: number, activityIds?: string[] | null): PickedTime => ({
  id, kind: "time", columnKey: "c1", calendarId: "c1", activityId: null, dayKey: day, range: { start, end },
  ...(activityIds !== undefined ? { activityIds } : {}),
});

describe("picked windows and their činnosti", () => {
  it("the payload leaves activityIds out when every činnost is allowed", () => {
    const ranges = ordersRangesOf([pick("a", "2026-10-26", t(8), t(12)), pick("b", "2026-10-27", t(8), t(12), null)], TODAY);
    expect(ranges).toEqual([{ fromDate: "2026-10-26", toDate: "2026-10-27", dailyFrom: "08:00", dailyTo: "12:00" }]);
    for (const r of ranges) expect(r).not.toHaveProperty("activityIds");
  });

  it("the payload carries activityIds for a strict subset", () => {
    const ranges = ordersRangesOf([pick("a", "2026-10-26", t(8), t(12), ["spiro"])], TODAY);
    expect(ranges).toEqual([{ fromDate: "2026-10-26", toDate: "2026-10-26", dailyFrom: "08:00", dailyTo: "12:00", activityIds: ["spiro"] }]);
  });

  it("ranges that differ only in activityIds are never merged: not on consecutive days, not on one day", () => {
    const days = clubRanges([pick("a", "2026-10-26", t(8), t(12), ["spiro"]), pick("b", "2026-10-27", t(8), t(12), ["basic"]), pick("c", "2026-10-28", t(8), t(12))], TODAY);
    expect(days).toHaveLength(3);
    const touching = clubRanges([pick("a", "2026-10-26", t(8), t(10), ["spiro"]), pick("b", "2026-10-26", t(10), t(12))], TODAY);
    expect(touching).toHaveLength(2);
  });

  it("windows with the same set still join, as before", () => {
    const same = clubRanges([pick("a", "2026-10-26", t(8), t(10), ["spiro"]), pick("b", "2026-10-26", t(10), t(12), ["spiro"]), pick("c", "2026-10-27", t(8), t(12), ["spiro"])], TODAY);
    expect(same).toEqual([{ fromDate: "2026-10-26", toDate: "2026-10-27", dailyFrom: "08:00", dailyTo: "12:00", activityIds: ["spiro"] }]);
  });

  it("a stored range's činnosti come back on its picks, and the calculator reads them", () => {
    const picks = picksFromRanges(
      [{ fromDate: "2026-10-26", toDate: "2026-10-27", dailyFrom: "08:00", dailyTo: "10:00", activityIds: ["spiro"] }, { fromDate: "2026-10-28", toDate: "2026-10-28", dailyFrom: "08:00", dailyTo: "09:00" }],
      "c1",
      (id) => id,
    );
    expect(picks).toHaveLength(3);
    expect(picks[0].activityIds).toEqual(["spiro"]);
    expect(picks[2]).not.toHaveProperty("activityIds");
    const windows = pickedWindowsOf(picks.map((p, i) => ({ ...p, id: `p${i}` })));
    expect(windows).toEqual([
      { minutes: 120, activityIds: ["spiro"] },
      { minutes: 120, activityIds: ["spiro"] },
      { minutes: 60, activityIds: null },
    ]);
  });
});
