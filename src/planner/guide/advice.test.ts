import { describe, expect, it } from 'vitest';
import { PAST_REFUSAL } from '../model';
import { completionAdvice, publishSteps, refusalAdvice, withAdvice } from './advice';
import { PLANNER_TEXT } from '../text';

describe('a refusal says what to do instead', () => {
  const A = PLANNER_TEXT.guide.advice;
  it.each([
    ['Den je v minulosti.', A.past],
    ['V tento den je zavřeno (Státní svátek).', A.otherDay],
    ['Ordinace v tento den nemá ordinační dobu.', A.otherDay],
    ['V tento den není volný čas na celý slot.', A.noFree],
    ['Potřeba klubu je už naplněna.', A.needMet],
    ['Klub objednal pro Základní jen 20 osob. Víc termínů už naplánovat nelze.', A.needMet],
    ['Tímto termínem byste překročili požadavek klubu.', A.needMet],
    ['Termín zasahuje do polední pauzy 12:00–12:30. Pauza zůstává volná.', A.lunch],
    ['Kolize: Spiroergometrie · 09:00–10:30.', A.busy],
    ['Čas se překrývá s již vytvořeným termínem.', A.busy],
  ])('%s', (reason, advice) => {
    expect(refusalAdvice(reason)).toBe(advice);
    expect(withAdvice(reason)).toBe(`${reason} ${advice}`);
  });

  it('leaves alone what already says what to do, and what it does not know', () => {
    expect(refusalAdvice(PAST_REFUSAL)).toBeNull();
    expect(refusalAdvice('Zbývá pouze 3 osob. Zkraťte časový úsek.')).toBeNull();
    expect(refusalAdvice('Cokoli jiného se stalo')).toBeNull();
    expect(withAdvice('Cokoli jiného se stalo')).toBe('Cokoli jiného se stalo');
    expect(withAdvice('')).toBe('');
  });

  it('adds the full stop a sentence lacks', () => {
    expect(withAdvice('Den je v minulosti')).toBe(`Den je v minulosti. ${PLANNER_TEXT.guide.advice.past}`);
  });
});

describe('what the completion card offers next', () => {
  const list = [
    { categoryId: 'a', name: 'Základní', done: true },
    { categoryId: 'b', name: 'Komplexní', done: false },
    { categoryId: 'c', name: 'Spiro', done: false },
  ];
  it('the next unfulfilled činnost after this one, wrapping to the start', () => {
    expect(completionAdvice({ list, categoryId: 'a' })).toMatchObject({ kind: 'next', next: { categoryId: 'b', name: 'Komplexní' } });
    const wrap = [{ categoryId: 'a', name: 'A', done: false }, { categoryId: 'b', name: 'B', done: true }, { categoryId: 'c', name: 'C', done: true }];
    expect(completionAdvice({ list: wrap, categoryId: 'c' }).next?.categoryId).toBe('a');
  });
  it('the whole order complete: the form is the next step, in one sentence', () => {
    const done = list.map((x) => ({ ...x, done: true }));
    const advice = completionAdvice({ list: done, categoryId: 'b' });
    expect(advice).toMatchObject({ kind: 'prepare', next: null });
    expect(advice.sentence).toBe(PLANNER_TEXT.guide.callout.prepareSentence);
    expect(advice.sentence.split('. ')).toHaveLength(1);
  });
});

describe('the three steps of the publish dialog', () => {
  const step = (p: Parameters<typeof publishSteps>[0]) => publishSteps(p).steps.map((s) => s.state);
  it('walk one after the other', () => {
    expect(step({ generated: false, previewed: false, copied: false })).toEqual(['current', 'locked', 'locked']);
    expect(step({ generated: true, previewed: false, copied: false })).toEqual(['done', 'current', 'locked']);
    expect(step({ generated: true, previewed: true, copied: false })).toEqual(['done', 'done', 'current']);
    expect(step({ generated: true, previewed: true, copied: true })).toEqual(['done', 'done', 'done']);
  });
  it('a later step never counts before the earlier one', () => {
    expect(step({ generated: false, previewed: true, copied: true })).toEqual(['current', 'locked', 'locked']);
    expect(step({ generated: true, previewed: false, copied: true })).toEqual(['done', 'current', 'locked']);
  });
  it('every locked step says why in words, an open one does not', () => {
    const s = publishSteps({ generated: false, previewed: false, copied: false });
    expect(s.steps[1].reason).toBe(PLANNER_TEXT.guide.steps.locked2);
    expect(s.steps[2].reason).toBe(PLANNER_TEXT.guide.steps.locked2);
    expect(s.steps[0].reason).toBeNull();
    const t = publishSteps({ generated: true, previewed: false, copied: false });
    expect(t.steps[1].reason).toBeNull();
    expect(t.steps[2].reason).toBe(PLANNER_TEXT.guide.steps.locked3);
  });
  it('says what to do now', () => {
    const T = PLANNER_TEXT.guide.steps;
    expect(publishSteps({ generated: false, previewed: false, copied: false }).say).toBe(T.now1);
    expect(publishSteps({ generated: true, previewed: false, copied: false }).say).toBe(T.now2);
    expect(publishSteps({ generated: true, previewed: true, copied: false }).say).toBe(T.now3);
    expect(publishSteps({ generated: true, previewed: true, copied: true }).say).toBe(T.done);
  });
});

describe('the strip hint counts in Czech', () => {
  const t = PLANNER_TEXT.guide.strip.text;
  it('1, 2-4 and 5 or more činností', () => {
    expect(t(1)).toContain('je ještě 1 činnost.');
    expect(t(3)).toContain('jsou ještě 3 činnosti.');
    expect(t(6)).toContain('je ještě 6 činností.');
  });
});
