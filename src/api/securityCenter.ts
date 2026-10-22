import { z } from 'zod';
import { AxiosError } from 'axios';
import client from './client';
import { parseResponse } from './bookingContracts';
import { ExportForbiddenError, isExportForbidden } from '../utils/download';

/* ══════════════════════════════════════════════════════════════
   Zabezpečení a zálohy (Nastavení -> Systém).

     GET  /api/system/security/overview        the whole screen in one read (audited on the server)
     GET  /api/system/security/lights          only the four lights, for the small chip (not audited)
     GET  /api/system/security/events          the security feed, paged
     GET  /api/system/security/config-export   the clinic's configuration as a JSON file
     POST /api/system/security/config-export/check   checks such a file, writes nothing
     GET  /api/system/security/recovery-kit    the recovery text
     POST /api/system/security/sign-out/{id}   ends every session of one account
     POST /api/system/security/sign-out-others ends every session but the caller's
     GET  /api/system/backups                  the backup part alone
     GET/POST/DELETE /api/system/backups/reporters[/{id}[/rotate]]   keys the backup jobs report with

   Every answer is parsed with zod: a field the screen depends on that is missing or of the wrong type is a
   refusal to draw, not a silent "undefined". The screen never says "green" unless this module has handed it the
   evidence for it (see pages/settings/securityCenter/model.ts), and nothing here reads or sends a secret except
   the one key the server shows once, when it is issued.
   ══════════════════════════════════════════════════════════════ */

const light = z.enum(['green', 'amber', 'red', 'unknown']);
export type Light = z.infer<typeof light>;

const instant = z.string();
const nullableInstant = instant.nullable();

const reason = z.object({ code: z.string(), severity: z.string(), text: z.string() });

const assessment = z.object({
  light,
  headline: z.string(),
  freshness: z.enum(['fresh', 'stale', 'old', 'never']),
  ageHours: z.number().nullable(),
  lastSuccessAtUtc: nullableInstant,
  lastAttemptAtUtc: nullableInstant,
  lastAttemptSucceeded: z.boolean().nullable(),
  lastSizeBytes: z.number().nullable(),
  lastRestoreVerifiedAtUtc: nullableInstant,
  restoreDrill: z.enum(['never', 'ok', 'dueSoon', 'overdue']),
  daysSinceRestoreVerified: z.number().nullable(),
  nextRestoreDrillDueUtc: nullableInstant,
  locationKind: z.enum(['eu', 'notEu', 'unknown']),
  targetLabel: z.string().nullable(),
  targetRegion: z.string().nullable(),
  encrypted: z.boolean().nullable(),
  sha256: z.string().nullable(),
  reasons: z.array(reason),
});

const run = z.object({
  id: z.string(),
  kind: z.string(),
  success: z.boolean(),
  completedAtUtc: instant,
  sizeBytes: z.number(),
  targetLabel: z.string(),
  targetRegion: z.string().nullable(),
  encrypted: z.boolean(),
  restoreVerified: z.boolean(),
  errorCode: z.string().nullable(),
});

const reporter = z.object({
  id: z.string(),
  label: z.string(),
  createdAtUtc: instant,
  createdByUserId: z.string().nullable(),
  lastUsedAtUtc: nullableInstant,
  revokedAtUtc: nullableInstant,
  keyPrefix: z.string(),
  isActive: z.boolean(),
});

const backupSection = z.object({
  light,
  headline: z.string(),
  assessment: assessment.nullable(),
  recentRuns: z.array(run),
  reporters: z.array(reporter),
  error: z.string().nullable(),
});

const accountFinding = z.object({
  code: z.string(),
  userId: z.string(),
  displayName: z.string(),
  role: z.string(),
  detail: z.string(),
  lastSignInAtUtc: nullableInstant,
});

const accountsSection = z.object({
  light,
  headline: z.string(),
  posture: z
    .object({
      activeAccounts: z.number(),
      inactiveAccounts: z.number(),
      privilegedAccounts: z.number(),
      privilegedWithTwoFactor: z.number(),
      findings: z.array(accountFinding),
    })
    .nullable(),
  error: z.string().nullable(),
});

const checkItem = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['pass', 'warn', 'fail']),
  detail: z.string(),
  explanation: z.string(),
  fix: z.string(),
});

const environmentSection = z.object({
  light,
  headline: z.string(),
  items: z.array(checkItem),
  error: z.string().nullable(),
});

const activitySection = z.object({
  light,
  headline: z.string(),
  facts: z
    .object({
      failedSignIns24h: z.number(),
      secondFactorFailures24h: z.number(),
      accessDenied24h: z.number(),
      activeLockouts: z.number(),
      sessionsStarted24h: z.number(),
      sessionsRevoked24h: z.number(),
      activeSessions: z.number(),
      sessionLifetimeHours: z.number().nullable(),
    })
    .nullable(),
  error: z.string().nullable(),
});

