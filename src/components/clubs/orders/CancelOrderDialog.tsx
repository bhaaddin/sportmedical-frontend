/*
 * "Zrušit objednávku?" - the one way to drop a whole club order (all its windows). Optionally cancels the athletes'
 * bookings too. The server's 409 `club_order.addenda_live` lists the addenda that still hold places; the desk then
 * confirms cancelling them together. Used by the order detail and by the club page's order card.
 * Etapa 11: an optional "Zpráva pro klub" travels with the cancellation (`clubMessage`) into the club's portal.
 */
import { useState } from 'react';
import { invalidateClubWorld } from '../clubWorld';
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ClubOrderError, clubOrdersApi, ORDER_STATUS_LABEL } from '../../../api/clubOrders';
import type { ClubOrderView, OrderAddendumSummary } from '../../../api/clubOrders';
import { orderCode } from '../order/orderFormat';
import { ClubMessageField, clubMessageOf } from './ClubMessageField';

export function CancelOrderDialog({ order, onClose, onCancelled }: {
  order: Pick<ClubOrderView, 'id' | 'clubName' | 'registered'>;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const queryClient = useQueryClient();
  const [cancelAthletes, setCancelAthletes] = useState(false);
  const [liveAddenda, setLiveAddenda] = useState<OrderAddendumSummary[] | null>(null);
  const [message, setMessage] = useState('');

  const cancel = useMutation({
    mutationFn: (withAddenda: boolean) => {
      const clubMessage = clubMessageOf(message);
      return clubMessage === undefined
        ? clubOrdersApi.cancel(order.id, cancelAthletes, withAddenda)
        : clubOrdersApi.cancel(order.id, cancelAthletes, withAddenda, clubMessage);
    },
    onSuccess: () => {
      void invalidateClubWorld(queryClient);
      toast.success('Objednávka zrušena');
      onCancelled();
    },
    onError: (e) => {
      /* 409 club_order.addenda_live: nothing was cancelled; list the addenda and let the desk confirm explicitly. */
      if (e instanceof ClubOrderError && e.code === 'club_order.addenda_live') {
        setLiveAddenda(e.addenda);
        return;
      }
      toast.error(e instanceof Error ? e.message : 'Objednávku se nepodařilo zrušit');
    },
  });

  return liveAddenda === null ? (
    <Dialog open onClose={cancel.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Zrušit objednávku?</DialogTitle>
      <DialogContent>
        <Typography variant="body2">Objednávka klubu {order.clubName} bude zrušena a uvolní se všechny její termíny v kalendáři.</Typography>
        {order.registered > 0 ? (
          <FormControlLabel
            sx={{ mt: 1 }}
            control={<Checkbox checked={cancelAthletes} onChange={(e) => setCancelAthletes(e.target.checked)} />}
            label={`Zrušit i jejich rezervace (${order.registered})`}
          />
        ) : null}
        <Box sx={{ mt: 2 }}>
          <ClubMessageField value={message} onChange={setMessage} disabled={cancel.isPending} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={cancel.isPending}>Ponechat</Button>
        <Button variant="contained" color="error" onClick={() => cancel.mutate(false)} disabled={cancel.isPending}>Ano, zrušit</Button>
      </DialogActions>
    </Dialog>
  ) : (
    <Dialog open onClose={cancel.isPending ? undefined : onClose} maxWidth="xs" fullWidth data-testid="addenda-live-dialog">
      <DialogTitle>Objednávka má platné dodatky</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1 }}>Nic nebylo zrušeno. Tyto dodatky stále platí:</Typography>
        <Stack component="ul" sx={{ m: 0, pl: 2.5 }} data-testid="addenda-live-list">
          {liveAddenda.map((a) => (
            <li key={a.id}><Typography variant="body2">{`${orderCode(a.id)} · ${a.serviceName} · ${a.totalSeats} míst · ${ORDER_STATUS_LABEL[a.status]}`}</Typography></li>
          ))}
        </Stack>
        <Typography variant="body2" sx={{ mt: 1 }}>Zrušte je zvlášť, nebo potvrďte zrušení celé objednávky i s dodatky.</Typography>
        <Box sx={{ mt: 2 }}>
          <ClubMessageField value={message} onChange={setMessage} disabled={cancel.isPending} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={cancel.isPending}>Ponechat</Button>
        <Button variant="contained" color="error" onClick={() => cancel.mutate(true)} disabled={cancel.isPending}>Zrušit i dodatky</Button>
      </DialogActions>
    </Dialog>
  );
}

export default CancelOrderDialog;
