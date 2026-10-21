/*
 * CalendarStrip - the calendar selector of the standard calendar (reviewer 2.4): one toggle chip per calendar of the clinic, in the
 * calendar's own name and colour, right under the toolbar. The old calendar had it (the toolbar's "Kalendáře" menu and the
 * "SLUŽBY" legend); the planner kept the choice only behind the gear, so the two calendars - Lékařské prohlídky and Sportovní
 * diagnostika in the clinic's own words - could no longer be told apart or switched.
 *
 * It edits the board's own session state (`boardSettings.ticked`, the gear's "Kalendáře" rows are the same state). With two or
 * three calendars on screen every day splits into one column per calendar (`calendarColumns`); with one, the day is one column.
 * Drawn only when the clinic has two calendars or more.
 */
import type { CSSProperties } from 'react';
import type { Calendar } from '../../../api/bookingContracts';
import { MAX_CALENDAR_COLUMNS, columnChips } from './calendarColumns';
import { boardSettings, useBoardSettings } from './boardSettings';

export const CALENDAR_STRIP_TEXT = {
  label: 'Kalendáře',
  group: 'Zobrazené kalendáře',
  all: 'Všechny',
  allTitle: 'Zobrazit všechny kalendáře',
  hint: (max: number) => `Víc než ${max} kalendáře se do sloupců dne nevejdou - vyberte jich nejvýše ${max}.`,
  chipTitle: (name: string, on: boolean) => (on ? `${name}: zobrazen (klepnutím skryjete)` : `${name}: skryt (klepnutím zobrazíte)`),
} as const;

export function CalendarStrip({ columns }: { columns: readonly Calendar[] | null }) {
  const settings = useBoardSettings();
  const calendars = settings.facets.calendars;
  if (calendars.length < 2) return null;
  const all = calendars.map((c) => c.id);
  const shown = (id: string) => settings.ticked === null || settings.ticked.has(id);
  const shownCount = calendars.filter((c) => shown(c.id)).length;
  const chips = columnChips(calendars);
  return (
    <div className="calendar-strip" role="group" aria-label={CALENDAR_STRIP_TEXT.group} data-testid="calendar-strip" data-split={columns ? 'true' : 'false'}>
      <span className="calendar-strip-label">{CALENDAR_STRIP_TEXT.label}</span>
      <div className="calendar-strip-chips">
        {chips.map((chip) => {
          const on = shown(chip.id);
          return (
            <button
              key={chip.id}
              type="button"
              className={`calendar-chip${on ? ' is-on' : ''}`}
              aria-pressed={on}
              data-testid={`calendar-chip-${chip.id}`}
              data-calendar-id={chip.id}
              title={CALENDAR_STRIP_TEXT.chipTitle(chip.name, on)}
              style={{ '--cal': chip.colour } as CSSProperties}
              onClick={() => boardSettings.toggleCalendar(chip.id, all)}
            >
              <i aria-hidden="true" />
              <span>{chip.name}</span>
            </button>
          );
        })}
        {settings.ticked !== null ? (
          <button type="button" className="calendar-chip is-all" data-testid="calendar-chip-all" title={CALENDAR_STRIP_TEXT.allTitle} onClick={() => boardSettings.showAllCalendars()}>
            <span>{CALENDAR_STRIP_TEXT.all}</span>
          </button>
        ) : null}
      </div>
      {columns === null && shownCount > MAX_CALENDAR_COLUMNS ? (
        <span className="calendar-strip-hint" data-testid="calendar-strip-hint">{CALENDAR_STRIP_TEXT.hint(MAX_CALENDAR_COLUMNS)}</span>
      ) : null}
    </div>
  );
}
