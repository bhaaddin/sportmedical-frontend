/*
 * "×" on one window of an order: the order stays ONE order and loses exactly that window (an `update` with the
 * remaining range set; the server diffs the blocks). If athletes are booked in the window the server answers 409
 * with them; the desk then confirms explicitly that their reservations are cancelled.
 * Etapa 11: an optional "Zpráva pro klub" is sent as `clubMessage` and shows in the club's portal.
 */
import { useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { ClubBlockView } from '../../../api/clubBlocks';
import { ClubOrderError, clubOrdersApi } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';
import { invalidateClubWorld } from '../clubWorld';
import { rangesWithout, windowLabel } from './orderWindows';
import { ClubMessageField, clubMessageOf } from './ClubMessageField';

export function RemoveWindowDialog({ order, block, onClose, onRemoved }: {
  order: ClubOrderView;
  block: ClubBlockView;
  onClose: () => void;
  onRemoved: (order: ClubOrderView) => void;
}) {
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<string | null>(null);
  const [affected, setAffected] = useState<{ message: string; list: ClubOrderError['affectedAthletes'] } | null>(null);
  const [message, setMessage] = useState('');
  const label = windowLabel(block, order);

  const remove = useMutation({
    mutationFn: (cancelAffected: boolean) => {
      const { ranges, calendarIds } = rangesWithout(order, block.id);
      const clubMessage = clubMessageOf(message);
      return clubOrdersApi.update(order.id, clubMessage === undefined ? { ranges, calendarIds } : { ranges, calendarIds, clubMessage }, cancelAffected);
    },
    onSuccess: (saved) => {
      void invalidateClubWorld(queryClient);
      toast.success('Termín odebrán z objednávky');
      onRemoved(saved);
    },
    onError: (error) => {
      const e = error instanceof ClubOrderError ? error : new ClubOrderError('Termín se nepodařilo odebrat.');
      if (e.status === 409 && e.affectedAthletes.length > 0) {
        setFailure(null);
        setAffected({ message: e.message, list: e.affectedAthletes });
        return;
      }
      setAffected(null);
      setFailure(e.message);
    },
  });

  return (
    <Dialog open onClose={remove.isPending ? undefined : onClose} maxWidth="xs" fullWidth data-testid="remove-window-dialog">
      <DialogTitle>Odebrat termín z objednávky?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>Objednávka zůstane jedna — jen přijde o tento termín a čas se vrátí do nabídky.</Typography>
        <Box sx={{ mt: 2 }}>
          <ClubMessageField value={message} onChange={setMessage} disabled={remove.isPending} />
        </Box>
        {failure !== null ? <Alert severity="error" sx={{ mt: 1.5 }} data-testid="remove-window-failure">{failure}</Alert> : null}
        {affected !== null ? (
          <Alert severity="warning" role="alert" sx={{ mt: 1.5, alignItems: 'flex-start' }} data-testid="remove-window-affected">
            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{affected.message}</Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>{`Dotčení sportovci (${affected.list.length}):`}</Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, maxHeight: 200, overflowY: 'auto' }}>
              {affected.list.map((a, i) => (
                <li key={`${a.name}-${i}`}><Typography variant="body2">{[a.name, a.activityName].filter(Boolean).join(' — ')}</Typography></li>
              ))}
            </Box>
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={remove.isPending}>Ponechat</Button>
        <Button variant="contained" color="error" onClick={() => remove.mutate(affected !== null)} disabled={remove.isPending}>
          {affected !== null ? 'Zrušit rezervace těchto hráčů a odebrat termín' : 'Odebrat termín'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default RemoveWindowDialog;
