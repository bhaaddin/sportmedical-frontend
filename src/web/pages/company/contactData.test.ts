import { describe, expect, it } from 'vitest';
import { mapyCzHref, parseHours } from './contactData';
import { fileFormat, usableFileUrl } from '../DokumentyPage';

describe('parseHours', () => {
  it('splits "day  time" lines into rows and marks the closed day', () => {
    const { rows, notes } = parseHours(['Po–Pá 8:00–18:00', 'So 8:00 – 18:00', 'Ne zavřeno', 'provoz podle objednání']);
    expect(rows).toEqual([
      { label: 'Po–Pá', value: '8:00–18:00', closed: false },
      { label: 'So', value: '8:00 – 18:00', closed: false },
      { label: 'Ne', value: 'zavřeno', closed: true },
    ]);
    expect(notes).toEqual(['provoz podle objednání']);
  });

  it('keeps a line it does not understand as a note instead of dropping it', () => {
    expect(parseHours(['Po dohodě'])).toEqual({ rows: [], notes: ['Po dohodě'] });
    expect(parseHours([])).toEqual({ rows: [], notes: [] });
  });
});

describe('mapyCzHref', () => {
  it('is a plain Mapy.cz search for the address', () => {
    const href = mapyCzHref('Jihlavská 1558/21, 140 00 Praha 4');
    expect(href.startsWith('https://mapy.cz/zakladni?q=')).toBe(true);
    expect(decodeURIComponent(href.split('q=')[1])).toBe('Jihlavská 1558/21, 140 00 Praha 4');
  });
});

describe('documents', () => {
  it('names the format from the end of the address, ignoring ?v= and #page', () => {
    expect(fileFormat('https://cdn.example/files/a.pdf?v=12')).toBe('PDF');
    expect(fileFormat('https://cdn.example/files/seznam.xlsx#x')).toBe('XLSX');
    expect(fileFormat('https://cdn.example/download')).toBe('Soubor');
  });

  it('accepts only http(s) addresses as a file; anything else is "not there yet"', () => {
    expect(usableFileUrl(' https://cdn.example/a.pdf ')).toBe('https://cdn.example/a.pdf');
    expect(usableFileUrl('')).toBeNull();
    expect(usableFileUrl('javascript:alert(1)')).toBeNull();
    expect(usableFileUrl('a.pdf')).toBeNull();
  });
});
