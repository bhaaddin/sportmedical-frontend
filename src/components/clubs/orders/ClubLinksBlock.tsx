/*
 * "Odkazy": the two links of one club order, each shown ONCE - the club's portal link (`portalUrl`, else `formUrl`; the form while the
 * order is an invitation, the portal afterwards) and the players' / parents' link (`registrationUrl`, once the order
 * is confirmed). "Vygenerovat nový odkaz" issues new ones (`rotate-links`); the old ones stop working, so it asks first.
 */
import { useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clubOrdersApi } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';
import { invalidateClubWorld } from '../clubWorld';
import { LinkCopyRow } from './LinkCopyRow';

export function RotateLinksDialog({ order, onClose, onRotated }: {
  order: Pick<ClubOrderView, 'id'>;
  onClose: () => void;
  onRotated: (order: ClubOrderView) => void;
}) {
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<string | null>(null);
  const rotate = useMutation({
    mutationFn: () => clubOrdersApi.rotateLinks(order.id),
    onSuccess: (saved) => {
      queryClient.setQueryData(['club-order', order.id], saved);
      void invalidateClubWorld(queryClient);
      toast.success('Nový odkaz je vygenerován');
      onRotated(saved);
    },
    onError: (e) => setFailure(e instanceof Error ? e.message : 'Nový odkaz se nepodařilo vygenerovat.'),
  });
  return (
    <Dialog open onClose={rotate.isPending ? undefined : onClose} maxWidth="xs" fullWidth data-testid="rotate-links-dialog" aria-labelledby="rotate-links-title">
      <DialogTitle id="rotate-links-title">Vygenerovat nový odkaz?</DialogTitle>
      <DialogContent>
        <Typography variant="body2">Starý odkaz přestane fungovat. Pokračovat?</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          Platí to i pro odkaz pro hráče a rodiče. Nové odkazy pošlete klubu znovu.
        </Typography>
        {failure !== null ? <Alert severity="error" sx={{ mt: 1.5 }} data-testid="rotate-links-failure">{failure}</Alert> : null}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={rotate.isPending} sx={{ minHeight: 44 }}>Ponechat</Button>
        <Button variant="contained" color="error" onClick={() => rotate.mutate()} disabled={rotate.isPending} sx={{ minHeight: 44 }}>
          {rotate.isPending ? 'Generuji…' : 'Vygenerovat nový'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ClubLinksBlock({ order }: { order: ClubOrderView }) {
  const [confirming, setConfirming] = useState(false);
  const players = order.registrationUrl !== '' && (order.status === 'Confirmed' || order.status === 'Completed');
  const clubPath = (order.portalUrl ?? '') !== '' ? (order.portalUrl as string) : order.formUrl;
  const canRotate = order.status !== 'Cancelled';
  return (
    <Stack spacing={1.5} data-testid="club-links">
      {order.linksStale === true ? (
        <Alert severity="warning" data-testid="links-stale">
          Odkazy této objednávky nelze zobrazit (změnil se podpisový klíč serveru). Odkazy, které klub už má, fungují dál; pro zobrazení vygenerujte nové.
        </Alert>
      ) : null}
      <LinkCopyRow
        label={order.status === 'Invited' ? 'Odkaz pro klub (formulář objednávky)' : 'Odkaz pro klub (portál klubu)'}
        path={clubPath}
        testId="club-portal-url"
      />
      {players ? <LinkCopyRow label="Odkaz pro hráče a rodiče (registrace)" path={order.registrationUrl} testId="players-url" /> : null}
      {canRotate ? (
        <Box>
          <Button variant="outlined" size="small" onClick={() => setConfirming(true)} data-testid="rotate-links" sx={{ minHeight: 44 }}>Vygenerovat nový odkaz</Button>
        </Box>
      ) : null}
      {confirming ? <RotateLinksDialog order={order} onClose={() => setConfirming(false)} onRotated={() => setConfirming(false)} /> : null}
    </Stack>
  );
}

export default ClubLinksBlock;
