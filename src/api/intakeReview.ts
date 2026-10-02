/* ══════════════════════════════════════════════════════════════
   B2 — REVIEW QUEUE API CLIENT

   Staff-facing, authenticated. Consumes the staged intakes produced by
   A1 and scored by A2, and resolves them one at a time.

   Resolution is bound to the candidate's revision and the intake's
   fingerprint: if the underlying data changed between the queue being
   rendered and the action being taken, the server rejects it rather than
   applying a decision made against stale information.
   ══════════════════════════════════════════════════════════════ */

import client from './client';

/* ── Outcomes — mirrors PatientIntakeMatchOutcome ── */

export const IntakeOutcome = {
  CreateNew: 'CreateNew',
  ReviewRequired: 'ReviewRequired',
  AutoAssignToExisting: 'AutoAssignToExisting',
} as const;

export type IntakeOutcome = (typeof IntakeOutcome)[keyof typeof IntakeOutcome];

/* ── Field-level comparison ── */

/**
 * One comparable field, as the server sees it for both sides. Values are
 * already masked per the viewer's role, so the client never has to decide
 * what a Staff user may see.
 */
/*
 * What the server says about a possible duplicate - measured against the
 * running API on 12. 9. 2026.
 *
 * Booleans, never values. The reviewer learns *which* fields agree without
 * being shown another patient's name, birth number or telephone, which is
 * enough to decide "same person?" in almost every case. That is the server's
 * design and this screen keeps it: to see the actual record, the reviewer
 * opens the patient's card deliberately, and that is an act with an audit
 * trail behind it.
 */
export interface IntakeMatchSignals {
  /** Birth number or insurer-assigned number - the identifier that settles it alone. */
  anchorMatches: boolean;
  emailMatches: boolean;
  emailIsVerified: boolean;
  phoneMatches: boolean;
  phoneIsVerified: boolean;
  givenNameMatches: boolean;
  familyNameMatches: boolean;
  dateOfBirthMatches: boolean;
  /** Both together - the pair that identifies a person in practice. */
  nameAndDateOfBirthMatch: boolean;
}

/*
 * A candidate as the wire actually carries it.
 *
 * This interface previously also declared `revision`, `fullName` and a
 * `fields` array of before/after comparisons. None of the three has ever been
 * sent. `fields` was read with `.map` the moment a reviewer pressed "Zobrazit
 * možné shody" on a row that had candidates, and took the whole screen down
 * with `Cannot read properties of undefined`.
 *
 * That is the same fault this file's comment below already records for the
 * queue summary - it was fixed one level up and missed here, because the crash
 * needs a row that actually has a duplicate to reach it.
 */
export interface IntakeCandidate {
  patientId: string;
  score: number;
  outcome: number;
  signals: IntakeMatchSignals;
}

/*
 * What `GET /api/patients/intake-review` actually returns - measured against
 * the running API on 11. 9. 2026, not transcribed from a contract.
 *
 * The types here previously described a shape the server has never sent:
 * `submittedAt`, `submittedName`, `submittedDateOfBirth`, `fingerprint` and
 * `candidates` were all invented on this side. The screen read
 * `entry.candidates.length` and threw `Cannot read properties of undefined`
 * the moment anybody opened the queue with a row in it - which nobody could do
 * until there was a login and a submission on the same day.
 *
 * The list is deliberately a summary. Duplicate candidates are expensive to
 * compute, so they live in the detail call and are fetched when a reviewer
 * actually opens a row. Asking for them per row would make a queue of two
 * hundred questionnaires do two hundred matches nobody looks at.
 */
export interface IntakeQueueEntry {
  intakeId: string;
  referenceNumber: string;
  givenName: string;
  familyName: string;
  dateOfBirth: string;
  sex: string;
  /*
   * A number on the wire: 0 CreateNew, 1 ReviewRequired, 2 AutoAssignToExisting.
   * Mapped through `outcomeOf` rather than compared directly - the numbers are
   * positions in a server-side enum, and this codebase has already been bitten
   * by two numeric enums whose order was load-bearing.
   */
  outcome: number;
  topScore: number;
  suppliedBirthNumber: boolean;
  hasCzechPublicHealthInsurance: boolean;
  submittedAtUtc: string;
}

/** The detail, where the duplicate candidates are. */
export interface IntakeReviewDetail {
  submission: IntakeQueueEntry;
  email: string;
  phone: string;
  candidates: IntakeCandidate[];
}

const OUTCOME_BY_NUMBER: Record<number, IntakeOutcome> = {
  0: IntakeOutcome.CreateNew,
  1: IntakeOutcome.ReviewRequired,
  2: IntakeOutcome.AutoAssignToExisting,
};

/**
 * The wire number as a name. An unknown number is not guessed at and not
 * defaulted to something harmless - a reviewer must not be shown "založit
 * nového" because a value they have never seen fell through to it.
 */
export function outcomeOf(value: number): IntakeOutcome | null {
  return OUTCOME_BY_NUMBER[value] ?? null;
}

/* ── Actions ── */

/*
 * Three separate endpoints, not one `resolve` with a discriminator.
 *
 * This file used to POST every decision to
 * `/api/patients/intake-review/resolve`, a route the server does not have -
 * it answers 405, because the path matches the GET-only detail route with
 * "resolve" standing in for an id. So every button on the queue was inert:
 * the screen listed submissions nobody could act on, and the failure looked
 * like a network error rather than a missing route.
 *
 * Measured from the running API's OpenAPI document on 12. 9. 2026:
 *
 *     POST /{intakeId}/link      { patientId, reason }   merge into a patient
 *     POST /{intakeId}/register  (no body)               create a new patient
 *     POST /{intakeId}/dismiss   { reason }              reject
 *
 * There is no `candidateRevision` anywhere on the wire; the optimistic
 * concurrency this file claimed does not exist server-side.
 */
export const IntakeResolution = {
  Merge: 'Merge',
  CreateNew: 'CreateNew',
  Reject: 'Reject',
} as const;

export type IntakeResolution = (typeof IntakeResolution)[keyof typeof IntakeResolution];

/* ── Calls ── */

export async function fetchIntakeQueue(): Promise<IntakeQueueEntry[]> {
  const response = await client.get<IntakeQueueEntry[]>('/api/patients/intake-review');
  return response.data;
}

export async function fetchIntakeDetail(
  intakeId: string,
): Promise<IntakeReviewDetail> {
  const response = await client.get<IntakeReviewDetail>(
    `/api/patients/intake-review/${intakeId}`,
  );
  return response.data;
}

const reviewPath = (intakeId: string, action: string): string =>
  `/api/patients/intake-review/${intakeId}/${action}`;

/**
 * Attach the submission to an existing patient.
 *
 * The reason is required by the server, and rightly: merging two records is
 * the one action here that cannot be undone by looking at it again later.
 */
export async function linkIntake(
  intakeId: string,
  patientId: string,
  reason: string,
): Promise<void> {
  await client.post(reviewPath(intakeId, 'link'), { patientId, reason });
}

/** Create a new patient from the submission. Takes no body. */
export async function registerIntake(intakeId: string): Promise<void> {
  await client.post(reviewPath(intakeId, 'register'), {});
}

/** Turn the submission away. Audited with the reason. */
export async function dismissIntake(intakeId: string, reason: string): Promise<void> {
  await client.post(reviewPath(intakeId, 'dismiss'), { reason });
}

/** True when the server refused because the data moved since the queue was loaded. */
export function isStaleResolution(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 409;
}
