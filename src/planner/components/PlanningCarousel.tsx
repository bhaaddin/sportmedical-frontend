/*
 * PlanningCarousel - `section#planning-cards.planning-cards` (prototype `renderPlanningActivities`): the
 * bottom deck with the činnost cards of the order being planned (two visible at a time, `.mode-1/2/scroll`),
 * the crystal arrows, the page dots and - in the same grid - the "Celková objednávka" summary card
 * `.s42-summary-card` with its ring, numbers, mini bars and the Zpět / Připravit formulář buttons.
 *
 * Every number comes from `orderFigures` (plan/orderFigures.ts), i.e. from the club order's own counter
 * (`pickPlan.ts`): per činnost, window by window, whole slots, parallel capacity - never one pool of
 * minutes. While a placement drag (or an edge pull) is valid, the card of its činnost, the summary ring and the
 * bars show the order WITH the gesture counted in (`usePlanFigures().live`).
 *
 * Selecting a card arms the činnost for planning (`selectPlanningCategory`); a complete card shows the
 * completion callout instead; a page change by arrow or horizontal drag exits the planning mode (reducer).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import crystalArrowUrl from '../assets/crystal-arrow.png';
import { cardVisibility, carouselModel, planCardModel, snapCarouselIndex, timeLeft } from '../model';
import { usePlannerActions, usePlannerSelector } from '../state/PlannerStoreProvider';
import { Icon } from './Icons';
import { usePlannerCtx, usePlannerModelState, usePlannerProfile } from './context';
import { personsWord, type CategoryFigure } from './plan/orderFigures';
import { orderSummary } from './plan/orderSummary';
import { S41Icon } from './plan/S41Icon';
import { useClubPlanningContext } from './plan/useClubPlanningContext';
import { usePlanActions } from './plan/usePlanActions';
import { usePlanFigures } from './plan/usePlanFigures';
import './plan/plan.css';

/** The arrow bitmap that the prototype inlined as a 80 kB base64 string. */
export const CRYSTAL_ARROW_URL: string = crystalArrowUrl;

const CARD_GAP_FALLBACK = 11;

function Bracket({ direction, disabled, onGo }: { direction: -1 | 1; disabled: boolean; onGo: (direction: -1 | 1) => void }) {
  const side = direction < 0 ? 'left' : 'right';
  const ref = useRef<HTMLButtonElement | null>(null);
  const firing = useRef<number>(0);
  const label = `${direction < 0 ? 'Předchozí' : 'Další'} činnost`;
  const onMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el || el.disabled) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    el.style.setProperty('--ax', ((0.5 - y) * 22).toFixed(2) + 'deg');
    el.style.setProperty('--ay', ((x - 0.5) * 42).toFixed(2) + 'deg');
    el.style.setProperty('--pull', ((x - 0.5) * 11).toFixed(1) + 'px');
    el.style.setProperty('--px', Math.round(x * 100) + '%');
    el.style.setProperty('--py', Math.round(y * 100) + '%');
  };
  const onOut = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el || (e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) return;
    for (const p of ['--ax', '--ay', '--pull', '--px', '--py']) el.style.removeProperty(p);
  };
  useEffect(() => () => window.clearTimeout(firing.current), []);
  return (
    <button
      ref={ref}
      type="button"
      className={`precision-bracket precision-bracket-${side} fx-arrow fx-hybrid ${side}`}
      data-deck-nav={direction}
      aria-label={label}
      title={label}
      style={{ '--arrow-art': `url('${CRYSTAL_ARROW_URL}')` } as CSSProperties}
      disabled={disabled}
      onPointerMove={onMove}
      onPointerOut={onOut}
      onClick={() => {
        if (disabled) return;
        onGo(direction);
        const el = ref.current;
        if (el) {
          el.classList.remove('is-firing');
          void el.offsetWidth;
          el.classList.add('is-firing');
          window.clearTimeout(firing.current);
          firing.current = window.setTimeout(() => el.classList.remove('is-firing'), 990);
        }
      }}
    >
      <span className="arrow-visual" aria-hidden="true">
        <img className="arrow-base precision-bracket-image" src={CRYSTAL_ARROW_URL} alt="" draggable={false} />
        <span className="visual-overlays">
          <span className="arrow-sheen" /><span className="arrow-shine" /><span className="arrow-refract" /><span className="arrow-energy" /><span className="arrow-liquid" />
          <svg className="voltage-svg" viewBox="0 0 92 318" aria-hidden="true">
            <path d="M83 9 L19 158 L82 306" />
            <path d="M88 28 L36 155 L86 286" strokeOpacity=".7" />
          </svg>
        </span>
      </span>
    </button>
  );
}

