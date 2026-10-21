/*
 * SummaryExperience - `#summary-experience-layer.s41-layer` (prototype `openSummaryExperience`,
 * `closeSummaryExperience`, `showSummarySheet`, `s41BuildProgressRow`): the full-stage "CELKOVÁ OBJEDNÁVKA"
 * command centre opened from the carousel's summary card.
 *
 * Real numbers: the figures are the order's own counter (plan/orderFigures.ts), the prices come from the
 * price list / the server's quote (`orderMoneyView`) and the order's reference (KO-xxxxxxxx) from the order.
 *
 *   Zpět                 closes (Esc and a right click close too, a click outside the panel as well)
 *   Připravit formulář   closes and opens the publication dialog
 *   Zobrazit detail      the side sheets "Přehled všech činností" (per činnost, with prices) and "Klubové termíny"
 *
 * It is a real modal: Tab stays inside, focus returns to where it was on closing.
 */
import { useEffect, useMemo, useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { usePlannerActions, usePlannerSelector } from '../state/PlannerStoreProvider';
import { usePlannerCtx, usePlannerModelState, usePlannerProfile } from './context';
import { personsWord, type CategoryFigure } from './plan/orderFigures';
import { detailLine, discountLine, moneyText, orderMoneyView, orderReference, orderSummary, termRows } from './plan/orderSummary';
import { S41_WAVE_ART } from './plan/s41WaveArt';
import { S41Icon } from './plan/S41Icon';
import { usePlanFigures } from './plan/usePlanFigures';
import type { SummarySheet } from '../state/plannerState';
import { timeLeft } from '../model';
import { onDarkSurface } from '../../colors/activityColor';
import './plan/plan.css';

const FLOW: { id: SummarySheet | 'publish'; label: string }[] = [
  { id: 'overview', label: 'PLÁNOVÁNÍ' },
  { id: 'activities', label: 'KAPACITA' },
  { id: 'terms', label: 'TERMÍNY' },
  { id: 'publish', label: 'FORMULÁŘ' },
];

function ProgressRow({ item, detail }: { item: CategoryFigure; detail: boolean }) {
  const pct = Math.max(0, Math.min(100, item.percent));
  if (!detail) {
    return (
      <div className="s41-activity-row" style={{ '--tone': onDarkSurface(item.color) } as CSSProperties} title={`${item.name}: ${item.planned}/${item.requested} ${personsWord(item.requested)}`}>
        <span className="s41-activity-name"><i className="s41-swatch" aria-hidden="true" />{item.name}</span>
        <span className="s41-activity-bar"><span style={{ '--value': `${pct}%` } as CSSProperties} /></span>
        <span className="s41-activity-pct">{pct}%</span>
      </div>
    );
  }
  return (
    <div className="s41-detail-row" data-testid="s41-detail-row" style={{ '--tone': onDarkSurface(item.color) } as CSSProperties}>
      <div className="s41-detail-line"><span className="s41-detail-name"><i />{item.name}</span><strong>{item.planned} / {item.requested}</strong></div>
      <div className="s41-detail-bar"><i style={{ '--pct': `${pct}%` } as CSSProperties} /></div>
      <div className="s41-detail-sub">{detailLine(item)}</div>
    </div>
  );
}

export function SummaryExperience() {
  const open = usePlannerSelector((s) => s.summary.open);
  const sheet = usePlannerSelector((s) => s.summary.sheet);
  const act = usePlannerActions();
  const layerRef = useRef<HTMLDivElement | null>(null);
  const returnFocus = useRef<Element | null>(null);

  /* Focus: remember where it was, move it to "Zpět", give it back on closing. */
  useEffect(() => {
    if (!open) return undefined;
    returnFocus.current = document.activeElement;
    layerRef.current?.querySelector<HTMLElement>('.s41-back')?.focus({ preventScroll: true });
    return () => {
      const el = returnFocus.current;
      if (el instanceof HTMLElement) {
        try { el.focus({ preventScroll: true }); } catch { /* element gone */ }
      }
    };
  }, [open]);
  useEffect(() => {
    if (open && sheet !== 'overview') layerRef.current?.querySelector<HTMLElement>('.s41-sheet-close')?.focus({ preventScroll: true });
  }, [open, sheet]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const focusables = [...(layerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]):not([hidden])') ?? [])].filter((el) => !el.closest('[hidden]'));
    if (!focusables.length) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus({ preventScroll: true }); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus({ preventScroll: true }); }
  };

  const toPublish = () => { act.closeSummary(); act.openDialog({ kind: 'publish' }); };

  return (
    <div
      id="summary-experience-layer"
      ref={layerRef}
      className="s41-layer"
      hidden={!open}
      aria-hidden={!open}
      data-testid="summary-layer"
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (!open) return;
        const target = e.target as Element;
        const nav = target.closest<HTMLElement>('[data-s41-nav]');
        const action = nav?.dataset.s41Nav ?? target.closest<HTMLElement>('[data-s41-action]')?.dataset.s41Action;
        if (action) {
          if (action === 'back') act.closeSummary();
          else if (action === 'overview' || action === 'activities' || action === 'terms') act.setSummarySheet(action);
          else if (action === 'publish') toPublish();
          return;
        }
        if (!target.closest('.s41-panel, .s41-topbar')) act.closeSummary();
      }}
      onContextMenu={(e) => { if (open) { e.preventDefault(); e.stopPropagation(); act.closeSummary(); } }}
    >
      {open ? <SummaryScene sheet={sheet} /> : null}
    </div>
  );
}

