/* ══════════════════════════════════════════════════════════════
   RESULTS MODEL  (patient portal, Výsledky — artboard V-Vysledky)

   Turns the sessions the server sends into what the page draws. Every value is
   a real column of the session (contract C-M): VO₂max, maximal and threshold
   heart rate, the threshold as a share of VO₂max, maximal power and W/kg,
   weight, body fat, muscle mass, blood pressure, training zones, the device,
   the protocol type and the date of the measurement.

   A value that is not there is "—". Nothing is estimated, converted or
   invented. The doctor's notes are not part of a portal result and are never
   read, whatever an older API might still send.
   ══════════════════════════════════════════════════════════════ */

import type { PortalResult } from '../../../api/patientPortal';
import { zoneRange } from '../../patients/results/measuredValues';

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
  /** "120–150 bpm", "od 120 bpm", "do 124 bpm"; '' when the zone has no bounds. */
  range: string;
  note: string;
}

export interface Measurement {
  id: string;
  /** What the table sorts by and the header shows: the day of the measurement, else when it was recorded. */
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
  weight: string;
  /** The threshold as a share of VO₂max, a number or "—". */
  thresholdPercent: string;
  maxPower: string;
  powerPerKg: string;
  device: string;
  protocol: string;
  zones: TrainingZone[];
  /** Labelled facts about the measurement itself, every one with "—" when missing. */
  extras: Array<[string, string]>;
}

const text = (value: string | null | undefined): string =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : MISSING;

export function toMeasurement(result: PortalResult): Measurement {
  const measuredOn = result.measuredOn ?? null;
  const dateIso = measuredOn !== null && /^\d{4}-\d{2}-\d{2}/.test(measuredOn) ? measuredOn.slice(0, 10) : result.sessionDate;

  const zones: TrainingZone[] = (result.trainingZones ?? []).map((zone, index) => ({
    name: text(zone.name) === MISSING ? `Zóna ${index + 1}` : zone.name.trim(),
    range: zoneRange(zone),
    note: typeof zone.note === 'string' ? zone.note.trim() : '',
  }));

  const device = text(result.device);
  const protocol = text(result.protocolType);

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
    weight: formatNumber(result.weightKg),
    thresholdPercent: formatNumber(result.thresholdPercentVo2Max),
    maxPower: formatNumber(result.maxPowerWatts, 0),
    powerPerKg: formatNumber(result.powerPerKg, 2),
    device,
    protocol,
    zones,
    extras: [
      ['Datum měření', formatDate(dateIso)],
      ['Typ protokolu', protocol],
      ['Přístroj', device],
    ],
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
