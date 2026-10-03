/* ══════════════════════════════════════════════════════════════
   RESULTS MODEL  (patient portal, Výsledky — artboard V-Vysledky)

   Turns the sessions the server sends into what the page draws. It shows what a
   diagnostic session already stores (VO₂max, maximal and threshold heart rate,
   resting heart rate, blood pressure, body fat, muscle mass) plus the extra
   facts a doctor typed by hand, which travel in the session's notes as the
   labelled "[Ruční zápis]" block and are read back with `parseManualExtras`
   (the same helper the staff screen uses).

   A value that is not there is "—". Nothing is estimated, converted or invented,
   and the doctor's free-text notes are NOT shown to the patient: only the
   structured block is.
   ══════════════════════════════════════════════════════════════ */

import type { PortalResult } from '../../../api/patientPortal';
import { parseManualExtras } from '../../patients/manualResults';

/** What stands in for a value the session does not carry. */
export const MISSING = '—';

/** A stored number, or null when it is absent or not a real measurement (≤ 0). */
export function present(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** "54,2" — Czech decimal comma, at most one decimal, or "—". */
export function formatNumber(value: number | null | undefined, maximumFractionDigits = 1): string {
  const real = present(value);
  return real === null ? MISSING : real.toLocaleString('cs-CZ', { maximumFractionDigits });
}

/** "120/80" or "—" when either pressure is missing. */
export function formatPressure(systolic: number | null | undefined, diastolic: number | null | undefined): string {
  const s = present(systolic);
  const d = present(diastolic);
  return s === null || d === null ? MISSING : `${Math.round(s)}/${Math.round(d)}`;
}

/** "24. 9. 2026" from a yyyy-MM-dd or an instant (read in the clinic's zone). */
export function formatDate(value: string): string {
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (plain !== null) return `${Number(plain[3])}. ${Number(plain[2])}. ${plain[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return MISSING;
  return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Europe/Prague' });
}

export interface TrainingZone {
  name: string;
  range: string;
}

export interface Measurement {
  id: string;
  /** What the table sorts by and the header shows: the doctor's "Datum měření", else when it was recorded. */
  dateIso: string;
  date: string;
  practitioner: string | null;
  vo2Max: string;
  maxHeartRate: string;
  thresholdHeartRate: string;
  restingHeartRate: string;
  bloodPressure: string;
  bodyFat: string;
  muscleMass: string;
  /** From the manual block ("79,1 kg"), as typed. */
  weight: string;
  /** The threshold as a share of VO₂max, from the manual block, as typed. */
  thresholdShare: string | null;
  zones: TrainingZone[];
  /** Every other labelled fact of the manual block, in the order written. */
  extras: Array<[string, string]>;
}

const RESERVED = new Set(['Datum měření', 'Hmotnost', 'Práh']);

export function toMeasurement(result: PortalResult): Measurement {
  const { facts } = parseManualExtras(result.rawPractitionerNotes);
  const fact = (label: string): string | null => facts.find(([l]) => l === label)?.[1] ?? null;

  const measuredOn = fact('Datum měření');
  const dateIso = measuredOn !== null && /^\d{4}-\d{2}-\d{2}$/.test(measuredOn) ? measuredOn : result.sessionDate;

  const zones: TrainingZone[] = facts
    .filter(([label]) => /^Zóna \d+$/.test(label))
    .map(([label, value]) => {
      const [name, range] = value.split('|').map((part) => part.trim());
      return { name: name !== undefined && name !== '' ? name : label, range: range ?? '' };
    });

  return {
    id: result.id,
    dateIso,
    date: formatDate(dateIso),
    practitioner: result.practitionerName?.trim() ? result.practitionerName.trim() : null,
    vo2Max: formatNumber(result.vo2MaxMlMinKg),
    maxHeartRate: formatNumber(result.maxHeartRateBpm, 0),
    thresholdHeartRate: formatNumber(result.anaerobicThresholdBpm, 0),
    restingHeartRate: formatNumber(result.restingHeartRateBpm, 0),
    bloodPressure: formatPressure(result.systolicBloodPressure, result.diastolicBloodPressure),
    bodyFat: formatNumber(result.bodyFatPercentage),
    muscleMass: formatNumber(result.muscleMassKg),
    weight: fact('Hmotnost') ?? MISSING,
    thresholdShare: fact('Práh'),
    zones,
    extras: facts.filter(([label]) => !RESERVED.has(label) && !/^Zóna \d+$/.test(label)),
  };
}

/** Newest first, by the date shown. */
export function toMeasurements(results: PortalResult[] | undefined): Measurement[] {
  return (results ?? [])
    .map(toMeasurement)
    .sort((a, b) => b.dateIso.localeCompare(a.dateIso));
}

/** "6 měření" — the noun does not change in Czech, only the sentence around it. */
export function measurementCountText(count: number): string {
  return count === 0 ? 'Zatím tu nejsou žádná měření.' : `${count} měření`;
}