function SummaryScene({ sheet }: { sheet: SummarySheet }) {
  const ctx = usePlannerCtx();
  const profile = usePlannerProfile();
  const { order } = usePlannerModelState();
  const { base } = usePlanFigures();
  const summary = useMemo(() => orderSummary(ctx, base, profile, order?.id), [ctx, base, profile, order?.id]);
  const money = useMemo(() => orderMoneyView(base, order), [base, order]);
  const reference = orderReference(order);
  const t = base;
  const remainingPct = t.requested ? Math.max(0, 100 - t.percent) : 0;
  void remainingPct;
  const sourceBars = summary.topRows;
  const colorOf = useMemo(() => new Map(base.list.map((f) => [f.categoryId, f.color] as const)), [base.list]);

  return (
    <div className="s41-scene" role="dialog" aria-modal="true" aria-labelledby="s41-heading">
      <header className="s41-topbar">
        <button type="button" className="s41-back" data-s41-action="back"><S41Icon name="back" /><span>Zpět</span></button>
        <div className="s41-brand"><strong>{profile.clubName}</strong><small>SPORTOVNÍ DIAGNOSTIKA · PREVENCE · VÝKON</small></div>
        <nav className="s41-flow" aria-label="Sekce přehledu">
          {FLOW.map((step, i) => (
            <span key={step.id} style={{ display: 'contents' }}>
              {i > 0 ? <i /> : null}
              <button type="button" className={sheet === step.id || (step.id === 'overview' && sheet === 'overview') ? 'is-current' : undefined} data-s41-nav={step.id}>{step.label}</button>
            </span>
          ))}
        </nav>
      </header>
      <main className="s41-panel">
        <span aria-hidden="true" style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: S41_WAVE_ART }} />
        <div className="s41-panel-content">
          <div className="s41-titlebar">
            <div className="s41-title-wrap">
              <span className="s41-title-led" aria-hidden="true" />
              <div>
                <h2 id="s41-heading">CELKOVÁ OBJEDNÁVKA</h2>
                <p>Přehled plánování a kapacity{reference ? <> · <b className="s41-reference" data-testid="order-reference">{reference}</b></> : null}</p>
              </div>
            </div>
            <div className={`s41-badge ${summary.fullyPlanned ? '' : 'incomplete'}`}><S41Icon name="pulse" /><span>{summary.status}</span><i className="s41-badge-dot" /></div>
          </div>
          <div className="s41-overview">
            <div className="s41-ring-column">
              <div className="s41-ring" role="progressbar" aria-label="Naplánovaná část klubové objednávky" aria-valuemin={0} aria-valuemax={100} aria-valuenow={t.percent} style={{ '--progress': `${Math.max(0, Math.min(100, t.percent))}%` } as CSSProperties}>
                <div className="s41-ring-content">
                  <strong className="s41-ring-percent">{t.percent}%</strong>
                  <span className="s41-ring-caption">NAPLNĚNO</span>
                  <span className="s41-ring-minibar"><i style={{ '--progress': `${Math.max(0, Math.min(100, t.percent))}%` } as CSSProperties} /></span>
                  <span className="s41-ring-count">{t.planned} / {t.requested}</span>
                </div>
              </div>
            </div>
            <div className="s41-number-column">
              <div className="s41-count-row"><strong className="s41-count-primary">{t.planned}</strong><span className="s41-count-total">/ {t.requested}</span></div>
              <div className="s41-count-label">naplánováno / požadováno</div>
              <div className="s41-remaining"><S41Icon name="people" /><span>Zbývá <b>{t.remaining} osob</b> · <b>{timeLeft(t.remainingMinutes)}</b></span></div>
              <div className="s41-small-metrics"><span><S41Icon name="calendar" />{summary.terms.length} termínů</span><i /><span><S41Icon name="layers" />{summary.slots} slotů</span></div>
              <div className="s41-money" data-testid="order-money">
                {money.totalCzk !== null ? (
                  <><b>{moneyText(money.totalCzk)}</b>{discountLine(money) ? <small>{discountLine(money)}</small> : null}</>
                ) : (
                  <><b>{moneyText(money.listCzk)}</b><small>{money.listCzk === null ? 'ceník nemá ceny činností' : money.incomplete ? 'podle ceníku · některá činnost je bez ceny' : 'podle ceníku'}</small></>
                )}
              </div>
            </div>
            <div className="s41-bars-column">
              {sourceBars.length ? sourceBars.map((x) => <ProgressRow key={x.categoryId} item={x} detail={false} />) : <span className="s41-activity-empty">Žádné činnosti v objednávce</span>}
              <button type="button" className="s41-drill" data-s41-action="activities" title="Zobrazit všechna vyšetření">
                <S41Icon name="chart" /><span> Zobrazit detail po činnostech</span><S41Icon name="next" />
              </button>
            </div>
          </div>
          <div className="s41-actions">
            <button type="button" className="s41-btn s41-btn-primary" data-s41-action="publish"><S41Icon name="document" /><span>Připravit formulář</span><S41Icon name="next" /></button>
            <button type="button" className="s41-btn s41-btn-secondary" data-s41-action="activities"><S41Icon name="chart" /><span>Zobrazit detail</span><S41Icon name="next" /></button>
          </div>
          <footer className="s41-footer">
            <div className="s41-note"><S41Icon name="info" /><span>Formulář se připravuje z naplánovaných termínů klubu</span></div>
            <div className="s41-readiness"><i className={`s41-dot ${summary.issues.length ? 'needs-action' : ''}`} /><span>{summary.readiness}</span>{!summary.issues.length ? <S41Icon name="check" /> : null}</div>
          </footer>
        </div>
        {sheet !== 'overview' ? (
          <aside id="s41-sheet" className="s41-sheet" aria-label="Podrobná analýza objednávky">
            <div className="s41-sheet-head">
              <div>
                <strong>{sheet === 'activities' ? 'Přehled všech činností' : 'Klubové termíny'}</strong>
                <small>{sheet === 'activities' ? 'Naplánovaný počet, zbývající osoby a čas' : 'Termíny rezervované z klubové objednávky'}</small>
              </div>
              <button className="s41-sheet-close" type="button" data-s41-action="overview" aria-label="Zavřít detail">×</button>
            </div>
            <div className="s41-sheet-body">
              {sheet === 'activities' ? (
                <>
                  {base.list.length ? base.list.map((r) => <ProgressRow key={r.categoryId} item={r} detail />) : <div className="s41-activity-empty">Objednávka nemá žádné činnosti.</div>}
                  <div className="s41-sheet-money">
                    {money.lines.filter((l) => l.seats > 0).map((l) => (
                      <div key={l.categoryId} className="s41-money-line" style={{ '--tone': onDarkSurface(colorOf.get(l.categoryId) ?? '') } as CSSProperties}><span><i className="s41-swatch" aria-hidden="true" />{l.name} · {l.seats} × {moneyText(l.unitCzk)}</span><strong>{moneyText(l.valueCzk)}</strong></div>
                    ))}
                    <div className="s41-money-line is-total"><span>{money.totalCzk !== null ? 'Cena objednávky' : 'Cena podle ceníku'}</span><strong>{moneyText(money.totalCzk ?? money.listCzk)}</strong></div>
                    {discountLine(money) ? <small>{discountLine(money)}</small> : null}
                  </div>
                  <p className="s41-detailed-note">Výpočet používá pouze naplánovanou kapacitu klubu, činnost po činnosti a okno po okně. Skutečné přihlášky sportovců se sledují samostatně v klubovém rozhraní. Zbývající hodiny jsou součtem celých slotů, které ještě chybí.</p>
                </>
              ) : (
                <>
                  {termRows(summary, ctx).map((e) => (
                    <div className="s41-term-row" key={e.id}>
                      <div><strong>{e.name}</strong><span className="s41-term-meta">{e.meta}</span></div>
                      <span className="s41-term-cap">{e.capacityLabel}</span>
                    </div>
                  ))}
                  {summary.terms.length === 0 ? <div className="s41-activity-empty">Žádné klubové termíny zatím nejsou vytvořeny.</div> : null}
                  <p className="s41-detailed-note">Pouze klubové termíny. Termíny pro individuální pacienty nejsou započítány do klubové objednávky.</p>
                </>
              )}
            </div>
          </aside>
        ) : null}
      </main>
    </div>
  );
}
