/*
 * `settings` - the board's gear (prototype `settings()`, "Nastavení plánování").
 *
 * The file's rows stay: the rule about several činnosti a day, the controls, and the reference day
 * capacity of the mini calendar (saved through the data source). Added, because the clinic uses them
 * daily and the file lacks them, in the same `settings-row` language:
 *
 *   Rozlišení    Hodina / 30 min / 15 min / 10 min + coarser / finer: four points of the board's one zoom
 *                (1x / 2x / 3.5x / 6x, `board/boardZoom.ts`; persisted as `localStorage.calendarZoomV2`) - the same
 *                zoom the "− 2× +" group of the board's toolbar sets, so the two always agree;
 *   Kalendáře    which calendars the board shows;
 *   Pracovník    only the days of one worker;
 *   Služby       which služby are shown (the legend in the sidebar is the same filter).
 *
 * The three filters are the board's own session state (`boardSettings`); the calendars, workers and služby
 * to offer are published by the board when it has read them (so they are absent in the lab).
 */
import { useId } from 'react';
import { GRID_TEXT } from '../../../../components/booking/grid/gridText';
import { usePlannerCommands } from '../../../data/usePlannerCommands';
import { usePlannerActions } from '../../../state/PlannerStoreProvider';
import { boardSettings, RESOLUTIONS, resolutionOf, useBoardSettings } from '../../board/boardSettings';
import { usePlannerModelState } from '../../context';
import type { DialogRenderer } from '../../dialogRegistry';
import './board-dialogs.css';

const CAPACITY_CHOICES = [
  { minutes: 480, label: '8 hodin' },
  { minutes: 600, label: '10 hodin' },
  { minutes: 720, label: '12 hodin' },
  { minutes: 960, label: '16 hodin' },
  { minutes: 1440, label: '24 kapacitních hodin' },
];

function ResolutionRow() {
  const st = useBoardSettings();
  const level = resolutionOf(st.zoom);
  return (
    <div className="settings-row" data-testid="settings-resolution">
      <div>
        <strong>{GRID_TEXT.resolution}</strong>
        <small>Krok mřížky {level.hint}</small>
      </div>
      <div className="resolution-group" role="group" aria-label={GRID_TEXT.resolution}>
        <button type="button" className="app-button" aria-label={GRID_TEXT.coarser} disabled={level.key === RESOLUTIONS[0]!.key} onClick={() => boardSettings.stepResolution(-1)}>−</button>
        {RESOLUTIONS.map((r) => (
          <button key={r.key} type="button" className="app-button" aria-pressed={level.key === r.key} data-resolution={r.key} onClick={() => boardSettings.setResolution(r.key)}>
            {r.label}
          </button>
        ))}
        <button type="button" className="app-button" aria-label={GRID_TEXT.finer} disabled={level.key === RESOLUTIONS[RESOLUTIONS.length - 1]!.key} onClick={() => boardSettings.stepResolution(1)}>+</button>
      </div>
    </div>
  );
}

function CalendarsRow() {
  const st = useBoardSettings();
  const { calendars } = st.facets;
  if (calendars.length === 0) return null;
  const all = calendars.map((c) => c.id);
  return (
    <div className="settings-row is-stacked" data-testid="settings-calendars">
      <div>
        <strong>{GRID_TEXT.calendars}</strong>
        <small>Která ordinace či přístroj se na ploše zobrazují.</small>
      </div>
      <div className="check-list">
        {calendars.map((c) => (
          <label className="check-row" key={c.id}>
            <input type="checkbox" checked={st.ticked === null || st.ticked.has(c.id)} onChange={() => boardSettings.toggleCalendar(c.id, all)} />
            <span className="swatch" style={{ background: c.color }} aria-hidden="true" />
            <span>{c.name}</span>
            <button type="button" className="only" onClick={() => boardSettings.onlyCalendar(c.id)}>jen tento</button>
          </label>
        ))}
      </div>
      {st.ticked !== null ? (
        <div className="row-actions"><button type="button" className="app-button" onClick={() => boardSettings.showAllCalendars()}>Zobrazit všechny kalendáře</button></div>
      ) : null}
    </div>
  );
}

