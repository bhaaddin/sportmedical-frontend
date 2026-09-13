/*
 * The rules that say which služba makes a patient bring which document, and
 * the two ways such a rule can quietly apply to nobody.
 *
 *     PRAVIDLO   šablona × služba
 *     ČINNOST    belongs to one service and inherits its rules
 *     TERMÍN     is booked for one činnost
 *
 * A rule only ever reaches a patient along that chain. Break it anywhere and
 * the rule is still in the list, still worded confidently, and asks nobody for
 * anything:
 *
 *   the service was deleted    the rule points at nothing
 *   the service has no činnost nothing can be booked under it
 *
 * Neither is an error and neither shows anywhere else. A clinic whose only
 * výpis rule points at a service somebody deleted last month looks exactly
 * like a clinic with its paperwork in order, and the first anybody hears of it
 * is a patient arriving without the record nobody asked them for.
 */

export interface RequirementRuleLike {
  id: string;
  templateId: string;
  templateName: string;
  /** Null once the service it pointed at has been deleted. */
  clinicServiceId: string | null;
  serviceName: string;
  serviceExists: boolean;
}

export interface ServiceLike {
  id: string;
  name: string;
  isActive: boolean;
  activities: number;
}

export type RuleHealth =
  | 'ok'
  /** The service it points at is gone. The rule applies to no termín at all. */
  | 'service-deleted'
  /** The service is there and empty, so nothing can be booked under it. */
  | 'service-empty';

/*
 * Deliberately not a health state: a *retired* service.
 *
 * Whether the server stops evaluating rules for one is not something this
 * screen can see, and the checkouts of the API here are older than the API
 * that is running. Saying "this rule no longer applies" on a guess would be
 * the same failure in the other direction - a confident sentence nobody
 * measured. Left out until somebody can answer it.
 */
export function ruleHealth(
  rule: RequirementRuleLike,
  services: readonly ServiceLike[],
): RuleHealth {
  /* The server's own answer, not ours: it knows the row is orphaned, we would
     only be guessing from a name we cannot find. */
  if (!rule.serviceExists) return 'service-deleted';

  /*
   * By id. Two services may share a name for as long as it takes somebody to
   * rename one, and a warning drawn on the wrong row is worse than none.
   */
  const service = services.find((s) => s.id === rule.clinicServiceId);
  if (service !== undefined && service.activities === 0) return 'service-empty';

  return 'ok';
}

export const RULE_HEALTH_TEXT: Record<Exclude<RuleHealth, 'ok'>, string> = {
  'service-deleted':
    'Služba už neexistuje — pravidlo neplatí pro žádný termín a nikoho na nic neupozorní. Smažte ho.',
  'service-empty':
    'Ta služba nemá zatím žádnou činnost, takže se pod ni nedá objednat a pravidlo se nikdy neuplatní.',
};

/**
 * Whether this document is already required for this service.
 *
 * The server answers a repeat by handing back the rule that is already there,
 * so a second add is not destructive - it is just a click that looks like it
 * did something and did not. Saying so beforehand is the whole point.
 */
export function alreadyRequired(
  rules: readonly RequirementRuleLike[],
  templateId: string,
  clinicServiceId: string,
): boolean {
  return rules.some(
    (r) => r.templateId === templateId && r.clinicServiceId === clinicServiceId,
  );
}

/**
 * Whether the pair on the form may be added.
 *
 * Both chosen, and not already recorded. Deliberately not "is the service any
 * good": a service with no činnosti yet is a service being set up, and
 * refusing to write its rules until it is finished would force the work into
 * an order nobody asked for.
 */
export function canAddRule(
  templateId: string,
  clinicServiceId: string,
  rules: readonly RequirementRuleLike[],
): boolean {
  if (templateId === '' || clinicServiceId === '') return false;
  return !alreadyRequired(rules, templateId, clinicServiceId);
}

/**
 * What the list as a whole is worth saying about itself.
 *
 * An empty list is the state every clinic starts in and it is legitimate -
 * but it is also indistinguishable from a screen that failed to load, which
 * is why it gets a sentence rather than a blank.
 */
export function summaryText(rules: readonly RequirementRuleLike[]): string {
  if (rules.length === 0) {
    return 'Zatím žádné pravidlo — po pacientech se před návštěvou nic nechce.';
  }
  const broken = rules.filter((r) => !r.serviceExists).length;
  if (broken === 0) return '';
  /* Czech counts one, a few and many differently, and this sentence is the
     one somebody reads when something is already wrong. */
  const count =
    broken === 1 ? '1 pravidlo ukazuje'
      : broken <= 4 ? `${broken} pravidla ukazují`
        : `${broken} pravidel ukazuje`;
  return `${count} na smazanou službu a neplatí pro žádný termín.`;
}
