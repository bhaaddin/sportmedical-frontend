import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { fetchSettingChanges, formatChangeTime, formatChangeValue, type ChangeEntry } from './changesApi';
import { Shelf } from '../../ui/shelf/Shelf';
import { MUTED_SX } from '../../ui/shelf/shelfStyle';

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

  /* A shelf like every other (Phase 2): heading, a count, one board of rows; loading holds the height. */
  return (
    <Box sx={{ mt: 4 }}>
      <Shelf
        id="changes"
        title="Poslední změny"
        layout="list"
        count={state.kind === 'ready' ? state.items.length : undefined}
        loading={state.kind === 'loading'}
        empty={state.kind === 'ready' && state.items.length === 0}
        emptyState={{ text: 'Zatím tu nikdo nic neměnil.' }}
        stagger={false}
      >
        {state.kind === 'ready' && state.items.map((entry, index) => (
          <Box
            key={`${entry.at}-${index}`}
            role="listitem"
            sx={{ px: 1.5, py: 1.25, minHeight: 44, display: 'flex', alignItems: 'center', borderTop: index === 0 ? 'none' : '1px solid', borderColor: 'divider' }}
          >
            <Typography sx={{ fontSize: 14, lineHeight: 1.5, color: 'text.primary' }}>
              <Box component="span" sx={{ fontWeight: 600 }}>{entry.user || 'Systém'}</Box>
              <Box component="span" sx={MUTED_SX}>{' · '}{formatChangeTime(entry.at)}{' · '}</Box>
              {entry.label}: {formatChangeValue(entry.before)} → {formatChangeValue(entry.after)}
            </Typography>
          </Box>
        ))}
      </Shelf>
    </Box>
  );
}

export default RecentChanges;
