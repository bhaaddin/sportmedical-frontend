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
  paperworkRows,
  paperworkSummary,
  paymentView,
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

describe("podklady k této prohlídce", () => {
  const fmt = (iso: string) => iso;
  const base = { questionnaireRequirement: "Required" as const, documents: [] as never[], formatDate: fmt };

  it("reads registration and questionnaire off the server's reasons, and documents off the check", () => {
    const rows = paperworkRows({
      ...base,
      paperwork: { ready: false, missing: ["questionnaire_missing"] },
      documents: [
        { templateId: "v", templateName: "Výpis", serviceName: "Prohlídka", standing: "Missing", validUntil: null },
        { templateId: "s", templateName: "Souhlas", serviceName: "Prohlídka", standing: "Valid", validUntil: "2027-03-01" },
      ],
    });
    expect(rows.map((r) => [r.label, r.state, r.action ?? null])).toEqual([
      ["Dokončená registrace", "ok", null],
      ["Vstupní dotazník", "missing", "completionLink"],
      ["Výpis", "missing", "documents"],
      ["Souhlas", "ok", null],
    ]);
    expect(rows[3].detail).toBe("vyžaduje služba Prohlídka · platí do 2027-03-01");
    expect(paperworkSummary(rows)).toEqual({ text: "2 chybí", tone: "beige" });
  });

  it("tells 'nothing missing' from 'not wanted' by the činnost's setting", () => {
    const fine = paperworkRows({ ...base, paperwork: { ready: true, missing: [] } });
    expect(fine.map((r) => r.state)).toEqual(["ok", "ok", "notRequired"]);
    expect(paperworkSummary(fine)).toEqual({ text: "vše v pořádku", tone: "green" });

    const notAsked = paperworkRows({ ...base, questionnaireRequirement: "NotAsked", paperwork: { ready: true, missing: [] } });
    expect(notAsked[1]).toMatchObject({ state: "notRequired", detail: "tato činnost dotazník nevyžaduje" });

    /* The server's verdict wins over the setting: a code present is a gap. */
    const contradicted = paperworkRows({ ...base, questionnaireRequirement: "NotAsked", paperwork: { ready: false, missing: ["questionnaire_expired"] } });
    expect(contradicted[1]).toMatchObject({ state: "missing", detail: "vyplněný dotazník je starší než 2 roky" });
  });

  it("never reassures when nobody could look", () => {
    const rows = paperworkRows({ ...base, paperwork: null, documents: null });
    expect(rows.map((r) => r.state)).toEqual(["unknown", "unknown", "unknown"]);
    expect(paperworkSummary(rows)).toEqual({ text: "nelze ověřit", tone: "grey" });
  });

  it("names a report the registry wants when the document list cannot, and an unknown reason as unknown", () => {
    const rows = paperworkRows({ ...base, documents: null, paperwork: { ready: false, missing: ["report_missing", "registration_incomplete", "something_new"] } });
    expect(rows.map((r) => [r.label, r.state])).toEqual([
      ["Dokončená registrace", "missing"],
      ["Vstupní dotazník", "ok"],
      ["Výpis od předchozího lékaře", "missing"],
      ["Neznámý požadavek (something_new)", "missing"],
    ]);
  });

  it("words an expired or expiring document the owner's way", () => {
    const rows = paperworkRows({
      ...base,
      paperwork: { ready: true, missing: [] },
      documents: [
        { templateId: "e", templateName: "Výpis", serviceName: "", standing: "Expired", validUntil: "2026-01-01" },
        { templateId: "x", templateName: "Výpis", serviceName: "", standing: "ExpiringSoon", validUntil: "2026-10-20" },
      ],
    });
    expect(rows[2]).toMatchObject({ state: "missing", detail: "platnost skončila 2026-01-01", action: "documents" });
    expect(rows[3]).toMatchObject({ state: "ok", detail: "platí do 2026-10-20 · brzy vyprší", action: "documents" });
  });
});

describe("PLATBA", () => {
  it("speaks the board's four words and falls back to 'no invoice'", () => {
    expect(paymentView("paid")).toEqual({ label: "Zaplaceno", tone: "green" });
    expect(paymentView("partial")).toEqual({ label: "Částečně zaplaceno", tone: "beige" });
    expect(paymentView("unpaid")).toEqual({ label: "Nezaplaceno", tone: "red" });
    expect(paymentView("none")).toEqual({ label: "Bez dokladu", tone: "grey" });
    expect(paymentView(null)).toEqual({ label: "Bez dokladu", tone: "grey" });
  });
});