interface CardProps {
  figure: CategoryFigure;
  /** The same činnost with the running gesture counted in (equals `figure` when none). */
  live: CategoryFigure;
  added: number;
  active: boolean;
  chart: { height: number; opacity: number }[];
  restoring: boolean;
  onSelect: (id: string) => void;
}

function PlanCard({ figure: f, live, added, active, chart, restoring, onSelect }: CardProps) {
  const previewing = added > 0;
  const shown = previewing ? live : f;
  const done = f.done;
  const percent = shown.percent;
  const remainingText = previewing
    ? shown.remaining === 0 ? '✓ Tímto naplníte požadavek' : `Zbývá ${shown.remaining} osob`
    : done ? '✓ Požadavek splněn' : `Zbývá ${f.remaining} osob`;
  const bottom = previewing
    ? `✦ NÁHLED +${added} ${added === 1 ? 'OSOBA' : 'OSOB'}`
    : active ? '✦ VYBRÁNO PRO PLÁNOVÁNÍ' : done ? 'HOTOVO' : 'KLIKNUTÍM VYBRAT';
  return (
    <button
      type="button"
      className={`plan-card${active ? ' is-selected' : ''}${done ? ' is-complete' : ''}${previewing ? ' is-previewing' : ''}${previewing && shown.remaining === 0 ? ' will-complete' : ''}${restoring ? ' focus-restoring' : ''}`}
      data-plan-type={f.categoryId}
      style={{ '--tone': f.color, '--pct': `${Math.min(100, percent)}%` } as CSSProperties}
      aria-pressed={active}
      title={`${f.name} · ${f.planned}/${f.requested} · ${f.remaining} zbývá`}
      onClick={() => onSelect(f.categoryId)}
    >
      <span className="fx-surface">
        <span className="fx-liquid" aria-hidden="true" />
        <span className="fx-spotlight" aria-hidden="true" />
        <span className="card-content">
          <span className="plan-card-head">
            <span className="plan-icon"><Icon name={f.iconKey} /></span>
            <span className="plan-card-titles">
              <span className="plan-card-name">{f.name}</span>
              <span className="plan-card-sub">{f.subtitle}</span>
            </span>
            {active ? <span className="plan-active-label">AKTIVNÍ</span> : done ? <span className="plan-check"><Icon name="check" /></span> : null}
          </span>
          <span className="plan-card-body">
            <span className="plan-ring"><b>{percent}%</b></span>
            <span>
              <strong className="plan-num">{shown.planned} <span>/ {f.requested}</span></strong>
              <small className="plan-remaining">{remainingText}</small>
              <small className="plan-duration">{f.slotMinutes} min / osoba · {timeLeft(shown.remainingMinutes)}</small>
            </span>
          </span>
          <span className="plan-bottom">
            <span>{bottom}</span>
            <span className="micro-chart">
              {chart.map((bar, i) => <span key={i} style={{ height: `${bar.height}px`, opacity: bar.opacity }} />)}
            </span>
          </span>
        </span>
      </span>
    </button>
  );
}

