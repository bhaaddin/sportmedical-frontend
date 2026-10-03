/*
 * The athletes list behind "Stáhnout seznam": the CSV has to open in a Czech
 * Excel (semicolons, UTF-8 BOM), say what a coach needs and nothing more personal
 * than a phone number, and never let a name turn into a formula.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ClubBlockAthlete } from '../../api/clubBlocks';
import { pragueWallClockToInstant } from '../../utils/time';
import { athletesCsvFilename, athletesToCsv, CSV_HEADERS, csvCell, csvTime, downloadAthletesCsv, sortAthletes } from './athleteList';

const at = (date: string, time: string) => pragueWallClockToInstant(date, time).toISOString();

const athlete = (over: Partial<ClubBlockAthlete> = {}): ClubBlockAthlete => ({
  id: 'p1', name: 'Jan Novák', activityName: 'Základní prohlídka', startUtc: at('2026-10-26', '11:00'), endUtc: at('2026-10-26', '12:00'),
  status: 'Booked', phone: '+420 777 123 456', ...over,
});

afterEach(() => vi.restoreAllMocks());

describe('sortAthletes', () => {
  it('orders by start time, athletes without one last, ties in the server order', () => {
    const list = [
      athlete({ id: 'none', startUtc: null }),
      athlete({ id: 'late', startUtc: at('2026-10-27', '09:00') }),
      athlete({ id: 'a', startUtc: at('2026-10-26', '11:00') }),
      athlete({ id: 'b', startUtc: at('2026-10-26', '11:00') }),
    ];
    expect(sortAthletes(list).map((a) => a.id)).toEqual(['a', 'b', 'late', 'none']);
    expect(sortAthletes(list, 'desc').map((a) => a.id)).toEqual(['late', 'a', 'b', 'none']);
    expect(list[0].id).toBe('none');
  });
});

describe('the CSV', () => {
  it('has Czech headers, semicolons, CRLF and clinic-time dates', () => {
    const csv = athletesToCsv([athlete()]);
    expect(csv).toBe(`${CSV_HEADERS.join(';')}\r\nJan Novák;Základní prohlídka;26. 10. 2026 11:00;26. 10. 2026 12:00;Zaregistrován;+420 777 123 456\r\n`);
    expect(CSV_HEADERS).toEqual(['Jméno', 'Činnost', 'Začátek', 'Konec', 'Stav', 'Telefon']);
  });

  it('carries nothing but those six columns - no birth number, no id', () => {
    const csv = athletesToCsv([{ ...athlete(), birthNumber: '9001011234', id: 'secret-id' } as ClubBlockAthlete]);
    expect(csv).not.toContain('9001011234');
    expect(csv).not.toContain('secret-id');
    for (const line of csv.trim().split('\r\n')) expect(line.split(';')).toHaveLength(6);
  });

  it('writes empty cells for what is not known and a Czech word for every status', () => {
    const csv = athletesToCsv([
      athlete({ id: '1', name: 'A', startUtc: null, endUtc: null, phone: null, activityName: '', status: 'Attended' }),
      athlete({ id: '2', name: 'B', startUtc: null, status: 'NoShow' }),
      athlete({ id: '3', name: 'C', startUtc: null, status: 'Cancelled' }),
    ]);
    const lines = csv.trim().split('\r\n');
    expect(lines[1]).toBe('A;;;;Dorazil;');
    expect(lines[2]).toContain(';Nedostavil se;');
    expect(lines[3]).toContain(';Zrušeno;');
  });

  it('lists the athletes in time order', () => {
    const csv = athletesToCsv([athlete({ id: 'b', name: 'Později', startUtc: at('2026-10-27', '09:00') }), athlete({ id: 'a', name: 'Dříve' })]);
    expect(csv.trim().split('\r\n').slice(1).map((l) => l.split(';')[0])).toEqual(['Dříve', 'Později']);
  });

  it('quotes a cell with a semicolon, a quote or a line break, and defuses a formula', () => {
    expect(csvCell('Novák; Jan')).toBe('"Novák; Jan"');
    expect(csvCell('Říkají "Pepa"')).toBe('"Říkají ""Pepa"""');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('+420 777 123 456')).toBe('+420 777 123 456');
  });

  it('formats a missing or broken instant as empty', () => {
    expect(csvTime(null)).toBe('');
    expect(csvTime('nonsense')).toBe('');
  });
});

describe('the file', () => {
  it('names itself after the block without diacritics', () => {
    expect(athletesCsvFilename('FK Slaný — podzim 2026')).toBe('sportovci-fk-slany-podzim-2026.csv');
    expect(athletesCsvFilename('!!!')).toBe('sportovci-blok.csv');
  });

  it('is handed over as UTF-8 with a BOM', async () => {
    const createUrl = vi.fn().mockReturnValue('blob:x');
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadAthletesCsv([athlete()], 'FK Slaný');
    const blob = createUrl.mock.calls[0][0] as Blob;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe(athletesToCsv([athlete()]));
    expect(click).toHaveBeenCalledTimes(1);
  });
});
