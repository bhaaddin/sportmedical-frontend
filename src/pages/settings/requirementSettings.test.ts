/*
 * The four settings a rule now carries, and the one that is not a switch.
 *
 * Until 14. 9. 2026 a rule was "šablona × služba" and everything it did was
 * fixed in the source. The owner's objection was exactly that: "nastavit ci
 * vsetky veci ktore su teraz v kode natvrdo".
 *
 * Two things here are worth more than the validation: that the summary says
 * what happens at a desk rather than what the field is called, and that the
 * screen does not promise blocking on a document booking never looks at.
 */
import { describe, it, expect } from 'vitest';
import {
  BLOCKING_IGNORED_TEXT, MAX_VALIDITY_MONTHS, MAX_WARN_DAYS, SERVER_DEFAULTS,
  SETTINGS_PROBLEM_TEXT, blockingWillHappen, settingsAreValid, settingsProblems,
  settingsSummary,
} from './requirementSettings';
import type { RequirementSettingsLike } from './requirementSettings';

const s = (over: Partial<RequirementSettingsLike> = {}): RequirementSettingsLike =>
  ({ ...SERVER_DEFAULTS, ...over });

describe('what may be saved', () => {
  it('accepts the server’s own defaults', () => {
    expect(settingsAreValid(SERVER_DEFAULTS)).toBe(true);
  });

  /* The server refuses these with a 400. Catching them here is about saying
     which field and why, at the field, rather than after the save. */
  it('refuses a negative validity', () => {
    expect(settingsProblems(s({ validityMonths: -1 }))).toContain('validity-negative');
  });

  it('refuses a negative warning', () => {
    expect(settingsProblems(s({ warnDaysBefore: -1 }))).toContain('warn-negative');
  });

  /* Zero is not negative: it is "never expires" and "never warn", both real. */
  it('accepts zero for both, which is what never means', () => {
    expect(settingsAreValid(s({ validityMonths: 0, warnDaysBefore: 0 }))).toBe(true);
  });

  it('catches a digit too many', () => {
    expect(settingsProblems(s({ validityMonths: MAX_VALIDITY_MONTHS + 1 })))
      .toContain('validity-too-large');
    expect(settingsProblems(s({ warnDaysBefore: MAX_WARN_DAYS + 1 })))
      .toContain('warn-too-large');
  });

  /*
   * The guard rail is a ceiling, not a permission. 365 days of warning is
   * inside it and still outlives a 12-month document - the two checks meet,
   * and the first version of this test assumed they did not.
   */
  it('allows the guard rail itself, where the validity has room for it', () => {
    expect(settingsAreValid(s({ validityMonths: MAX_VALIDITY_MONTHS }))).toBe(true);
    expect(settingsAreValid(s({ validityMonths: 0, warnDaysBefore: MAX_WARN_DAYS }))).toBe(true);
    expect(settingsAreValid(s({ validityMonths: 24, warnDaysBefore: MAX_WARN_DAYS }))).toBe(true);
  });

  it('still catches a warning that outruns even a long validity', () => {
    expect(settingsProblems(s({ validityMonths: 12, warnDaysBefore: MAX_WARN_DAYS })))
      .toContain('warn-outlives-validity');
  });

  /*
   * Warning further ahead than the document ever lasts means warning from the
   * day it is issued - permanent amber, which is the same as no signal at all.
   */
  it('catches a warning window that outlives the document', () => {
    expect(settingsProblems(s({ validityMonths: 1, warnDaysBefore: 90 })))
      .toContain('warn-outlives-validity');
  });

  /*
   * But not when it never expires. There is no window to outrun, and 30 days
   * of amber before a document that never expires simply never arrives.
   * Written because the first version compared against `validityMonths * 30`
   * unconditionally and so complained about every "nevyprší" rule.
   */
  it('says nothing about the warning when the document never expires', () => {
    expect(settingsAreValid(s({ validityMonths: 0, warnDaysBefore: 365 }))).toBe(true);
  });

  it('has a sentence for every problem it can report', () => {
    const seen: string[] = [
      ...settingsProblems(s({ validityMonths: -1 })),
      ...settingsProblems(s({ warnDaysBefore: -1 })),
      ...settingsProblems(s({ validityMonths: MAX_VALIDITY_MONTHS + 1 })),
      ...settingsProblems(s({ warnDaysBefore: MAX_WARN_DAYS + 1 })),
      ...settingsProblems(s({ validityMonths: 1, warnDaysBefore: 90 })),
    ];
    for (const problem of seen) {
      expect(SETTINGS_PROBLEM_TEXT[problem as keyof typeof SETTINGS_PROBLEM_TEXT]).toBeTruthy();
    }
    expect(new Set(seen).size).toBe(5);
  });
});

