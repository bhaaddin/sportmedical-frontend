/*
 * What the club-block panel does with the athletes list (contract C-C): order
 * it, name the statuses, and turn it into the CSV "Stáhnout seznam" hands over.
 * Pure, so the tests can say exactly what a file contains.
 *
 * The CSV carries what a coach needs on the day and nothing more personal than
 * a phone number: name, činnost, start, end, status, phone. No birth number, no
 * e-mail, no insurance - the server does not send them and this never asks.
 */
import type { ClubBlockAthlete, ClubBlockAthleteStatus } from '../../api/clubBlocks';
import type { ChipTone } from '../ui';
import { pragueHHMM } from '../../pages/clubs/clubOrders';
import { pragueDateKey } from '../../utils/time';
import { formatCzk } from './order/orderFormat';

export const ATHLETE_STATUS_LABEL: Record<ClubBlockAthleteStatus, string> = {
  Booked: 'Zaregistrován',
  Attended: 'Dorazil',
  NoShow: 'Nedostavil se',
  Cancelled: 'Zrušeno',
};

export const ATHLETE_STATUS_TONE: Record<ClubBlockAthleteStatus, ChipTone> = {
  Booked: 'blue',
  Attended: 'green',
  NoShow: 'red',
  Cancelled: 'grey',
};

export type SortDirection = 'asc' | 'desc';

/** By start time; athletes without a time go last either way, ties keep the server's order. */
export function sortAthletes(athletes: readonly ClubBlockAthlete[], direction: SortDirection = 'asc'): ClubBlockAthlete[] {
  const sign = direction === 'asc' ? 1 : -1;
  return athletes
    .map((athlete, index) => ({ athlete, index }))
    .sort((a, b) => {
      const x = a.athlete.startUtc === null ? NaN : Date.parse(a.athlete.startUtc);
      const y = b.athlete.startUtc === null ? NaN : Date.parse(b.athlete.startUtc);
      if (Number.isNaN(x) && Number.isNaN(y)) return a.index - b.index;
      if (Number.isNaN(x)) return 1;
      if (Number.isNaN(y)) return -1;
      return x === y ? a.index - b.index : (x - y) * sign;
    })
    .map((entry) => entry.athlete);
}

/* ── Price (Etapa 12: "ceny všude") ── */

export interface AthletePrice {
  /** What this athlete's visit costs: the agreed price when the desk set one, else the list price; null when neither is known. */
  czk: number | null;
  /** The desk agreed a price different from the list's ("upraveno"). */
  adjusted: boolean;
}

/** Tolerant: an older server sends neither field, and that reads as "no price" - never as zero. */
export function athletePrice(a: Pick<ClubBlockAthlete, 'agreedPriceCzk' | 'listPriceCzk'>): AthletePrice {
  const agreed = typeof a.agreedPriceCzk === 'number' && Number.isFinite(a.agreedPriceCzk) ? a.agreedPriceCzk : null;
  const list = typeof a.listPriceCzk === 'number' && Number.isFinite(a.listPriceCzk) ? a.listPriceCzk : null;
  return { czk: agreed ?? list, adjusted: agreed !== null && agreed !== list };
}

/** "1 600 Kč", "1 200 Kč (upraveno)" or "bez ceny" - the one wording every player list uses. */
export function athletePriceText(a: Pick<ClubBlockAthlete, 'agreedPriceCzk' | 'listPriceCzk'>): string {
  const p = athletePrice(a);
  if (p.czk === null) return 'bez ceny';
  return p.adjusted ? `${formatCzk(p.czk)} (upraveno)` : formatCzk(p.czk);
}

/* ── CSV ── */

export const CSV_HEADERS = ['Jméno', 'Činnost', 'Začátek', 'Konec', 'Stav', 'Telefon', 'Cena', 'Cena upravena'] as const;

/** The two price cells of a CSV row: the amount as a plain number (empty when unknown) and "Ano" when the desk changed it. */
export const csvPriceCells = (a: Pick<ClubBlockAthlete, 'agreedPriceCzk' | 'listPriceCzk'>): [string, string] => {
  const p = athletePrice(a);
  return [p.czk === null ? '' : String(Math.round(p.czk)), p.adjusted ? 'Ano' : ''];
};

/** "26. 10. 2026 11:00" in the clinic's time zone. */
export function csvTime(instantUtc: string | null): string {
  if (instantUtc === null || Number.isNaN(Date.parse(instantUtc))) return '';
  const [y, m, d] = pragueDateKey(instantUtc).split('-').map(Number);
  return `${d}. ${m}. ${y} ${pragueHHMM(instantUtc)}`;
}

const PHONE_LIKE = /^[+\-]?[\d\s()-]+$/;

/** A cell a spreadsheet must not read as a formula; quoted when it holds a separator, quote or line break. */
export function csvCell(value: string): string {
  const risky = /^[=+\-@\t\r]/.test(value) && !PHONE_LIKE.test(value);
  const safe = risky ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function athletesToCsv(athletes: readonly ClubBlockAthlete[]): string {
  const rows = sortAthletes(athletes).map((a) =>
    [a.name, a.activityName, csvTime(a.startUtc), csvTime(a.endUtc), ATHLETE_STATUS_LABEL[a.status], a.phone ?? '', ...csvPriceCells(a)].map(csvCell).join(';'),
  );
  return [CSV_HEADERS.join(';'), ...rows].join('\r\n') + '\r\n';
}

/** "sportovci-fk-sparta-podzim.csv" - no diacritics, nothing a file system refuses. */
export function athletesCsvFilename(blockTitle: string): string {
  const slug = blockTitle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `sportovci-${slug === '' ? 'blok' : slug}.csv`;
}

/** Hands the file to the browser: UTF-8 with a BOM, so Excel reads the Czech letters. */
export function downloadAthletesCsv(athletes: readonly ClubBlockAthlete[], blockTitle: string): void {
  const blob = new Blob(['\uFEFF', athletesToCsv(athletes)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = athletesCsvFilename(blockTitle);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
