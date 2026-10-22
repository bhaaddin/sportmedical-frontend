/*
 * CalendarStrip - the selector of the standard calendar, "Kalendáře" (R20; R2 made it by služba): one toggle chip per calendar
 * group of the clinic - an ICON from the planner's set (`calendarIcon.ts`, chosen by keywords, neutral fallback), the calendar's own
 * name ("Ordinace 1") and the služba's colour - plus "Všechny", right under the toolbar. Never a list of činnosti: "I click a
 * calendar and see it; two clicks, two calendars side by side; each služba contains its činnosti".
 *
 *   - one click shows only that služba's calendar (from "Všechny"); a click on a second služba adds a column to every day (the
 *     split of fix 2.4); a click on a shown one hides it; hiding the last one is "Všechny" again (`toggleGroupSet`);
 *   - the činnosti of the shown služby are listed inside as colour pills (they are not calendars and are not clickable);
 *   - a služba with several calendars is still one chip and one column (`serviceGroups`) - the extra rows are hidden, not deleted.
 *
 * It edits the board's own session state (`boardSettings.ticked`; the gear's "Kalendáře" rows are the same state). Drawn only when
 * the clinic has two služby or more.
 */
import type { CSSProperties } from 'react';
import type { Calendar } from '../../../api/bookingContracts';
import { MAX_CALENDAR_COLUMNS } from './calendarColumns';
import { boardSettings, useBoardSettings } from './boardSettings';
import { calendarIconName, CALENDAR_ICON_FALLBACK } from './calendarIcon';
import { Icon } from '../Icons';
import { textOnColor } from '../../../colors/activityColor';
import { groupOn, groupsOnScreen } from './serviceGroups';

export const CALENDAR_STRIP_TEXT = {
  label: 'Kalendáře',
  group: 'Zobrazené kalendáře',
  all: 'Všechny',
  allTitle: 'Zobrazit všechny kalendáře',
  activities: 'Činnosti zobrazených služeb',
  hint: (max: number) => `Víc než ${max} kalendáře se do sloupců dne nevejdou - vyberte jich nejvýše ${max}.`,
  chipTitle: (name: string, on: boolean) => (on ? `${name}: zobrazen (klepnutím skryjete)` : `${name}: skryt (klepnutím zobrazíte)`),
} as const;

export function CalendarStrip({ columns }: { columns: readonly Calendar[] | null }) {
  const settings = useBoardSettings();
  const groups = settings.facets.groups;
  if (groups.length < 2) return null;
  const shownCount = groupsOnScreen(settings.ticked, groups);
  /* the pills of the činnosti: only once the choice is narrowed (with every služba on screen they would be the whole price list) */
  const pills = settings.ticked === null ? [] : groups.filter((g) => groupOn(settings.ticked, g)).flatMap((g) => g.activities.map((a) => ({ ...a, serviceId: g.id })));
  return (
    <div className="calendar-strip" role="group" aria-label={CALENDAR_STRIP_TEXT.group} data-testid="calendar-strip" data-split={columns ? 'true' : 'false'}>
      <span className="calendar-strip-label">{CALENDAR_STRIP_TEXT.label}</span>
      <div className="calendar-strip-chips">
        {groups.map((group) => {
          const on = groupOn(settings.ticked, group);
          return (
            <button
              key={group.id}
              type="button"
              className={`calendar-chip${on ? ' is-on' : ''}`}
              aria-pressed={on}
              data-testid={`calendar-chip-${group.id}`}
              data-calendar-id={group.primaryId}
              data-service-id={group.serviceId ?? undefined}
              title={group.name !== group.calendarName ? `${CALENDAR_STRIP_TEXT.chipTitle(group.calendarName, on)} - ${group.name}` : CALENDAR_STRIP_TEXT.chipTitle(group.calendarName, on)}
              style={{ '--cal': group.colour, '--cal-ink': textOnColor(group.colour).color } as CSSProperties}
              onClick={() => boardSettings.clickGroup(group.id, groups)}
            >
              <Icon name={calendarIconName(group.calendarName, group.name)} className="icon calendar-chip-icon" />
              <span>{group.calendarName}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={`calendar-chip is-all${settings.ticked === null ? ' is-on' : ''}`}
          aria-pressed={settings.ticked === null}
          data-testid="calendar-chip-all"
          title={CALENDAR_STRIP_TEXT.allTitle}
          style={{ '--cal': '#8fb6c9', '--cal-ink': textOnColor('#8fb6c9').color } as CSSProperties}
          onClick={() => boardSettings.showAllCalendars()}
        >
          <Icon name={CALENDAR_ICON_FALLBACK} className="icon calendar-chip-icon" />
          <span>{CALENDAR_STRIP_TEXT.all}</span>
        </button>
      </div>
      {columns === null && shownCount > MAX_CALENDAR_COLUMNS ? (
        <span className="calendar-strip-hint" data-testid="calendar-strip-hint">{CALENDAR_STRIP_TEXT.hint(MAX_CALENDAR_COLUMNS)}</span>
      ) : null}
      {pills.length > 0 ? (
        <ul className="calendar-strip-pills" aria-label={CALENDAR_STRIP_TEXT.activities} data-testid="calendar-strip-pills">
          {pills.map((p) => (
            <li key={p.id} className="calendar-pill" data-activity-id={p.id} data-service-id={p.serviceId} style={{ '--cal': p.colour } as CSSProperties}>
              <i aria-hidden="true" />
              <span>{p.name}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
