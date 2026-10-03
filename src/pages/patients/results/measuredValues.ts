/*
 * The measured values of one diagnostic session, read from its columns (C-M).
 * Nothing is parsed out of the doctor's notes. A value the session does not
 * carry is "—"; nothing is estimated or converted.
 *
 * Shared by the patient card's Výsledky tab and the patient portal.
 */
import type { DiagnosticSession, TrainingZone } from '../../../api/diagnostics';

/** What stands in for a value the session does not carry. */
export const MISSING = '—';

/** A stored number, or null when it is absent or not a real measurement (≤ 0). */
export function presentNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** "54,2" - Czech decimal comma, at most `digits` decimals, or "—". */
export function formatValue(value: number | null | undefined, digits = 1): string {
  const real = presentNumber(value);
  return real === null ? MISSING : real.toLocaleString('cs-CZ', { maximumFractionDigits: digits });
}

/** "120–150 bpm", "od 120 bpm", "do 150 bpm", or '' when the zone has no bounds. */
export function zoneRange(zone: Pick<TrainingZone, 'fromBpm' | 'toBpm'>): string {
  const from = presentNumber(zone.fromBpm);
  const to = presentNumber(zone.toBpm);
  const f = (v: number) => v.toLocaleString('cs-CZ', { maximumFractionDigits: 1 });
  if (from !== null && to !== null) return `${f(from)}–${f(to)} bpm`;
  if (from !== null) return `od ${f(from)} bpm`;
  if (to !== null) return `do ${f(to)} bpm`;
  return '';
}

/** The day of the measurement: the doctor's date, else when the session was recorded. */
export const measurementDate = (s: Pick<DiagnosticSession, 'measuredOn' | 'sessionDate'>): string =>
  s.measuredOn ?? s.sessionDate;

export interface ValueRow {
  key: string;
  label: string;
  /** Already formatted, with its unit; "—" when not measured. */
  value: string;
}

const withUnit = (text: string, unit: string) => (text === MISSING ? MISSING : `${text} ${unit}`);
const freeText = (v: string | null | undefined) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : MISSING);

/** Every measured value of a session, in reading order. */
export function sessionValueRows(s: DiagnosticSession): ValueRow[] {
  const sys = presentNumber(s.systolicBloodPressure);
  const dia = presentNumber(s.diastolicBloodPressure);
  return [
    { key: 'vo2', label: 'VO₂max', value: withUnit(formatValue(s.vo2MaxMlMinKg), 'ml/kg/min') },
    { key: 'resting', label: 'Klidový tep', value: withUnit(formatValue(s.restingHeartRateBpm, 0), 'bpm') },
    { key: 'max', label: 'Max. tep', value: withUnit(formatValue(s.maxHeartRateBpm, 0), 'bpm') },
    { key: 'threshold', label: 'Tep prahu', value: withUnit(formatValue(s.anaerobicThresholdBpm, 0), 'bpm') },
    { key: 'thresholdPct', label: 'Práh v % VO₂max', value: withUnit(formatValue(s.thresholdPercentVo2Max), '%') },
    { key: 'power', label: 'Max. výkon', value: withUnit(formatValue(s.maxPowerWatts, 0), 'W') },
    { key: 'powerPerKg', label: 'Výkon na kg', value: withUnit(formatValue(s.powerPerKg, 2), 'W/kg') },
    { key: 'weight', label: 'Hmotnost', value: withUnit(formatValue(s.weightKg), 'kg') },
    { key: 'fat', label: 'Tělesný tuk', value: withUnit(formatValue(s.bodyFatPercentage), '%') },
    { key: 'muscle', label: 'Svalová hmota', value: withUnit(formatValue(s.muscleMassKg), 'kg') },
    {
      key: 'pressure',
      label: 'Krevní tlak',
      value: sys === null || dia === null ? MISSING : `${Math.round(sys)}/${Math.round(dia)} mmHg`,
    },
    { key: 'protocol', label: 'Protokol', value: freeText(s.protocolType) },
    { key: 'device', label: 'Přístroj', value: freeText(s.device) },
  ];
}
