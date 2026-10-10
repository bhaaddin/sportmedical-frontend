import { describe, expect, it } from "vitest";
import {
  canSplit,
  cutPart,
  mergeCut,
  midpointOf,
  moreNeeded,
  moreNeededLine,
  moveCut,
  openMinutesOf,
  partsFromPlan,
  pickCoverage,
  sequentialPlan,
  stepFor,
  takeForActivity,
  trimToNeed,
} from "./pickPlan";

const komplexni = { activityId: "k", name: "Komplexní sportovní prohlídka", seats: 20, minutesPerSeat: 60, parallelCapacity: 1 };
const spiro = { activityId: "s", name: "Spiroergometrické vyšetření", seats: 50, minutesPerSeat: 90, parallelCapacity: 1 };

describe("sequentialPlan", () => {
  it("lays the činnosti one after another in the order given, each as long as its players need", () => {
    const plan = sequentialPlan({ range: { start: 8 * 60, end: 16 * 60 }, step: 30 }, [komplexni, { ...spiro, seats: 2 }]);
    /* 20 × 60 = 1200 > 480: only 8 fit; spiro gets nothing (no room left). */
    expect(plan.parts).toHaveLength(1);
    expect(plan.parts[0]).toEqual({ activityId: "k", name: komplexni.name, range: { start: 480, end: 960 }, seats: 8, slots: 8 });
    expect(plan.overflow).toEqual([{ activityId: "k", name: komplexni.name, seats: 12 }, { activityId: "s", name: spiro.name, seats: 2 }]);
    expect(plan.unused).toBeNull();
  });

  it("rounds each part up to the grid step and reports the tail: 3 × 45 min = 135 → 150 at a 30-min step", () => {
    const plan = sequentialPlan({ range: { start: 480, end: 720 }, step: 30 }, [
      { activityId: "a", name: "A", seats: 3, minutesPerSeat: 45, parallelCapacity: 1 },
      { activityId: "b", name: "B", seats: 1, minutesPerSeat: 60, parallelCapacity: 1 },
    ]);
    expect(plan.parts).toEqual([
      { activityId: "a", name: "A", range: { start: 480, end: 630 }, seats: 3, slots: 3 },
      { activityId: "b", name: "B", range: { start: 630, end: 690 }, seats: 1, slots: 1 },
    ]);
    expect(plan.unused).toEqual({ start: 690, end: 720 });
    expect(plan.overflow).toEqual([]);
  });

  it("a parallel capacity of 2 halves the time: 20 players × 60 min = 10 slots = 600 min", () => {
    const plan = sequentialPlan({ range: { start: 0, end: 600 }, step: 30 }, [{ ...komplexni, parallelCapacity: 2 }]);
    expect(plan.parts[0]).toMatchObject({ range: { start: 0, end: 600 }, seats: 20, slots: 10 });
    expect(plan.overflow).toEqual([]);
  });

  it("two calendars run the same window twice: 20 players × 60 min on 2 calendars = 10 slots", () => {
    const plan = sequentialPlan({ range: { start: 0, end: 480 }, step: 30, calendars: 2 }, [komplexni, { ...spiro, seats: 4 }]);
    expect(plan.parts).toEqual([{ activityId: "k", name: komplexni.name, range: { start: 0, end: 480 }, seats: 16, slots: 8 }]);
    /* 8 slots × 2 lanes = 16 players fit, 4 overflow; spiro has no room. */
    expect(plan.overflow).toEqual([{ activityId: "k", name: komplexni.name, seats: 4 }, { activityId: "s", name: spiro.name, seats: 4 }]);
  });

  it("a shorter činnost after an overflow still takes the room that is left", () => {
    const plan = sequentialPlan({ range: { start: 0, end: 100 }, step: 5 }, [
      { activityId: "s", name: "S", seats: 1, minutesPerSeat: 90, parallelCapacity: 1 },
      { activityId: "x", name: "X", seats: 1, minutesPerSeat: 120, parallelCapacity: 1 },
      { activityId: "a", name: "A", seats: 1, minutesPerSeat: 10, parallelCapacity: 1 },
    ]);
    expect(plan.parts.map((p) => [p.activityId, p.range.start, p.range.end])).toEqual([["s", 0, 90], ["a", 90, 100]]);
    expect(plan.overflow).toEqual([{ activityId: "x", name: "X", seats: 1 }]);
  });
});

