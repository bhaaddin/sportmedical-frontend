/*
 * The arithmetic under the appointment detail and its edit form (board
 * screens 12 and 13): what a draft changes, whether a typed start was
 * offered, which statuses the STAV select may hold, and how the header dates
 * are worded. No DOM - the markup is the integrator's visual pass.
 */
import { describe, expect, it } from "vitest";
import {
  draftFrom,
  durationMinutes,
  formatCzk,
  formatLongPragueDate,
  formatShortPragueDateTime,
  formatWallClock,
  initials,
  isOfferedStart,
  planEdit,
  pragueWallDate,
  reachableStatuses,
  sourceLabel,
  statusTone,
} from "./appointmentEdit";

/* 26. 10. 2026 is a Monday; Prague is on CET (+1) then, so 09:30 local = 08:30Z. */
const monday = { startUtc: "2026-10-26T08:30:00Z", status: 0 };

describe("the header wording", () => {
  it("says the day the board's way, capitalised, in Prague time", () => {
    expect(formatLongPragueDate(monday.startUtc)).toBe("Pondělí 26. října 2026");
    expect(formatShortPragueDateTime(monday.startUtc)).toBe("Po 26. 10. 2026, 09:30");
  });

  it("gives the form two-digit wall-clock values on the Prague date", () => {
    expect(formatWallClock(monday.startUtc)).toBe("09:30");
    expect(pragueWallDate(monday.startUtc)).toBe("2026-10-26");
    /* 23:30Z in summer is 01:30 the next Prague day. */
    expect(pragueWallDate("2026-07-01T23:30:00Z")).toBe("2026-07-02");
    expect(formatWallClock("2026-07-01T23:30:00Z")).toBe("01:30");
  });

  it("counts minutes, formats money and makes initials", () => {
    expect(durationMinutes("2026-10-26T08:30:00Z", "2026-10-26T09:00:00Z")).toBe(30);
    /* cs-CZ groups thousands with a non-breaking space; the reader sees "1 600 Kč". */
    expect(formatCzk(1600).replace(/ /g, " ")).toBe("1 600 Kč");
    expect(initials("Bohumil Komárek")).toBe("BK");
    expect(initials("Madonna")).toBe("M");
    expect(initials(null)).toBe("?");
  });

  it("tones and sources follow 4.5", () => {
    expect(statusTone(0)).toBe("green");
    expect(statusTone(2)).toBe("green");
    expect(statusTone(5)).toBe("red");
    expect(statusTone(4)).toBe("grey");
    expect(sourceLabel(0)).toBe("Recepce");
    expect(sourceLabel(1)).toBe("Web");
    expect(sourceLabel(2)).toBe("Klub");
    expect(sourceLabel(null)).toBe("—");
  });
});

describe("the edit plan", () => {
  it("opens with exactly what the appointment is, and plans nothing", () => {
    const draft = draftFrom(monday);
    expect(draft).toEqual({ date: "2026-10-26", time: "09:30", status: 0 });
    expect(planEdit(monday, draft)).toEqual({ startUtc: null, status: null });
  });

  it("turns a new Prague wall-clock time into the right instant", () => {
    const plan = planEdit(monday, { date: "2026-10-26", time: "10:00", status: 0 });
    expect(plan.startUtc).toBe("2026-10-26T09:00:00.000Z");
    expect(plan.status).toBeNull();
  });

  it("plans a status change on its own", () => {
    const plan = planEdit(monday, { date: "2026-10-26", time: "09:30", status: 1 });
    expect(plan).toEqual({ startUtc: null, status: 1 });
  });

  it("treats an unparseable time as no move rather than a move to nowhere", () => {
    const plan = planEdit(monday, { date: "2026-10-26", time: "", status: 0 });
    expect(plan.startUtc).toBeNull();
  });

  it("offers only the statuses the transition table reaches, never cancel", () => {
    expect(reachableStatuses(0)).toEqual([0, 1, 2, 5]);
    expect(reachableStatuses(2)).toEqual([2, 0, 3, 5]);
    expect(reachableStatuses(3)).toEqual([3]);
  });

  it("calls a start free only when the server listed it (6.1)", () => {
    const slots = [{ startUtc: "2026-10-26T09:00:00Z", endUtc: "2026-10-26T09:30:00Z" }];
    expect(isOfferedStart(slots, "2026-10-26T09:00:00.000Z")).toBe(true);
    expect(isOfferedStart(slots, "2026-10-26T09:15:00.000Z")).toBe(false);
    expect(isOfferedStart(undefined, "2026-10-26T09:00:00.000Z")).toBe(false);
  });
});
