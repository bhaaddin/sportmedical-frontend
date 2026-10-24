/*
 * The clinic's planner tint (stage 3b follow-up): reads `plannerTintColor` from the calendar display settings - the same query and
 * cache the calendar uses, its module fetched on demand so the first load does not carry it - and hands it to the theme prefs.
 * A server without the field, a failed read, or "follow the accent" all mean null. Mounted only inside the signed-in staff app.
 */
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useThemePrefs } from './themePrefs';

/** The calendar display settings' query key (`CALENDAR_DISPLAY_QUERY_KEY`), written out so this file does not import the module. */
const KEY = ['settings', 'calendar-display'] as const;

export function ClinicPlannerTint() {
  const { setClinicPlannerTint } = useThemePrefs();
  const query = useQuery({
    queryKey: KEY,
    queryFn: async () => (await import('./api/displaySettings')).readCalendarDisplay(),
    staleTime: 5 * 60 * 1000,
  });
  const tint = query.data?.settings.plannerTintColor ?? null;
  useEffect(() => { setClinicPlannerTint?.(tint); }, [tint, setClinicPlannerTint]);
  return null;
}
