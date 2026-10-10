import { describe, expect, it } from "vitest";
import type { TimeBlock } from "../../../api/bookingContracts";
import { drawnBlocksOfDay } from "./clubWindows";

/* Etapa 12: an order's windows around lunch are ONE block on the grid; deliberate gaps and other orders stay apart. */

const DAY = "2026-10-26";
const club = (id: string, start: string, end: string, clubBlockId = "cb1"): TimeBlock => ({
  id,
  startUtc: `${DAY}T${start}:00Z`,
  endUtc: `${DAY}T${end}:00Z`,
  reason: "",
  kind: "club",
  clubBlockId,
  clubId: "club1",
  clubName: "FK Slaný",
  colorHex: "#7B1FA2",
});
/* UTC 07:00–11:00 and 11:30–15:00 are 08:00–12:00 and 12:30–16:00 in Prague on that date. */
const LUNCH = { start: 12 * 60, end: 12 * 60 + 30 };

describe("drawnBlocksOfDay", () => {
  it("joins the morning and the afternoon window of one order across the lunch band", () => {
    const drawn = drawnBlocksOfDay([club("w2", "11:30", "15:00"), club("w1", "07:00", "11:00")], DAY, LUNCH);
    expect(drawn).toHaveLength(1);
    expect(drawn[0].span).toEqual({ start: 8 * 60, end: 16 * 60 });
    expect(drawn[0].block.id).toBe("w1");
    expect(drawn[0].parts.map((p) => p.id)).toEqual(["w1", "w2"]);
  });

  it("joins windows that touch, even without a lunch band", () => {
    const drawn = drawnBlocksOfDay([club("w1", "07:00", "11:00"), club("w2", "11:00", "15:00")], DAY, null);
    expect(drawn).toHaveLength(1);
    expect(drawn[0].span).toEqual({ start: 8 * 60, end: 16 * 60 });
  });

  it("keeps two windows apart when free time, not lunch, lies between them", () => {
    const drawn = drawnBlocksOfDay([club("w1", "07:00", "09:00"), club("w2", "12:00", "14:00")], DAY, LUNCH);
    expect(drawn).toHaveLength(2);
  });

  it("keeps a gap wider than the lunch band", () => {
    /* 11:30–13:00 local lies around lunch but reaches past it - the desk left that time free. */
    const drawn = drawnBlocksOfDay([club("w1", "07:00", "10:30"), club("w2", "12:00", "15:00")], DAY, LUNCH);
    expect(drawn).toHaveLength(2);
  });

  it("never joins two different orders or a manual block", () => {
    const manual: TimeBlock = { id: "m", startUtc: `${DAY}T11:00:00Z`, endUtc: `${DAY}T11:30:00Z`, reason: "Porada", kind: "manual" };
    const drawn = drawnBlocksOfDay([club("w1", "07:00", "11:00"), club("w2", "11:30", "15:00", "cb2"), manual], DAY, LUNCH);
    expect(drawn.map((d) => d.block.id)).toEqual(["w1", "m", "w2"]);
  });
});