const lights = z.object({
  backups: light,
  accounts: light,
  environment: light,
  activity: light,
  overall: light,
});

const thresholds = z.object({
  backupFreshHours: z.number(),
  backupStaleHours: z.number(),
  restoreDrillDays: z.number(),
  accountStaleDays: z.number(),
  failedSignInsAmber: z.number(),
  failedSignInsRed: z.number(),
  lockoutsRed: z.number(),
  accessDeniedAmber: z.number(),
});

const overview = z.object({
  generatedAtUtc: instant,
  lights,
  backups: backupSection,
  accounts: accountsSection,
  environment: environmentSection,
  activity: activitySection,
  notMeasured: z.array(z.string()),
  thresholds,
});

const securityEvent = z.object({
  id: z.string(),
  atUtc: instant,
  action: z.string(),
  title: z.string(),
  severity: z.string(),
  actorLabel: z.string().nullable(),
  subjectUserId: z.string().nullable(),
});

const eventPage = z.object({ items: z.array(securityEvent), totalCount: z.number() });

const dryRun = z.object({
  canRestore: z.boolean(),
  format: z.string().nullable(),
  version: z.number().nullable(),
  exportedAtUtc: nullableInstant,
  schemaMigration: z.string().nullable(),
  checksumMatches: z.boolean(),
  sections: z.array(
    z.object({
      section: z.string(),
      inFile: z.number(),
      wouldAdd: z.number(),
      wouldChange: z.number(),
      unchanged: z.number(),
      onlyInDatabase: z.number(),
    }),
  ),
  issues: z.array(z.object({ severity: z.string(), section: z.string(), message: z.string() })),
  note: z.string(),
});

const issuedKey = z.object({
  key: reporter,
  token: z.string(),
  headerName: z.string(),
  notice: z.string(),
});

const signedOut = z.object({ sessionsEnded: z.number() });

export type BackupAssessment = z.infer<typeof assessment>;
export type BackupRunSummary = z.infer<typeof run>;
export type BackupReporterKey = z.infer<typeof reporter>;
export type BackupSection = z.infer<typeof backupSection>;
export type AccountFinding = z.infer<typeof accountFinding>;
export type AccountsSection = z.infer<typeof accountsSection>;
export type EnvironmentCheckItem = z.infer<typeof checkItem>;
export type EnvironmentSection = z.infer<typeof environmentSection>;
export type ActivitySection = z.infer<typeof activitySection>;
export type SecurityLights = z.infer<typeof lights>;
export type SecurityThresholds = z.infer<typeof thresholds>;
export type SecurityOverview = z.infer<typeof overview>;
export type SecurityEvent = z.infer<typeof securityEvent>;
export type SecurityEventPage = z.infer<typeof eventPage>;
export type ConfigurationDryRunReport = z.infer<typeof dryRun>;
export type IssuedReporterKey = z.infer<typeof issuedKey>;

export const SECURITY_CENTER_ROUTE = '/nastaveni/zabezpeceni-a-zalohy';

/* ── Errors: what the person should be told, never what the server threw ── */

export type SecurityCenterErrorKind =
  | 'reauth'
  | 'forbidden'
  | 'notFound'
  | 'ownerProtected'
  | 'invalid'
  | 'conflict'
  | 'rateLimited'
  | 'offline'
  | 'server';

export class SecurityCenterError extends Error {
  readonly kind: SecurityCenterErrorKind;
  readonly status: number | undefined;
  /** The server's own Czech sentence, when it sent one in the standard problem shape. */
  readonly serverMessage: string | undefined;

