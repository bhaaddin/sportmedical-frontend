/*
 * "Rozdělit": the staff takes some days out of the club's one order into an order of their own. The parts stay
 * visibly linked ("rozděleno z KO-…"). Days that are invoiced or cancelled, and the root itself, cannot be moved -
 * each says why. At least one day must be chosen and not all of them.
 */
import { useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Typography } from '@mui/material';
import type { CombinedOrder } from '../../../api/clubOneOrder';
import { splitOrder } from '../../../api/clubOneOrder';
import { useIsPhone } from '../../../layout/useDevice';
import { dayWhen, splitBlocker, splitProblem } from './oneOrderModel';

const messageOf = (e: unknown): string => {
  const m = (e as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  return typeof m === 'string' && m.trim() !== '' ? m : 'Objednávku se nepodařilo rozdělit.';
};

export function SplitOrderDialog({ combined, onClose, onSplit }: {
  combined: CombinedOrder;
  onClose: () => void;
  /** The id of the new root when the server names it. */
  onSplit: (newRootId: string | null) => void;
}) {
  const phone = useIsPhone();
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = [...chosen];
  const problem = splitProblem(selected, combined);

  const toggle = (id: string) => setChosen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const confirm = async () => {
    if (problem !== null) return;
    setBusy(true);
    setError(null);
    try {
      onSplit(await splitOrder(combined.rootId, selected));
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={phone} aria-labelledby="split-order-title">
      <DialogTitle id="split-order-title">Rozdělit objednávku</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            Vybrané dny přejdou do nové objednávky. Obě části zůstanou propojené.
          </Typography>
          <Stack component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }} data-testid="split-days">
            {combined.days.map((d) => {
              const blocker = splitBlocker(d, combined.rootId);
              return (
                <Box component="li" key={d.orderId} sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 0.25 }}>
                  <FormControlLabel
                    sx={{ minHeight: 44, m: 0, width: '100%', alignItems: 'center' }}
                    disabled={blocker !== null || busy}
                    control={<Checkbox checked={chosen.has(d.orderId)} onChange={() => toggle(d.orderId)} slotProps={{ input: { 'data-testid': `split-day-${d.orderId}` } as object }} />}
                    label={(
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{dayWhen(d)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {`${d.serviceName} · ${d.reference}`}{blocker !== null ? ` · ${blocker}` : ''}
                        </Typography>
                      </Box>
                    )}
                  />
                </Box>
              );
            })}
          </Stack>
          {selected.length > 0 && problem !== null ? <Alert severity="info" data-testid="split-problem">{problem}</Alert> : null}
          {error !== null ? <Alert severity="error" data-testid="split-error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={busy} sx={{ minHeight: 44 }}>Zrušit</Button>
        <Button variant="contained" onClick={() => void confirm()} disabled={busy || problem !== null} data-testid="split-confirm" sx={{ minHeight: 44 }}>
          {selected.length > 0 ? `Rozdělit (${selected.length})` : 'Rozdělit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default SplitOrderDialog;
