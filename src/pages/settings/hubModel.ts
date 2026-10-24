/*
 * What the settings hub may say about the state of the clinic's settings - pure, so it can be pinned without a browser.
 *
 * "Vyžaduje nastavení" is drawn only from data the application already reads, and only when that data answered: the
 * security lights (GET /api/system/security/lights, the same call as the chip beside "Zabezpečení a zálohy"). A light
 * that is unknown, a call that failed or a person who may not open the screen gives NOTHING - never an all-clear.
 * Other checks (missing company data, a calendar without hours) would need reads the hub does not make; they are
 * left out rather than guessed.
 */
import type { Light, SecurityLights } from '../../api/securityCenter';
import { LIGHT_WORD, SHELF_ORDER, SHELF_TITLE, chipLight } from './securityCenter/model';
import type { SettingsItem, SettingsSection } from './catalogue';

/** The catalogue id of the screen the lights belong to. */
export const SECURITY_ITEM_ID = 'zabezpeceni-zalohy';

export interface SettingsNeed {
  id: string;
  /** The screen that fixes it. */
  title: string;
  /** One line: what is wrong, in words (never a colour alone). */
  detail: string;
  to: string;
  /** red = a problem, beige = worth a look. */
  tone: 'red' | 'beige';
  light: Light;
}

/** The catalogue row, when this person may open it. */
export function visibleItem(sections: SettingsSection[], id: string): SettingsItem | null {
  for (const s of sections) for (const i of s.items) if (i.id === id) return i;
  return null;
}

/** "Vyžaduje nastavení": the cases, most urgent first; empty when nothing answered or everything is fine. */
export function settingsNeeds(sections: SettingsSection[], lights: SecurityLights | null): SettingsNeed[] {
  const item = visibleItem(sections, SECURITY_ITEM_ID);
  if (item === null || lights === null) return [];
  const worst = chipLight(lights);
  if (worst !== 'red' && worst !== 'amber') return [];
  const bad = SHELF_ORDER.filter((id) => lights[id] === 'red' || lights[id] === 'amber').map((id) => SHELF_TITLE[id]);
  return [{
    id: SECURITY_ITEM_ID,
    title: item.label,
    detail: `${LIGHT_WORD[worst]}: ${bad.join(', ')}`,
    to: item.to,
    tone: worst === 'red' ? 'red' : 'beige',
    light: worst,
  }];
}
