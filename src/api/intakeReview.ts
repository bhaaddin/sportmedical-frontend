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

export interface IntakeQueueEntry {
  intakeId: string;
  referenceNumber: string;
  submittedAt: string;
  submittedName: string;
  submittedDateOfBirth: string;
  outcome: IntakeOutcome;
  candidates: IntakeCandidate[];
  /** Guards the resolve call against data that moved underneath the reviewer. */
  fingerprint: string;
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
  fingerprint: string;
}

/* ── Calls ── */

export async function fetchIntakeQueue(): Promise<IntakeQueueEntry[]> {
  const response = await client.get<IntakeQueueEntry[]>('/api/patients/intake-review');
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