function EmployeeRow() {
  const st = useBoardSettings();
  const id = useId();
  const { employees, calendars } = st.facets;
  if (calendars.length === 0) return null;
  return (
    <div className="settings-row" data-testid="settings-employee">
      <div>
        <strong><label htmlFor={id}>{GRID_TEXT.employee}</label></strong>
        <small>{employees.length ? 'Jen dny, na které je pracovník rozepsaný.' : GRID_TEXT.noEmployees}</small>
      </div>
      <select id={id} className="capacity-option" value={st.employeeId ?? ''} onChange={(e) => boardSettings.setEmployee(e.target.value === '' ? null : e.target.value)}>
        <option value="">{GRID_TEXT.allEmployees}</option>
        {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
    </div>
  );
}

function ServicesRow() {
  const st = useBoardSettings();
  const { services } = st.facets;
  if (services.length === 0) return null;
  const all = services.map((s) => s.id);
  return (
    <div className="settings-row is-stacked" data-testid="settings-services">
      <div>
        <strong>{GRID_TEXT.services}</strong>
        <small>Stejný filtr jako legenda Služby v postranním panelu.</small>
      </div>
      <div className="check-list">
        {services.map((s) => (
          <label className="check-row" key={s.id}>
            <input type="checkbox" checked={st.serviceSet === null || st.serviceSet.has(s.id)} onChange={() => boardSettings.toggleService(s.id, all)} />
            <span className="swatch" style={{ background: s.color }} aria-hidden="true" />
            <span>{s.name}</span>
            <button type="button" className="only" onClick={() => boardSettings.onlyService(s.id)}>jen tato</button>
          </label>
        ))}
      </div>
      {st.serviceSet !== null ? (
        <div className="row-actions"><button type="button" className="app-button" onClick={() => boardSettings.showAllServices()}>{GRID_TEXT.allServices}</button></div>
      ) : null}
    </div>
  );
}

function CapacityRow() {
  const { dayBudget } = usePlannerModelState();
  const commands = usePlannerCommands();
  const act = usePlannerActions();
  const current = dayBudget?.defaultMinutes ?? 720;
  const choices = CAPACITY_CHOICES.some((c) => c.minutes === current)
    ? CAPACITY_CHOICES
    : [...CAPACITY_CHOICES, { minutes: current, label: `${Math.round((current / 60) * 10) / 10} hodin` }].sort((a, b) => a.minutes - b.minutes);
  return (
    <div className="settings-row" data-testid="settings-capacity">
      <div>
        <strong>Referenční denní kapacita mini kalendáře</strong>
        <small>Z kolika hodin se počítá naplnění dne v mini kalendáři a v kroužcích dnů.</small>
      </div>
      <select
        id="demo-day-capacity"
        className="capacity-option"
        aria-label="Referenční denní kapacita mini kalendáře"
        value={current}
        onChange={(e) => {
          commands
            .saveDayBudget(Number(e.target.value))
            .then(() => act.toast('Referenční kapacita dne aktualizována.'))
            .catch((error: unknown) => act.toast(error instanceof Error ? error.message : 'Kapacitu dne se nepodařilo uložit.'));
        }}
      >
        {choices.map((c) => <option key={c.minutes} value={c.minutes}>{c.label}</option>)}
      </select>
    </div>
  );
}

function SettingsBody() {
  return (
    <div className="board-settings" data-testid="board-settings">
      <div className="settings-row">
        <div>
          <strong>Více činností během jednoho dne</strong>
          <small>Různé činnosti je možné plánovat ve stejný den. Časové překryvy termínů zůstávají blokované.</small>
        </div>
        <span className="policy-enabled">Povoleno ✓</span>
      </div>
      <div className="settings-row">
        <div>
          <strong>Ovládání</strong>
          <small>
            Táhnutím po volném čase vyberete místo pro objednání nebo blokaci · chytněte existující rezervaci → přesuňte ji myší, poté potvrďte · v plánování
            klubu klikněte na činnost a táhněte po plánu · Esc zruší tažení · Ctrl+Z vrátí poslední krok
          </small>
        </div>
      </div>
      <ResolutionRow />
      <CalendarsRow />
      <EmployeeRow />
      <ServicesRow />
      <CapacityRow />
    </div>
  );
}

export const settingsDialog: DialogRenderer<'settings'> = ({ close }) => ({
  body: <SettingsBody />,
  footer: <button className="app-button" data-close="1" onClick={close}>Hotovo</button>,
});
