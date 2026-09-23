/*
 * The two rules the screens apply to the clinic's display settings.
 *
 * `gridSpan`: the clinic's day is the least the calendar shows. Working hours
 * and bookings outside it widen it — a setting may hide empty time, never a
 * patient booked at 6:30 on a grid that starts at 7.
 *
 * `shownFields`: which patient rows a screen draws, in the clinic's order, and
 * never a sensitive one to somebody without the permission — whatever the
 * setting says.
 */
import { describe, it, expect } from 'vitest';
import { gridSpan, shownFields } from './displaySettings';
import type { PatientFieldVisibility } from './displaySettings';
import { moveKey } from '../pages/settings/patientFieldOrder';
import { fieldErrorsOf, problemMessageOf } from '../pages/settings/settingsProblem';

describe('gridSpan', () => {
  const day = { dayStartHour: 7, dayEndHour: 19 };

  it('is the clinic day when nothing falls outside it', () => {
    expect(gridSpan(day, { start: 8, end: 16 })).toEqual({ start: 7, end: 19 });
  });

  it('widens to opening hours that start earlier or end later', () => {
    expect(gridSpan(day, { start: 5, end: 21 })).toEqual({ start: 5, end: 21 });
  });

  it('widens to a booking outside both, so no patient is hidden', () => {
    expect(gridSpan(day, null, [{ start: 6, end: 7 }, { start: 20, end: 21 }])).toEqual({ start: 6, end: 21 });
  });

  it('keeps within one day', () => {
    expect(gridSpan({ dayStartHour: 0, dayEndHour: 24 }, null, [{ start: -1, end: 25 }])).toEqual({
      start: 0,
      end: 24,
    });
  });
});

describe('shownFields', () => {
  const visibility: PatientFieldVisibility = {
    fields: [
      { key: 'recordId', label: 'ID záznamu', group: 'personal', onCard: true, onList: true, sensitive: false },
      { key: 'email', label: 'E-mail', group: 'personal', onCard: true, onList: false, sensitive: false },
      { key: 'phone', label: 'Telefon', group: 'personal', onCard: true, onList: false, sensitive: false },
      { key: 'birthNumber', label: 'Rodné číslo', group: 'registration', onCard: true, onList: false, sensitive: true },
      { key: 'address', label: 'Adresa', group: 'registration', onCard: true, onList: false, sensitive: false },
    ],
    visible: ['phone', 'birthNumber', 'email', 'address'],
  };

  const keys = (fields: ReturnType<typeof shownFields>) => fields?.map((field) => field.key);

  it('is null until the setting is known, so a screen does not flash every row', () => {
    expect(shownFields(undefined, 'card', true)).toBeNull();
  });

  it('draws the chosen fields in the chosen order, and nothing that was not chosen', () => {
    expect(keys(shownFields(visibility, 'card', true))).toEqual(['phone', 'birthNumber', 'email', 'address']);
  });

  it('never draws a sensitive field without the permission, whatever the setting says', () => {
    expect(keys(shownFields(visibility, 'card', false))).toEqual(['phone', 'email', 'address']);
  });

  it('draws on the register only what the register can show', () => {
    expect(keys(shownFields({ ...visibility, visible: ['recordId', 'email'] }, 'list', true))).toEqual(['recordId']);
  });

  it('splits the card into its two panels', () => {
    expect(keys(shownFields(visibility, 'card', true, 'registration'))).toEqual(['birthNumber', 'address']);
  });
});

describe('moveKey', () => {
  it('swaps a field with its neighbour', () => {
    expect(moveKey(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(moveKey(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c']);
  });

  it('leaves the order alone at either end or for an unknown key', () => {
    expect(moveKey(['a', 'b'], 'a', -1)).toEqual(['a', 'b']);
    expect(moveKey(['a', 'b'], 'b', 1)).toEqual(['a', 'b']);
    expect(moveKey(['a', 'b'], 'z', 1)).toEqual(['a', 'b']);
  });
});

describe('settings refusals', () => {
  const refusal = {
    response: {
      data: {
        code: 'settings.invalid',
        message: 'Nastavení nelze uložit: Konec dne musí být později než jeho začátek.',
        errors: { dayEndHour: ['Konec dne musí být později než jeho začátek.'] },
      },
    },
  };

  it('puts the server sentence under the field it names', () => {
    expect(fieldErrorsOf(refusal)).toEqual({ dayEndHour: 'Konec dne musí být později než jeho začátek.' });
  });

  it('shows the server message, or the fallback when there was no answer', () => {
    expect(problemMessageOf(refusal, 'x')).toContain('Konec dne');
    expect(problemMessageOf(new Error('Network Error'), 'Nepodařilo se uložit.')).toBe('Nepodařilo se uložit.');
    expect(fieldErrorsOf(new Error('Network Error'))).toEqual({});
  });
});
