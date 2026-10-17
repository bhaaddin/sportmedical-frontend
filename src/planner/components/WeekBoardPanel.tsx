/*
 * WeekBoardPanel - `section.planner.glass-panel` (prototype lines 2905-2941): the toolbar
 * (week arrows, "Dnes", heading, Den / Týden / Měsíc, činnost filter, settings) and the
 * 07:00-19:00 board with its overlay layers.
 *
 * SHELL. Done: toolbar (wired to the store), day headings, hour labels and every
 * overlay element with its prototype id, all `hidden`.
 * TO DO by the owner of this file:
 *   - the cards in `#grid-events` (`renderWeekEvents`) from `weekEventsModel(ctx, weekStart, filter)`;
 *   - the day / month alternates in `#alternate-view` (`renderAlternative`) from
 *     `dayViewModel` / `monthViewModel`;
 *   - the three gestures on `#day-board`: placement drag (`beginPlacement`, `selectionFromPointer`,
 *     `placementOverlay` -> `#drag-preview` + `#drag-hud`), moving a card (`beginMove`,
 *     `proposalForMove`, `moveOverlay` -> `#move-ghost` `#move-lanes` `#move-hud`) and pulling an edge
 *     (`beginResize`, `proposalForTermExpansion`, `resizeOverlay` -> `#term-resize-*`);
 *     pointer maths: divide client distances by `useStage().scale`, ratios of `board.getBoundingClientRect()`
 *     need no correction; commit through `usePlannerCommands()` (createInterval / moveInterval / resizeInterval);
 *   - day marks (holiday / closed / lunch / hours) from `usePlannerModelState().dayMarks` - new, not in the prototype;
 *   - Esc, Ctrl+Z, right click are handled globally by `usePlannerKeyboard`.
 * Store: `view`, `filter`, `weekStart`, `planning.*`.
 */
import { weekHeadModel } from '../model';
import { usePlannerActions, usePlannerSelector } from '../state/PlannerStoreProvider';
import { Icon } from './Icons';
import { usePlannerCtx } from './context';

const VIEWS = [
  { value: 'day', label: 'Den' },
  { value: 'week', label: 'Týden' },
  { value: 'month', label: 'Měsíc' },
] as const;

export function WeekBoardPanel() {
  const ctx = usePlannerCtx();
  const view = usePlannerSelector((s) => s.view);
  const filter = usePlannerSelector((s) => s.filter);
  const weekStart = usePlannerSelector((s) => s.weekStart);
  const act = usePlannerActions();
  const head = weekHeadModel(weekStart, ctx.window);
  return (
    <section className="planner glass-panel" aria-label="Týdenní kalendář" data-testid="week-board-panel">
      <div className="planner-toolbar">
        <div className="planner-arrows">
          <button className="control" data-command="previousWeek" title="Předchozí týden" aria-label="Předchozí týden" onClick={() => act.previousWeek()}><Icon name="chevron-left" /></button>
          <button className="control" data-command="nextWeek" title="Následující týden" aria-label="Následující týden" onClick={() => act.nextWeek()}><Icon name="chevron-right" /></button>
          <button className="control today" data-command="today" onClick={() => act.today(ctx.today)}>Dnes</button>
        </div>
        <div className="week-heading"><h2 id="week-range">{head.range}</h2><span id="week-number">{head.weekNumber}</span></div>
        <div className="planner-filters">
          <div className="view-segment" aria-label="Typ zobrazení">
            {VIEWS.map((v) => (
              <button key={v.value} data-view={v.value} className={view === v.value ? 'active' : undefined} onClick={() => act.setView(v.value)}>{v.label}</button>
            ))}
          </div>
          <label className="filter-select">
            <span className="sr-only">Filtrovat podle činnosti</span>
            <select id="activity-filter" value={filter} onChange={(e) => act.setFilter(e.target.value)}>
              <option value="all">Všechny činnosti</option>
              {ctx.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Icon name="chevron-down" />
          </label>
          <button className="control settings-control" data-command="settings" title="Nastavení" aria-label="Nastavení" onClick={() => act.openDialog({ kind: 'settings' })}><Icon name="settings" /></button>
        </div>
      </div>
      <div id="week-board" className="week-board">
        <div className="board-head">
          <div className="time-head" />
          <div id="day-headings" className="day-headings">
            {head.days.map((d) => (
              <div className="day-title" key={d.date}>{d.weekName}<strong>{d.label}</strong></div>
            ))}
          </div>
        </div>
        <div className="board-body" id="board-body">
          <div className="hour-column" id="hour-column">
            {head.hours.map((h) => <div className="hour-label" key={h.label} style={{ top: `${h.top}px` }}>{h.label}</div>)}
          </div>
          <div className="day-board" id="day-board" data-testid="day-board">
            <div className="grid-lines" aria-hidden="true" />
            <div className="rugby-decoration" aria-hidden="true" />
            <div id="grid-events" className="grid-events" />
            <div id="drag-preview" className="drag-preview" hidden />
            <div id="drag-hud" className="drag-hud" hidden aria-live="off" />
            <div id="move-lanes" className="move-lanes" hidden aria-hidden="true" />
            <div id="move-ghost" className="move-ghost" hidden aria-hidden="true" />
            <div id="move-hud" className="move-hud" hidden aria-live="off" />
            <div id="term-resize-range" hidden aria-hidden="true" />
            <div id="term-resize-added" hidden aria-hidden="true" />
            <div id="term-resize-hud" hidden aria-live="polite" />
          </div>
        </div>
      </div>
      <div id="alternate-view" className="alternate-view" hidden={view === 'week'} />
    </section>
  );
}
