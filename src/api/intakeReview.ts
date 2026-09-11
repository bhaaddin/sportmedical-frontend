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
export interface IntakeFieldComparison {
  field: string;
  label: string;
  submitted: string | null;
  candidate: string | null;
  matches: boolean;
  /** True for birth number and insurance number — rendered with a warning affordance. */
  sensitive: boolean;
}

export interface IntakeCandidate {
  patientId: string;
  revision: number;
  fullName: string;
  score: number;
  outcome: IntakeOutcome;
  fields: IntakeFieldComparison[];
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

export const IntakeResolution = {
  Merge: 'Merge',
  CreateNew: 'CreateNew',
  Reject: 'Reject',
} as const;

export type IntakeResolution = (typeof IntakeResolution)[keyof typeof IntakeResolution];

export interface ResolveIntakeRequest {
  intakeId: string;
  resolution: IntakeResolution;
  /** Required for Merge — which candidate the intake belongs to. */
  patientId?: string;
  /** Required for Merge — the revision the reviewer actually saw. */
  candidateRevision?: number;
  /** Audited. Required for Reject, optional otherwise. */
  reason?: string;
}

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

export async function resolveIntake(request: ResolveIntakeRequest): Promise<void> {
  await client.post('/api/patients/intake-review/resolve', request);
}

/** True when the server refused because the data moved since the queue was loaded. */
export function isStaleResolution(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 409;
}
