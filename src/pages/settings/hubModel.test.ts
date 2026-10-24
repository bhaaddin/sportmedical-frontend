import { describe, it, expect } from 'vitest';
import { SETTINGS_SECTIONS, visibleSections } from './catalogue';
import { settingsNeeds, visibleItem, SECURITY_ITEM_ID } from './hubModel';

const OWNER = visibleSections(['settings.clinic.manage', 'users.manage', 'communication.manage', 'questionnaires.manage']);
const lights = (over: Partial<Record<'backups' | 'accounts' | 'environment' | 'activity' | 'overall', 'green' | 'amber' | 'red' | 'unknown'>> = {}) => ({
  backups: 'green' as const, accounts: 'green' as const, environment: 'green' as const, activity: 'green' as const, overall: 'green' as const, ...over,
});

describe('settingsNeeds - "Vyžaduje nastavení" on the hub', () => {
  it('says nothing before the lights answered, or when they cannot', () => {
    expect(settingsNeeds(OWNER, null)).toEqual([]);
  });

  it('says nothing when all is well, and nothing when a light is only unknown (never a guess)', () => {
    expect(settingsNeeds(OWNER, lights())).toEqual([]);
    expect(settingsNeeds(OWNER, lights({ activity: 'unknown' }))).toEqual([]);
  });

  it('names the screen, the worst word and which parts are wrong - a problem in red', () => {
    const [need, ...rest] = settingsNeeds(OWNER, lights({ backups: 'red', accounts: 'amber' }));
    expect(rest).toEqual([]);
    expect(need).toMatchObject({ id: SECURITY_ITEM_ID, title: 'Zabezpečení a zálohy', to: '/nastaveni/zabezpeceni-a-zalohy', tone: 'red' });
    expect(need.detail).toBe('Problém: Zálohy, Účty');
  });

  it('is "Pozor" in beige for an amber light', () => {
    expect(settingsNeeds(OWNER, lights({ environment: 'amber' }))[0]).toMatchObject({ tone: 'beige', detail: 'Pozor: Prostředí' });
  });

  it('is never offered to somebody who may not open the screen', () => {
    const receptionist = visibleSections(['patients.view']);
    expect(visibleItem(receptionist, SECURITY_ITEM_ID)).toBeNull();
    expect(settingsNeeds(receptionist, lights({ backups: 'red' }))).toEqual([]);
  });

  it('points at a screen the catalogue really has', () => {
    expect(SETTINGS_SECTIONS.some((s) => s.items.some((i) => i.id === SECURITY_ITEM_ID))).toBe(true);
  });
});