  constructor(kind: SecurityCenterErrorKind, status: number | undefined, serverMessage?: string) {
    super(kind);
    this.name = 'SecurityCenterError';
    this.kind = kind;
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

const readProblem = (data: unknown): { code?: string; message?: string } => {
  if (data === null || typeof data !== 'object') return {};
  const record = data as Record<string, unknown>;
  return {
    code: typeof record.code === 'string' ? record.code : undefined,
    message: typeof record.message === 'string' ? record.message : undefined,
  };
};

export function toSecurityCenterError(error: unknown): SecurityCenterError {
  if (error instanceof SecurityCenterError) return error;
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    if (status === undefined) return new SecurityCenterError('offline', undefined);
    const { code, message } = readProblem(error.response?.data);
    if (status === 403 && code === 'reauth.required') return new SecurityCenterError('reauth', status, message);
    if (status === 403 && code === 'account.owner_protected') return new SecurityCenterError('ownerProtected', status, message);
    if (status === 403) return new SecurityCenterError('forbidden', status, message);
    if (status === 404) return new SecurityCenterError('notFound', status, message);
    if (status === 400) return new SecurityCenterError('invalid', status, message);
    if (status === 409) return new SecurityCenterError('conflict', status, message);
    if (status === 429) return new SecurityCenterError('rateLimited', status);
    return new SecurityCenterError('server', status);
  }
  /* A schema mismatch is our bug; it must not leak its detail onto a screen. */
  return new SecurityCenterError('server', undefined);
}

/** The sentence for an error. The server's own wording is used only where it is meant for people. */
export function securityErrorText(error: SecurityCenterError): string {
  switch (error.kind) {
    case 'reauth':
      return 'Pro tuto akci se přihlaste znovu. Vaše přihlášení je starší než povolená doba.';
    case 'forbidden':
      return 'K tomu nemáte oprávnění.';
    case 'ownerProtected':
      return 'Vlastníka může odhlásit jen vlastník.';
    case 'notFound':
      return 'Záznam už neexistuje. Obnovte stránku.';
    case 'invalid':
    case 'conflict':
      return error.serverMessage ?? 'Server požadavek odmítl.';
    case 'rateLimited':
      return 'Příliš mnoho požadavků za sebou. Chvíli počkejte.';
    case 'offline':
      return 'Server neodpovídá.';
    default:
      return 'Něco se nepovedlo na straně serveru.';
  }
}

async function guarded<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    /* Deliberately not logged: an answer may name an account. */
    throw toSecurityCenterError(error);
  }
}

/** Like `guarded`, but a refused download (403 `export.forbidden`, its body is a Blob) stays recognisable as such. */
async function guardedDownload<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (await isExportForbidden(error)) throw new ExportForbiddenError();
    throw toSecurityCenterError(error);
  }
}

export interface DownloadedFile {
  blob: Blob;
  fileName: string;
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');

export const securityCenterApi = {
  overview: (): Promise<SecurityOverview> =>
    guarded(async () => parseResponse(overview, (await client.get('/api/system/security/overview')).data)),

  lights: (): Promise<SecurityLights> =>
    guarded(async () => parseResponse(lights, (await client.get('/api/system/security/lights')).data)),

  events: (skip: number, take: number): Promise<SecurityEventPage> =>
    guarded(async () =>
      parseResponse(eventPage, (await client.get('/api/system/security/events', { params: { skip, take } })).data),
    ),

  backups: (): Promise<BackupSection> =>
    guarded(async () => parseResponse(backupSection, (await client.get('/api/system/backups')).data)),

  reporters: (): Promise<BackupReporterKey[]> =>
    guarded(async () => parseResponse(z.array(reporter), (await client.get('/api/system/backups/reporters')).data)),

  createReporter: (label: string): Promise<IssuedReporterKey> =>
    guarded(async () => parseResponse(issuedKey, (await client.post('/api/system/backups/reporters', { label })).data)),

  rotateReporter: (id: string): Promise<IssuedReporterKey> =>
    guarded(async () =>
      parseResponse(issuedKey, (await client.post(`/api/system/backups/reporters/${encodeURIComponent(id)}/rotate`)).data),
    ),

  revokeReporter: (id: string): Promise<void> =>
    guarded(async () => {
      await client.delete(`/api/system/backups/reporters/${encodeURIComponent(id)}`);
    }),

  signOutUser: (userId: string): Promise<number> =>
    guarded(async () =>
      parseResponse(signedOut, (await client.post(`/api/system/security/sign-out/${encodeURIComponent(userId)}`)).data).sessionsEnded,
    ),

  signOutOthers: (): Promise<number> =>
    guarded(async () => parseResponse(signedOut, (await client.post('/api/system/security/sign-out-others')).data).sessionsEnded),

  /** The file name is made here: a cross-origin browser does not see Content-Disposition. */
  configExport: (): Promise<DownloadedFile> =>
    guardedDownload(async () => {
      const res = await client.get('/api/system/security/config-export', { responseType: 'blob' });
      return { blob: res.data as Blob, fileName: `sportmedical-konfigurace-${stamp()}.json` };
    }),

  recoveryKit: (): Promise<DownloadedFile> =>
    guardedDownload(async () => {
      const res = await client.get('/api/system/security/recovery-kit', { responseType: 'blob' });
      return { blob: res.data as Blob, fileName: 'obnova-sportmedical.md' };
    }),

  /** Sends the text of an export file to be checked. Nothing is written on the server. */
  checkConfigExport: (text: string): Promise<ConfigurationDryRunReport> =>
    guarded(async () =>
      parseResponse(
        dryRun,
        (await client.post('/api/system/security/config-export/check', text, { headers: { 'Content-Type': 'application/json' } })).data,
      ),
    ),
};

export default securityCenterApi;
