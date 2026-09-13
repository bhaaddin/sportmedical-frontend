/*
 * A rule that applies to nobody reads exactly like a rule that works.
 *
 * That is the whole subject here. The list is short, the wording is
 * confident, and nothing else in the application ever mentions that the
 * service a rule points at was deleted last month - so the first anybody
 * hears of it is a patient at the desk without the record nobody asked for.
 */
import { describe, it, expect } from 'vitest';
import {
  RULE_HEALTH_TEXT, alreadyRequired, canAddRule, ruleHealth, summaryText,
} from './requirementRules';
import type { RequirementRuleLike, ServiceLike } from './requirementRules';

const rule = (over: Partial<RequirementRuleLike> = {}): RequirementRuleLike => ({
  id: 'r1',
  templateId: 't1',
  templateName: 'Výpis ze zdravotní dokumentace',
  clinicServiceId: 's1',
  serviceName: 'Sportovní lékařské prohlídky',
  serviceExists: true,
  ...over,
});

const service = (over: Partial<ServiceLike> = {}): ServiceLike => ({
  id: 's1',
  name: 'Sportovní lékařské prohlídky',
  isActive: true,
  activities: 3,
  ...over,
});

describe('whether a rule reaches anybody', () => {
  it('says nothing about one whose service is there and used', () => {
    expect(ruleHealth(rule(), [service()])).toBe('ok');
  });

  /* The server's own answer. The row survives the service it names. */
  it('names the one whose service was deleted', () => {
    const orphan = rule({ clinicServiceId: null, serviceExists: false });
    expect(ruleHealth(orphan, [service()])).toBe('service-deleted');
  });

  /*
   * A service with no činnosti cannot be booked, so nothing ever carries its
   * rules. Distinct from a deleted one: this is a half-finished setup, not a
   * mistake, and the sentence has to say which.
   */
  it('names the one whose service has no činnost', () => {
    expect(ruleHealth(rule(), [service({ activities: 0 })])).toBe('service-empty');
  });

  /*
   * By id, not by name. Two services share a name for as long as it takes to
   * rename one, and a warning drawn on the wrong row is worse than none.
   *
   * Written with the empty one first on purpose: with a name match, this rule
   * would pick up the empty service's count and report a gap that is not
   * there.
   */
  it('reads the counts of the service the rule actually points at', () => {
    const services = [
      service({ id: 's9', name: 'Sportovní lékařské prohlídky', activities: 0 }),
      service({ id: 's1', name: 'Sportovní lékařské prohlídky', activities: 4 }),
    ];
    expect(ruleHealth(rule({ clinicServiceId: 's1' }), services)).toBe('ok');
  });

  /*
   * Services still loading is not the same as a broken rule. Warning on an
   * empty list would put a warning on every row for as long as the request
   * takes, and those are the rows somebody then goes and deletes.
   */
  it('stays quiet while the services are still unknown', () => {
    expect(ruleHealth(rule(), [])).toBe('ok');
  });

  it('has a sentence for each way of failing', () => {
    expect(RULE_HEALTH_TEXT['service-deleted']).toMatch(/neexistuje/);
    expect(RULE_HEALTH_TEXT['service-empty']).toMatch(/činnost/);
  });
});

describe('adding a rule', () => {
  it('waits for both halves', () => {
    expect(canAddRule('', 's1', [])).toBe(false);
    expect(canAddRule('t1', '', [])).toBe(false);
    expect(canAddRule('t1', 's1', [])).toBe(true);
  });

  /*
   * The server answers a repeat by handing back the rule already there, so a
   * second add is not destructive - it is a click that looks like it did
   * something and did not. Saying so beforehand is the point.
   */
  it('refuses a pair that is already in the list', () => {
    expect(canAddRule('t1', 's1', [rule()])).toBe(false);
    expect(alreadyRequired([rule()], 't1', 's1')).toBe(true);
  });

  it('lets the same document be required for another service', () => {
    expect(canAddRule('t1', 's2', [rule()])).toBe(true);
  });

  it('lets another document be required for the same service', () => {
    expect(canAddRule('t2', 's1', [rule()])).toBe(true);
  });

  /*
   * A service being empty is not a reason to refuse the rule. A service with
   * no činnosti yet is a service being set up, and making people finish it
   * before they may write its paperwork forces the work into an order nobody
   * asked for.
   */
  it('does not wait for the service to be finished', () => {
    expect(canAddRule('t1', 's-new', [])).toBe(true);
  });
});

describe('what the list says about itself', () => {
  /*
   * An empty list is legitimate - every clinic starts there - and it is also
   * indistinguishable from a screen that failed to load. So it gets a
   * sentence rather than a blank.
   */
  it('says out loud that nothing is required of anybody', () => {
    expect(summaryText([])).toMatch(/Zatím žádné pravidlo/);
  });

  it('says nothing when every rule reaches something', () => {
    expect(summaryText([rule(), rule({ id: 'r2', templateId: 't2' })])).toBe('');
  });

  /* Czech counts one, a few and many differently, and this is the sentence
     somebody reads when something is already wrong. */
  it('counts the broken ones the way Czech counts', () => {
    const broken = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        rule({ id: `r${i}`, clinicServiceId: null, serviceExists: false }));

    expect(summaryText(broken(1))).toContain('1 pravidlo ukazuje');
    expect(summaryText(broken(3))).toContain('3 pravidla ukazují');
    expect(summaryText(broken(5))).toContain('5 pravidel ukazuje');
  });
});
