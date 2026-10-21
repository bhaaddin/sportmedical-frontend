import type {
  AccountsSection,
  ActivitySection,
  BackupAssessment,
  BackupSection,
  EnvironmentCheckItem,
  EnvironmentSection,
  SecurityOverview,
} from '../../../api/securityCenter';

/*
 * Answers shaped exactly like the server's, for the tests of the screen, the model and the API module. The defaults
 * are a system that has earned every green (so a test has to take a piece of evidence away to see a colour change).
 */

export const assessmentFixture = (patch: Partial<BackupAssessment> = {}): BackupAssessment => ({
  light: 'green',
  headline: 'Záloha je čerstvá a obnova ověřená',
  freshness: 'fresh',
  ageHours: 3.2,
  lastSuccessAtUtc: '2026-10-21T08:48:00+00:00',
  lastAttemptAtUtc: '2026-10-21T08:48:00+00:00',
  lastAttemptSucceeded: true,
  lastSizeBytes: 4_200_000,
  lastRestoreVerifiedAtUtc: '2026-10-14T09:00:00+00:00',
  restoreDrill: 'ok',
  daysSinceRestoreVerified: 7,
  nextRestoreDrillDueUtc: '2027-01-13T09:00:00+00:00',
  locationKind: 'eu',
  targetLabel: 'sm-backups',
  targetRegion: 'fr-par',
  encrypted: true,
  sha256: 'ab'.repeat(32),
  reasons: [{ code: 'location_eu', severity: 'info', text: 'Úloha hlásí úložiště v EU. API to nemůže ověřit, je to její tvrzení.' }],
  ...patch,
});

export const backupSection = (patch: Partial<BackupSection> = {}, assessment: Partial<BackupAssessment> = {}): BackupSection => ({
  light: 'green',
  headline: 'Záloha je čerstvá a obnova ověřená',
  assessment: assessmentFixture(assessment),
  recentRuns: [
    { id: 'r2', kind: 'dump', success: true, completedAtUtc: '2026-10-21T08:48:00+00:00', sizeBytes: 4_300_000, targetLabel: 'sm-backups', targetRegion: 'fr-par', encrypted: true, restoreVerified: false, errorCode: null },
    { id: 'r1', kind: 'dump', success: true, completedAtUtc: '2026-10-20T08:48:00+00:00', sizeBytes: 4_200_000, targetLabel: 'sm-backups', targetRegion: 'fr-par', encrypted: true, restoreVerified: true, errorCode: null },
  ],
  reporters: [
    { id: 'k1', label: 'Noční záloha', createdAtUtc: '2026-10-01T10:00:00+00:00', createdByUserId: null, lastUsedAtUtc: '2026-10-21T08:48:00+00:00', revokedAtUtc: null, keyPrefix: 'smbk.01a2b3c4', isActive: true },
  ],
  error: null,
  ...patch,
});

export const accountsSection = (
  patch: Partial<AccountsSection> = {},
  posture: Partial<NonNullable<AccountsSection['posture']>> = {},
): AccountsSection => ({
  light: 'green',
  headline: 'Účty vlastníka a správců mají dvoufázové ověření a žádný účet nevyžaduje pozornost.',
  posture: { activeAccounts: 3, inactiveAccounts: 1, privilegedAccounts: 2, privilegedWithTwoFactor: 2, findings: [], ...posture },
  error: null,
  ...patch,
});

const pass = (id: string, title: string): EnvironmentCheckItem => ({ id, title, status: 'pass', detail: 'v pořádku', explanation: 'proč to záleží', fix: '' });

export const environmentSection = (patch: Partial<EnvironmentSection> = {}, items?: EnvironmentCheckItem[]): EnvironmentSection => ({
  light: 'green',
  headline: 'Všech 3 kontrol prošlo',
  items: items ?? [pass('https', 'Šifrované spojení (HTTPS)'), pass('cors', 'Povolené zdroje požadavků (CORS)'), pass('rate_limits', 'Omezení počtu požadavků')],
  error: null,
  ...patch,
});

export const activitySection = (patch: Partial<ActivitySection> = {}): ActivitySection => ({
  light: 'green',
  headline: 'Za posledních 24 h 0 neúspěšných přihlášení, nic mimořádného.',
  facts: {
    failedSignIns24h: 0,
    secondFactorFailures24h: 0,
    accessDenied24h: 0,
    activeLockouts: 0,
    sessionsStarted24h: 4,
    sessionsRevoked24h: 1,
    activeSessions: 2,
    sessionLifetimeHours: 8,
  },
  error: null,
  ...patch,
});

export const overviewFixture = (patch: Partial<SecurityOverview> = {}): SecurityOverview => ({
  generatedAtUtc: '2026-10-21T12:00:00+00:00',
  lights: { backups: 'green', accounts: 'green', environment: 'green', activity: 'green', overall: 'green' },
  backups: backupSection(),
  accounts: accountsSection(),
  environment: environmentSection(),
  activity: activitySection(),
  notMeasured: ['Oblast databáze u Supabase a zálohy, které tam dělá poskytovatel: API je nevidí.'],
  thresholds: {
    backupFreshHours: 26,
    backupStaleHours: 72,
    restoreDrillDays: 92,
    accountStaleDays: 90,
    failedSignInsAmber: 10,
    failedSignInsRed: 100,
    lockoutsRed: 3,
    accessDeniedAmber: 10,
  },
  ...patch,
});

/** The "nothing was ever reported" backup, as the server answers it on a fresh system. */
export const neverReportedBackup = (): BackupSection =>
  backupSection(
    { light: 'red', headline: 'Zálohy se nehlásí', recentRuns: [], reporters: [] },
    {
      light: 'red',
      headline: 'Zálohy se nehlásí',
      freshness: 'never',
      ageHours: null,
      lastSuccessAtUtc: null,
      lastAttemptAtUtc: null,
      lastAttemptSucceeded: null,
      lastSizeBytes: null,
      lastRestoreVerifiedAtUtc: null,
      restoreDrill: 'never',
      daysSinceRestoreVerified: null,
      nextRestoreDrillDueUtc: null,
      locationKind: 'unknown',
      targetLabel: null,
      targetRegion: null,
      encrypted: null,
      sha256: null,
      reasons: [{ code: 'never', severity: 'red', text: 'Záloha dosud nehlásila žádný běh - nastavte zálohování.' }],
    },
  );
