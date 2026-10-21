import { describe, expect, it } from 'vitest';
import type { AccountsSection, ActivitySection, BackupSection, EnvironmentSection, SecurityLights } from '../../../api/securityCenter';
import {
  accountsLight,
  activityLight,
  agoText,
  backupLight,
  bytesText,
  chipLight,
  environmentLight,
  groupFindings,
  overallLight,
  sizeSeries,
  sortChecks,
  sparklinePoints,
  worstLight,
  type LightView,
  type ShelfId,
} from './model';
import { backupSection, accountsSection, activitySection, environmentSection } from './fixtures';

/*
 * The rules of the lights on the screen. The server colours a part from what it can prove; the screen refuses to
 * paint a green that the data in the same answer does not support, and paints a part nobody could measure grey.
 */

describe('the backup light', () => {
  it('shows what the server says when it is not green', () => {
    expect(backupLight(backupSection({ light: 'red' })).light).toBe('red');
    expect(backupLight(backupSection({ light: 'amber' })).light).toBe('amber');
  });

  it('is green only with the whole evidence', () => {
    const view = backupLight(backupSection());
    expect(view.light).toBe('green');
    expect(view.downgraded).toBe(false);
  });

  it.each([
    ['not fresh', { freshness: 'stale' as const }, 'není čerstvá'],
    ['no successful run', { lastSuccessAtUtc: null }, 'není žádný úspěšný běh'],
    ['no verified restore', { lastRestoreVerifiedAtUtc: null }, 'chybí ověřená obnova'],
    ['restore drill never done', { restoreDrill: 'never' as const }, 'chybí ověřená obnova'],
    ['restore drill overdue', { restoreDrill: 'overdue' as const }, 'chybí ověřená obnova'],
    ['not provably in the EU', { locationKind: 'unknown' as const }, 'není doloženo úložiště v EU'],
    ['outside the EU', { locationKind: 'notEu' as const }, 'není doloženo úložiště v EU'],
    ['no claim of encryption', { encrypted: null }, 'není doloženo šifrování'],
    ['claimed unencrypted', { encrypted: false }, 'není doloženo šifrování'],
  ])('is held back to amber when a green lacks evidence: %s', (_name, change, because) => {
    const view = backupLight(backupSection({}, change));
    expect(view.light).toBe('amber');
    expect(view.downgraded).toBe(true);
    expect(view.why).toContain(because);
  });

  it('is grey, never green and never red, when the part could not be read', () => {
    const view = backupLight(backupSection({ light: 'unknown', assessment: null, error: 'Stav záloh se nepodařilo načíst z databáze.' }));
    expect(view.light).toBe('unknown');
    expect(view.why).toContain('nevíme nic');
  });

  it('is grey when the server says green but sent nothing to base it on', () => {
    expect(backupLight(backupSection({ light: 'green', assessment: null })).light).toBe('unknown');
  });
});

describe('the accounts light', () => {
  it('is green only when every privileged account has a second factor and nothing needs attention', () => {
    expect(accountsLight(accountsSection()).light).toBe('green');
  });

  it('is held back when the numbers behind a green do not add up', () => {
    const view = accountsLight(accountsSection({}, { privilegedWithTwoFactor: 1 }));
    expect(view.light).toBe('amber');
    expect(view.downgraded).toBe(true);
  });

  it('is held back when nobody privileged exists to be protected (nothing was proven)', () => {
    expect(accountsLight(accountsSection({}, { privilegedAccounts: 0, privilegedWithTwoFactor: 0 })).light).toBe('amber');
  });

  it('is grey without data', () => {
    expect(accountsLight(accountsSection({ light: 'unknown', posture: null, error: 'x' })).light).toBe('unknown');
  });

  it('passes red and amber through', () => {
    expect(accountsLight(accountsSection({ light: 'red' })).light).toBe('red');
  });
});

describe('the environment light', () => {
  it('is green only when every check passed', () => {
    expect(environmentLight(environmentSection()).light).toBe('green');
    const view = environmentLight(
      environmentSection({}, [{ id: 'https', title: 'HTTPS', status: 'warn', detail: 'd', explanation: 'e', fix: 'f' }]),
    );
    expect(view.light).toBe('amber');
    expect(view.downgraded).toBe(true);
  });

  it('is grey with no checks at all, not green', () => {
    expect(environmentLight(environmentSection({ light: 'green' }, [])).light).toBe('unknown');
  });
});

describe('the activity light', () => {
  it('follows the server and is grey without facts', () => {
    expect(activityLight(activitySection({ light: 'amber' })).light).toBe('amber');
    expect(activityLight(activitySection({ light: 'green', facts: null })).light).toBe('unknown');
  });
});

