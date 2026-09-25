/* ══════════════════════════════════════════════════════════════
   Posudky — certificates of medical fitness for sport, per patient.

     GET  /api/patients/{id}/posudky              list (documents.view)
     POST /api/patients/{id}/posudky              issue (documents.manage);
                                                  the issuing doctor is the
                                                  signed-in account
     GET  /api/patients/{id}/posudky/{pid}/pdf    the PDF (documents.view),
                                                  rendered fresh from Nastavení
                                                  and the registry
   ══════════════════════════════════════════════════════════════ */
import { client } from './client';

export type PosudekType = 'ZakladniProhlidka' | 'KomplexniProhlidka' | 'Predsezonni' | 'Pooporavu';
export type PosudekResult = 'Fit' | 'Unfit' | 'FitWithRestrictions';

export interface Posudek {
  id: string;
  patientId: string;
  type: PosudekType;
  typeText: string;
  result: PosudekResult;
  resultText: string;
  restrictions: string | null;
  sport: string;
  club: string | null;
  /** yyyy-mm-dd */
  reportDate: string;
  /** yyyy-mm-dd */
  validUntil: string;
  isValidToday: boolean;
  practitioner: string;
  note: string | null;
  createdAt: string;
}

export interface IssuePosudekInput {
  type: PosudekType;
  result: PosudekResult;
  restrictions?: string;
  sport: string;
  club?: string;
  /** yyyy-mm-dd */
  validUntil: string;
  note?: string;
}

/** The Czech for each type, with one sentence saying when it is the right one. */
export const POSUDEK_TYPES: { value: PosudekType; label: string; help: string }[] = [
  { value: 'ZakladniProhlidka', label: 'Základní prohlídka', help: 'Běžná roční prohlídka výkonnostního nebo rekreačního sportovce.' },
  { value: 'KomplexniProhlidka', label: 'Komplexní prohlídka', help: 'Rozšířená prohlídka se zátěžovým testem, typicky u vrcholových sportovců.' },
  { value: 'Predsezonni', label: 'Předsezónní prohlídka', help: 'Před začátkem sezóny, obvykle na žádost klubu.' },
  { value: 'Pooporavu', label: 'Prohlídka po zranění', help: 'Návrat ke sportu po zranění nebo nemoci.' },
];

/** The Czech for each result, with the sentence that ends up on the certificate. */
export const POSUDEK_RESULTS: { value: PosudekResult; label: string; help: string }[] = [
  { value: 'Fit', label: 'Způsobilý', help: 'Bez omezení; na posudku bude „posuzovaná osoba je způsobilá“.' },
  { value: 'FitWithRestrictions', label: 'Způsobilý s omezením', help: 'Smí sportovat jen za podmínek, které napíšete do omezení; ty se tisknou na posudek.' },
  { value: 'Unfit', label: 'Nezpůsobilý', help: 'Nesmí sportovat; důvod můžete uvést do omezení.' },
];

export const posudkyApi = {
  list: async (patientId: string): Promise<Posudek[]> => {
    const { data } = await client.get<Posudek[]>(`/api/patients/${encodeURIComponent(patientId)}/posudky`);
    return data ?? [];
  },

  issue: async (patientId: string, input: IssuePosudekInput): Promise<Posudek> => {
    const { data } = await client.post<Posudek>(`/api/patients/${encodeURIComponent(patientId)}/posudky`, input);
    return data;
  },

  pdf: async (patientId: string, posudekId: string): Promise<{ blob: Blob; fileName: string }> => {
    const res = await client.get(
      `/api/patients/${encodeURIComponent(patientId)}/posudky/${encodeURIComponent(posudekId)}/pdf`,
      { responseType: 'blob' },
    );
    const disposition = String(res.headers?.['content-disposition'] ?? '');
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    const fileName = match ? decodeURIComponent(match[1]) : `posudek-${posudekId}.pdf`;
    return { blob: res.data as Blob, fileName };
  },
};

/** yyyy-mm-dd for the day one year on, the usual validity. */
export function defaultValidUntil(today: Date = new Date()): string {
  const next = new Date(Date.UTC(today.getFullYear() + 1, today.getMonth(), today.getDate()));
  return next.toISOString().slice(0, 10);
}
