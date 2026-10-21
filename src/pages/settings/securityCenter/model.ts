import type {
  AccountFinding,
  AccountsSection,
  ActivitySection,
  BackupRunSummary,
  BackupSection,
  EnvironmentSection,
  Light,
  SecurityLights,
  SecurityOverview,
} from '../../../api/securityCenter';

/* ══════════════════════════════════════════════════════════════
   The rules of the traffic lights on the screen.

   The server decides a colour from what it can prove; this file refuses to paint a GREEN the data in hand does
   not support. A green needs its evidence in the same answer: an account light is green only when the numbers
   behind it say every privileged account has a second factor, the environment only when every check passed, a
   backup only when it is fresh, restored, in the EU, and reported as encrypted. A section whose data is missing
   (the part could not be read) is grey, never green and never red - red would claim a finding nobody made.

   A "downgrade" is a defect in the server or in a stale cache, not a normal state, so the screen says it out loud.
   ══════════════════════════════════════════════════════════════ */

export type ShelfId = 'backups' | 'accounts' | 'environment' | 'activity';

export interface LightView {
  light: Light;
  /** The server said green and this file did not agree. */
  downgraded: boolean;
  /** Why it is not green, when it was held back or when there is nothing to base a colour on. */
  why: string | null;
}

export const LIGHT_WORD: Record<Light, string> = {
  green: 'V pořádku',
  amber: 'Pozor',
  red: 'Problém',
  unknown: 'Neznámé',
};

/** Czech name of a shelf, in the order the summary shows them. */
export const SHELF_TITLE: Record<ShelfId, string> = {
  backups: 'Zálohy',
  accounts: 'Účty',
  environment: 'Prostředí',
  activity: 'Aktivita',
};

export const SHELF_ORDER: readonly ShelfId[] = ['backups', 'accounts', 'environment', 'activity'];

const NOT_MEASURED = 'Tuto část se nepodařilo změřit, takže o ní nevíme nic. Šedá neznamená v pořádku.';

const held = (light: Light, why: string): LightView => ({ light: light === 'green' ? 'amber' : light, downgraded: light === 'green', why });

export function backupLight(section: BackupSection): LightView {
  const a = section.assessment;
  if (section.error !== null || a === null) return { light: 'unknown', downgraded: false, why: NOT_MEASURED };
  if (section.light !== 'green') return { light: section.light, downgraded: false, why: null };

  const missing: string[] = [];
  if (a.freshness !== 'fresh') missing.push('záloha není čerstvá');
  if (a.lastSuccessAtUtc === null) missing.push('není žádný úspěšný běh');
  if (a.lastRestoreVerifiedAtUtc === null || a.restoreDrill === 'never' || a.restoreDrill === 'overdue') missing.push('chybí ověřená obnova');
  if (a.locationKind !== 'eu') missing.push('není doloženo úložiště v EU');
  if (a.encrypted !== true) missing.push('není doloženo šifrování');

  return missing.length === 0 ? { light: 'green', downgraded: false, why: null } : held('green', `Server hlásí zeleně, ale chybí důkaz: ${missing.join(', ')}.`);
}

export function accountsLight(section: AccountsSection): LightView {
  const p = section.posture;
  if (section.error !== null || p === null) return { light: 'unknown', downgraded: false, why: NOT_MEASURED };
  if (section.light !== 'green') return { light: section.light, downgraded: false, why: null };

  const proven = p.privilegedAccounts > 0 && p.privilegedWithTwoFactor === p.privilegedAccounts && p.findings.length === 0;

  return proven ? { light: 'green', downgraded: false, why: null } : held('green', 'Server hlásí zeleně, ale čísla o účtech to nepotvrzují.');
}

export function environmentLight(section: EnvironmentSection): LightView {
  if (section.error !== null || section.items.length === 0) return { light: 'unknown', downgraded: false, why: NOT_MEASURED };
  if (section.light !== 'green') return { light: section.light, downgraded: false, why: null };

  return section.items.every((item) => item.status === 'pass')
    ? { light: 'green', downgraded: false, why: null }
    : held('green', 'Server hlásí zeleně, ale některá kontrola neprošla.');
}

export function activityLight(section: ActivitySection): LightView {
  if (section.error !== null || section.facts === null) return { light: 'unknown', downgraded: false, why: NOT_MEASURED };

  return { light: section.light, downgraded: false, why: null };
}

export function lightViews(overview: SecurityOverview): Record<ShelfId, LightView> {
  return {
    backups: backupLight(overview.backups),
    accounts: accountsLight(overview.accounts),
    environment: environmentLight(overview.environment),
    activity: activityLight(overview.activity),
  };
}

const RANK: Record<Light, number> = { green: 0, unknown: 1, amber: 2, red: 3 };

/** The worst of the lights; a part nobody measured outranks a green, because "not measured" is not "fine". */
export function worstLight(lights: readonly Light[]): Light {
  if (lights.length === 0) return 'unknown';
  return lights.reduce((worst, current) => (RANK[current] > RANK[worst] ? current : worst), 'green' as Light);
}

