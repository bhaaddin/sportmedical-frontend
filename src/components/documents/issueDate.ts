/*
 * Which documents are asked for a date, and which of those may not go without
 * one.
 *
 * Two different questions that looked like one. Until 13. 9. 2026 this dialog
 * asked for a date only when the upload was a report from another doctor, and
 * the výpis - which has a template - was never asked at all.
 *
 * Then the owner decided a výpis is good for a year from the day it was
 * issued, and the server started insisting:
 *
 *     POST /api/documents/upload  without reportDate on a Vypis
 *     -> 400 "U výpisu je nutné zadat datum vydání — od něj se počítá jeho
 *             platnost."
 *
 * Measured, not read from a commit. So a výpis uploaded through this dialog
 * failed at the server, after the file had gone up, with nothing on screen
 * saying which field was wanted.
 *
 * A report is still asked - the date decides the order they are listed in -
 * but not required, because a report with no date is still a report worth
 * keeping.
 */
import type { DocumentTemplate } from '../../api/documents';

/** A upload that belongs to no template is a report from another doctor. */
export function isReportUpload(template: DocumentTemplate | null): boolean {
  return template === null;
}

/** Whether to ask for a date at all. */
export function asksIssueDate(template: DocumentTemplate | null): boolean {
  return isReportUpload(template) || template?.type === 'Vypis';
}

/**
 * Whether the upload may not proceed without one.
 *
 * Only the výpis, because only the výpis has a validity computed from it. The
 * button is held shut rather than the upload allowed to fail: a 400 arriving
 * after the file has gone up is a failure nobody can act on from here.
 */
export function requiresIssueDate(template: DocumentTemplate | null): boolean {
  return template?.type === 'Vypis';
}

export function issueDateMissing(
  template: DocumentTemplate | null,
  reportDate: string,
): boolean {
  return requiresIssueDate(template) && reportDate.trim() === '';
}
