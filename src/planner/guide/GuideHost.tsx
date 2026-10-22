/*
 * GuideHost - the club planner's "what now" pop-out. LAZY: nothing of it is in the planner's first download.
 *
 * It reads the planner state (never the DOM), asks the pure `chooseHint` which single hint to show, and draws it as a
 * small calm card: dismissible with x ("seen", it does not come back) and "Nezobrazovat" (no more hints for this person).
 * Never a sidebar, never over the board's controls, `pointer-events` only on the card itself.
 * The memory is per person in `localStorage` (a blocked or junk storage is an empty memory, never an error).
 */
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PLANNER_TEXT } from '../text';
import { usePlannerSelector } from '../state/PlannerStoreProvider';
import { useStage } from '../components/PlannerStage';
import { usePlannerMetrics } from '../components/PlannerMetrics';
import { usePlanFigures } from '../components/plan/usePlanFigures';
import {
  chooseHint, hintKeyOf, loadMemory, markSeen, mute, saveMemory, wants,
  NO_CLOCK, type HintClock, type HintId, type HintInput, type HintLayout, type HintMemory,
} from './hints';
import './guide.css';

const T = PLANNER_TEXT.guide;

/** When the last hint appeared in this page (the 20 s gap is per page, not per planner mount). */
let lastShown: { id: HintId; at: number } | null = null;

const storageOf = (): Storage | null => {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
};
const rawUser = (): string | null => {
  try { return storageOf()?.getItem('user') ?? null; } catch { return null; }
};

export function textOf(id: HintId, variant: string, hidden: number): { title: string; text: string } {
  if (id === 'strip') return { title: T.strip.title, text: T.strip.text(hidden) };
  const s = T.start as Record<string, string>;
  return { title: T.start.title, text: s[variant] ?? T.start.board };
}

export default function GuideHost() {
  const { base } = usePlanFigures();
  const view = usePlannerSelector((s) => s.view);
  const armed = usePlannerSelector((s) => s.planning.selectedCategoryId !== null);
  const calloutOpen = usePlannerSelector((s) => s.planning.completion !== null);
  const dialogOpen = usePlannerSelector((s) => s.dialog !== null || s.summary.open);
  const page = usePlannerSelector((s) => s.carousel.index);
  const { layout } = useStage();
  const { deckVisible } = usePlannerMetrics();

  const key = useMemo(() => hintKeyOf(rawUser()), []);
  const [memory, setMemory] = useState<HintMemory>(() => loadMemory(storageOf(), key));
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const clock = useRef<HintClock>(NO_CLOCK);
  const firstPage = useRef(page);
  const [stripUsed, setStripUsed] = useState(false);
  useEffect(() => { if (page !== firstPage.current) setStripUsed(true); }, [page]);

  const activities = base.list.length;
  const input: HintInput = {
    active: activities > 0,
    activities,
    planned: base.planned,
    armed,
    view,
    layout: layout as HintLayout,
    hiddenCards: Math.max(0, activities - deckVisible),
    stripUsed,
    dialogOpen,
    calloutOpen,
  };
  const choice = chooseHint(input, memory, Date.now(), clock.current);

  /* Remember what happened to the hint that was on screen, and note the one that appears. */
  useEffect(() => {
    const was = clock.current.shown;
    if (was && was !== choice.hint && !wants(was, { ...input, dialogOpen: false, calloutOpen: false })) {
      const next = markSeen(memory, was);
      if (next !== memory) { setMemory(next); saveMemory(storageOf(), key, next); }
    }
    if (choice.hint && choice.hint !== was) lastShown = { id: choice.hint, at: Date.now() };
    clock.current = { shown: choice.hint, lastId: lastShown?.id ?? null, lastAt: lastShown?.at ?? null };
  });
  /* A hint that waits only for the 20 s gap is asked again when the gap is over. */
  useEffect(() => {
    if (choice.waitMs === null) return undefined;
    const id = window.setTimeout(tick, choice.waitMs + 20);
    return () => window.clearTimeout(id);
  }, [choice.waitMs]);

  /* The pop-out sits in the strip's own box, right above its cards, so it can never cover a card or a control. */
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const el = document.getElementById('planning-cards');
    if (el !== host) setHost(el);
  });

  if (!choice.hint || !host) return null;
  const { title, text } = textOf(choice.hint, choice.variant, input.hiddenCards);
  const close = () => {
    const next = markSeen(memory, choice.hint!);
    setMemory(next);
    saveMemory(storageOf(), key, next);
  };
  const silence = () => {
    const next = mute(markSeen(memory, choice.hint!));
    setMemory(next);
    saveMemory(storageOf(), key, next);
  };
  return createPortal(
    <aside className="guide-hint" role="note" aria-live="polite" data-testid="guide-hint" data-hint={choice.hint} data-variant={choice.variant}>
      <button type="button" className="guide-hint-close" aria-label={T.close} data-guide-close="" onClick={close}>×</button>
      <div className="guide-hint-title">{title}</div>
      <p className="guide-hint-text">{text}</p>
      <button type="button" className="guide-hint-mute" title={T.muteTitle} data-guide-mute="" onClick={silence}>{T.mute}</button>
    </aside>,
    host,
  );
}