describe('the overall light', () => {
  const view = (light: LightView['light']): LightView => ({ light, downgraded: false, why: null });
  const all = (a: LightView['light'], b: LightView['light'], c: LightView['light'], d: LightView['light']): Record<ShelfId, LightView> => ({
    backups: view(a),
    accounts: view(b),
    environment: view(c),
    activity: view(d),
  });

  it('is the worst of the four', () => {
    expect(overallLight(all('green', 'green', 'green', 'green'))).toBe('green');
    expect(overallLight(all('green', 'amber', 'green', 'green'))).toBe('amber');
    expect(overallLight(all('green', 'amber', 'red', 'green'))).toBe('red');
  });

  it('is never green while a part was not measured', () => {
    expect(overallLight(all('green', 'green', 'unknown', 'green'))).toBe('unknown');
    expect(worstLight([])).toBe('unknown');
  });

  it('is the chip: the worst of the four server lights, and grey when they could not be fetched', () => {
    const lights = (p: Partial<SecurityLights>): SecurityLights => ({ backups: 'green', accounts: 'green', environment: 'green', activity: 'green', overall: 'green', ...p });
    expect(chipLight(null)).toBe('unknown');
    expect(chipLight(lights({}))).toBe('green');
    expect(chipLight(lights({ environment: 'amber' }))).toBe('amber');
    expect(chipLight(lights({ backups: 'red', environment: 'unknown' }))).toBe('red');
    expect(chipLight(lights({ activity: 'unknown' }))).toBe('unknown');
  });
});

describe('words and numbers', () => {
  const now = new Date('2026-10-21T12:00:00Z');

  it.each([
    ['2026-10-21T12:00:00Z', 'právě teď'],
    ['2026-10-21T11:55:00Z', 'před 5 min'],
    ['2026-10-21T09:00:00Z', 'před 3 h'],
    ['2026-10-18T12:00:00Z', 'před 3 dny'],
    ['2026-10-20T11:00:00Z', 'před 25 h'],
    ['2026-10-19T12:00:00Z', 'před 2 dny'],
  ])('%s reads %s', (iso, text) => expect(agoText(iso, now)).toBe(text));

  it('says never for nothing', () => expect(agoText(null, now)).toBe('nikdy'));

  it.each([
    [null, '—'],
    [500, '500 B'],
    [2048, '2 kB'],
    [4_200_000, '4 MB'],
  ])('%s bytes read %s', (bytes, text) => expect(bytesText(bytes).replace(/ /g, ' ')).toBe(text));
});

describe('the size sparkline', () => {
  const run = (day: number, bytes: number, extra: object = {}) => ({
    id: String(day),
    kind: 'dump',
    success: true,
    completedAtUtc: `2026-10-${String(day).padStart(2, '0')}T01:00:00Z`,
    sizeBytes: bytes,
    targetLabel: 'b',
    targetRegion: 'fr-par',
    encrypted: true,
    restoreVerified: false,
    errorCode: null,
    ...extra,
  });

  it('draws only successful dumps, oldest first', () => {
    const series = sizeSeries([run(3, 30), run(1, 10), run(2, 20, { success: false }), run(4, 99, { kind: 'restore_drill' })]);
    expect(series.map((p) => p.bytes)).toEqual([10, 30]);
  });

  it('keeps the newest thirty', () => {
    const runs = Array.from({ length: 40 }, (_, i) => run((i % 28) + 1, i + 1, { completedAtUtc: new Date(Date.UTC(2026, 8, 1 + i)).toISOString() }));
    const series = sizeSeries(runs);
    expect(series).toHaveLength(30);
    expect(series.at(-1)?.bytes).toBe(40);
  });

  it('has nothing to draw under two points', () => {
    expect(sparklinePoints([], 100, 20)).toBeNull();
    expect(sparklinePoints([{ bytes: 5 }], 100, 20)).toBeNull();
  });

  it('puts the larger value higher and a flat series in the middle', () => {
    const [first, second] = (sparklinePoints([{ bytes: 10 }, { bytes: 20 }], 100, 20) ?? '').split(' ').map((p) => p.split(',').map(Number));
    expect(second[1]).toBeLessThan(first[1]);
    const flat = (sparklinePoints([{ bytes: 7 }, { bytes: 7 }], 100, 20) ?? '').split(' ').map((p) => Number(p.split(',')[1]));
    expect(flat).toEqual([10, 10]);
  });
});

describe('findings and checks', () => {
  const finding = (code: string, name: string) => ({ code, userId: name, displayName: name, role: 'Staff', detail: 'd', lastSignInAtUtc: null });

  it('groups findings with the worst first and drops empty groups', () => {
    const groups = groupFindings([finding('never_signed_in', 'a'), finding('no_two_factor', 'b'), finding('no_two_factor', 'c')]);
    expect(groups.map((g) => g.code)).toEqual(['no_two_factor', 'never_signed_in']);
    expect(groups[0].items).toHaveLength(2);
  });

  it('keeps a finding code it does not know rather than hiding it', () => {
    expect(groupFindings([finding('brand_new', 'x')]).map((g) => g.code)).toEqual(['brand_new']);
  });

  it('opens on what needs doing: failures, warnings, then passes', () => {
    const sorted = sortChecks([{ status: 'pass' as const }, { status: 'fail' as const }, { status: 'warn' as const }]);
    expect(sorted.map((c) => c.status)).toEqual(['fail', 'warn', 'pass']);
  });
});

/* Keep the fixture types honest: a section the model reads is the section the API module parses. */
const _types: [BackupSection, AccountsSection, EnvironmentSection, ActivitySection] = [backupSection(), accountsSection(), environmentSection(), activitySection()];
void _types;
