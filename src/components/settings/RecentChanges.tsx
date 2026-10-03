import { useEffect, useState } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { fetchSettingChanges, formatChangeTime, formatChangeValue, type ChangeEntry } from './changesApi';
import { TYPE, settingsLine } from './settingsStyle';

type State = { kind: 'loading' } | { kind: 'hidden' } | { kind: 'ready'; items: ChangeEntry[] };

/**
 * "Poslední změny" - the last five changes to this page's settings, under the
 * page: who, when, which field, from what to what.
 *
 * It is a courtesy, never a blocker: where the history cannot be read (404
 * while the endpoint is not deployed, 503, a network error, an answer that is
 * not a list) the panel is simply not there. While it loads it holds its
 * height so nothing under it jumps.
 */
export function RecentChanges({ scope, take = 5 }: { scope: string; take?: number }) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    setState({ kind: 'loading' });
    (async () => {
      try {
        const page = await fetchSettingChanges(scope, take);
        if (alive) setState({ kind: 'ready', items: page.items.slice(0, take) });
      } catch {
        if (alive) setState({ kind: 'hidden' });
      }
    })();
    return () => { alive = false; };
  }, [scope, take]);

  if (state.kind === 'hidden') return null;

  return (
    <Box
      component="section"
      aria-label="Poslední změny"
      sx={{ mt: 4, border: '1px solid', borderColor: settingsLine, borderRadius: 3, bgcolor: 'background.paper', overflow: 'hidden' }}
    >
      <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderColor: settingsLine }}>
        <Typography component="h2" sx={TYPE.sectionTitle}>Poslední změny</Typography>
      </Box>
      {state.kind === 'loading' ? (
        <Box sx={{ p: 2.5 }}>
          <Skeleton variant="text" height={24} />
          <Skeleton variant="text" height={24} width="70%" />
        </Box>
      ) : state.items.length === 0 ? (
        <Typography sx={[TYPE.caption, { px: 2.5, py: 2 }]}>Zatím tu nikdo nic neměnil.</Typography>
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {state.items.map((entry, index) => (
            <Box
              key={`${entry.at}-${index}`}
              component="li"
              sx={{ px: 2.5, py: 1.5, minHeight: 48, borderTop: index === 0 ? 'none' : '1px solid', borderColor: settingsLine }}
            >
              <Typography sx={[TYPE.caption, { color: 'text.primary' }]}>
                <Box component="span" sx={{ fontWeight: 600 }}>{entry.user || 'Systém'}</Box>
                {' · '}
                {formatChangeTime(entry.at)}
                {' · '}
                {entry.label}: {formatChangeValue(entry.before)} → {formatChangeValue(entry.after)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export default RecentChanges;
