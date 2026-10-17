/*
 * CompletionCallout - `#planner-feedback.planner-feedback` (prototype `showCompletionCallout`,
 * `hideCompletionCallout`): the "Požadavek naplněn / Celá objednávka naplánována" card that appears when a
 * činnost (or the whole order) is fully planned, or when the desk tries to plan a činnost that is already
 * complete (the "Hotovo" guard: no more picks once every player has a place). Auto-hides after 10 s.
 *
 *   Prohlédnout plán     hides the card and opens the finish dialog (`finishPlan`)
 *   Jiná činnost         arms the next ordered činnost that is not complete ("Zavřít" when the whole order is planned)
 *   Přidat termín navíc  (club planning, kept from pick mode) arms exactly ONE extra drop for this činnost; the
 *                        board refuses further drops again afterwards. Places beyond the players are reported
 *                        and can be trimmed ("Zkrátit na potřebu") before the order is saved.
 *
 * The numbers are the order's own counter (plan/orderFigures.ts).
 */
import { useEffect } from 'react';
import { usePlannerActions, usePlannerSelector } from '../state/PlannerStoreProvider';
import { Icon } from './Icons';
import { usePlanActions } from './plan/usePlanActions';
import { usePlanFigures } from './plan/usePlanFigures';
import './plan/plan.css';
import type { CSSProperties } from 'react';

const HIDE_AFTER_MS = 10000;

export function CompletionCallout() {
  const completion = usePlannerSelector((s) => s.planning.completion);
  const act = usePlannerActions();
  const { base } = usePlanFigures();
  const plan = usePlanActions();

  useEffect(() => {
    if (!completion) return undefined;
    const timer = window.setTimeout(() => act.hideCompletion(), HIDE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [completion, act]);

  const f = completion ? base.byId.get(completion.categoryId) : undefined;
  if (!completion || !f) {
    return <div id="planner-feedback" className="planner-feedback" hidden aria-live="polite" data-testid="completion-callout" />;
  }
  const wholeOrder = base.remaining === 0;
  const next = base.list.find((x) => x.categoryId !== f.categoryId && !x.done) ?? null;

  return (
    <div
      id="planner-feedback"
      className="planner-feedback"
      aria-live="polite"
      data-testid="completion-callout"
      style={{ '--feedback-tone': f.color } as CSSProperties}
    >
      <section className="completion-card" role="status">
        <button type="button" className="completion-close" aria-label="Zavřít oznámení" data-completion-close="" onClick={() => act.hideCompletion()}>×</button>
        <div className="completion-eyebrow"><span className="completion-dot" /> {wholeOrder ? 'OBJEDNÁVKA DOKONČENA' : 'KAPACITA SPLNĚNA'}</div>
        <div className="completion-body">
          <div className="completion-emblem"><Icon name="check" /></div>
          <div>
            <h3>{wholeOrder ? 'Celá objednávka naplánována' : 'Požadavek naplněn'}</h3>
            <p>{f.name}</p>
          </div>
        </div>
        <div className="completion-stat"><strong>{f.planned} <span>/ {f.requested} osob</span></strong><span>100 % naplánováno</span></div>
        <div className="completion-track"><i /></div>
        <p className="completion-message">
          {wholeOrder ? 'Všechny činnosti v objednávce jsou naplánované.' : 'Další sloty pro tuto činnost již nelze přidávat.'}
        </p>
        <div className="completion-actions">
          <button
            type="button"
            data-completion-review=""
            onClick={() => { act.hideCompletion(); act.openDialog({ kind: 'finish' }); }}
          >
            Prohlédnout plán <Icon name="arrow-right" />
          </button>
          <button
            type="button"
            className="completion-extra"
            data-completion-extra=""
            title="Označte v kalendáři jeden další termín nad rámec požadavku"
            onClick={() => {
              act.hideCompletion();
              plan.arm(base, f.categoryId, { extra: true, toast: 'Další termín: označte ho v kalendáři (jen jeden, potom se výběr zase uzavře).' });
            }}
          >
            Přidat termín navíc
          </button>
          <button
            type="button"
            data-completion-another=""
            onClick={() => {
              act.hideCompletion();
              if (wholeOrder || !next) return;
              plan.arm(base, next.categoryId);
            }}
          >
            {wholeOrder ? 'Zavřít' : 'Jiná činnost'}
          </button>
        </div>
      </section>
    </div>
  );
}
