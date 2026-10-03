import { describe, it, expect, vi } from 'vitest';
import { buildStatisticsCsv, downloadCsv, statisticsCsvFileName } from './csv';

const period = { from: '2026-10-01', to: '2026-10-31' };

describe('buildStatisticsCsv', () => {
  it('stacks the sections with Czech headers, semicolons, CRLF and a BOM', () => {
    const csv = buildStatisticsCsv(
      [
        { title: 'Podle činnosti', columns: ['Činnost', 'Objednávky'], rows: [['Základní prohlídka', 3], ['Komplexní prohlídka', 1]] },
        { title: 'Vyfakturováno a zaplaceno', columns: ['Období', 'Vyfakturováno (Kč)', 'Zaplaceno (Kč)'], rows: [['1. 10.', 1600.5, 1600]] },
      ],
      period,
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Statistiky;Období 2026-10-01 až 2026-10-31',
      '',
      'Podle činnosti',
      'Činnost;Objednávky',
      'Základní prohlídka;3',
      'Komplexní prohlídka;1',
      '',
      'Vyfakturováno a zaplaceno',
      'Období;Vyfakturováno (Kč);Zaplaceno (Kč)',
      '1. 10.;1600,5;1600',
      '',
    ]);
  });

  it('quotes a cell that holds a separator and doubles an inner quote', () => {
    const csv = buildStatisticsCsv([{ title: 'T', columns: ['A'], rows: [['a;b'], ['řekl "ano"']] }], period);
    expect(csv).toContain('"a;b"');
    expect(csv).toContain('"řekl ""ano"""');
  });

  it('never writes something shaped like a birth number', () => {
    const csv = buildStatisticsCsv(
      [{ title: 'T', columns: ['Skupina', 'Pacienti'], rows: [['900101/1234', 1], ['9001011234', 2], ['Noví', 3]] }],
      period,
    );
    expect(csv).not.toMatch(/\d{6}\/?\d{3,4}/);
    expect(csv).toContain('Noví;3');
  });

  it('is only the header line when nothing is shown', () => {
    expect(buildStatisticsCsv([], period)).toBe('﻿Statistiky;Období 2026-10-01 až 2026-10-31\r\n');
  });
});

describe('statisticsCsvFileName', () => {
  it('names the area and the period, without diacritics', () => {
    expect(statisticsCsvFileName('Objednávky', period)).toBe('statistiky-objednavky-2026-10-01_2026-10-31.csv');
  });
});

describe('downloadCsv', () => {
  it('hands a UTF-8 Blob to a one-off link and frees it again', async () => {
    const createObjectURL = vi.fn((_b: Blob) => 'blob:x');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    downloadCsv('a.csv', '﻿x;y\r\n');
    expect(createObjectURL.mock.calls[0][0].type).toBe('text/csv;charset=utf-8');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
    click.mockRestore();
  });
});
