import type { CoverageActivity } from "../../clubs/order/coverage";
import type { PickedTime } from "./multiSelect";
import type { AskPart, PlanWindow } from "./pickPlan";

/* What the pick-mode questions (the činnost bubble, the shortfall question) are asked and answered with. */

/**
 * Etapa 12: a window has just been picked (or the desk pressed "Rozdělit" on one) and the bubble asks which činnosti
 * it is for. `windows` are the picks in question (several after a day shortcut around the lunch break), `others` the
 * rest of the pick, so the bubble can count live.
 */
export interface PickAsk {
  /** "new": "Zrušit" removes the windows again. "edit": a window already in the pick, "Zrušit" keeps it as it is. */
  mode: "new" | "edit";
  windows: PickedTime[];
  /** The order's činnosti with players, in the order's order. */
  activities: CoverageActivity[];
  others: PlanWindow[];
  baseline?: CoverageActivity[];
  /** The grid step the window sits on (its calendar's step, or a finer one that fits). */
  stepOf: (calendarId: string) => number;
  calendarName: (calendarId: string) => string;
  /** The price of a činnost (null = none set); the map itself is null while the catalogue loads. */
  prices: ReadonlyMap<string, number | null> | null;
}

/** What the bubble hands back: each window's parts (one part = unchanged window), with the činnosti of each. */
export interface AskResult {
  id: string;
  parts: AskPart[];
}

/**
 * Etapa 12: "Potvrdit objednávku" pressed while players are still without a slot, or with places picked beyond the
 * players (money lost) - the desk decides, nothing is created or trimmed silently.
 */
export interface Shortfall {
  totalSeats: number;
  remainingSeats: number;
  perActivity: { activityId: string; name: string; remainingSeats: number }[];
  /** Calendar minutes the missing players still need (whole slots). */
  neededMinutes: number;
  /** Picked minutes no slot uses (information, never a block). */
  unusedMinutes: number;
  /** Places picked beyond the players, per činnost, with the money they would earn (null = no price set). */
  spare: { activityId: string; name: string; seats: number; minutes: number; lostCzk: number | null }[];
  spareSeats: number;
  editing: boolean;
}

export type ShortfallChoice = "fill" | "trim" | "create";
