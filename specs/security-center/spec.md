# Zabezpečení a zálohy (Nastavení -> Systém)

Branch `ui/security-center`. Backend: `bhaaddin/sportmedical-api`, branch `feature/security-backup-center`
(`SecurityCenterController`, `BackupsController`, `docs/engineering/backup-and-recovery.md`).

## Request (owner, 21. 10. 2026, translated)

"All pages with a better new style ... with security and backup handling." One hub that shows the TRUTH about security
and backups and lets the owner act, without claiming anything the system cannot prove.

## What it is

`/nastaveni/zabezpeceni-a-zalohy`, in the Systém group, visible and routable only with `settings.clinic.manage`
(Owner and Administrator by default). A small status chip beside its row in the Systém group.

| Shelf | Shows | Acts |
|---|---|---|
| Zálohy | freshness, last verified restore, drill reminder, where it went (EU, "hlášeno"), encryption claim, checksum, sizes sparkline, reasons | keys for backup jobs (issue, rotate, revoke), recovery kit, configuration export, check an export file (writes nothing) |
| Účty | owner/admin accounts without 2FA, never signed in, stale (90 days), must change password, locked; link to the account | sign one account out, sign everybody else out (needs `users.manage` and a recent sign-in) |
| Prostředí | checklist with pass/warn/fail, why it matters, the fix | none |
| Aktivita | failed sign-ins (count only), denied access, lockouts, sessions; the security events feed | none |
| Co stránka nevidí | what only the owner can verify | none |

## Decisions

1. **Never green without evidence.** The server colours a part; `securityCenter/model.ts` refuses a green the same
   answer does not support (backup: fresh + verified restore + EU + encrypted; accounts: every privileged account has 2FA;
   environment: every check passed). A held-back green is shown as amber with the missing evidence named. A part that
   could not be measured is grey "Neznámé", never green and never red.
2. **Honest empty and never states.** "Záloha dosud nehlásila žádný běh - nastavte zálohování." in red, not a tick.
3. **A report is a claim.** Backup facts are worded "hlášeno"; only a restore drill is proof. The page says it cannot see the
   storage.
4. **Secrets are shown once.** The reporter key is on screen when issued and in no list, log or audit row.
5. **Sensitive actions need a recent sign-in.** The server answers `reauth.required`; the dialog offers "Přihlásit se znovu".
6. **Shelves.** Each shelf is one component fed by one section of the overview (`Shelf` in `securityCenter/parts.tsx` is the
   single wrapper), so the shelf design system on `ui/shelf` can adopt them one at a time.
7. **Layouts.** Phone: single column inside the region that scrolls; tablet and desktop: the settings frame is the scrolling
   region and the document never scrolls. Targets are 44 px. The red card breathes only under `html[data-motion="full"]`;
   shelves arrive with the kit's `useReveal` (nothing is written under "vypnuto"). Colours come from the theme, so the accent
   recolours the page.

## Verified

`npm run typecheck`, the Vitest suites (model, API module, page: every state, permission hiding, never-green, dialogs, three
layouts, motion), `PRERENDER_API_URL=off npm run build`, and `scripts/security-center-check.mjs` in our own headless
Chromium against a backend on :5094 (scratch database) at 390x844, 820x1180 and 1440x900: document scroll, horizontal
overflow, 44 px targets, console, failed requests. Screenshots in `design/security-center/`.

## Not done

2FA cannot be forced for a role (the backend has no setting to hold it; BE-07). A per-action password prompt does not exist
in the application; the recent-sign-in rule is what there is. Backup of patient documents is not covered by the database
backup and is said so on the page.
