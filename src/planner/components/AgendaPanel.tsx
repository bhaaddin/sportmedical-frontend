/*
 * AgendaPanel - `section#agenda-panel.appointments.agenda-panel` inside `.sidebar`
 * (prototype lines 2878-2902, `renderAppointments`, `agendaRow`): tabs "Plánované činnosti" /
 * "Všechny termíny", the činnost chips + KPI + term list, the scope buttons Vše / Den / Týden and
 * the footer.
 *
 * The wording follows the mode: a club order is "Plánované činnosti", standard ordering "Činnosti" and "Všechny termíny".
 *
 * Planning a club order: chips are the ordered činnosti, the KPI measures planned seats against the
 * ordered ones, "Vše" lists every term of the order. Standard booking (no order): the same lists over
 * the clinic's own sessions of the loaded range (`left/agendaView.ts`). A term row opens its detail
 * (`agendaDetail`) and brings the board to that week, so the term is there when the dialog closes.
 */
import type { CSSProperties } from 'react';
import { usePlannerActions, usePlannerSelector } from '../state/PlannerStoreProvider';
import type { AgendaRowModel, AgendaScope } from '../model';
import { Icon } from './Icons';
import { usePlanFigures } from './plan/usePlanFigures';
import { usePlannerCtx, usePlannerModelState } from './context';
import { agendaView } from './left/agendaView';
import './left/left.css';

const SCOPES: { value: AgendaScope; label: string }[] = [
  { value: 'all', label: 'Vše' },
  { value: 'day', label: 'Den' },
  { value: 'week', label: 'Týden' },
];

const tone = (value: string): CSSProperties => ({ '--agenda-tone': value }) as CSSProperties;

function AgendaTermRow({ row, onOpen }: { row: AgendaRowModel; onOpen: (row: AgendaRowModel) => void }) {
  return (
    <button
      type="button"
      className="agenda-term"
      data-agenda-open={row.id}
      data-testid="agenda-term"
      style={tone(row.tone)}
      title={row.title}
      aria-label={row.title}
      onClick={() => onOpen(row)}
    >
      <span className="agenda-date"><b>{row.dayLabel}</b><small>{row.dayCode}</small></span>
      <span className="agenda-term-copy"><b>{row.name}</b><small>{row.timeRange}</small></span>
      <span className="agenda-term-slots"><b>{row.slots}</b><small>{row.slotLabel}</small></span>
      <Icon name="chevron-right" />
    </button>
  );
}

