/*
 * Zabezpečení a zálohy, as a person meets it: every state of the lights, what is never allowed to be green, who sees
 * which buttons, and what an action does. The server is the only thing replaced (the HTTP client), so the zod parsing,
 * the model's refusal to paint an unearned green and the page all run for real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, type AxiosResponse } from 'axios';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock('../../api/client', () => ({ default: http, client: http }));
const signOutMock = vi.hoisted(() => vi.fn());
vi.mock('../../auth/signOut', () => ({ signOut: signOutMock }));

import SecurityCenterPage from './SecurityCenterPage';
import { SecurityStatusChip } from '../../components/settings/SecurityStatusChip';
import { SETTINGS_SECTIONS, visibleSections } from './catalogue';
import {
  accountsSection,
  activitySection,
  backupSection,
  environmentSection,
  neverReportedBackup,
  overviewFixture,
} from './securityCenter/fixtures';
import type { SecurityOverview } from '../../api/securityCenter';

const refused = (status: number, data: unknown): AxiosError =>
  new AxiosError('x', 'ERR_BAD_REQUEST', undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never } as AxiosResponse);

const finding = (code: string, name: string, extra: object = {}) => ({
  code,
  userId: `id-${name}`,
  displayName: name,
  role: 'Administrator',
  detail: 'Dvoufázové ověření není zapnuté.',
  lastSignInAtUtc: null,
  ...extra,
});

function serve(overview: SecurityOverview | Error, events: unknown = { items: [], totalCount: 0 }) {
  http.get.mockImplementation(async (url: string) => {
    if (url === '/api/system/security/overview') {
      if (overview instanceof Error) throw overview;
      return { data: overview };
    }
    if (url === '/api/system/security/events') return { data: events };
    if (url === '/api/system/security/lights') return { data: (overview as SecurityOverview).lights };
    throw new Error(`unexpected GET ${url}`);
  });
}

const open = async (permissions: string[] = ['settings.clinic.manage', 'users.manage']) => {
  localStorage.setItem('permissions', JSON.stringify(permissions));
  render(
    <MemoryRouter initialEntries={['/nastaveni/zabezpeceni-a-zalohy']}>
      <SecurityCenterPage />
    </MemoryRouter>,
  );
  await screen.findByTestId('lights');
};

const card = (id: string) => document.querySelector(`[data-card="${id}"]`) as HTMLElement;

beforeEach(() => {
  http.get.mockReset();
  http.post.mockReset();
  http.delete.mockReset();
  signOutMock.mockReset();
  localStorage.clear();
  setViewport(VIEWPORTS.desktop);
});

afterEach(() => cleanup());

describe('the four lights', () => {
  it('draws Zálohy, Účty, Prostředí and Aktivita, each with its word', async () => {
    serve(overviewFixture());
    await open();

    expect(['backups', 'accounts', 'environment', 'activity'].map((id) => card(id)?.getAttribute('data-light'))).toEqual(['green', 'green', 'green', 'green']);
    expect(within(screen.getByTestId('lights')).getAllByText('V pořádku')).toHaveLength(4);
    expect(screen.getByTestId('overall-light')).toHaveTextContent('V pořádku');
  });

  it('is never green on a fresh system that has never reported a backup, and says what to do', async () => {
    serve(overviewFixture({ lights: { backups: 'red', accounts: 'green', environment: 'green', activity: 'green', overall: 'red' }, backups: neverReportedBackup() }));
    await open();

    expect(card('backups').getAttribute('data-light')).toBe('red');
    expect(screen.getByTestId('overall-light')).toHaveTextContent('Problém');
    const empty = screen.getByTestId('backup-never');
    expect(empty).toHaveTextContent('Záloha dosud nehlásila žádný běh - nastavte zálohování.');
    expect(within(screen.getByRole('region', { name: 'Zálohy' })).queryByText(/Čerstvá/)).toBeNull();
  });

  it('says the sentence once, not once as an alert and once as a reason', async () => {
    serve(overviewFixture({ backups: neverReportedBackup() }));
    await open();

    expect(screen.getAllByText('Záloha dosud nehlásila žádný běh - nastavte zálohování.')).toHaveLength(1);
  });

  it('does not claim nothing was reported when only failed runs were', async () => {
    const failedOnly = neverReportedBackup();
    failedOnly.assessment = {
      ...failedOnly.assessment!,
      lastAttemptAtUtc: '2026-10-21T01:00:00+00:00',
      lastAttemptSucceeded: false,
      reasons: [
        { code: 'never', severity: 'red', text: 'Žádný běh zálohy zatím neskončil úspěšně.' },
        { code: 'last_failed', severity: 'amber', text: 'Poslední pokus o zálohu selhal (kód dump_failed).' },
      ],
    };
    serve(overviewFixture({ backups: failedOnly }));
    await open();

    const alert = screen.getByTestId('backup-never');
    expect(alert).toHaveTextContent('Žádný běh zálohy zatím neskončil úspěšně.');
    expect(alert).not.toHaveTextContent('nehlásila žádný běh');
    expect(screen.getByText(/Poslední pokus o zálohu selhal/)).toBeInTheDocument();
  });

  it('says there is no key when none was issued', async () => {
    serve(overviewFixture({ backups: neverReportedBackup() }));
    await open();

    expect(screen.getByText(/Žádný klíč pro hlášení záloh není vydán/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Klíče pro hlášení záloh (0)' })).toBeInTheDocument();
  });

  it('holds a green back when the evidence is missing, and says which evidence', async () => {
    serve(overviewFixture({ backups: backupSection({}, { lastRestoreVerifiedAtUtc: null, restoreDrill: 'never' }) }));
    await open();

    expect(card('backups').getAttribute('data-light')).toBe('amber');
    expect(screen.getByText(/Server hlásí zeleně, ale chybí důkaz: chybí ověřená obnova/)).toBeInTheDocument();
    expect(screen.getByTestId('overall-light')).toHaveTextContent('Pozor');
  });

  it('shows a part that could not be measured as grey with a sentence, and the whole as not fine', async () => {
    serve(overviewFixture({ accounts: accountsSection({ light: 'unknown', posture: null, headline: 'Účty se nepodařilo načíst', error: 'Stav účtů se nepodařilo načíst z databáze.' }) }));
    await open();

    expect(card('accounts').getAttribute('data-light')).toBe('unknown');
    expect(within(card('accounts')).getByText('Neznámé')).toBeInTheDocument();
    expect(screen.getByText('Stav účtů se nepodařilo načíst z databáze.')).toBeInTheDocument();
    expect(screen.getByTestId('overall-light')).toHaveTextContent('Neznámé');
    expect(screen.getByTestId('overall-light')).not.toHaveTextContent('V pořádku');
  });

  it('says nothing is known, not that all is well, when the overview cannot be read', async () => {
    serve(new Error('boom'));
    localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));
    render(
      <MemoryRouter>
        <SecurityCenterPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Nemůžeme říct nic, ani že je všechno v pořádku/)).toBeInTheDocument();
    expect(screen.queryByTestId('lights')).toBeNull();
    expect(screen.getByRole('button', { name: /Zkusit znovu/ })).toBeInTheDocument();
  });

  it('opens a shelf from its card', async () => {
    serve(overviewFixture());
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    await open();

    await userEvent.click(card('environment'));

    expect(scroll).toHaveBeenCalled();
    expect(document.getElementById('shelf-environment')).not.toBeNull();
  });
});

describe('the backup shelf', () => {
  it('states what was reported, and what it cannot prove', async () => {
    serve(overviewFixture());
    await open();
    const shelf = screen.getByRole('region', { name: 'Zálohy' });

    expect(within(shelf).getByText(/Systém nevidí úložiště a neumí ověřit, že soubor existuje/)).toBeInTheDocument();
    expect(within(shelf).getByTestId('fact-last')).toHaveTextContent('Čerstvá');
    expect(within(shelf).getByText('Úloha hlásí: šifrováno')).toBeInTheDocument();
    expect(within(shelf).getByText(/EU, hlášeno úlohou/)).toBeInTheDocument();
    expect(within(shelf).getByTestId('backup-rules')).toHaveTextContent('mladší než 26 h');
    expect(within(shelf).getByTestId('backup-rules')).toHaveTextContent('92 dnech');
  });

  it('says "Nikdy" for a restore nobody verified', async () => {
    serve(overviewFixture({ backups: backupSection({ light: 'amber' }, { light: 'amber', lastRestoreVerifiedAtUtc: null, restoreDrill: 'never', daysSinceRestoreVerified: null, nextRestoreDrillDueUtc: null }) }));
    await open();

    expect(screen.getByTestId('fact-restore')).toHaveTextContent('Nikdy');
    expect(screen.getByText('Obnova nebyla nikdy ověřena')).toBeInTheDocument();
  });

  it('draws the sizes as a line only when there is something to draw', async () => {
    serve(overviewFixture());
    await open();
    expect(screen.getByRole('img', { name: /Velikost posledních 2 záloh/ })).toBeInTheDocument();
  });

  it('says there are too few backups for a graph instead of drawing a flat nothing', async () => {
    serve(overviewFixture({ backups: backupSection({ recentRuns: [] }) }));
    await open();
    expect(screen.getByText(/málo záloh/)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Velikost/ })).toBeNull();
  });

  it('offers the recovery kit and the export as downloads and a way to check a file', async () => {
    serve(overviewFixture());
    await open();

    expect(screen.getByRole('button', { name: 'Návod k obnově' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export konfigurace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zkontrolovat soubor konfigurace' })).toBeInTheDocument();
  });

  it('shows the report of a checked export file and says nothing was written', async () => {
    serve(overviewFixture());
    http.post.mockResolvedValue({
      data: {
        canRestore: false,
        format: 'sportmedical.config-export',
        version: 1,
        exportedAtUtc: null,
        schemaMigration: null,
        checksumMatches: false,
        sections: [{ section: 'priceList', inFile: 3, wouldAdd: 1, wouldChange: 1, unchanged: 1, onlyInDatabase: 0 }],
        issues: [{ severity: 'error', section: 'soubor', message: 'Kontrolní součet obsahu nesouhlasí.' }],
        note: 'Toto je jen kontrola souboru. Nic se nezapsalo a nic se neobnovilo.',
      },
    });
    await open();

    const input = screen.getByLabelText('Soubor exportu konfigurace ke kontrole') as HTMLInputElement;
    await userEvent.upload(input, new File(['{"format":"x"}'], 'konfigurace.json', { type: 'application/json' }));

    const dialog = await screen.findByRole('dialog', { name: /Kontrola souboru konfigurace/ });
    expect(within(dialog).getByTestId('check-verdict')).toHaveTextContent('nelze použít');
    expect(within(dialog).getByText(/Nic se nezapsalo/)).toBeInTheDocument();
    expect(within(dialog).getByText('Kontrolní součet obsahu nesouhlasí.')).toBeInTheDocument();
    expect(within(dialog).getByText('Ceník')).toBeInTheDocument();
  });
});

describe('the keys backup jobs report with', () => {
  const issuedAnswer = {
    key: { id: 'k2', label: 'Nová úloha', createdAtUtc: '2026-10-21T10:00:00+00:00', createdByUserId: null, lastUsedAtUtc: null, revokedAtUtc: null, keyPrefix: 'smbk.aabbccdd', isActive: true },
    token: 'smbk.aabbccddeeff00112233445566778899.THE-SECRET-OF-THE-KEY',
    headerName: 'X-Backup-Reporter-Key',
    notice: 'Klíč se zobrazí jen teď. Uložte ho do tajných údajů úlohy.',
  };

  it('shows a new key once, in the dialog, and never again', async () => {
    serve(overviewFixture());
    http.post.mockResolvedValue({ data: issuedAnswer });
    await open();

    await userEvent.click(screen.getByRole('button', { name: /Klíče pro hlášení záloh/ }));
    const dialog = await screen.findByRole('dialog', { name: /Klíče pro hlášení záloh/ });
    await userEvent.type(within(dialog).getByLabelText('Název nového klíče'), 'Nová úloha');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vydat klíč' }));

    expect(await within(dialog).findByTestId('issued-token')).toHaveTextContent('THE-SECRET-OF-THE-KEY');
    expect(within(dialog).getByText(/Klíč se zobrazí jen teď/)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Zavřít' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Klíče pro hlášení záloh/ })).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: /Klíče pro hlášení záloh/ }));
    await screen.findByRole('dialog', { name: /Klíče pro hlášení záloh/ });

    expect(document.body.textContent).not.toContain('THE-SECRET-OF-THE-KEY');
  });

  it('lists keys by name and prefix, and never a secret', async () => {
    serve(overviewFixture());
    await open();

    await userEvent.click(screen.getByRole('button', { name: /Klíče pro hlášení záloh/ }));
    const dialog = await screen.findByRole('dialog', { name: /Klíče pro hlášení záloh/ });

    expect(within(dialog).getByText('Noční záloha')).toBeInTheDocument();
    expect(within(dialog).getByText(/smbk\.01a2b3c4/)).toBeInTheDocument();
  });

  it('asks before it revokes and says what will happen', async () => {
    serve(overviewFixture());
    http.delete.mockResolvedValue({ data: {} });
    await open();

    await userEvent.click(screen.getByRole('button', { name: /Klíče pro hlášení záloh/ }));
    const dialog = await screen.findByRole('dialog', { name: /Klíče pro hlášení záloh/ });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Odvolat' }));

    const confirm = await screen.findByRole('dialog', { name: 'Odvolat klíč?' });
    expect(confirm).toHaveTextContent('přestane fungovat hned');
    expect(http.delete).not.toHaveBeenCalled();

    await userEvent.click(within(confirm).getByRole('button', { name: 'Odvolat' }));
    await waitFor(() => expect(http.delete).toHaveBeenCalledWith('/api/system/backups/reporters/k1'));
  });

  it('refuses a name that is too short before it asks the server', async () => {
    serve(overviewFixture());
    await open();

    await userEvent.click(screen.getByRole('button', { name: /Klíče pro hlášení záloh/ }));
    const dialog = await screen.findByRole('dialog', { name: /Klíče pro hlášení záloh/ });
    await userEvent.type(within(dialog).getByLabelText('Název nového klíče'), 'ab');

    expect(within(dialog).getByRole('button', { name: 'Vydat klíč' })).toBeDisabled();
  });
});

describe('the accounts shelf', () => {
  const withFindings = () =>
    overviewFixture({
      accounts: accountsSection(
        { light: 'amber', headline: '1 z 2 účtů vlastníka a správců je bez dvoufázového ověření.' },
        { privilegedWithTwoFactor: 1, findings: [finding('no_two_factor', 'Jana Správcová'), finding('stale_sign_in', 'Petr Starý', { role: 'Staff', detail: 'Naposledy přihlášen před 112 dny.' })] },
      ),
    });

  it('lists who has no second factor and links to the account', async () => {
    serve(withFindings());
    await open();
    const shelf = screen.getByRole('region', { name: 'Účty' });

    expect(within(shelf).getByRole('region', { name: 'Bez dvoufázového ověření' })).toHaveTextContent('Jana Správcová');
    expect(within(shelf).getByRole('region', { name: 'Dlouho nepřihlášen' })).toHaveTextContent('před 112 dny');
    expect(within(shelf).getByRole('link', { name: 'Otevřít účet Jana Správcová' })).toHaveAttribute('href', '/staff-management?user=id-Jana%20Spr%C3%A1vcov%C3%A1');
    expect(within(shelf).getByTestId('fact-privileged')).toHaveTextContent('1 z 2 má dvoufázové ověření');
  });

  it('says plainly when nobody needs attention', async () => {
    serve(overviewFixture());
    await open();
    expect(within(screen.getByRole('region', { name: 'Účty' })).getByText(/Žádný účet nevyžaduje pozornost/)).toBeInTheDocument();
  });

  it('hides the sign-out buttons from somebody who may not manage users, and keeps the rest', async () => {
    serve(withFindings());
    await open(['settings.clinic.manage']);

    expect(screen.queryByRole('button', { name: /Odhlásit/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Otevřít účet Jana Správcová' })).toBeInTheDocument();
  });

  it('shows the sign-out buttons to somebody who may', async () => {
    serve(withFindings());
    await open();

    expect(screen.getByRole('button', { name: 'Odhlásit Jana Správcová' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Odhlásit všechny ostatní' })).toBeInTheDocument();
  });

  it('asks before signing one account out, names it, and only then calls the server', async () => {
    serve(withFindings());
    http.post.mockResolvedValue({ data: { sessionsEnded: 2 } });
    await open();

    await userEvent.click(screen.getByRole('button', { name: 'Odhlásit Jana Správcová' }));
    const confirm = await screen.findByRole('dialog', { name: 'Odhlásit účet ze všech zařízení?' });
    expect(confirm).toHaveTextContent('Jana Správcová');
    expect(http.post).not.toHaveBeenCalled();

    await userEvent.click(within(confirm).getByRole('button', { name: 'Odhlásit' }));
    await waitFor(() => expect(http.post).toHaveBeenCalledWith('/api/system/security/sign-out/id-Jana%20Spr%C3%A1vcov%C3%A1'));
    expect(await screen.findByText(/Jana Správcová byl odhlášen \(2\)/)).toBeInTheDocument();
  });

  it('does nothing when the confirmation is cancelled', async () => {
    serve(withFindings());
    await open();

    await userEvent.click(screen.getByRole('button', { name: 'Odhlásit všechny ostatní' }));
    const confirm = await screen.findByRole('dialog', { name: 'Odhlásit všechny ostatní?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Zrušit' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Odhlásit všechny ostatní?' })).toBeNull());
    expect(http.post).not.toHaveBeenCalled();
  });

  it('tells the person to sign in again when the server wants a recent sign-in, and offers to', async () => {
    serve(withFindings());
    http.post.mockRejectedValue(refused(403, { code: 'reauth.required', message: 'x' }));
    await open();

    await userEvent.click(screen.getByRole('button', { name: 'Odhlásit všechny ostatní' }));
    const confirm = await screen.findByRole('dialog', { name: 'Odhlásit všechny ostatní?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Odhlásit všechny ostatní' }));

    expect(await within(confirm).findByText(/Pro tuto akci se přihlaste znovu/)).toBeInTheDocument();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Přihlásit se znovu' }));
    expect(signOutMock).toHaveBeenCalled();
  });
});

describe('the environment shelf', () => {
  it('opens on what needs doing, with the fix, and keeps passes folded', async () => {
    serve(
      overviewFixture({
        environment: environmentSection({ light: 'amber', headline: '1 upozornění, žádná kontrola neselhala' }, [
          { id: 'rate_limits', title: 'Omezení počtu požadavků', status: 'pass', detail: 'Výchozí hodnoty.', explanation: 'Brzdí hádání hesel.', fix: '' },
          { id: 'allowed_hosts', title: 'Povolené názvy hostitele (AllowedHosts)', status: 'warn', detail: 'Povolen je libovolný název hostitele (*).', explanation: 'Hvězdička přijme jakýkoli název.', fix: 'Nastavte AllowedHosts na skutečný název API.' },
        ]),
      }),
    );
    await open();
    const shelf = screen.getByRole('region', { name: 'Prostředí' });
    const rows = within(shelf).getAllByRole('listitem');

    expect(rows[0]).toHaveAttribute('data-check', 'allowed_hosts');
    expect(within(rows[0]).getByText(/Nastavte AllowedHosts na skutečný název API/)).toBeInTheDocument();
    expect(within(rows[1]).queryByText(/Brzdí hádání hesel/)).toBeNull();

    await userEvent.click(within(rows[1]).getByRole('button', { name: /Omezení počtu požadavků/ }));
    expect(await within(rows[1]).findByText(/Brzdí hádání hesel/)).toBeInTheDocument();
  });
});

describe('the activity shelf and the feed', () => {
  it('counts without naming anybody', async () => {
    serve(overviewFixture({ activity: activitySection({ light: 'amber', facts: { ...activitySection().facts!, failedSignIns24h: 14, activeLockouts: 1 } }) }));
    await open();

    expect(screen.getByTestId('fact-failed')).toHaveTextContent('14');
    expect(screen.getByTestId('fact-failed')).toHaveTextContent('jen počet, nikdo jmenovitě');
  });

  it('says so when there is no security event yet', async () => {
    serve(overviewFixture());
    await open();
    expect(await screen.findByTestId('events-empty')).toBeInTheDocument();
  });

  it('lists the events with their Czech title, who did it and a link to the account', async () => {
    serve(overviewFixture(), {
      items: [{ id: 'e1', atUtc: '2026-10-21T11:00:00+00:00', action: 'account.role_assigned', title: 'Změněna role účtu', severity: 'warning', actorLabel: 'vlastnik@klinika.test', subjectUserId: 'u-9' }],
      totalCount: 1,
    });
    await open();

    const feed = await screen.findByRole('list', { name: 'Bezpečnostní události' });
    expect(within(feed).getByText('Změněna role účtu')).toBeInTheDocument();
    expect(within(feed).getByText(/vlastnik@klinika\.test/)).toBeInTheDocument();
    expect(within(feed).getByRole('link', { name: 'otevřít účet' })).toHaveAttribute('href', '/staff-management?user=u-9');
  });

  it('loads older events on request and stops offering it when there are no more', async () => {
    const page = (n: number) => ({ id: `e${n}`, atUtc: '2026-10-21T11:00:00+00:00', action: 'settings.changed', title: 'Změněno nastavení', severity: 'notice', actorLabel: null, subjectUserId: null });
    http.get.mockImplementation(async (url: string, config?: { params?: { skip: number } }) => {
      if (url === '/api/system/security/overview') return { data: overviewFixture() };
      return { data: config?.params?.skip === 0 ? { items: [page(1)], totalCount: 2 } : { items: [page(2)], totalCount: 2 } };
    });
    await open();

    await userEvent.click(await screen.findByRole('button', { name: 'Načíst starší' }));
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Bezpečnostní události' })).getAllByText('Změněno nastavení')).toHaveLength(2));
    expect(screen.queryByRole('button', { name: 'Načíst starší' })).toBeNull();
  });
});

describe('what the page admits it cannot see', () => {
  it('lists what it does not measure', async () => {
    serve(overviewFixture());
    await open();
    const shelf = screen.getByRole('region', { name: 'Co tato stránka nevidí' });

    expect(shelf).toHaveTextContent('Oblast databáze u Supabase');
    expect(shelf).toHaveTextContent('nikdy nezazelená samo');
  });
});

describe('who sees it at all', () => {
  it('is in the settings catalogue only for somebody who may manage the clinic', () => {
    const idsFor = (held: string[]) => visibleSections(held).flatMap((s) => s.items.map((i) => i.id));

    expect(idsFor([])).not.toContain('zabezpeceni-zalohy');
    expect(idsFor(['users.manage'])).not.toContain('zabezpeceni-zalohy');
    expect(idsFor(['settings.clinic.manage'])).toContain('zabezpeceni-zalohy');
    expect(SETTINGS_SECTIONS.find((s) => s.items.some((i) => i.id === 'zabezpeceni-zalohy'))?.id).toBe('system');
  });

  it('is found by what a person would type', () => {
    const item = SETTINGS_SECTIONS.flatMap((s) => s.items).find((i) => i.id === 'zabezpeceni-zalohy');
    expect(item?.keywords).toEqual(expect.arrayContaining(['záloha', 'obnova', 'odhlásit']));
  });
});

describe('the status chip in the system area', () => {
  it('shows the worst light in a word', async () => {
    serve(overviewFixture({ lights: { backups: 'red', accounts: 'green', environment: 'amber', activity: 'green', overall: 'red' } }));
    render(<SecurityStatusChip />);

    await waitFor(() => expect(screen.getByTestId('security-status-chip')).toHaveTextContent('Problém'));
  });

  it('is grey "Neznámé", never green, while nothing has answered or when the server cannot be reached', async () => {
    http.get.mockRejectedValue(refused(500, {}));
    render(<SecurityStatusChip />);

    expect(screen.getByTestId('security-status-chip')).toHaveTextContent('Neznámé');
    await waitFor(() => expect(http.get).toHaveBeenCalled());
    expect(screen.getByTestId('security-status-chip')).toHaveTextContent('Neznámé');
    expect(screen.getByTestId('security-status-chip')).not.toHaveTextContent('V pořádku');
  });
});

describe.each([
  ['phone', VIEWPORTS.phone],
  ['tablet', VIEWPORTS.tablet],
  ['desktop', VIEWPORTS.desktop],
])('on a %s', (_name, width) => {
  beforeEach(() => setViewport(width));

  it('draws every shelf and the four lights', async () => {
    serve(overviewFixture());
    await open();

    for (const title of ['Zálohy', 'Účty', 'Prostředí', 'Aktivita a události', 'Co tato stránka nevidí']) {
      expect(screen.getByRole('region', { name: title })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('button', { name: /^(Zálohy|Účty|Prostředí|Aktivita):/ })).toHaveLength(4);
  });

  it('gives every action button at least 44 px', async () => {
    serve(overviewFixture({ accounts: accountsSection({ light: 'amber' }, { findings: [finding('no_two_factor', 'Jana')] }) }));
    await open();

    for (const name of [/Klíče pro hlášení záloh/, 'Návod k obnově', 'Export konfigurace', 'Zkontrolovat soubor konfigurace', 'Odhlásit všechny ostatní', 'Odhlásit Jana', 'Obnovit data']) {
      const button = screen.getByRole('button', { name });
      expect(parseFloat(getComputedStyle(button).minHeight), `${String(name)} min-height`).toBeGreaterThanOrEqual(44);
    }
  });
});

describe('the motion setting', () => {
  it('breathes a red card only while the setting is "plné"', async () => {
    serve(overviewFixture({ lights: { backups: 'red', accounts: 'green', environment: 'green', activity: 'green', overall: 'red' }, backups: neverReportedBackup() }));
    await open();

    const css = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n');
    const rules = css.split('}').filter((rule) => rule.includes('sm-light-breathe') && rule.includes('animation'));

    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule).toContain('html[data-motion="full"]');
  });

  it('writes no inline transform or opacity on a shelf under "vypnuto"', async () => {
    localStorage.setItem('sm-motion', 'vypnuto');
    serve(overviewFixture());
    await open();
    await new Promise((resolve) => setTimeout(resolve, 50));

    for (const shelf of document.querySelectorAll<HTMLElement>('[data-shelf]')) {
      expect(shelf.style.transform).toBe('');
      expect(shelf.style.opacity).toBe('');
    }
  });
});

describe('a screen that never goes blank', () => {
  it('keeps the title while the data is on its way', async () => {
    http.get.mockReturnValue(new Promise(() => undefined));
    localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));
    render(
      <MemoryRouter>
        <SecurityCenterPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Zabezpečení a zálohy' })).toBeInTheDocument();
    expect(screen.getByLabelText('Načítám stav zabezpečení')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Obnovit data' }));
  });
});