export function PlanningCarousel() {
  const ctx = usePlannerCtx();
  const profile = usePlannerProfile();
  const act = usePlannerActions();
  const plan = usePlanActions();
  const { session } = useClubPlanningContext();
  /* Standard booking (no club order): there is nothing to plan, the deck stays in the DOM but is not drawn. */
  const standard = usePlannerModelState().order?.club === false;
  const weekStart = usePlannerSelector((s) => s.weekStart);
  const selected = usePlannerSelector((s) => s.planning.selectedCategoryId);
  const index = usePlannerSelector((s) => s.carousel.index);
  const { base, live, previewCategoryId, added } = usePlanFigures();

  const quantity = base.list.length;
  const deck = carouselModel(quantity, index);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLElement | null>(null);

  /* ---- the focus dimming of the siblings (delayed on the first selection so the browser animates it) ---- */
  const [focusOn, setFocusOn] = useState(false);
  const [restoringFrom, setRestoringFrom] = useState<string | null>(null);
  const previousSelected = useRef<string | null>(null);
  useEffect(() => {
    const previous = previousSelected.current;
    previousSelected.current = selected;
    let raf = 0;
    let timer = 0;
    if (selected && !previous) {
      setFocusOn(false);
      raf = requestAnimationFrame(() => { raf = requestAnimationFrame(() => setFocusOn(true)); });
    } else {
      setFocusOn(!!selected);
    }
    if (previous && !selected) {
      setRestoringFrom(previous);
      timer = window.setTimeout(() => setRestoringFrom(null), 900);
    }
    return () => { cancelAnimationFrame(raf); window.clearTimeout(timer); };
  }, [selected]);

  /* ---- the scroll position follows the page; cards fade at the edges ---- */
  const cardStep = (): number => {
    const vp = viewportRef.current;
    const card = vp?.querySelector<HTMLElement>('.plan-card');
    const track = vp?.querySelector<HTMLElement>('.adaptive-card-track');
    if (!vp || !card || !track) return 0;
    const width = parseFloat(getComputedStyle(card).width) || card.offsetWidth;
    const gap = parseFloat(getComputedStyle(track).gap) || CARD_GAP_FALLBACK;
    return width + gap;
  };
  const syncVisibility = () => {
    const vp = viewportRef.current;
    if (!vp || !vp.closest('.mode-scroll')) return;
    const rect = vp.getBoundingClientRect();
    vp.querySelectorAll<HTMLElement>('.plan-card').forEach((card) => {
      const c = card.getBoundingClientRect();
      const v = cardVisibility({ left: c.left, right: c.right }, { left: rect.left, right: rect.right });
      card.style.opacity = String(v.opacity);
      card.classList.toggle('precision-outside-view', v.outside);
    });
  };
  const rafRef = useRef(0);
  const queueVisibility = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => { rafRef.current = 0; syncVisibility(); });
  };
  const lastIndex = useRef(deck.index);
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp || !deck.showCarousel) return;
    const left = deck.index * cardStep();
    const smooth = lastIndex.current !== deck.index;
    lastIndex.current = deck.index;
    if (smooth && typeof vp.scrollTo === 'function') vp.scrollTo({ left, behavior: 'smooth' });
    else vp.scrollLeft = left;
    syncVisibility();
  });
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  /* ---- horizontal drag of the deck (mouse, a click stays a click) ---- */
  const suppressClickUntil = useRef(0);
  const dragRef = useRef<{ id: number; startX: number; startY: number; startLeft: number; dragging: boolean; viewport: HTMLElement } | null>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || e.pointerType !== 'mouse') return;
      const target = e.target instanceof Element ? e.target : null;
      const card = target?.closest('[data-plan-type]');
      const viewport = card?.closest<HTMLElement>('.adaptive-card-viewport');
      if (!viewport || !viewport.closest('.mode-scroll')) return;
      e.preventDefault();
      dragRef.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, startLeft: viewport.scrollLeft, dragging: false, viewport };
    };
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.dragging) {
        if (Math.abs(dx) < 9 && Math.abs(dy) < 9) return;
        if (Math.abs(dx) < 9 || Math.abs(dx) < Math.abs(dy) * 1.18) { dragRef.current = null; return; }
        d.dragging = true;
        syncVisibility();
        d.viewport.classList.add('is-dragging');
        try { d.viewport.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      }
      if (e.cancelable) e.preventDefault();
      d.viewport.scrollLeft = d.startLeft - dx;
    };
    const onUp = (e: PointerEvent, cancelled = false) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.id) return;
      dragRef.current = null;
      d.viewport.classList.remove('is-dragging');
      if (!d.dragging) return;
      suppressClickUntil.current = performance.now() + 850;
      const step = cardStep();
      if (step) act.carouselTo(snapCarouselIndex(d.viewport.scrollLeft, d.startLeft, step, cancelled), quantity);
      try { if (d.viewport.hasPointerCapture(e.pointerId)) d.viewport.releasePointerCapture(e.pointerId); } catch { /* released */ }
    };
    const onCancel = (e: PointerEvent) => onUp(e, true);
    host.addEventListener('pointerdown', onDown);
    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
    return () => {
      host.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantity, act]);

  /* ---- the pointer-follow tilt of a card ---- */
  const tilt = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch') return;
    const card = (e.target as Element).closest<HTMLElement>('.plan-card');
    const fx = card?.querySelector<HTMLElement>('.fx-surface');
    if (!card || !fx) return;
    const b = card.getBoundingClientRect();
    if (!b.width || !b.height) return;
    const x = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width));
    const y = Math.max(0, Math.min(1, (e.clientY - b.top) / b.height));
    fx.style.setProperty('--rx', ((0.5 - y) * 10).toFixed(2) + 'deg');
    fx.style.setProperty('--ry', ((x - 0.5) * 14).toFixed(2) + 'deg');
    fx.style.setProperty('--px', (x * 100).toFixed(1) + '%');
    fx.style.setProperty('--py', (y * 100).toFixed(1) + '%');
  };
  const resetTilt = (card: Element | null) => {
    const fx = card?.querySelector<HTMLElement>('.fx-surface');
    if (!fx) return;
    fx.style.setProperty('--rx', '0deg');
    fx.style.setProperty('--ry', '0deg');
    fx.style.setProperty('--px', '50%');
    fx.style.setProperty('--py', '50%');
  };

  const charts = useMemo(
    () => new Map(base.list.map((f) => [f.categoryId, planCardModel(ctx, f.categoryId, weekStart, selected).chart])),
    [base, ctx, weekStart, selected],
  );
  const summary = useMemo(() => orderSummary(ctx, live, profile), [ctx, live, profile]);
  const baseSummary = useMemo(() => orderSummary(ctx, base, profile), [ctx, base, profile]);

  const onCardSelect = (id: string) => {
    if (performance.now() < suppressClickUntil.current) return;
    plan.selectCategory(base, id);
  };
  const go = (direction: -1 | 1) => act.carouselMove(direction, quantity);

  const t = live;
  const showPreviewChip = added > 0;
  const kicker = session?.clubName ?? null;

  return (
    <section
      ref={hostRef}
      id="planning-cards"
      className={`planning-cards${focusOn ? ' activity-focus-on' : ''}`}
      style={standard ? { display: 'none' } : undefined}
      data-standard={standard ? 'true' : undefined}
      aria-label="Výběr činnosti pro přetažení do kalendáře"
      data-testid="planning-carousel"
      data-focused-activity={selected ?? ''}
      onPointerMove={tilt}
      onPointerOut={(e) => {
        const card = (e.target as Element).closest('.plan-card');
        if (card && (!e.relatedTarget || !(e.relatedTarget instanceof Node) || !card.contains(e.relatedTarget))) resetTilt(card);
      }}
      onBlur={(e) => resetTilt((e.target as Element).closest('.plan-card'))}
    >
      <section className={`adaptive-deck ${deck.mode}`} data-mode={quantity} aria-label="Dvě pevné pozice činností a stálý souhrn objednávky">
        <div className={`adaptive-card-stage ${deck.showNavigation ? 'has-navigation' : 'without-navigation'}`}>
          {deck.showNavigation ? <Bracket direction={-1} disabled={deck.prevDisabled} onGo={go} /> : <span className="precision-bracket-placeholder" />}
          <div className="adaptive-card-viewport" id="adaptive-viewport" ref={viewportRef} aria-label="Činnosti klubové objednávky" onScroll={queueVisibility}>
            <div className="adaptive-card-track">
              {base.list.map((f) => (
                <PlanCard
                  key={f.categoryId}
                  figure={f}
                  live={live.byId.get(f.categoryId) ?? f}
                  added={previewCategoryId === f.categoryId ? added : 0}
                  active={selected === f.categoryId}
                  chart={charts.get(f.categoryId) ?? []}
                  restoring={restoringFrom !== null && restoringFrom !== f.categoryId}
                  onSelect={onCardSelect}
                />
              ))}
            </div>
          </div>
          {deck.showNavigation ? <Bracket direction={1} disabled={deck.nextDisabled} onGo={go} /> : <span className="precision-bracket-placeholder" />}
        </div>
        {deck.showNavigation ? (
          <div className={`adaptive-nav-row ${deck.showCarousel ? 'is-slideable' : 'is-static'}`} aria-label="Pozice činností">
            <span className="nav-page" id="adaptive-page">{deck.pageLabel}</span>
            <span className="nav-dots" aria-hidden="true">
              {deck.dots.map((inView, i) => <i key={i} className={inView ? 'is-in-view' : ''} />)}
            </span>
          </div>
        ) : null}
        <aside
          className="adaptive-insight s42-summary-card"
          data-summary-card=""
          tabIndex={0}
          aria-label="Celkový souhrn klubové objednávky. Kliknutím nebo klávesou Enter otevřete podrobnosti."
          title="Kliknutím otevřete podrobnosti objednávky"
          data-testid="summary-card"
          onClick={(e) => {
            const target = e.target as Element;
            if (target.closest('[data-summary-back]')) { e.preventDefault(); plan.backToOrder(); return; }
            if (target.closest('[data-publish-launch]')) { e.preventDefault(); plan.publish(); return; }
            plan.openSummary();
          }}
          onKeyDown={(e) => {
            if (!(e.target as Element).matches('[data-summary-card]')) return;
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); plan.openSummary(); }
          }}
        >
          <svg className="s42-ambient-wave" viewBox="0 0 420 160" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="s42-wavelight" x1="0" x2="1" y1="0" y2=".1">
                <stop stopColor="#2e9ab8" stopOpacity="0" /><stop offset=".48" stopColor="#96f6fb" stopOpacity=".29" /><stop offset="1" stopColor="#0ca2d5" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g fill="none" stroke="url(#s42-wavelight)" strokeWidth=".75">
              <path d="M125 60 Q215 -2 305 50 T440 44" /><path d="M125 64 Q224 5 308 52 T440 48" /><path d="M125 68 Q222 13 314 54 T440 52" /><path d="M125 72 Q222 21 314 56 T440 56" />
              <path d="M125 76 Q222 29 314 58 T440 60" /><path d="M125 80 Q222 37 314 60 T440 64" /><path d="M125 84 Q222 45 314 62 T440 68" /><path d="M125 88 Q222 53 314 64 T440 72" />
            </g>
          </svg>
          <div className="s42-summary-top">
            <button type="button" className="s42-summary-name" data-open-summary="" title="Otevřít celkový přehled klubové objednávky"><i className="s42-led" />CELKOVÁ OBJEDNÁVKA</button>
            <span className={`s42-status ${baseSummary.issues.length ? '' : 's42-ready'}`} title={baseSummary.issues.length ? baseSummary.issues.join(' · ') : 'Kapacity a kontakty jsou připraveny'}>
              <S41Icon name="pulse" /> {baseSummary.issues.length ? 'V PRŮBĚHU' : 'PŘIPRAVENO'}
            </span>
          </div>
          <div className="s42-summary-body">
            <div className="s42-main-block">
              <span className="s42-ring" id="adaptive-ring" role="progressbar" aria-label="Naplánovaná kapacita klubové objednávky" aria-valuenow={t.percent} aria-valuemin={0} aria-valuemax={100} style={{ '--progress': `${Math.min(100, t.percent)}%` } as CSSProperties}>
                <strong id="adaptive-percent">{t.percent}%</strong>
              </span>
              <div className="s42-numbers">
                <strong className="s42-primary-count" id="adaptive-count">{t.planned} <em>/ {t.requested}</em></strong>
                <span className="s42-count-caption">naplánováno / požadováno</span>
                <span className="s42-pending">
                  Zbývá <b id="adaptive-remaining">{t.remaining}</b> osob · <b id="adaptive-hours">{timeLeft(t.remainingMinutes)}</b>
                  <span id="insight-preview" className={`insight-preview-chip${showPreviewChip ? ' is-visible' : ''}`}>{showPreviewChip ? `  +${added} náhled` : ''}</span>
                </span>
                <span className="s42-metrics" id="insight-detail-line">{summary.terms.length} termínů <i /> {summary.slots} slotů</span>
              </div>
            </div>
            <button type="button" className="s42-mini-breakdown" data-open-summary="" title="Otevřít grafy všech klubových činností">
              <span className="s42-chart-head">ČINNOSTI <span>DETAIL ↗</span></span>
              <span className="s42-bars" id="s42-activity-bars">
                {live.list.slice(0, 4).map((row) => (
                  <span className="s42-bar-row" key={row.categoryId} data-summary-type={row.categoryId} title={`${row.name}: ${row.planned}/${row.requested} ${personsWord(row.requested)}`}>
                    <span className="s42-bar-name">{row.name}</span>
                    <span className="s42-bar-track"><i style={{ '--pct': `${row.percent}%` } as CSSProperties} /></span>
                    <span className="s42-bar-number">{row.percent}%</span>
                  </span>
                ))}
              </span>
            </button>
          </div>
          <div className="s42-summary-actions">
            <button type="button" className="s42-back-action" data-summary-back="" title={kicker ? `Zpět k objednávce klubu ${kicker}` : 'Zpět k objednávce'}><S41Icon name="back" /><span>Zpět</span></button>
            <button type="button" className="s42-primary-action" data-publish-launch=""><S41Icon name="document" /><span>Připravit formulář</span><S41Icon name="next" /></button>
          </div>
        </aside>
      </section>
    </section>
  );
}

export type { CategoryFigure };