export function AgendaPanel() {
  const ctx = usePlannerCtx();
  const { catalogue } = usePlannerModelState();
  const agenda = usePlannerSelector((s) => s.agenda);
  const weekStart = usePlannerSelector((s) => s.weekStart);
  const selectedDate = usePlannerSelector((s) => s.selectedDate);
  const act = usePlannerActions();
  const figures = usePlanFigures();
  const m = agendaView(ctx, agenda, { weekStart, selectedDate }, catalogue?.capabilities.mode, figures.live);
  const openTerm = (row: AgendaRowModel) => {
    act.focusDate(row.date, true);
    /* A činnost's several bookings of the day are one row: it opens the day (its people are in the day panel), not one of them. */
    if (row.group) {
      act.openReservationDrawer(row.date);
      act.setDrawerTab('bookings');
    }
    else act.openDialog({ kind: 'agendaDetail', id: row.id });
  };
  return (
    <section className="appointments agenda-panel" id="agenda-panel" aria-label={m.standard ? 'Přehled termínů' : 'Přehled plánovaných termínů'} data-testid="agenda-panel" data-agenda-standard={m.standard ? 'true' : undefined}>
      <div className="agenda-mode-tabs" role="group" aria-label="Režim přehledu termínů">
        <button type="button" data-agenda-mode="activities" className={agenda.mode === 'activities' ? 'is-active' : undefined} aria-pressed={agenda.mode === 'activities'} onClick={() => act.setAgendaMode('activities')}>
          {m.standard ? 'Činnosti' : 'Plánované činnosti'}
        </button>
        <button type="button" data-agenda-mode="all" className={agenda.mode === 'all' ? 'is-active' : undefined} aria-pressed={agenda.mode === 'all'} onClick={() => act.setAgendaMode('all')}>
          Všechny termíny <span className="agenda-tab-count" id="agenda-total-count">{m.totalCount}</span>
        </button>
      </div>
      <div className="agenda-pane" id="agenda-activities-view" hidden={agenda.mode !== 'activities'}>
        <div id="agenda-activity-chips" className="agenda-chips" role="group" aria-label="Filtrovat podle činnosti">
          {m.chips.map((chip) => (
            <button
              key={chip.categoryId}
              type="button"
              data-agenda-type={chip.categoryId}
              className={`agenda-chip${chip.active ? ' is-active' : ''}`}
              style={tone(chip.tone)}
              title={chip.title}
              aria-label={chip.title}
              aria-pressed={chip.active}
              onClick={() => act.setAgendaCategory(chip.categoryId)}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div id="agenda-activity-kpi" className="agenda-kpi" aria-live="polite" style={m.kpi ? tone(m.kpi.tone) : undefined}>
          {m.kpi ? (
            <>
              <div className="agenda-kpi-top">
                <strong className="agenda-kpi-title" title={m.kpi.name}>{m.kpi.name}</strong>
                <span className="agenda-kpi-numbers">
                  <strong>{m.kpi.planned}</strong>{m.standard ? ' slotů' : ` / ${m.kpi.requested} slotů`}
                </span>
              </div>
              <div className="agenda-track"><span style={{ '--fill': `${m.kpi.fillPercent}%` } as CSSProperties} /></div>
              <div className="agenda-kpi-bottom">
                <span><b>{m.kpi.termCountLabel.split(' ')[0]}</b> {m.kpi.termCountLabel.split(' ').slice(1).join(' ')}</span>
                {m.kpi.priceText ? <span data-testid="agenda-kpi-price">cena <b>{m.kpi.priceText}</b></span> : null}
                <span className="agenda-remaining">{m.kpi.remainingLabel}</span>
              </div>
            </>
          ) : null}
        </div>
        <div className="agenda-section-caption"><span>{m.standard ? 'TERMÍNY ČINNOSTI V KALENDÁŘI' : 'TERMÍNY VYBRANÉ ČINNOSTI'}</span><small id="agenda-activity-term-count">{m.termCaption}</small></div>
        <div id="agenda-activity-list" className="agenda-list" aria-label={m.standard ? 'Termíny činnosti' : 'Termíny vybrané činnosti'}>
          {m.activityRows.length
            ? m.activityRows.map((row) => <AgendaTermRow key={row.id} row={row} onOpen={openTerm} />)
            : <div className="agenda-empty">{m.activityEmpty}</div>}
        </div>
      </div>
      <div className="agenda-pane" id="agenda-all-view" hidden={agenda.mode !== 'all'}>
        <div className="agenda-filter-row">
          <div className="agenda-scopes" role="group" aria-label="Období termínů">
            {SCOPES.map((s) => (
              <button key={s.value} data-agenda-scope={s.value} className={agenda.scope === s.value ? 'is-active' : undefined} type="button" aria-pressed={agenda.scope === s.value} onClick={() => act.setAgendaScope(s.value)}>
                {s.label}
              </button>
            ))}
          </div>
          <span id="agenda-scope-note" className="agenda-scope-note">{m.scopeNote}</span>
        </div>
        <div id="agenda-all-totals" className="agenda-all-totals">
          <span><b>{m.allTotals.terms}</b> {m.allTotals.termsLabel}</span>
          <span><b>{m.allTotals.slots}</b> {m.allTotals.slotsLabel}</span>
        </div>
        <div id="agenda-all-list" className="agenda-list" aria-label={m.standard ? 'Všechny termíny' : 'Všechny vytvořené termíny'}>
          {m.allRows.length
            ? m.allRows.map((row) => <AgendaTermRow key={row.id} row={row} onOpen={openTerm} />)
            : <div className="agenda-empty">{m.allEmpty}</div>}
        </div>
      </div>
      <div className="agenda-footer">
        <span><i className="agenda-led" /><span id="agenda-footer-status">{m.footerStatus}</span></span>
        <button type="button" data-agenda-full="1" onClick={() => act.openDialog({ kind: 'agendaFullList', categoryId: agenda.mode === 'activities' ? (m.categoryId ?? 'all') : 'all' })}>
          Kompletní seznam <Icon name="arrow-right" />
        </button>
      </div>
    </section>
  );
}
