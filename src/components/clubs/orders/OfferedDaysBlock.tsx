/*
 * Etapa 8: the order detail's "Nabídnuté dny" - what the desk offered the club, what the club chose out of it
 * ("Klub vybral: 12., 13., 15. října"), and an editor (same calendar as the invite) that saves with PUT offered-dates.
 * Shown while the order is Invited or Requested; the processing flow itself is untouched.
 */
import { useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clubOrdersApi } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';
import { useIsPhone } from '../../../layout/useDevice';
import { SectionLabel, SoftCard } from '../../ui';
import { OfferedDaysEditor } from './OfferedDaysEditor';
import { dayText, daysText } from './dayOffer';

export function OfferedDaysBlock({ order, onChanged }: { order: ClubOrderView; onChanged: () => void }) {
  const phone = useIsPhone();
  const offered = order.offeredDates ?? [];
  const chosen = order.requestedDates ?? [];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const year = new Date().getFullYear();

  const save = useMutation({
    mutationFn: () => clubOrdersApi.setOfferedDates(order.id, draft),
    onSuccess: () => {
      toast.success(draft.length === 0 ? 'Nabídka dnů zrušena' : 'Nabídka dnů uložena');
      setEditing(false);
      onChanged();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Nabídku se nepodařilo uložit.'),
  });

  if (order.status !== 'Invited' && order.status !== 'Requested') return null;
  const chosenSet = new Set(chosen);

  return (
    <SoftCard sx={{ p: 2 }} data-testid="offered-days-block">
      <SectionLabel>Nabídnuté dny</SectionLabel>
      {offered.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Klubu nic nenabízíte — termín zvolil sám.</Typography>
      ) : (
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 0.75 }} data-testid="order-offered-chips">
          {offered.map((d) => (
            <li key={d}><Chip size="small" label={dayText(d, year)} color={chosenSet.has(d) ? 'primary' : 'default'} variant={chosenSet.has(d) ? 'filled' : 'outlined'} /></li>
          ))}
        </Box>
      )}
      {chosen.length > 0 ? (
        <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }} data-testid="order-club-chose">
          Klub vybral: {daysText(chosen)}
          {offered.length > 0 ? ` (${chosen.length} z ${offered.length} nabídnutých)` : ''}
        </Typography>
      ) : null}
      <Button size="small" variant="outlined" sx={{ mt: 1.5, minHeight: 44 }} data-testid="offered-edit" onClick={() => { setDraft(offered); setError(null); setEditing(true); }}>
        {offered.length === 0 ? 'Nabídnout dny' : 'Upravit nabídku'}
      </Button>

      <Dialog open={editing} onClose={save.isPending ? undefined : () => setEditing(false)} fullWidth maxWidth="sm" fullScreen={phone}>
        <DialogTitle>Nabídnout klubu dny k výběru</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}><OfferedDaysEditor value={draft} onChange={setDraft} /></Box>
          {error !== null ? <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setEditing(false)} disabled={save.isPending}>Zavřít</Button>
          <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>Uložit nabídku</Button>
        </DialogActions>
      </Dialog>
    </SoftCard>
  );
}

export default OfferedDaysBlock;
