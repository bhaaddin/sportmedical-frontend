/*
 * AgendaPanel - `section#agenda-panel.appointments.agenda-panel` inside `.sidebar`
 * (prototype lines 2878-2902): tabs "Plánované činnosti" / "Všechny termíny", the
 * činnost chips + KPI + term list, the scope buttons Vše / Den / Týden and the footer.
 *
 * SHELL. Done: the frame, the tabs (wired to `agenda.mode`), the total count, the
 * scope buttons (wired to `agenda.scope`), the footer status and "Kompletní seznam".
 * TO DO by the owner of this file: fill `#agenda-activity-chips`, `#agenda-activity-kpi`,
 * `#agenda-activity-list`, `#agenda-all-totals`, `#agenda-all-list` from
 * `agendaPanelModel(ctx, ui, view)` ('../model/agenda.ts'; it returns chips, KPI, rows,
 * totals, notes and the empty texts) and open the term detail with
 * `act.openDialog({ kind: 'agendaDetail', id })`.
 * Prototype functions: `renderAppointments`, `agendaRow`, the delegated click handler of
 * `#agenda-panel`. Store: `agenda`, `weekStart`, `selectedDate`.
 */
import { agendaPanelModel, type AgendaScope } from '../model';
import { usePlannerActions, usePlannerSelector } from '../state/PlannerStoreProvider';
import { Icon } from './Icons';
import { usePlannerCtx } from './context';

const SCOPES: { value: AgendaScope; label: string }[] = [
  { value: 'all', label: 'Vše' },
  { value: 'day', label: 'Den' },
  { value: 'week', label: 'Týden' },
];

export function AgendaPanel() {
  const ctx = usePlannerCtx();
  const agenda = usePlannerSelector((s) => s.agenda);
  const weekStart = usePlannerSelector((s) => s.weekStart);
  const selectedDate = usePlannerSelector((s) => s.selectedDate);
  const act = usePlannerActions();
  const m = agendaPanelModel(ctx, agenda, { weekStart, selectedDate });
  return (
    <section className="appointments agenda-panel" id="agenda-panel" aria-label="Přehled plánovaných termínů" data-testid="agenda-panel">
      <div className="agenda-mode-tabs" role="group" aria-label="Režim přehledu termínů">
        <button type="button" data-agenda-mode="activities" className={agenda.mode === 'activities' ? 'is-active' : undefined} aria-pressed={agenda.mode === 'activities'} onClick={() => act.setAgendaMode('activities')}>
          Plánované činnosti
        </button>
        <button type="button" data-agenda-mode="all" className={agenda.mode === 'all' ? 'is-active' : undefined} aria-pressed={agenda.mode === 'all'} onClick={() => act.setAgendaMode('all')}>
          Všechny termíny <span className="agenda-tab-count" id="agenda-total-count">{m.totalCount}</span>
        </button>
      </div>
      <div className="agenda-pane" id="agenda-activities-view" hidden={agenda.mode !== 'activities'}>
        <div id="agenda-activity-chips" className="agenda-chips" role="group" aria-label="Filtrovat podle činnosti" />
        <div id="agenda-activity-kpi" className="agenda-kpi" aria-live="polite" />
        <div className="agenda-section-caption"><span>TERMÍNY VYBRANÉ ČINNOSTI</span><small id="agenda-activity-term-count">{m.termCaption}</small></div>
        <div id="agenda-activity-list" className="agenda-list" aria-label="Termíny vybrané činnosti" />
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
        <div id="agenda-all-totals" className="agenda-all-totals" />
        <div id="agenda-all-list" className="agenda-list" aria-label="Všechny vytvořené termíny" />
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
