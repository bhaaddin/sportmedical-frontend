import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Collapse, Skeleton, Snackbar, Stack, Typography } from '@mui/material';
import { ExpandMore, Logout } from '@mui/icons-material';
import {
  securityCenterApi,
  type AccountFinding,
  type AccountsSection,
  type ActivitySection,
  type EnvironmentSection,
  type SecurityEvent,
  type SecurityThresholds,
} from '../../../api/securityCenter';
import { TYPE, focusRing } from '../../../components/settings/settingsStyle';
import { StatusChip } from '../../../components/ui';
import { FIT_SCROLL_SX } from '../../../components/ui/fit';
import { useIsPhone } from '../../../layout/useDevice';
import { usePermission } from '../../../auth/usePermission';
import { EVENT_TONE, STATUS_WORD, agoText, dateTimeText, groupFindings, sortChecks, staffLink, type LightView } from './model';
import { BIG, ConfirmDialog, Fact, Shelf } from './parts';

/* ── Účty ── */

export function AccountsShelf({
  section,
  view,
  thresholds,
  onChanged,
}: {
  section: AccountsSection;
  view: LightView;
  thresholds: SecurityThresholds;
  onChanged: () => void;
}) {
  const canSignOut = usePermission('users.manage');
  const p = section.posture;
  const [target, setTarget] = useState<AccountFinding | null>(null);
  const [others, setOthers] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  return (
    <Shelf id="accounts" title="Účty" view={view} headline={section.headline}>
      {section.error !== null && <Alert severity="error">{section.error}</Alert>}

      {p !== null && (
        <>
          <Fact label="Aktivní účty">
            {p.activeAccounts} <span style={{ opacity: 0.75 }}>(vypnutých {p.inactiveAccounts})</span>
          </Fact>
          <Fact label="Vlastník a správci" testId="fact-privileged">
            {p.privilegedWithTwoFactor} z {p.privilegedAccounts} má dvoufázové ověření
          </Fact>

          {p.findings.length === 0 ? (
            <Typography sx={[TYPE.caption, { mt: 1 }]}>
              Žádný účet nevyžaduje pozornost: nikdo bez dvoufázového ověření (u vlastníka a správců), nikdo nezamčený, nikdo neaktivní déle než {thresholds.accountStaleDays} dní.
            </Typography>
          ) : (
            <Stack spacing={1.5} sx={{ mt: 1.5 }}>
              {groupFindings(p.findings).map((group) => (
                <Box key={group.code} component="section" aria-label={group.title}>
                  <Typography sx={TYPE.label}>
                    {group.title} ({group.items.length})
                  </Typography>
                  <Stack component="ul" spacing={0.75} sx={{ listStyle: 'none', m: 0, p: 0, mt: 0.5 }}>
                    {group.items.map((finding) => (
                      <Box
                        component="li"
                        key={`${finding.code}-${finding.userId}`}
                        sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', minHeight: 44 }}
                      >
                        <Box sx={{ flex: '1 1 180px', minWidth: 0 }}>
                          <Typography sx={TYPE.itemName}>
                            {finding.displayName} <span style={{ fontWeight: 400, opacity: 0.75 }}>· {finding.role}</span>
                          </Typography>
                          <Typography sx={{ fontSize: 13 }}>{finding.detail}</Typography>
                        </Box>
                        <Button component={RouterLink} to={staffLink(finding.userId)} size="small" sx={BIG} aria-label={`Otevřít účet ${finding.displayName}`}>
                          Otevřít účet
                        </Button>
                        {canSignOut && (
                          <Button size="small" color="warning" startIcon={<Logout />} onClick={() => setTarget(finding)} sx={BIG} aria-label={`Odhlásit ${finding.displayName}`}>
                            Odhlásit
                          </Button>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </>
      )}

      {canSignOut && (
        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" color="warning" startIcon={<Logout />} onClick={() => setOthers(true)} sx={BIG}>
            Odhlásit všechny ostatní
          </Button>
          <Typography sx={[TYPE.caption, { mt: 0.75 }]}>
            Ukončí přihlášení všech ostatních lidí na všech zařízeních. Vaše zůstane. Použijte při podezření na zneužití účtu.
          </Typography>
        </Box>
      )}

      <ConfirmDialog
        open={target !== null}
        title="Odhlásit účet ze všech zařízení?"
        confirmLabel="Odhlásit"
        danger
        onClose={() => setTarget(null)}
        onConfirm={async () => {
          if (target === null) return;
          const ended = await securityCenterApi.signOutUser(target.userId);
          setDone(ended === 0 ? `${target.displayName} nebyl nikde přihlášen.` : `${target.displayName} byl odhlášen (${ended}).`);
          onChanged();
        }}
      >
        {target?.displayName} bude hned odhlášen na všech zařízeních a při dalším kroku se musí znovu přihlásit. Rozepsaná práce, která nebyla uložena, se ztratí.
      </ConfirmDialog>

      <ConfirmDialog
        open={others}
        title="Odhlásit všechny ostatní?"
        confirmLabel="Odhlásit všechny ostatní"
        danger
        onClose={() => setOthers(false)}
        onConfirm={async () => {
          const ended = await securityCenterApi.signOutOthers();
          setDone(`Odhlášeno přihlášení: ${ended}. Vaše zůstalo.`);
          onChanged();
        }}
      >
        Všichni ostatní zaměstnanci budou hned odhlášeni a musí se znovu přihlásit. Rozepsaná práce, která nebyla uložena, se ztratí. Akce se zapíše do auditu.
      </ConfirmDialog>

      <Snackbar open={done !== null} autoHideDuration={6000} onClose={() => setDone(null)} message={done ?? ''} />
    </Shelf>
  );
}

/* ── Prostředí ── */

export function EnvironmentShelf({ section, view }: { section: EnvironmentSection; view: LightView }) {
  const [open, setOpen] = useState<string | null>(null);
  const items = sortChecks(section.items);

  return (
    <Shelf id="environment" title="Prostředí" view={view} headline={section.headline}>
      {section.error !== null && <Alert severity="error">{section.error}</Alert>}
      <Stack component="ul" spacing={0.5} sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label="Kontroly prostředí">
        {items.map((item) => {
          const expanded = open === item.id || item.status !== 'pass';
          return (
            <Box component="li" key={item.id} data-check={item.id} data-status={item.status} sx={{ borderBottom: 1, borderColor: 'divider', pb: 0.5 }}>
              <Box
                component="button"
                type="button"
                aria-expanded={expanded}
                aria-controls={`check-${item.id}`}
                onClick={() => setOpen(open === item.id ? null : item.id)}
                sx={[
                  focusRing,
                  {
                    all: 'unset',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    width: '100%',
                    minHeight: 44,
                    cursor: 'pointer',
                    '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                  },
                ]}
              >
                <StatusChip tone={item.status === 'pass' ? 'green' : item.status === 'warn' ? 'beige' : 'red'} size="sm">
                  {STATUS_WORD[item.status]}
                </StatusChip>
                <Typography sx={[TYPE.itemName, { flex: 1, minWidth: 0 }]}>{item.title}</Typography>
                <ExpandMore sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }} aria-hidden />
              </Box>
              <Collapse in={expanded} unmountOnExit>
                <Box id={`check-${item.id}`} sx={{ pl: { xs: 0, sm: 1 }, pb: 1 }}>
                  <Typography sx={{ fontSize: 14 }}>{item.detail}</Typography>
                  <Typography sx={[TYPE.caption, { mt: 0.5 }]}>{item.explanation}</Typography>
                  {item.fix !== '' && (
                    <Typography sx={{ fontSize: 14, mt: 0.5, fontWeight: 600 }}>
                      Co s tím: <span style={{ fontWeight: 400 }}>{item.fix}</span>
                    </Typography>
                  )}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Stack>
    </Shelf>
  );
}

/* ── Aktivita a bezpečnostní události ── */

export function ActivityShelf({
  section,
  view,
  events,
  eventsTotal,
  eventsFailure,
  eventsLoading,
  onMore,
  now,
}: {
  section: ActivitySection;
  view: LightView;
  events: SecurityEvent[];
  eventsTotal: number | null;
  eventsFailure: string | null;
  eventsLoading: boolean;
  onMore: () => void;
  now: Date;
}) {
  const phone = useIsPhone();
  const f = section.facts;

  return (
    <Shelf id="activity" title="Aktivita a události" view={view} headline={section.headline}>
      {section.error !== null && <Alert severity="error">{section.error}</Alert>}
      {f !== null && (
        <Box sx={{ mb: 1.5 }}>
          <Fact label="Neúspěšná přihlášení (24 h)" testId="fact-failed">
            {f.failedSignIns24h} <span style={{ opacity: 0.75 }}>(jen počet, nikdo jmenovitě)</span>
          </Fact>
          <Fact label="Chybné ověřovací kódy (24 h)">{f.secondFactorFailures24h}</Fact>
          <Fact label="Odepřené přístupy (24 h)">{f.accessDenied24h}</Fact>
          <Fact label="Zamčené účty teď">{f.activeLockouts}</Fact>
          <Fact label="Přihlášení teď">
            {f.activeSessions}
            {f.sessionLifetimeHours !== null ? ` · platnost přihlášení ${f.sessionLifetimeHours} h` : ''}
          </Fact>
          <Fact label="Za 24 h">
            {f.sessionsStarted24h} nových přihlášení, {f.sessionsRevoked24h} ukončených
          </Fact>
        </Box>
      )}

      <Typography sx={TYPE.label}>Bezpečnostní události{eventsTotal !== null ? ` (${eventsTotal})` : ''}</Typography>
      {eventsFailure !== null && (
        <Alert severity="error" sx={{ mt: 0.5 }}>
          {eventsFailure}
        </Alert>
      )}
      {eventsFailure === null && !eventsLoading && events.length === 0 && (
        <Typography sx={[TYPE.caption, { mt: 0.5 }]} data-testid="events-empty">
          V záznamech zatím není žádná bezpečnostní událost (změna účtu, role, oprávnění, nastavení, odepřený přístup).
        </Typography>
      )}
      <Stack
        component="ul"
        spacing={0.5}
        aria-label="Bezpečnostní události"
        sx={[{ listStyle: 'none', m: 0, p: 0, mt: 0.5 }, phone ? {} : { maxHeight: 360, ...FIT_SCROLL_SX }]}
      >
        {events.map((event) => (
          <Box component="li" key={event.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
            <StatusChip tone={EVENT_TONE[event.severity] ?? 'grey'} size="sm">
              {event.severity === 'warning' ? 'Pozor' : event.severity === 'notice' ? 'Změna' : 'Info'}
            </StatusChip>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{event.title}</Typography>
              <Typography sx={{ fontSize: 13 }} title={dateTimeText(event.atUtc)}>
                {agoText(event.atUtc, now)}
                {event.actorLabel !== null ? ` · ${event.actorLabel}` : ''}
                {event.subjectUserId !== null && (
                  <>
                    {' · '}
                    <RouterLink to={staffLink(event.subjectUserId)}>otevřít účet</RouterLink>
                  </>
                )}
              </Typography>
            </Box>
          </Box>
        ))}
        {eventsLoading && <Skeleton variant="rounded" height={44} aria-label="Načítám události" />}
      </Stack>
      {eventsTotal !== null && events.length < eventsTotal && !eventsLoading && (
        <Button onClick={onMore} sx={[BIG, { mt: 1 }]}>
          Načíst starší
        </Button>
      )}
    </Shelf>
  );
}

/* ── Co stránka nevidí ── */

export function NotMeasuredShelf({ items }: { items: string[] }) {
  return (
    <Shelf id="not-measured" title="Co tato stránka nevidí">
      <Typography sx={[TYPE.caption, { mb: 1 }]}>
        Zelená tu znamená jen to, co systém sám dokázal ověřit. Tohle ověřit neumí, a proto to nikdy nezazelená samo:
      </Typography>
      <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 2.5, listStyleType: 'disc' }}>
        {items.map((text) => (
          <Typography component="li" key={text} sx={{ fontSize: 14, display: 'list-item' }}>
            {text}
          </Typography>
        ))}
      </Stack>
    </Shelf>
  );
}