export function overallLight(views: Record<ShelfId, LightView>): Light {
  return worstLight(SHELF_ORDER.map((id) => views[id].light));
}

/** The chip in the system area has only the four server lights, so it can only be as sure as the server. */
export function chipLight(lights: SecurityLights | null): Light {
  if (lights === null) return 'unknown';
  return worstLight([lights.backups, lights.accounts, lights.environment, lights.activity]);
}

/* ── Words and numbers ── */

export const FRESHNESS_WORD = { fresh: 'Čerstvá', stale: 'Stárne', old: 'Stará', never: 'Nikdy nenahlášena' } as const;

export const DRILL_WORD = {
  never: 'Obnova nebyla nikdy ověřena',
  ok: 'Obnova ověřena v tomto čtvrtletí',
  dueSoon: 'Cvičná obnova je brzy na řadě',
  overdue: 'Cvičná obnova je po termínu',
} as const;

export const LOCATION_WORD = { eu: 'EU, hlášeno úlohou', notEu: 'mimo EU nebo spotřebitelská služba', unknown: 'oblast neuvedena nebo nepoznána' } as const;

/** "před 3 h", "před 2 dny": the way every sentence on the screen counts time. */
export function agoText(iso: string | null, now: Date): string {
  if (iso === null) return 'nikdy';
  const age = now.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(age)) return 'nikdy';
  const minutes = Math.max(0, Math.floor(age / 60_000));
  if (minutes < 1) return 'právě teď';
  if (minutes < 60) return `před ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `před ${hours} h`;
  const days = Math.floor(hours / 24);
  return `před ${days} ${days === 1 ? 'dnem' : 'dny'}`;
}

export function bytesText(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['kB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString('cs-CZ', { maximumFractionDigits: value >= 100 ? 0 : 1 })} ${units[unit]}`;
}

export function dateTimeText(iso: string | null): string {
  if (iso === null) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' });
}

export function dateText(iso: string | null): string {
  if (iso === null) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('cs-CZ');
}

/** The sizes of the successful dumps, oldest first, for the sparkline. Failed runs and drills are not backups. */
export function sizeSeries(runs: readonly BackupRunSummary[], limit = 30): { at: string; bytes: number }[] {
  return runs
    .filter((run) => run.success && run.kind !== 'restore_drill' && run.sizeBytes > 0)
    .map((run) => ({ at: run.completedAtUtc, bytes: run.sizeBytes }))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .slice(-limit);
}

/** SVG polyline points for a series in a width x height box; null when there is nothing worth drawing (under two points). */
export function sparklinePoints(series: readonly { bytes: number }[], width: number, height: number, pad = 3): string | null {
  if (series.length < 2) return null;
  const values = series.map((point) => point.bytes);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  return values
    .map((value, index) => {
      const x = pad + (index * (width - 2 * pad)) / (values.length - 1);
      /* A flat series sits in the middle rather than on the floor. */
      const y = span === 0 ? height / 2 : height - pad - ((value - min) * (height - 2 * pad)) / span;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export const FINDING_TITLE: Record<string, string> = {
  no_two_factor: 'Bez dvoufázového ověření',
  never_signed_in: 'Nikdy se nepřihlásil',
  stale_sign_in: 'Dlouho nepřihlášen',
  must_change_password: 'Čeká na změnu hesla',
  locked: 'Zamčený účet',
};

export const FINDING_ORDER = ['no_two_factor', 'locked', 'stale_sign_in', 'never_signed_in', 'must_change_password'] as const;

export function groupFindings(findings: readonly AccountFinding[]): { code: string; title: string; items: AccountFinding[] }[] {
  const codes = [...FINDING_ORDER, ...findings.map((f) => f.code).filter((c) => !(FINDING_ORDER as readonly string[]).includes(c))];
  return [...new Set(codes)]
    .map((code) => ({ code, title: FINDING_TITLE[code] ?? code, items: findings.filter((f) => f.code === code) }))
    .filter((group) => group.items.length > 0);
}

export const STATUS_WORD = { pass: 'Prošlo', warn: 'Pozor', fail: 'Neprošlo' } as const;

/** Failures first, then warnings, then passes: the screen opens on what needs doing. */
export function sortChecks<T extends { status: 'pass' | 'warn' | 'fail' }>(items: readonly T[]): T[] {
  const order = { fail: 0, warn: 1, pass: 2 } as const;
  return [...items].sort((a, b) => order[a.status] - order[b.status]);
}

export const EVENT_TONE: Record<string, 'blue' | 'beige' | 'red'> = { info: 'blue', notice: 'beige', warning: 'red' };

/** The label of a download link target on the staff-management screen. */
export const staffLink = (userId: string): string => `/staff-management?user=${encodeURIComponent(userId)}`;

/** How a lights summary reads as one sentence for a screen reader. */
export function summarySentence(views: Record<ShelfId, LightView>): string {
  return SHELF_ORDER.map((id) => `${SHELF_TITLE[id]}: ${LIGHT_WORD[views[id].light]}`).join('. ');
}
