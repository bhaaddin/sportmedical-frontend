/*
 * The board's toolbar - the prototype's `.planner-toolbar`: week arrows and "Dnes", the heading with
 * the week counter, Den / Týden / Měsíc, the činnost filter, the zoom ("−  2×  +") and the gear. In the real calendar it
 * also carries the clinic's two entry points, "Nová objednávka" and "Klubová objednávka" (the file
 * has no create button of its own; its create action is the board itself). On a club's own screen the same place
 * holds the club's order switcher (`club/ClubOrderSwitcher`).
 */
import type { WeekHeadModel, PlannerCategory } from '../../model';
import type { PlannerView } from '../../state/plannerState';
import type { BoundPlannerActions } from '../../state/PlannerStoreProvider';
import { ClubOrderSwitcher } from '../../club/ClubOrderSwitcher';
import { categoryWithPrice, serviceWithPrice } from '../categoryPrice';
import { normalizeFilter, plannerServices, usesServiceFilter } from '../../model/services';
import { Icon } from '../Icons';
import { formatZoom, ZOOM_MAX, ZOOM_MIN } from './boardZoom';

const VIEWS = [
  { value: 'day', label: 'Den' },
  { value: 'week', label: 'Týden' },
  { value: 'month', label: 'Měsíc' },
] as const;

export interface BoardEntryPoints {
  /** Nová objednávka (bookings.create). */
  onNewBooking: () => void;
  /** Klubová objednávka; absent where there is no router to start it in. */
  onClubOrder?: () => void;
}

/** The board's zoom in the file's own segment (`.view-segment`): "−  2×  +"; the value resets to 1×. */
export interface BoardZoomControl {
  zoom: number;
  onStep: (direction: -1 | 1) => void;
  onReset: () => void;
}

export function BoardToolbar({
  head,
  view,
  filter,
  categories,
  today,
  act,
  entry,
  filterActive,
  zoomControl,
  serviceFilter = true,
}: {
  head: WeekHeadModel;
  view: PlannerView;
  filter: string;
  categories: readonly PlannerCategory[];
  today: string;
  act: BoundPlannerActions;
  entry: BoardEntryPoints | null;
  /** Some other board filter (calendars, služby, worker) is narrowing the board: the gear says so. */
  filterActive: boolean;
  /** The zoom group next to the gear; absent where the board is not zoomable. */
  zoomControl?: BoardZoomControl;
  /** The main planner filters by služba (R1); a club's own board keeps filtering by the činnosti of its order. */
  serviceFilter?: boolean;
}) {
  const byService = usesServiceFilter(categories, !serviceFilter);
  const services = byService ? plannerServices(categories) : [];
  const value = byService ? normalizeFilter(filter, categories) : filter;
  const chosenService = services.find((s) => s.id === value);
  const chosen = categories.find((c) => c.id === filter);
  return (
    <div className="planner-toolbar">
      <div className="planner-arrows">
        <button className="control" data-command="previousWeek" title="Předchozí týden" aria-label="Předchozí týden" onClick={() => act.previousWeek()}><Icon name="chevron-left" /></button>
        <button className="control" data-command="nextWeek" title="Následující týden" aria-label="Následující týden" onClick={() => act.nextWeek()}><Icon name="chevron-right" /></button>
        <button className="control today" data-command="today" onClick={() => act.today(today)}>Dnes</button>
      </div>
      <div className="week-heading"><h2 id="week-range">{head.range}</h2><span id="week-number">{head.weekNumber}</span></div>
      {/* A club's own screen: which of the club's orders the stage shows (nothing on any other route). */}
      <ClubOrderSwitcher />
      {entry ? (
        <div className="planner-actions" data-testid="board-entry-points">
          <button className="control primary" type="button" data-command="newBooking" onClick={entry.onNewBooking}><Icon name="plus" />Objednávka</button>
          {entry.onClubOrder ? (
            <button className="control" type="button" data-command="clubOrder" title="Klubová objednávka" aria-label="Klubová objednávka" onClick={entry.onClubOrder}><Icon name="users" />Klub</button>
          ) : null}
        </div>
      ) : null}
      <div className="planner-filters">
        <div className="view-segment" aria-label="Typ zobrazení">
          {VIEWS.map((v) => (
            <button key={v.value} data-view={v.value} className={view === v.value ? 'active' : undefined} onClick={() => act.setView(v.value)}>{v.label}</button>
          ))}
        </div>
        <label className="filter-select">
          <span className="sr-only">{byService ? 'Filtrovat podle služby' : 'Filtrovat podle činnosti'}</span>
          {byService ? (
            <select id="activity-filter" value={value} title={chosenService ? serviceWithPrice(chosenService) : undefined} onChange={(e) => act.setFilter(e.target.value)}>
              <option value="all">Všechny služby</option>
              {services.map((s) => <option key={s.id} value={s.id} title={serviceWithPrice(s)}>{serviceWithPrice(s)}</option>)}
            </select>
          ) : (
            <select id="activity-filter" value={filter} title={chosen ? categoryWithPrice(chosen) : undefined} onChange={(e) => act.setFilter(e.target.value)}>
              <option value="all">Všechny činnosti</option>
              {categories.map((c) => <option key={c.id} value={c.id} title={categoryWithPrice(c)}>{categoryWithPrice(c)}</option>)}
            </select>
          )}
          <Icon name="chevron-down" />
        </label>
        {zoomControl ? (
          <div className="view-segment zoom-segment" role="group" aria-label="Přiblížení časové osy" data-testid="board-zoom">
            <button type="button" data-zoom-command="out" title="Oddálit (−)" aria-label="Oddálit" disabled={zoomControl.zoom <= ZOOM_MIN} onClick={() => zoomControl.onStep(-1)}>−</button>
            <button
              type="button"
              className="zoom-value"
              data-zoom-command="reset"
              data-testid="board-zoom-value"
              title="Původní velikost (0)"
              aria-label={`Přiblížení ${formatZoom(zoomControl.zoom)}`}
              onClick={zoomControl.onReset}
            >
              {formatZoom(zoomControl.zoom)}
            </button>
            <button type="button" data-zoom-command="in" title="Přiblížit (+)" aria-label="Přiblížit" disabled={zoomControl.zoom >= ZOOM_MAX} onClick={() => zoomControl.onStep(1)}>+</button>
          </div>
        ) : null}
        <button
          className={`control settings-control${filterActive ? ' has-filter' : ''}`}
          data-command="settings"
          title="Nastavení"
          aria-label="Nastavení"
          onClick={() => act.openDialog({ kind: 'settings' })}
        >
          <Icon name="settings" />
        </button>
      </div>
    </div>
  );
}
