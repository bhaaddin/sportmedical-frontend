/*
 * Moje relace: where this account is signed in. One row per session with "Odhlásit", and "Odhlásit všude jinde" above them.
 * The session this browser is using is marked and has no button (that is "Odhlásit se" in the account menu).
 *
 * A server without the routes: nothing is drawn, nobody is told (api/accountSessions.ts).
 */
import { Alert, Box, Button, Chip, Skeleton, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ACCOUNT_SESSIONS_QUERY_KEY, readSessions, revokeOtherSessions, revokeSession, type AccountSession,
} from '../../../api/accountSessions';
import { MUTED_SX } from '../../../ui/shelf/shelfStyle';
import { SettingsBoard } from '../SettingsBoard';

const when = (iso: string | null): string => {
  if (iso === null) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function SessionRow({ session, busy, onRevoke }: { session: AccountSession; busy: boolean; onRevoke: () => void }) {
  const device = session.device ?? 'Neznámé zařízení';
  return (
    <Box
      component="li"
      data-session={session.id}
      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, minHeight: 64, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
          <Typography sx={{ fontSize: 15, fontWeight: 650, overflowWrap: 'anywhere' }}>{device}</Typography>
          {session.current && <Chip size="small" color="primary" label="Toto zařízení" />}
        </Stack>
        <Typography sx={{ ...MUTED_SX, fontSize: 13, mt: 0.25 }}>
          Naposledy aktivní {when(session.lastSeenAt ?? session.createdAt)} · přihlášeno {when(session.createdAt)}
        </Typography>
      </Box>
      {!session.current && (
        <Button variant="outlined" color="error" disabled={busy} onClick={onRevoke} aria-label={`Odhlásit: ${device}`} sx={{ minHeight: 44, flexShrink: 0 }}>
          Odhlásit
        </Button>
      )}
    </Box>
  );
}

export default function MySessions() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ACCOUNT_SESSIONS_QUERY_KEY, queryFn: readSessions, retry: false });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ACCOUNT_SESSIONS_QUERY_KEY });

  const one = useMutation({ mutationFn: revokeSession, onSuccess: refresh });
  const others = useMutation({ mutationFn: revokeOtherSessions, onSuccess: refresh });

  /* Nothing to say on a server without the routes, and nothing worth an error box while it loads. */
  if (query.data === null) return null;

  const sessions = query.data ?? [];
  const hasOthers = sessions.some((s) => !s.current);
  const busy = one.isPending || others.isPending;

  return (
    <SettingsBoard id="my-sessions" title="Kde jsem přihlášený/á" hint="Zařízení, na kterých je váš účet přihlášený">
      {query.isPending ? (
        <Box aria-busy="true" aria-label="Načítám přihlášená zařízení">
          <Skeleton variant="rounded" height={56} />
        </Box>
      ) : query.isError ? (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => { void query.refetch(); }} sx={{ minHeight: 44 }}>Zkusit znovu</Button>}>
          Přihlášená zařízení se nepodařilo načíst.
        </Alert>
      ) : (
        <Stack spacing={1.5}>
          <Box component="ul" aria-label="Přihlášená zařízení" sx={{ listStyle: 'none', m: 0, p: 0, '& > li + li': { borderTop: '1px solid', borderColor: 'divider' } }}>
            {sessions.map((s) => (
              <SessionRow key={s.id} session={s} busy={busy} onRevoke={() => one.mutate(s.id)} />
            ))}
          </Box>
          {(one.isError || others.isError) && <Alert severity="error">Odhlášení se nepovedlo. Zkuste to znovu.</Alert>}
          {hasOthers ? (
            <Box>
              <Button variant="contained" color="error" disabled={busy} onClick={() => others.mutate()} sx={{ minHeight: 44 }}>
                Odhlásit všude jinde
              </Button>
            </Box>
          ) : (
            <Typography sx={{ ...MUTED_SX, fontSize: 13 }}>Jinde nejste přihlášený/á.</Typography>
          )}
        </Stack>
      )}
    </SettingsBoard>
  );
}
