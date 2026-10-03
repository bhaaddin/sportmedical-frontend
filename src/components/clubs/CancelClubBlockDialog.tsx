/*
 * Zrušit blok. Frees every slot the block held - they go back into the
 * calendars' offer at once. Athletes who already registered keep their
 * appointment unless the operator ticks "Zrušit i rezervace ...": the server
 * refuses the cancellation (`409`) while athletes are registered and the flag
 * is off, so the dialog does not let that button be pressed.
 */
import { useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clubBlocksApi, ClubBlockError } from '../../api/clubBlocks';
import type { ClubBlockConflict, ClubBlockView } from '../../api/clubBlocks';
import { useIsPhone } from '../../layout/useDevice';
import { blockRange, blockTitle } from './blockLogic';
import { ConflictList } from './ConflictList';

export function CancelClubBlockDialog({
  block,
  onClose,
  onCancelled,
}: {
  block: ClubBlockView;
  onClose: () => void;
  onCancelled?: () => void;
}) {
  const phone = useIsPhone();
  const queryClient = useQueryClient();
  const [cancelAthletes, setCancelAthletes] = useState(false);
  const [conflicts, setConflicts] = useState<{ message: string; list: ClubBlockConflict[] } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const hasAthletes = block.registered > 0 || conflicts !== null;

  const cancel = useMutation({
    mutationFn: () => clubBlocksApi.cancel(block.id, cancelAthletes),
    onSuccess: () => {
      toast.success('Blok zrušen. Uvolněné časy se vrátily do nabídky.');
      void queryClient.invalidateQueries({ queryKey: ['club-blocks'] });
      void queryClient.invalidateQueries({ queryKey: ['blocks'] });
      onCancelled?.();
      onClose();
    },
    onError: (error) => {
      const e = error instanceof ClubBlockError ? error : new ClubBlockError('Blok se nepodařilo zrušit.', undefined);
      if (e.isConflict) {
        setFailure(null);
        setConflicts({ message: e.message, list: e.conflicts });
        setCancelAthletes(false);
      } else {
        setConflicts(null);
        setFailure(e.message);
      }
    },
  });

  const blocked = hasAthletes && !cancelAthletes;

  return (
    <Dialog open onClose={cancel.isPending ? undefined : onClose} fullWidth maxWidth="xs" fullScreen={phone} aria-labelledby="block-cancel-title">
      <DialogTitle id="block-cancel-title" sx={{ fontWeight: 700 }}>Zrušit blok</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Box>
            <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{blockTitle(block)}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>{blockRange(block)}</Typography>
          </Box>
          <Typography variant="body2">
            Všechny časy, které blok držel, se vrátí do nabídky kalendářů a budou znovu k dispozici pro ostatní objednávky.
          </Typography>

          {hasAthletes ? (
            <>
              <Alert severity="warning">
                {block.registered > 0
                  ? `Na blok je registrováno ${block.registered} ${block.registered === 1 ? 'sportovec' : 'sportovců'}. `
                  : 'Na blok jsou registrovaní sportovci. '}
                Bez zrušení jejich rezervací blok zrušit nejde.
              </Alert>
              <FormControlLabel
                sx={{ minHeight: 44, mr: 0 }}
                control={<Checkbox checked={cancelAthletes} onChange={(e) => setCancelAthletes(e.target.checked)} />}
                label="Zrušit i rezervace registrovaných sportovců"
              />
            </>
          ) : null}

          {conflicts !== null ? <ConflictList conflicts={conflicts.list} message={conflicts.message} /> : null}
          {failure !== null ? <Alert severity="error">{failure}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button variant="outlined" onClick={onClose} disabled={cancel.isPending} sx={{ minHeight: 44 }}>Ponechat blok</Button>
        <Button variant="contained" color="error" disabled={blocked || cancel.isPending} onClick={() => cancel.mutate()} sx={{ minHeight: 44 }}>
          {cancel.isPending ? 'Ruším…' : 'Zrušit blok'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CancelClubBlockDialog;
