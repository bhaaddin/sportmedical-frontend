import { useState, type ReactNode } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography, useTheme } from '@mui/material';
import { StatusChip, type ChipTone } from '../../../components/ui';
import { Shelf as SystemShelf } from '../../../ui/shelf';
import { TYPE, focusRing } from '../../../components/settings/settingsStyle';
import { signOut } from '../../../auth/signOut';
import { securityErrorText, type Light, type SecurityCenterError } from '../../../api/securityCenter';
import { LIGHT_WORD, bytesText, sparklinePoints, type LightView } from './model';

/* The small pieces every shelf of the screen is made of. */

export const LIGHT_TONE: Record<Light, Exclude<ChipTone, 'primary'>> = { green: 'green', amber: 'beige', red: 'red', unknown: 'grey' };

/** A light as a pill: the colour AND the word, so the state never rests on colour alone. */
export function LightPill({ light, size = 'md', testId }: { light: Light; size?: 'sm' | 'md'; testId?: string }) {
  return (
    <StatusChip tone={LIGHT_TONE[light]} size={size} dot testId={testId}>
      {LIGHT_WORD[light]}
    </StatusChip>
  );
}

/**
 * One titled shelf of the screen, drawn by the shelf system (a `board`). The title and the light sit in its head, the
 * headline and the reason (when a light was held back) open its body. The outer box keeps the old anchor `shelf-<id>`
 * that the summary cards scroll to.
 */
export function Shelf({
  id,
  title,
  view,
  headline,
  actions,
  children,
  bodySx,
}: {
  id: string;
  title: string;
  view?: LightView;
  headline?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  bodySx?: object;
}) {
  const controls = view !== undefined || actions !== undefined ? (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      {view !== undefined && <LightPill light={view.light} testId={`shelf-${id}-light`} />}
      {actions}
    </Box>
  ) : undefined;
  return (
    <Box id={`shelf-${id}`} sx={{ minWidth: 0, scrollMarginTop: 8 }}>
      <SystemShelf id={id} title={title} layout="board" controls={controls} stagger={false}>
        <Box sx={{ p: 2, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {headline !== undefined && <Typography sx={TYPE.caption}>{headline}</Typography>}
          {view?.why != null && (
            <Alert severity={view.downgraded ? 'warning' : 'info'} sx={{ alignItems: 'center' }}>
              {view.why}
            </Alert>
          )}
          <Box sx={bodySx}>{children}</Box>
        </Box>
      </SystemShelf>
    </Box>
  );
}

/** The sizes of the last backups as a line. Under two points there is nothing to draw, and it says so. */
export function Sparkline({ series }: { series: readonly { at: string; bytes: number }[] }) {
  const theme = useTheme();
  const width = 220;
  const height = 48;
  const points = sparklinePoints(series, width, height);

  if (points === null) {
    return <Typography sx={TYPE.caption}>Na graf velikostí je zatím málo záloh (potřeba aspoň dvě).</Typography>;
  }

  const first = series[0];
  const last = series[series.length - 1];
  const [lastX, lastY] = points.split(' ').slice(-1)[0].split(',');

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
      <svg
        role="img"
        aria-label={`Velikost posledních ${series.length} záloh: od ${bytesText(first.bytes)} do ${bytesText(last.bytes)}`}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        style={{ maxWidth: '100%' }}
      >
        <polyline fill="none" stroke={theme.palette.primary.main} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={points} />
        <circle cx={lastX} cy={lastY} r="3.5" fill={theme.palette.primary.main} />
      </svg>
      <Typography sx={TYPE.caption}>
        {series.length} záloh, poslední {bytesText(last.bytes)}
      </Typography>
    </Box>
  );
}

/** A label and a value on one line (or two on a phone), for the facts of a shelf. */
export function Fact({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 0, sm: 1.5 }, py: 0.5 }} data-testid={testId}>
      <Typography sx={[TYPE.label, { flex: '0 0 190px', pt: 0.4 }]}>{label}</Typography>
      <Typography component="div" sx={{ fontSize: 15, minWidth: 0, overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </Box>
  );
}

/** A button that is always at least 44 px high. */
export const BIG = { minHeight: 44, minWidth: 44, ...focusRing } as const;

/**
 * An action that needs a yes. It states what will happen and to whom, runs the action, and keeps the error in the
 * dialog (with the way out when the cause is an old sign-in) instead of closing and losing it.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SecurityCenterError | null>(null);

  const close = () => {
    if (busy) return;
    setError(null);
    onClose();
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setBusy(false);
      onClose();
    } catch (failure) {
      setBusy(false);
      setError(failure as SecurityCenterError);
    }
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth aria-labelledby="confirm-title">
      <DialogTitle id="confirm-title">{title}</DialogTitle>
      <DialogContent>
        <Typography component="div" sx={{ fontSize: 15 }}>
          {children}
        </Typography>
        {error !== null && (
          <Alert
            severity="error"
            sx={{ mt: 2 }}
            action={
              error.kind === 'reauth' ? (
                <Button color="inherit" size="small" onClick={() => void signOut()} sx={BIG}>
                  Přihlásit se znovu
                </Button>
              ) : undefined
            }
          >
            {securityErrorText(error)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={close} disabled={busy} sx={BIG}>
          Zrušit
        </Button>
        <Button variant="contained" color={danger ? 'error' : 'primary'} onClick={() => void run()} disabled={busy} sx={BIG}>
          {busy ? 'Pracuji…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