describe("pickCoverage · the owner's case (Dukla Jižní Město)", () => {
  const windows = [
    { id: "w1", dayKey: "2026-11-13", range: { start: 8 * 60, end: 14 * 60 }, activityIds: ["s"], step: 30 },
    { id: "w2", dayKey: "2026-11-13", range: { start: 14 * 60 + 30, end: 16 * 60 }, activityIds: ["k"], step: 30 },
  ];

  it("counts individually: a 360-min spiro window holds 4 spiro slots, a 90-min komplexní window holds 1 (30 min unused)", () => {
    const c = pickCoverage([komplexni, spiro], windows);
    const k = c.perActivity[0];
    const s = c.perActivity[1];
    expect(k).toMatchObject({ seats: 20, coveredSlots: 1, coveredSeats: 1, remainingSeats: 19, remainingSlots: 19 });
    expect(s).toMatchObject({ seats: 50, coveredSlots: 4, coveredSeats: 4, remainingSeats: 46, remainingSlots: 46 });
    expect(c.totalSeats).toBe(70);
    expect(c.coveredSeats).toBe(5);
    expect(c.remainingSeats).toBe(65);
    /* Σ players × duration / capacity */
    expect(c.neededMinutes).toBe(20 * 60 + 50 * 90);
    expect(c.pickedMinutes).toBe(450);
    expect(c.usedMinutes).toBe(60 + 360);
    expect(c.unusedMinutes).toBe(30);
    expect(c.covered).toBe(false);
    expect(c.windows.find((w) => w.id === "w2")).toMatchObject({ unusedMinutes: 30, coveredAlready: false, parts: [{ activityId: "k", seats: 1, slots: 1 }] });
    expect(c.windows.find((w) => w.id === "w1")).toMatchObject({ unusedMinutes: 0, parts: [{ activityId: "s", seats: 4, slots: 4 }] });
    expect(k.percent).toBe(5);
    expect(s.percent).toBe(8);
  });

  it("a window whose činnost is already covered is spare and says so", () => {
    const c = pickCoverage([{ ...komplexni, seats: 1 }, spiro], [
      ...windows,
      { id: "w3", dayKey: "2026-11-14", range: { start: 8 * 60, end: 10 * 60 }, activityIds: ["k"], step: 30 },
    ]);
    expect(c.perActivity[0]).toMatchObject({ coveredSeats: 1, remainingSeats: 0 });
    expect(c.windows.find((w) => w.id === "w3")).toMatchObject({ coveredAlready: true, unusedMinutes: 120, names: [komplexni.name] });
  });

  it('a "Vše" window is laid out by the sequential plan: komplexní first for everybody, then spiro', () => {
    const c = pickCoverage([komplexni, spiro], [{ id: "v", dayKey: "2026-11-13", range: { start: 8 * 60, end: 17 * 60 }, activityIds: null, step: 30 }]);
    const w = c.windows[0];
    expect(w.parts).toEqual([
      { activityId: "k", name: komplexni.name, range: { start: 480, end: 480 + 540 }, seats: 9, slots: 9 },
    ]);
    expect(c.perActivity[0]).toMatchObject({ coveredSeats: 9, remainingSeats: 11 });
    expect(c.perActivity[1]).toMatchObject({ coveredSeats: 0, remainingSeats: 50 });
    const wide = pickCoverage([{ ...komplexni, seats: 2 }, spiro], [{ id: "v", range: { start: 480, end: 1020 }, activityIds: null, step: 30 }]);
    expect(wide.windows[0].parts.map((p) => [p.activityId, p.range.start, p.range.end, p.seats])).toEqual([["k", 480, 600, 2], ["s", 600, 960, 4]]);
    expect(wide.windows[0].unusedMinutes).toBe(60);
  });

  it("restricted windows are counted before 'Vše' windows, so a spiro-only window never starves", () => {
    const c = pickCoverage([komplexni, { ...spiro, seats: 2 }], [
      { id: "all", dayKey: "2026-11-12", range: { start: 480, end: 480 + 180 }, activityIds: null, step: 30 },
      { id: "s", dayKey: "2026-11-13", range: { start: 480, end: 660 }, activityIds: ["s"], step: 30 },
    ]);
    /* spiro's 2 players are taken by the spiro window; the "Vše" window goes entirely to komplexní. */
    expect(c.perActivity[1]).toMatchObject({ coveredSeats: 2 });
    expect(c.windows.find((w) => w.id === "all")?.parts).toEqual([{ activityId: "k", name: komplexni.name, range: { start: 480, end: 660 }, seats: 3, slots: 3 }]);
    expect(c.covered).toBe(false);
  });

  it("a single činnost: 390 min of 30-min slots for 10 players = 10 covered, 90 min unused, percent 100", () => {
    const basic = { activityId: "a", name: "Základní", seats: 10, minutesPerSeat: 30, parallelCapacity: 1 };
    const c = pickCoverage([basic], [{ range: { start: 570, end: 960 }, activityIds: null, step: 30 }]);
    expect(c).toMatchObject({ covered: true, coveredSeats: 10, pickedMinutes: 390, usedMinutes: 300, unusedMinutes: 90, surplusMinutes: 90, percent: 100 });
    expect(pickCoverage([basic], []).covered).toBe(false);
    expect(pickCoverage([basic], []).percent).toBe(0);
  });

  it("flags a činnost with players that no window allows", () => {
    const c = pickCoverage([komplexni, spiro], [{ range: { start: 0, end: 600 }, activityIds: ["k"], step: 30 }]);
    expect(c.perActivity[1].noWindow).toBe(true);
    expect(c.perActivity[0].noWindow).toBe(false);
  });

  it("enlarging an order shows only the added players: 3 saved of 10, a 30-min window covers the saved 3 → 7 still missing", () => {
    const now = { activityId: "a", name: "Základní", seats: 10, minutesPerSeat: 10, parallelCapacity: 1 };
    const baseline = [{ ...now, seats: 3 }];
    const c = pickCoverage([now], [{ range: { start: 540, end: 570 }, activityIds: null, step: 5 }], { baseline });
    expect(c.additional).toBe(true);
    expect(c).toMatchObject({ totalSeats: 7, coveredSeats: 0, remainingSeats: 7, remainingSlots: 7, neededMinutes: 70, pickedMinutes: 0 });
    const more = pickCoverage([now], [{ range: { start: 540, end: 570 }, activityIds: null, step: 5 }, { range: { start: 780, end: 870 }, activityIds: null, step: 5 }], { baseline });
    expect(more).toMatchObject({ covered: true, coveredSeats: 7, remainingSeats: 0 });
  });
});

