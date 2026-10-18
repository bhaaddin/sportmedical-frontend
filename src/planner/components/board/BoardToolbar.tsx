/*
 * The board's toolbar - the prototype's `.planner-toolbar`: week arrows and "Dnes", the heading with
 * the week counter, Den / Týden / Měsíc, the činnost filter and the gear. In the real calendar it
 * also carries the clinic's two entry points, "Nová objednávka" and "Klubová objednávka" (the file
 * has no create button of its own; its create action is the board itself). On a club's own screen the same place
 * holds the club's order switcher (`club/ClubOrderSwitcher`).
 */
import type { WeekHeadModel, PlannerCategory } from '../../model';
import type { PlannerView } from '../../state/plannerState';
import type { BoundPlannerActions } from '../../state/PlannerStoreProvider';
import { ClubOrderSwitcher } from '../../club/ClubOrderSwitcher';
import { categoryWithPrice } from '../categoryPrice';
import { Icon } from '../Icons';

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

export function BoardToolbar({
  head,
  view,
  filter,
  categories,
  today,
  act,
  entry,
  filterActive,
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
}) {
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
          <span className="sr-only">Filtrovat podle činnosti</span>
          <select id="activity-filter" value={filter} title={chosen ? categoryWithPrice(chosen) : undefined} onChange={(e) => act.setFilter(e.target.value)}>
            <option value="all">Všechny činnosti</option>
            {categories.map((c) => <option key={c.id} value={c.id} title={categoryWithPrice(c)}>{categoryWithPrice(c)}</option>)}
          </select>
          <Icon name="chevron-down" />
        </label>
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
