/*
 * The CSV of what Statistiky is showing, built as a pure function so the rows
 * can be tested without a browser. `downloadCsv` is the one impure helper, and
 * it only hands a Blob to a one-off link: nothing is sent anywhere.
 *
 * Excel-friendly for a Czech machine: semicolons, a decimal comma, CRLF, and a
 * UTF-8 BOM so the diacritics survive (all of that is `toCsv`'s). The sections
 * are the charts' own tables - aggregates by period, činnost, calendar - so no
 * personal identifier is ever a column; as a last line of defence a cell that
 * looks like a birth number (rodné číslo) is blanked rather than written.
 */
import { downloadCsv as saveCsv } from '../../utils/download';
import { csvFileName, toCsv } from './aggregate';
import type { CsvCell, Period } from './aggregate';

export interface CsvSection {
  title: string;
  columns: readonly string[];
  rows: readonly (readonly CsvCell[])[];
}

/** 6 digits, an optional slash, 3-4 digits: the shape of a Czech birth number. */
const BIRTH_NUMBER = /^\s*\d{6}\s*\/?\s*\d{3,4}\s*$/;

const safe = (cell: CsvCell): CsvCell =>
  typeof cell === 'string' && BIRTH_NUMBER.test(cell) ? '' : cell;

/**
 * Sections one under another, each introduced by its title and a header row,
 * with a blank line between. The first line says what the file is and for
 * which period.
 */
export function buildStatisticsCsv(sections: readonly CsvSection[], period: Period): string {
  const rows: CsvCell[][] = [];
  sections.forEach((section) => {
    rows.push([], [section.title]);
    rows.push([...section.columns]);
    for (const r of section.rows) rows.push(r.map(safe));
  });
  return toCsv(['Statistiky', `Období ${period.from} až ${period.to}`], rows);
}

/** `statistiky-objednavky-2026-10-01_2026-10-31.csv` */
export const statisticsCsvFileName = (areaLabel: string, period: Period): string =>
  csvFileName(areaLabel, period);

/**
 * Saves a CSV through the one download helper (`utils/download`): UTF-8 with one byte-order mark, allowed by an
 * administrator (`exports.download`) and audited by kind and row count. `kind` is the audit slug.
 */
export function downloadCsv(fileName: string, csv: string, kind = 'statistics-csv'): Promise<boolean> {
  /* header line + one per row; the blank lines between sections are rows too, close enough for an audit count */
  const rows = Math.max(0, csv.split(/\r?\n/).filter((line) => line.trim() !== '').length - 1);
  return saveCsv(kind, fileName, csv, rows);
}
