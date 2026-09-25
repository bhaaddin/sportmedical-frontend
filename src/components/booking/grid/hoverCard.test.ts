import { describe, expect, it } from 'vitest';
import { birthDateText, hoverNeeds, lastChangeText } from './hoverCard';
import { hoverFieldsFor } from '../../../api/displaySettings';

/*
 * The hover card asks only for what the administrator's list needs, shows the
 * sensitive facts only to somebody allowed to see them, and reads the newest
 * history line as one sentence.
 */

describe('hoverFieldsFor', () => {
  const catalogue = [
    { key: 'patientName', label: 'Jméno pacienta', help: '', sensitive: false },
    { key: 'insurer', label: 'Zdravotní pojišťovna', help: '', sensitive: true },
    { key: 'birthDate', label: 'Datum narození', help: '', sensitive: true },
    { key: 'phone', label: 'Telefon', help: '', sensitive: false },
  ];

  it('keeps the clinic order and drops what the card cannot draw', () => {
    expect(hoverFieldsFor({ hoverFields: ['phone', 'shoeSize', 'patientName'] }, true, catalogue)).toEqual([
      'phone',
      'patientName',
    ]);
  });

  it('withholds the sensitive facts from somebody without the permission, whatever the setting says', () => {
    const fields = ['patientName', 'insurer', 'birthDate', 'phone'];
    expect(hoverFieldsFor({ hoverFields: fields }, false, catalogue)).toEqual(['patientName', 'phone']);
    expect(hoverFieldsFor({ hoverFields: fields }, true, catalogue)).toEqual(fields);
  });

  it('knows which facts are sensitive even before the catalogue arrives', () => {
    expect(hoverFieldsFor({ hoverFields: ['insurer', 'birthDate', 'status'] }, false)).toEqual(['status']);
  });
});

describe('hoverNeeds', () => {
  it('asks for nothing when the row already carries every chosen fact', () => {
    expect(hoverNeeds(['patientName', 'activity', 'status', 'paperwork'])).toEqual({
      profile: false,
      patient: false,
      detail: false,
      history: false,
    });
  });

  it('asks for exactly the request each fact needs', () => {
    expect(hoverNeeds(['phone'])).toMatchObject({ profile: true, patient: false });
    expect(hoverNeeds(['insurer'])).toMatchObject({ profile: true });
    expect(hoverNeeds(['birthDate'])).toMatchObject({ patient: true, profile: false });
    expect(hoverNeeds(['note'])).toMatchObject({ detail: true });
    expect(hoverNeeds(['history'])).toMatchObject({ history: true });
  });
});

describe('lastChangeText', () => {
  const t = (key: string, options?: Record<string, unknown>) =>
    key === 'booking.history.rescheduled' ? 'Přesunuto' : `${key}${options ? JSON.stringify(options) : ''}`;

  it('is null with no history', () => {
    expect(lastChangeText(undefined, t, 'neznámý')).toBeNull();
    expect(lastChangeText([], t, 'neznámý')).toBeNull();
  });

  it('reads the newest line as action · when · who', () => {
    const text = lastChangeText(
      [
        { action: 0, actorId: 'u1', actorDisplayName: 'Recepce', atUtc: '2026-09-22T07:00:00Z', reason: null, oldValue: null, newValue: null },
        { action: 2, actorId: 'u2', actorDisplayName: 'Anna Černá', atUtc: '2026-09-23T08:31:00Z', reason: null, oldValue: null, newValue: null },
      ],
      t,
      'neznámý',
    );
    expect(text).toMatch(/^Přesunuto · 23\. 9\. 2026 10:31 · Anna Černá$/);
  });

  it('names an unknown actor as unknown rather than dropping the line', () => {
    const text = lastChangeText(
      [{ action: 2, actorId: 'u2', actorDisplayName: null, atUtc: '2026-09-23T08:31:00Z', reason: null, oldValue: null, newValue: null }],
      t,
      'neznámý uživatel',
    );
    expect(text).toContain('neznámý uživatel');
  });
});

describe('birthDateText', () => {
  it('writes an ISO date the Czech way and leaves anything else alone', () => {
    expect(birthDateText('1990-05-02')).toBe('2. 5. 1990');
    expect(birthDateText('1990-05-02T00:00:00')).toBe('2. 5. 1990');
    expect(birthDateText(null)).toBeNull();
    expect(birthDateText('neznámo')).toBe('neznámo');
  });
});
