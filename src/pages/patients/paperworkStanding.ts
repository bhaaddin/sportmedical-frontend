/*
 * What this patient has to bring, and what they already have.
 *
 * Two questions, and holding them apart is the whole point:
 *
 *     what the person HOLDS       a fact about them     výpis, signed off
 *     what their TERMÍNY require  a fact about bookings prohlídka 24. 9. → výpis
 *
 * The card used to answer neither. It filtered templates on `requiredForVisit`
 * and `firstVisitOnly`, and on 14. 9. 2026 the server stopped sending both -
 * they moved onto the rule, where they belong. The filter then matched nothing
 * and the whole paperwork section vanished, on every patient, without an
 * error. A patient with no výpis looked exactly like a patient with their
 * paperwork in order.
 *
 * WHY IT IS NOT "EVERY RULE, UNIONED"
 *
 * The obvious replacement - collect the templates from every rule and say
 * "these are wanted" - is the bug the owner had removed two days earlier. It
 * told somebody booked for a blood draw that their medical record was missing.
 * His rule: a výpis is required only if the patient booked a sports
 * examination. A rule hangs on a SERVICE, and which service applies is a fact
 * about the appointment, not about the person.
 *
 * So the requirement comes from the server, per appointment, and this module
 * only decides how to say it.
 */
/**
 * One thing one appointment needs, as the server reports it.
 *
 * `standing` is the server's verdict and this module does not second-guess it.
 * It was a bare `integer` for a few hours on 14. 9. 2026 - no names in the
 * contract, no appointments to measure against - and rather than draw a
 * traffic light from a guessed enum, it was asked about and changed to names.
 */
export interface AppointmentRequirement {
  templateId: string;
  templateName: string;
  /** The service that asked for it - so the row says why, not just what. */
  serviceName: string;
  appointmentId: string;
  startUtc: string;
  standing: string;
  /** Date only, or null when the server has no date to give. */
  validUntil?: string | null;
  daysLeft?: number | null;
  blocksBooking?: boolean;
}

export type RequirementState =
  /** Nothing on file, or what is on file no longer covers the appointment. */
  | 'missing'
  /** Covers it, and runs out within the rule's warning days. */
  | 'expiring'
  /** Covers it with room to spare. */
  | 'on-file';

/**
 * What the server said, read rather than recomputed.
 *
 * An unrecognised value is treated as needing attention, not as fine. A name
 * this screen has not met is a name somebody added, and the wrong way to meet
 * it is by quietly clearing a patient who may be missing something. Failing
 * loud here costs a needless row; failing quiet costs a visit.
 */
export function requirementState(requirement: AppointmentRequirement): RequirementState {
  switch (requirement.standing) {
    case 'Valid': return 'on-file';
    case 'ExpiringSoon': return 'expiring';
    default: return 'missing';
  }
}

/**
 * Everything the patient has to act on before the appointment.
 *
 * `ExpiringSoon` is deliberately not in here. The document still covers that
 * appointment - the server keeps `allRequiredPresent` true - so calling it
 * missing would turn a reminder into an alarm, and an alarm that is not true
 * is the one people learn to ignore.
 */
export function stillMissing(
  requirements: readonly AppointmentRequirement[],
): AppointmentRequirement[] {
  return requirements.filter((r) => requirementState(r) === 'missing');
}

/** Still good, and this is the cheap moment to renew it. */
export function expiringSoon(
  requirements: readonly AppointmentRequirement[],
): AppointmentRequirement[] {
  return requirements.filter((r) => requirementState(r) === 'expiring');
}

/**
 * Whether any of what is missing would stop the booking rather than warn.
 *
 * The owner's rule from plan 2.4 is that paperwork warns; a rule can now
 * reverse that for itself, and a desk reading this has to know which kind of
 * missing it is looking at before they pick up the telephone.
 */
export function anyBlocks(missing: readonly AppointmentRequirement[]): boolean {
  return missing.some((r) => r.blocksBooking === true);
}

/**
 * The third state, and the reason this module exists.
 *
 * No appointment that asks for anything is not the same as "everything is in
 * order", and for three days these two were the same silence on screen. It is
 * also the ordinary state of most patients most of the time, so it is said
 * plainly rather than drawn as a warning.
 */
export const NOTHING_REQUIRED_TEXT =
  'Nemá objednaný termín, který by po něm něco vyžadoval.';

/** "Prohlídka 24. 9. — Výpis ze zdravotní dokumentace" */
export function requirementLine(
  requirement: AppointmentRequirement,
  formatDate: (iso: string) => string,
): string {
  const when = formatDate(requirement.startUtc);
  const service = requirement.serviceName === ''
    ? 'termín'
    : requirement.serviceName;
  return `${service} ${when} — ${requirement.templateName}`;
}

/**
 * How long what they hold still stands, when the server says so.
 *
 * Computed there, never here. This screen carried its own copy of "a výpis
 * lasts a year", booking carried a second, and the column meant for it was
 * never written - three answers to one question. The rule now says how many
 * months and the server does the counting, so the only job left is to read it
 * out.
 */
export function validityText(
  requirement: AppointmentRequirement,
  formatDate: (iso: string) => string,
): string | null {
  if (requirement.validUntil === null || requirement.validUntil === undefined) return null;
  return `platí do ${formatDate(requirement.validUntil)}`;
}
