/*
 * "Napsat klubu": a short note (max 500) that the club reads in its portal under "Změny od ordinace". Sent to
 * `POST /club-orders/{id}/notice`; the answer is the order with the new history entry, which the detail shows
 * under "Co vidí klub".
 */
import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clubOrdersApi } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';
import { invalidateClubWorld } from '../clubWorld';
import { ClubMessageField } from './ClubMessageField';

export function WriteToClubDialog({ order, onClose, onSent }: {
  order: Pick<ClubOrderView, 'id' | 'clubName'>;
  onClose: () => void;
  onSent: (order: ClubOrderView) => void;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const trimmed = text.trim();

  const send = useMutation({
    mutationFn: () => clubOrdersApi.notice(order.id, trimmed),
    onSuccess: (saved) => {
      queryClient.setQueryData(['club-order', order.id], saved);
      void invalidateClubWorld(queryClient);
      toast.success('Zpráva je v portálu klubu');
      onSent(saved);
    },
    onError: (e) => setFailure(e instanceof Error ? e.message : 'Zprávu se nepodařilo odeslat.'),
  });

  return (
    <Dialog open onClose={send.isPending ? undefined : onClose} maxWidth="xs" fullWidth data-testid="write-to-club-dialog" aria-labelledby="write-to-club-title">
      <DialogTitle id="write-to-club-title">Napsat klubu</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {`Klub ${order.clubName} si zprávu přečte ve svém portálu v části „Změny od ordinace“. E-mail se neodesílá.`}
        </Typography>
        <ClubMessageField
          value={text}
          onChange={(v) => { setText(v); setFailure(null); }}
          disabled={send.isPending}
          label="Zpráva pro klub"
          hint="Zobrazí se v portálu klubu."
          testId="write-to-club-text"
        />
        {failure !== null ? <Alert severity="error" sx={{ mt: 1.5 }} data-testid="write-to-club-failure">{failure}</Alert> : null}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={send.isPending} sx={{ minHeight: 44 }}>Zavřít</Button>
        <Button variant="contained" onClick={() => send.mutate()} disabled={trimmed === '' || send.isPending} sx={{ minHeight: 44 }}>
          {send.isPending ? 'Odesílám…' : 'Odeslat'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default WriteToClubDialog;
