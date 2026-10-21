import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock('./client', () => ({ default: http, client: http }));

import {
  SecurityCenterError,
  securityCenterApi,
  securityErrorText,
  toSecurityCenterError,
} from './securityCenter';
import { overviewFixture, neverReportedBackup } from '../pages/settings/securityCenter/fixtures';

const refused = (status: number, data: unknown): AxiosError =>
  new AxiosError('x', 'ERR_BAD_REQUEST', undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never } as AxiosResponse);

beforeEach(() => {
  http.get.mockReset();
  http.post.mockReset();
  http.delete.mockReset();
});

describe('the answers are parsed, not trusted', () => {
  it('reads a real overview', async () => {
    http.get.mockResolvedValue({ data: overviewFixture() });
    const overview = await securityCenterApi.overview();
    expect(overview.lights.overall).toBe('green');
    expect(overview.backups.assessment?.freshness).toBe('fresh');
    expect(http.get).toHaveBeenCalledWith('/api/system/security/overview');
  });

  it('reads the never-reported backup the server sends on a fresh system', async () => {
    http.get.mockResolvedValue({ data: overviewFixture({ backups: neverReportedBackup() }) });
    const overview = await securityCenterApi.overview();
    expect(overview.backups.assessment?.freshness).toBe('never');
    expect(overview.backups.assessment?.lastSuccessAtUtc).toBeNull();
  });

  it('refuses an answer with a missing field instead of drawing "undefined"', async () => {
    const broken = overviewFixture() as unknown as Record<string, unknown>;
    delete broken.thresholds;
    http.get.mockResolvedValue({ data: broken });
    await expect(securityCenterApi.overview()).rejects.toBeInstanceOf(SecurityCenterError);
  });

  it('refuses a light it does not know (a "green" spelled any other way is not green)', async () => {
    const odd = overviewFixture();
    http.get.mockResolvedValue({ data: { ...odd, lights: { ...odd.lights, backups: 'ok' } } });
    await expect(securityCenterApi.lights()).rejects.toBeInstanceOf(SecurityCenterError);
  });

  it('refuses a freshness it does not know', async () => {
    const odd = overviewFixture();
    http.get.mockResolvedValue({ data: { ...odd, backups: { ...odd.backups, assessment: { ...odd.backups.assessment, freshness: 'fine' } } } });
    await expect(securityCenterApi.overview()).rejects.toMatchObject({ kind: 'server' });
  });

  it('reads the events page and sends the paging', async () => {
    http.get.mockResolvedValue({ data: { items: [{ id: 'e', atUtc: '2026-10-21T10:00:00+00:00', action: 'account.role_assigned', title: 'Změněna role účtu', severity: 'warning', actorLabel: 'a@b.cz', subjectUserId: null }], totalCount: 1 } });
    const page = await securityCenterApi.events(20, 20);
    expect(page.items[0].title).toBe('Změněna role účtu');
    expect(http.get).toHaveBeenCalledWith('/api/system/security/events', { params: { skip: 20, take: 20 } });
  });
});

describe('the actions', () => {
  it('shows the key once, as the server issues it', async () => {
    http.post.mockResolvedValue({
      data: {
        key: { id: 'k', label: 'Noční', createdAtUtc: '2026-10-21T10:00:00+00:00', createdByUserId: null, lastUsedAtUtc: null, revokedAtUtc: null, keyPrefix: 'smbk.aabbccdd', isActive: true },
        token: 'smbk.aabbccdd.secret',
        headerName: 'X-Backup-Reporter-Key',
        notice: 'Klíč se zobrazí jen teď.',
      },
    });
    const issued = await securityCenterApi.createReporter('Noční');
    expect(issued.token).toBe('smbk.aabbccdd.secret');
    expect(http.post).toHaveBeenCalledWith('/api/system/backups/reporters', { label: 'Noční' });
  });

  it('sends the sign-outs to the right routes and returns how many sessions ended', async () => {
    http.post.mockResolvedValue({ data: { sessionsEnded: 2 } });
    expect(await securityCenterApi.signOutUser('u 1')).toBe(2);
    expect(http.post).toHaveBeenLastCalledWith('/api/system/security/sign-out/u%201');
    expect(await securityCenterApi.signOutOthers()).toBe(2);
    expect(http.post).toHaveBeenLastCalledWith('/api/system/security/sign-out-others');
  });

  it('sends an export file as text for checking and reads the report', async () => {
    http.post.mockResolvedValue({ data: { canRestore: true, format: 'x', version: 1, exportedAtUtc: null, schemaMigration: null, checksumMatches: true, sections: [], issues: [], note: 'Nic se nezapsalo.' } });
    const report = await securityCenterApi.checkConfigExport('{"a":1}');
    expect(report.canRestore).toBe(true);
    expect(http.post).toHaveBeenCalledWith('/api/system/security/config-export/check', '{"a":1}', { headers: { 'Content-Type': 'application/json' } });
  });

  it('names the downloaded files itself (a cross-origin browser does not see Content-Disposition)', async () => {
    http.get.mockResolvedValue({ data: new Blob(['x']) });
    expect((await securityCenterApi.configExport()).fileName).toMatch(/^sportmedical-konfigurace-\d{8}-\d{4}\.json$/);
    expect((await securityCenterApi.recoveryKit()).fileName).toBe('obnova-sportmedical.md');
  });
});

describe('errors are told in Czech and never carry what the server threw', () => {
  it.each([
    [403, { code: 'reauth.required', message: 'x' }, 'reauth'],
    [403, { code: 'account.owner_protected', message: 'x' }, 'ownerProtected'],
    [403, { code: 'access.denied', message: 'Nemáte právo.' }, 'forbidden'],
    [404, {}, 'notFound'],
    [400, { code: 'backup.reporter_label_invalid', message: 'Název klíče není v pořádku.' }, 'invalid'],
    [409, { code: 'backup.reporter_too_many', message: 'Příliš mnoho klíčů.' }, 'conflict'],
    [429, {}, 'rateLimited'],
    [500, { message: 'stack trace with Npgsql' }, 'server'],
  ])('%s %j is %s', async (status, body, kind) => {
    http.post.mockRejectedValue(refused(status, body));
    await expect(securityCenterApi.signOutOthers()).rejects.toMatchObject({ kind });
  });

  it('is offline when nothing answered', () => {
    expect(toSecurityCenterError(new AxiosError('Network Error', 'ERR_NETWORK')).kind).toBe('offline');
  });

  it('does not show the text of a server error', () => {
    const text = securityErrorText(toSecurityCenterError(refused(500, { message: 'Npgsql.PostgresException: password authentication failed' })));
    expect(text).not.toContain('Npgsql');
    expect(text).not.toContain('password');
  });

  it('shows the server sentence only where it is meant for people', () => {
    expect(securityErrorText(toSecurityCenterError(refused(400, { message: 'Název klíče musí mít 3 až 60 znaků.' })))).toBe('Název klíče musí mít 3 až 60 znaků.');
    expect(securityErrorText(new SecurityCenterError('reauth', 403))).toContain('přihlaste znovu');
  });
});