describe('saying what the rule does', () => {
  /* From the issue date, not from the upload. A výpis written in March and
     handed over in June has three months of its year already spent. */
  it('says the validity is counted from the issue date', () => {
    expect(settingsSummary(s({ validityMonths: 12 }))).toContain('12 měsíců od vystavení');
  });

  it('says so when it never expires', () => {
    expect(settingsSummary(s({ validityMonths: 0 }))).toContain('Nevyprší');
  });

  it('says so when nothing warns in advance', () => {
    expect(settingsSummary(s({ warnDaysBefore: 0 }))).toContain('neupozorňuje předem');
  });

  it('separates a first visit from every visit', () => {
    expect(settingsSummary(s({ firstVisitOnly: true }))).toContain('jen při první návštěvě');
    expect(settingsSummary(s({ firstVisitOnly: false }))).toContain('při každé návštěvě');
  });

  /* The consequence, not the field name. Somebody reading the row has to know
     that this one turns people away. */
  it('says plainly when a rule refuses bookings', () => {
    expect(settingsSummary(s({ blocksBooking: true }))).toContain('nejde objednat');
    expect(settingsSummary(s({ blocksBooking: false }))).not.toContain('nejde objednat');
  });

  /* Read at a desk, not by a machine. */
  it('counts the way Czech counts', () => {
    expect(settingsSummary(s({ validityMonths: 1 }))).toContain('1 měsíc ');
    expect(settingsSummary(s({ validityMonths: 3 }))).toContain('3 měsíce');
    expect(settingsSummary(s({ validityMonths: 12 }))).toContain('12 měsíců');
    expect(settingsSummary(s({ warnDaysBefore: 1 }))).toContain('1 den');
    expect(settingsSummary(s({ warnDaysBefore: 3 }))).toContain('3 dny');
    expect(settingsSummary(s({ warnDaysBefore: 30 }))).toContain('30 dní');
  });
});

describe('whether the blocking will actually happen', () => {
  /*
   * Booking narrows to `template.Type == DocumentType.Vypis` when an
   * appointment is made, so a rule on any other template refuses nothing -
   * switch on or not. The owner knows and is leaving it for later.
   *
   * A switch that says "bez něj nejde objednat" while booking never asks is
   * exactly the shape this project keeps deleting: a setting that looks
   * obeyed and is not.
   */
  it('happens for a výpis', () => {
    expect(blockingWillHappen('Vypis')).toBe(true);
  });

  it('does not happen for anything else', () => {
    expect(blockingWillHappen('InformovanySouhlas')).toBe(false);
    expect(blockingWillHappen('Cenik')).toBe(false);
    expect(blockingWillHappen('Podminky')).toBe(false);
  });

  /* A template we cannot find is not a licence to promise. */
  it('does not happen for a template that cannot be identified', () => {
    expect(blockingWillHappen(undefined)).toBe(false);
    expect(blockingWillHappen('')).toBe(false);
  });

  it('has the sentence that says so', () => {
    expect(BLOCKING_IGNORED_TEXT).toMatch(/jen výpis/);
  });
});
