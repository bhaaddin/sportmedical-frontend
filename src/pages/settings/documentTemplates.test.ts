/*
 * The kinds of document the clinic keeps.
 *
 * The owner asked why documents he had deleted were back in the picker: "v
 * doikunete su zase dalsie veci .. preco ?? ved som to mazal malo tam ostat
 * len vypis". They were never gone. All four were seeded on 8. 9. 2026 at
 * 22:58:27 and share that one timestamp, and the API has no DELETE for a
 * template at all - nothing he could have clicked could have removed one.
 *
 * What he wanted became possible with the merge on 14. 9.: a template can be
 * switched off, and every picker already hides an inactive one.
 */
import { describe, it, expect } from 'vitest';
import {
  STALE_FIRST_VISIT_TEXT, TEMPLATE_PROBLEM_TEXT, describesACancelledRule,
  switchingOffText, templateChanged, templateIsValid, templateProblems,
} from './documentTemplates';
import type { TemplateDraft, TemplateLike } from './documentTemplates';

const template = (over: Partial<TemplateLike> = {}): TemplateLike => ({
  id: 't1',
  name: 'Výpis ze zdravotní dokumentace',
  description: 'Výpis od předchozího lékaře',
  isActive: true,
  ...over,
});

const draft = (over: Partial<TemplateDraft> = {}): TemplateDraft => ({
  name: 'Výpis ze zdravotní dokumentace',
  description: 'Výpis od předchozího lékaře',
  isActive: true,
  ...over,
});

describe('what may be saved', () => {
  it('accepts a template as it stands', () => {
    expect(templateIsValid(draft())).toBe(true);
  });

  /* The name is the only thing a document is recognised by, on every picker
     and on the patient's card. */
  it('refuses an empty name', () => {
    expect(templateProblems(draft({ name: '' }))).toContain('name-empty');
    expect(templateProblems(draft({ name: '   ' }))).toContain('name-empty');
    expect(TEMPLATE_PROBLEM_TEXT['name-empty']).toMatch(/prázdný/);
  });

  /* An empty description is fine - not every document needs a sentence. */
  it('does not insist on a description', () => {
    expect(templateIsValid(draft({ description: '' }))).toBe(true);
  });
});

describe('whether saving would change anything', () => {
  it('says no when nothing moved', () => {
    expect(templateChanged(template(), draft())).toBe(false);
  });

  it('notices each of the three', () => {
    expect(templateChanged(template(), draft({ name: 'Jiný' }))).toBe(true);
    expect(templateChanged(template(), draft({ description: 'Jiný popis' }))).toBe(true);
    expect(templateChanged(template(), draft({ isActive: false }))).toBe(true);
  });
});

describe('the sentence that outlived its rule', () => {
  /*
   * The seeded výpis still describes itself as "(vyžaduje se při první
   * návštěvě)". The owner cancelled that rule on 13. 9. 2026 - sportspeople
   * come every year and bring a new one - and nothing could correct it while
   * `/api/documents/templates` was `GET` only. He reported it as an error the
   * same day and it stayed live for another day for want of an endpoint.
   */
  it('recognises the cancelled rule in a description', () => {
    expect(describesACancelledRule(
      'Výpis ze zdravotní dokumentace od předchozího lékaře (vyžaduje se při první návštěvě)',
    )).toBe(true);
  });

  it('is not fooled by capitals', () => {
    expect(describesACancelledRule('Vyžaduje Se Při První Návštěvě')).toBe(true);
  });

  it('says nothing about a description that does not claim it', () => {
    expect(describesACancelledRule('Výpis od předchozího lékaře')).toBe(false);
    expect(describesACancelledRule('')).toBe(false);
  });

  /* Pointed at, not rewritten. The text is the clinic's to write, and a screen
     that silently corrected it would be making the same kind of decision on
     his behalf that put the sentence there. */
  it('says where the rule actually lives now', () => {
    expect(STALE_FIRST_VISIT_TEXT).toMatch(/na pravidle/);
  });
});

describe('what switching one off will do', () => {
  /* Off, never deleted: a filed document keeps its `templateId` forever, so
     deleting the kind would leave years of paperwork nameless. */
  /*
   * This sentence said both things in one day. It promised "kdykoli zpátky",
   * which was false while the list endpoint answered with the active ones
   * only; it was corrected to the unpleasant truth the same hour; and it is
   * true again now that `?includeInactive=true` exists for this screen. The
   * difference the third time is that it was measured before it was written.
   */
  it('says it is reversible, and that filed documents keep their name', () => {
    const text = switchingOffText(0);
    expect(text).toMatch(/zmizí ze všech nabídek/);
    expect(text).toMatch(/zůstanou/);
    expect(text).toMatch(/v tomhle seznamu/);
    expect(text).toMatch(/zapnout zpátky/);
  });

  /*
   * The consequence that reaches another screen: a rule pointing at a
   * switched-off document stays in its list with nothing left to ask for.
   * Said before the switch, because nothing else would say it afterwards.
   */
  it('says how many rules would be left asking for nothing', () => {
    expect(switchingOffText(1)).toMatch(/Jedno pravidlo/);
    expect(switchingOffText(2)).toMatch(/2 pravidla/);
    expect(switchingOffText(1)).toMatch(/nebude si už mít co vyžádat/);
  });

  it('says nothing about rules when none point at it', () => {
    expect(switchingOffText(0)).not.toMatch(/pravidl/);
  });
});
