/*
 * Zkrátit / Prodloužit - change the first and the last day of a block.
 *
 * Shortening frees the days that fall out, so athletes already registered on
 * them are hit. The server says so with `409` and their list; the dialog shows
 * the list and asks again, and only the second, explicit confirmation sends
 * `cancelAthletes` and cancels their appointments. Extending can only collide
 * with something else booked on the new days, which comes back the same way.
 */
import { useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clubBlocksApi, ClubBlockError } from '../../api/clubBlocks';
import type { ClubBlockConflict, ClubBlockView } from '../../api/clubBlocks';
import { useIsPhone } from '../../layout/useDevice';
import { blockRange, blockTitle } from './blockLogic';
import { ConflictList } from './ConflictList';

export type RangeMode = 'shorten' | 'extend';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function rangeProblem(mode: RangeMode, block: Pick<ClubBlockView, 'fromDate' | 'toDate'>, from: string, to: string): string | null {
  if (!DATE.test(from) || !DATE.test(to)) return 'Zadejte obě data.';
  if (to < from) return 'Konec nesmí být před začátkem.';
  if (from === block.fromDate && to === block.toDate) return 'Rozsah se nezměnil.';
  if (mode === 'shorten' && (from < block.fromDate || to > block.toDate)) {
    return `Zkrácený blok musí ležet uvnitř původního (${blockRange(block)}).`;
  }
  if (mode === 'extend' && (from > block.fromDate || to < block.toDate)) {
    return `Prodloužený blok musí zahrnovat původní (${blockRange(block)}).`;
  }
  return null;
}

export function ClubBlockRangeDialog({
  block,
  mode,
  onClose,
  onSaved,
}: {
  block: ClubBlockView;
  mode: RangeMode;
  onClose: () => void;
  onSaved?: (block: ClubBlockView) => void;
}) {
  const phone = useIsPhone();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(block.fromDate);
  const [to, setTo] = useState(block.toDate);
  const [touched, setTouched] = useState(false);
  const [conflicts, setConflicts] = useState<{ message: string; list: ClubBlockConflict[] } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const problem = rangeProblem(mode, block, from, to);

  const save = useMutation({
    mutationFn: (confirmed: boolean) => clubBlocksApi.update(block.id, { fromDate: from, toDate: to }, { cancelAthletes: confirmed }),
    onSuccess: (updated, confirmed) => {
      toast.success(
        mode === 'shorten'
          ? `Blok zkrácen. Uvolněné časy se vrátily do nabídky${confirmed ? ' a rezervace dotčených sportovců se zrušily' : ''}.`
          : 'Blok prodloužen.',
      );
      void queryClient.invalidateQueries({ queryKey: ['club-blocks'] });
      void queryClient.invalidateQueries({ queryKey: ['blocks'] });
      onSaved?.(updated);
      onClose();
    },
    onError: (error) => {
      const e = error instanceof ClubBlockError ? error : new ClubBlockError('Změnu se nepodařilo uložit.', undefined);
      if (e.isConflict) {
        setFailure(null);
        setConflicts({ message: e.message, list: e.conflicts });
      } else {
        setConflicts(null);
        setFailure(e.message);
      }
    },
  });

  const title = mode === 'shorten' ? 'Zkrátit blok' : 'Prodloužit blok';
  const confirming = conflicts !== null;

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} fullWidth maxWidth="xs" fullScreen={phone} aria-labelledby="block-range-title">
      <DialogTitle id="block-range-title" sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Box>
            <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{blockTitle(block)}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Nyní {blockRange(block)} · {mode === 'shorten' ? 'uvolněné dny se vrátí do nabídky kalendáře' : 'nové dny se pro klub podrží'}
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              type="date"
              size="small"
              label="Od"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setConflicts(null); setTouched(true); }}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              type="date"
              size="small"
              label="Do"
              value={to}
              onChange={(e) => { setTo(e.target.value); setConflicts(null); setTouched(true); }}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </Stack>

          {touched && problem !== null ? <Alert severity="info">{problem}</Alert> : null}
          {conflicts !== null ? (
            <>
              <ConflictList conflicts={conflicts.list} message={conflicts.message} />
              <Typography variant="body2">
                Pokud změnu potvrdíte, rezervace těchto sportovců se zruší a jejich časy se vrátí do nabídky.
              </Typography>
            </>
          ) : null}
          {failure !== null ? <Alert severity="error">{failure}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button variant="outlined" onClick={onClose} disabled={save.isPending} sx={{ minHeight: 44 }}>Zavřít</Button>
        <Button
          variant="contained"
          color={confirming ? 'error' : 'primary'}
          disabled={problem !== null || save.isPending}
          onClick={() => save.mutate(confirming)}
          sx={{ minHeight: 44 }}
        >
          {save.isPending ? 'Ukládám…' : confirming ? 'Potvrdit a zrušit rezervace' : title}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ClubBlockRangeDialog;
