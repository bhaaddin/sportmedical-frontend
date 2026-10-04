/* Hráči: every athlete registered through a club link, across clubs and orders. Pure; the CSV reuses athleteList's cells. */
import type { ClubBlockAthlete, ClubBlockAthleteStatus, ClubBlockView } from '../../../api/clubBlocks';
import type { ClubOrderView } from '../../../api/clubOrders';
import { ATHLETE_STATUS_LABEL, csvCell, csvTime } from '../../../components/clubs/athleteList';

export interface PlayerRow {
  id: string;
  name: string;
  clubId: string;
  clubName: string;
  clubColorHex: string | null;
  activityName: string;
  startUtc: string | null;
  endUtc: string | null;
  status: ClubBlockAthleteStatus;
  phone: string | null;
}

export interface PlayerFilters {
  clubId: string;
  activity: string;
  status: '' | ClubBlockAthleteStatus;
  search: string;
}

const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

interface AthleteSource {
  clubId: string;
  clubName: string;
  colorHex?: string | null;
  athletes?: ClubBlockAthlete[];
}

/** Blocks first, then the blocks an order carries; the same athlete id is listed once. */
export function collectPlayers(blocks: readonly ClubBlockView[], orders: readonly ClubOrderView[]): PlayerRow[] {
  const seen = new Set<string>();
  const rows: PlayerRow[] = [];
  const take = (source: AthleteSource, fallbackColor: string | null) => {
    for (const a of source.athletes ?? []) {
      const key = a.id || `${source.clubId}|${a.name}|${a.startUtc}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        id: key,
        name: a.name,
        clubId: source.clubId,
        clubName: source.clubName,
        clubColorHex: source.colorHex ?? fallbackColor,
        activityName: a.activityName ?? '',
        startUtc: a.startUtc ?? null,
        endUtc: a.endUtc ?? null,
        status: a.status ?? 'Booked',
        phone: a.phone ?? null,
      });
    }
  };
  for (const b of blocks) take(b, null);
  for (const o of orders) {
    for (const b of o.blocks) {
      take({ clubId: b.clubId || o.clubId, clubName: b.clubName || o.clubName, colorHex: b.colorHex, athletes: b.athletes }, o.clubColorHex);
    }
  }
  return rows;
}

export function filterPlayers(rows: readonly PlayerRow[], f: PlayerFilters): PlayerRow[] {
  const q = fold(f.search);
  return rows
    .filter(
      (r) =>
        (f.clubId === '' || r.clubId === f.clubId) &&
        (f.activity === '' || r.activityName === f.activity) &&
        (f.status === '' || r.status === f.status) &&
        (q === '' || fold(r.name).includes(q)),
    )
    .sort((a, b) => {
      const x = a.startUtc === null ? Infinity : Date.parse(a.startUtc);
      const y = b.startUtc === null ? Infinity : Date.parse(b.startUtc);
      return x === y ? a.name.localeCompare(b.name, 'cs') : x - y;
    });
}

export const PLAYER_CSV_HEADERS = ['Jméno', 'Klub', 'Činnost', 'Začátek', 'Konec', 'Stav', 'Telefon'] as const;

export function playersToCsv(rows: readonly PlayerRow[]): string {
  const lines = rows.map((r) =>
    [r.name, r.clubName, r.activityName, csvTime(r.startUtc), csvTime(r.endUtc), ATHLETE_STATUS_LABEL[r.status], r.phone ?? ''].map(csvCell).join(';'),
  );
  return [PLAYER_CSV_HEADERS.join(';'), ...lines].join('\r\n') + '\r\n';
}

/** A phone number reduced to what a tel: link accepts. */
export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`;
