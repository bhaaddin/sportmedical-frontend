/*
 * The pure parts of the club planning guide that the planner itself needs (so they are NOT in the lazy hint chunk):
 *
 *   refusalAdvice / withAdvice   a refusal ends with what to do instead
 *   completionAdvice             what the "Požadavek naplněn" card offers next (the next činnost, or the form)
 *   publishSteps                 the three numbered steps of the publish dialog and why a step is not ready
 *
 * No React, no DOM, no clock: everything is a function of the planner state it is given.
 */
import { PLANNER_TEXT } from '../text';

const A = PLANNER_TEXT.guide.advice;

/** A refusal that already tells the person what to do (a verb in the imperative) needs nothing added. */
const ADVISES = /zkraťte|vyberte|zvolte|přesuňte|opravte|zachovejte|klikněte|otevřete|použijte|začněte/i;

/** The sentence to add after a refusal, or null when it already says what to do (or is not a refusal we know). */
export function refusalAdvice(reason: string): string | null {
  if (!reason || ADVISES.test(reason)) return null;
  const r = reason.toLowerCase();
  if (/polední|pauz/.test(r)) return A.lunch;
  if (/naplněn|naplánovat nelze|nelze naplánovat|překročil|zbývá pouze|zbývá \d+ (slot|míst)|nepotřebuje|už mají termín|již mají termín/.test(r)) return A.needMet;
  if (/v minulosti/.test(r)) return A.past;
  if (/zavřeno|ordinační dob|svátek|mimo provozní|mimo plánovací/.test(r)) return A.otherDay;
  if (/není volný|nevejde|volný den/.test(r)) return A.noFree;
  if (/kolize|překrývá|obsazen/.test(r)) return A.busy;
  return null;
}

/** The refusal and, when it helps, the plain sentence about what to do instead. */
export function withAdvice(reason: string): string {
  const advice = refusalAdvice(reason);
  if (!advice) return reason;
  const t = reason.trim();
  return `${/[.!?]$/.test(t) ? t : `${t}.`} ${advice}`;
}

/* ------------------------------ the completion card ------------------------------ */

export interface CompletionAdviceInput {
  /** Every činnost of the order, in the order's order. */
  list: ReadonlyArray<{ categoryId: string; name: string; done: boolean }>;
  /** The činnost that was just fulfilled. */
  categoryId: string;
}
export interface CompletionAdvice {
  kind: 'next' | 'prepare';
  /** For `next`: the činnost to offer (the first unfulfilled one AFTER this one, then from the start). */
  next: { categoryId: string; name: string } | null;
  /** One sentence: what happens when the highlighted button is pressed. */
  sentence: string;
}

export function completionAdvice(input: CompletionAdviceInput): CompletionAdvice {
  const T = PLANNER_TEXT.guide.callout;
  const at = input.list.findIndex((x) => x.categoryId === input.categoryId);
  const ordered = at < 0 ? [...input.list] : [...input.list.slice(at + 1), ...input.list.slice(0, at)];
  const next = ordered.find((x) => !x.done && x.categoryId !== input.categoryId) ?? null;
  if (!next) return { kind: 'prepare', next: null, sentence: T.prepareSentence };
  return { kind: 'next', next: { categoryId: next.categoryId, name: next.name }, sentence: T.nextSentence(next.name) };
}

/* ------------------------------ the publish dialog's steps ------------------------------ */

export type StepState = 'done' | 'current' | 'locked';
export interface PublishStep {
  n: 1 | 2 | 3;
  title: string;
  state: StepState;
  /** For a step that cannot be used yet: why, in words. */
  reason: string | null;
}
export interface PublishProgress {
  /** The club's link exists. */
  generated: boolean;
  /** The e-mail preview was opened for THIS link. */
  previewed: boolean;
  /** The link or the e-mail text was copied. */
  copied: boolean;
}

export function publishSteps(p: PublishProgress): { steps: readonly [PublishStep, PublishStep, PublishStep]; say: string } {
  const T = PLANNER_TEXT.guide.steps;
  const previewed = p.generated && p.previewed;
  const copied = previewed && p.copied;
  const s1: StepState = p.generated ? 'done' : 'current';
  const s2: StepState = !p.generated ? 'locked' : previewed ? 'done' : 'current';
  const s3: StepState = !previewed ? 'locked' : copied ? 'done' : 'current';
  const say = !p.generated ? T.now1 : !previewed ? T.now2 : !copied ? T.now3 : T.done;
  return {
    steps: [
      { n: 1, title: T.one, state: s1, reason: null },
      { n: 2, title: T.two, state: s2, reason: s2 === 'locked' ? T.locked2 : null },
      { n: 3, title: T.three, state: s3, reason: s3 === 'locked' ? (p.generated ? T.locked3 : T.locked2) : null },
    ],
    say,
  };
}
