/*
 * The date a výpis cannot go without.
 *
 * The owner decided a výpis is good for a year from the day it was issued, so
 * the server now insists on that day:
 *
 *     POST /api/documents/upload  without reportDate on a Vypis
 *     -> 400 "U výpisu je nutné zadat datum vydání — od něj se počítá jeho
 *             platnost."
 *
 * Measured against the running server, not read from a commit. Until then this
 * dialog asked for a date only on a report from another doctor - a výpis has a
 * template, so it was never asked - and uploading one failed at the server
 * after the file had already gone up, with nothing on screen naming the field.
 */
import { describe, it, expect } from 'vitest';
import { asksIssueDate, isReportUpload, issueDateMissing, requiresIssueDate } from './issueDate';
import type { DocumentTemplate } from '../../api/documents';

const template = (type: string): DocumentTemplate =>
  ({ id: 't1', name: type, type } as unknown as DocumentTemplate);

const VYPIS = template('Vypis');
const SOUHLAS = template('InformovanySouhlas');
const REPORT = null;

describe('which uploads are asked for a date', () => {
  /* The case that was missing and cost a 400. */
  it('asks for one on a výpis', () => {
    expect(asksIssueDate(VYPIS)).toBe(true);
  });

  it('asks for one on a report from another doctor', () => {
    expect(asksIssueDate(REPORT)).toBe(true);
  });

  /* A consent form has no date of its own worth asking for. */
  it('does not ask on other templates', () => {
    expect(asksIssueDate(SOUHLAS)).toBe(false);
  });
});

describe('which may not go without one', () => {
  it('is the výpis, and only the výpis', () => {
    expect(requiresIssueDate(VYPIS)).toBe(true);
    expect(requiresIssueDate(REPORT)).toBe(false);
    expect(requiresIssueDate(SOUHLAS)).toBe(false);
  });

  /*
   * A report with no date is still a report worth keeping - the date only
   * decides the order they are listed in. Requiring it would refuse a document
   * the clinic wants, to enforce a tidiness nobody asked for.
   */
  it('lets a report through with no date', () => {
    expect(issueDateMissing(REPORT, '')).toBe(false);
  });

  it('holds a výpis with no date', () => {
    expect(issueDateMissing(VYPIS, '')).toBe(true);
    expect(issueDateMissing(VYPIS, '   ')).toBe(true);
  });

  it('lets a výpis through once the date is there', () => {
    expect(issueDateMissing(VYPIS, '2026-05-03')).toBe(false);
  });
});

describe('what counts as a report', () => {
  /* No template is the whole of it: that absence is what keeps a report out
     of the required-document rules. */
  it('is an upload belonging to no template', () => {
    expect(isReportUpload(REPORT)).toBe(true);
    expect(isReportUpload(VYPIS)).toBe(false);
  });
});