describe("over-coverage: spare places and 'Zkrátit na potřebu'", () => {
  const basic = { activityId: "a", name: "Základní", seats: 10, minutesPerSeat: 30, parallelCapacity: 1 };

  it("390 min for 10 × 30 min = 3 spare places (90 min); a 20-min rest is not a place", () => {
    const c = pickCoverage([basic], [{ id: "w", range: { start: 540, end: 930 }, activityIds: null, step: 30 }]);
    expect(c.perActivity[0]).toMatchObject({ spareSeats: 3, spareMinutes: 90, coveredSeats: 10 });
    expect(c.spareSeats).toBe(3);
    expect(c.windows[0].spare).toEqual({ activityId: "a", name: "Základní", seats: 3, minutes: 90 });
    const rest = pickCoverage([basic], [{ id: "w", range: { start: 540, end: 860 }, activityIds: null, step: 5 }]);
    expect(rest.windows[0]).toMatchObject({ unusedMinutes: 20, spare: null });
    expect(rest.spareSeats).toBe(0);
  });

  it("a komplexní-only window after komplexní is covered is spare whole, charged to komplexní (4 places × 60 min = 6 h window)", () => {
    const c = pickCoverage([{ ...komplexni, seats: 4 }, spiro], [
      { id: "k1", dayKey: "2026-11-12", range: { start: 480, end: 720 }, activityIds: ["k"], step: 30 },
      { id: "k2", dayKey: "2026-11-13", range: { start: 480, end: 840 }, activityIds: ["k"], step: 30 },
    ]);
    expect(c.windows.find((w) => w.id === "k1")?.spare).toBeNull();
    expect(c.windows.find((w) => w.id === "k2")).toMatchObject({ coveredAlready: true, spare: { activityId: "k", seats: 6, minutes: 360 } });
    expect(c.perActivity[0]).toMatchObject({ spareSeats: 6, spareMinutes: 360 });
  });

  it("trimToNeed cuts the spare windows back to what is used, snapped up to the step, and drops an unused one", () => {
    const windows = [
      { id: "w1", dayKey: "2026-11-12", range: { start: 540, end: 930 }, activityIds: null, step: 30 },
    ];
    expect(trimToNeed([basic], windows)).toEqual([{ id: "w1", range: { start: 540, end: 840 } }]);
    const two = [
      { id: "k1", dayKey: "2026-11-12", range: { start: 480, end: 720 }, activityIds: ["k"], step: 30 },
      { id: "k2", dayKey: "2026-11-13", range: { start: 480, end: 840 }, activityIds: ["k"], step: 30 },
    ];
    expect(trimToNeed([{ ...komplexni, seats: 4 }], two)).toEqual([{ id: "k2", range: null }]);
    /* 45-min slots at a 30-min step: 3 players use 135 → the end snaps up to 150. */
    const odd = [{ id: "o", range: { start: 480, end: 720 }, activityIds: null, step: 30 }];
    expect(trimToNeed([{ activityId: "x", name: "X", seats: 3, minutesPerSeat: 45, parallelCapacity: 1 }], odd)).toEqual([{ id: "o", range: { start: 480, end: 630 } }]);
    /* Nothing spare: nothing to trim. */
    expect(trimToNeed([basic], [{ id: "w", range: { start: 540, end: 840 }, activityIds: null, step: 30 }])).toEqual([]);
  });
});

