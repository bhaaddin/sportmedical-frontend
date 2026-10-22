/*
 * R20 - the icon of a Kalendáře chip, chosen from the planner's own icon set by keywords in the calendar's name (then the služba's
 * name). Nothing is hard-coded to a particular clinic: a calendar called anything else gets the neutral calendar icon.
 */
import type { IconName } from '../IconSprite.generated';

const plain = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** First match wins: the most specific words first ("Zvýhodněné balíčky - prohlídka + diagnostika" is a package, not a check-up). */
const RULES: readonly { icon: IconName; words: RegExp }[] = [
  { icon: 'dumbbell', words: /balic|paket|package|bundle|zvyhodn/ },
  { icon: 'physio', words: /inbody|body|telesn|slozeni|vyziv|fyzio|physio|rehab/ },
  { icon: 'gauge', words: /diagnost|spiro|vo2|ergo|zatez|vykon|mereni|test/ },
  { icon: 'heart', words: /ordinac|lekar|medic|prohlid|ambulan|doktor|klinik|vysetren/ },
  { icon: 'users', words: /klub|tym|team|skupin/ },
  { icon: 'run', words: /sport|trenink|beh/ },
];

export const CALENDAR_ICON_FALLBACK: IconName = 'calendar';

/** The icon for a calendar: its own name decides first, the služba's name second, else the neutral calendar. */
export function calendarIconName(calendarName: string | null | undefined, serviceName?: string | null): IconName {
  for (const text of [calendarName, serviceName]) {
    if (!text) continue;
    const t = plain(text);
    const hit = RULES.find((r) => r.words.test(t));
    if (hit) return hit.icon;
  }
  return CALENDAR_ICON_FALLBACK;
}
