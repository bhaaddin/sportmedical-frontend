import { plural } from "../../clubs/blockLogic";
import { formatCzk } from "../../clubs/order/orderFormat";
import { firstWord } from "../../clubs/order/routing";
import { formatFree } from "./pickDays";
import type { PickActivityCoverage } from "./pickPlan";

/* The words the pick-mode dialogs (the činnost bubble, the shortfall question) share. */

const playersWord = (n: number): string => plural(n, ["hráč", "hráči", "hráčů"]);
const placesWord = (n: number): string => plural(n, ["místo", "místa", "míst"]);
export const players = (n: number): string => `${n} ${playersWord(n)}`;
export const places = (n: number): string => `${n} ${placesWord(n)}`;

/** "Navíc 6 h (4 místa Komplexní) – nevyužitý čas ≈ 8 800 Kč ušlých tržeb"; without the money when no price is set. */
export function spareLine(a: Pick<PickActivityCoverage, "name" | "spareSeats" | "spareMinutes">, price: number | null | undefined): string {
  const base = `Navíc ${formatFree(a.spareMinutes)} (${places(a.spareSeats)} ${firstWord(a.name)})`;
  if (price === null || price === undefined || price <= 0) return `${base} – nevyužitý čas`;
  return `${base} – nevyužitý čas ≈ ${formatCzk(price * a.spareSeats)} ušlých tržeb`;
}