describe("more options", () => {
  it("46 spiro players at 90 min ≈ 69 h ≈ 9 whole days of 480 min", () => {
    const need = moreNeeded({ minutesPerSeat: 90, parallelCapacity: 1, remainingSeats: 46 }, 480);
    expect(need).toEqual({ seats: 46, minutes: 4140, days: 9 });
    expect(moreNeededLine(need)).toBe("ještě 46 hráčů ≈ 69 h ≈ 9 celých dní při 1 kalendáři");
    expect(moreNeededLine(moreNeeded({ minutesPerSeat: 60, parallelCapacity: 2, remainingSeats: 3 }, null))).toBe("ještě 3 hráči ≈ 2 h");
  });

  it("openMinutesOf takes the break out", () => {
    expect(openMinutesOf({ isOpen: true, startTime: "08:00:00", endTime: "16:00:00", breakStart: "12:00:00", breakEnd: "12:30:00" })).toBe(450);
    expect(openMinutesOf({ isOpen: false, startTime: null, endTime: null, breakStart: null, breakEnd: null })).toBe(0);
    expect(openMinutesOf(undefined)).toBe(0);
  });

  it("takeForActivity takes whole slots from the day's blocks, never more than the players need", () => {
    const blocks = [{ calendarId: "c1", range: { start: 480, end: 720 } }, { calendarId: "c1", range: { start: 750, end: 960 } }];
    const take = takeForActivity(blocks, { minutesPerSeat: 90, parallelCapacity: 1 }, 3, 30);
    /* 240 min holds 2 × 90 = 180 (→ 480-660), the third slot is in the afternoon block. */
    expect(take.blocks).toEqual([{ calendarId: "c1", range: { start: 480, end: 660 } }, { calendarId: "c1", range: { start: 750, end: 840 } }]);
    expect(take.slots).toBe(3);
    expect(take.trimmed).toBe(true);
    expect(takeForActivity(blocks, { minutesPerSeat: 90, parallelCapacity: 1 }, 0, 30).blocks).toEqual([]);
    /* 46 players: everything that fits is taken whole, nothing trimmed. */
    const all = takeForActivity(blocks, { minutesPerSeat: 90, parallelCapacity: 1 }, 46, 30);
    expect(all.slots).toBe(4);
    expect(all.blocks).toEqual([{ calendarId: "c1", range: { start: 480, end: 660 } }, { calendarId: "c1", range: { start: 750, end: 930 } }]);
  });
});

describe("splitting a window", () => {
  const range = { start: 480, end: 960 };

  it("stepFor takes the calendar's step when it divides the window, else a finer one", () => {
    expect(stepFor(range, 30)).toBe(30);
    expect(stepFor({ start: 480, end: 555 }, 30)).toBe(15);
    expect(stepFor({ start: 485, end: 555 }, 30)).toBe(5);
    expect(stepFor({ start: 481, end: 555 }, 30)).toBe(1);
  });

  it("cuts at the snapped midpoint, keeps the činnosti on both halves, and refuses a part shorter than two steps", () => {
    expect(canSplit({ start: 0, end: 30 }, 30)).toBe(false);
    expect(midpointOf({ start: 480, end: 570 }, 30)).toBe(510);
    expect(midpointOf({ start: 480, end: 540 }, 30)).toBe(510);
    const parts = cutPart([{ range, activityIds: ["s"] }], 0, midpointOf(range, 30), 30);
    expect(parts).toEqual([{ range: { start: 480, end: 720 }, activityIds: ["s"] }, { range: { start: 720, end: 960 }, activityIds: ["s"] }]);
    expect(cutPart([{ range: { start: 0, end: 30 }, activityIds: null }], 0, 15, 30)).toEqual([{ range: { start: 0, end: 30 }, activityIds: null }]);
  });

  it("moves a cut inside its two parts (one step from each edge at least) and merges it back", () => {
    const parts = cutPart([{ range, activityIds: null }], 0, 720, 30);
    expect(moveCut(parts, 0, 600, 30).map((p) => p.range)).toEqual([{ start: 480, end: 600 }, { start: 600, end: 960 }]);
    expect(moveCut(parts, 0, 100, 30).map((p) => p.range)).toEqual([{ start: 480, end: 510 }, { start: 510, end: 960 }]);
    expect(moveCut(parts, 0, 2000, 30).map((p) => p.range)).toEqual([{ start: 480, end: 930 }, { start: 930, end: 960 }]);
    expect(moveCut(parts, 0, 611, 30)[0].range.end).toBe(600);
    expect(mergeCut([{ range: { start: 480, end: 600 }, activityIds: ["k"] }, { range: { start: 600, end: 960 }, activityIds: ["s"] }], 0)).toEqual([{ range, activityIds: ["k"] }]);
  });

  it("partsFromPlan turns the plan into parts for one činnost each and keeps the tail with the window's own činnosti", () => {
    const plan = sequentialPlan({ range, step: 30 }, [{ ...komplexni, seats: 2 }, { ...spiro, seats: 3 }]);
    const parts = partsFromPlan({ range, activityIds: null }, plan.parts);
    expect(parts).toEqual([
      { range: { start: 480, end: 600 }, activityIds: ["k"] },
      { range: { start: 600, end: 870 }, activityIds: ["s"] },
      { range: { start: 870, end: 960 }, activityIds: null },
    ]);
    expect(partsFromPlan({ range, activityIds: ["k"] }, [])).toEqual([{ range, activityIds: ["k"] }]);
  });
});
