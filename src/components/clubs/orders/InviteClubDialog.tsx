/*
 * "Poslat odkaz klubu": the desk picks a club (and maybe a service and a note), the order is created as
 * Invited and its form link is shown short and big, with a one-click "Zkopírovat". Nothing is e-mailed - the desk
 * sends the link itself. The address is built by `absoluteLink` (the admin-set public address, never the long
 * preview address of the staff app).
 */
import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { clubsApi } from '../../../api/clubs';
import { clinicServicesApi } from '../../../api/clinicServices';
import { clubOrdersApi } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';
import { useIsPhone } from '../../../layout/useDevice';
import { LinkCopyRow } from './LinkCopyRow';

export { copyText } from './LinkCopyRow';

export function InviteClubDialog({ open, onClose, defaultClubId, onInvited }: {
  open: boolean;
  onClose: () => void;
  defaultClubId?: string;
  onInvited?: (order: ClubOrderView) => void;
}) {
  const phone = useIsPhone();
  const [clubId, setClubId] = useState(defaultClubId ?? '');
  const [serviceId, setServiceId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<ClubOrderView | null>(null);

  const clubsQuery = useQuery({
    queryKey: ['clubs'],
    queryFn: async () => { const l = await clubsApi.getAll(false); return Array.isArray(l) ? l : []; },
    enabled: open,
  });
  const servicesQuery = useQuery({ queryKey: ['clinic-services'], queryFn: () => clinicServicesApi.list(), enabled: open });
  const clubs = (clubsQuery.data ?? []).filter((c) => c.isActive);
  const services = (servicesQuery.data ?? []).filter((s) => s.isActive);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const order = await clubOrdersApi.invite({
        clubId,
        ...(serviceId !== '' ? { serviceId } : {}),
        ...(note.trim() !== '' ? { note: note.trim() } : {}),
      });
      setCreated(order);
      onInvited?.(order);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Formulář se nepodařilo vytvořit.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={phone}>
      <DialogTitle>Poslat odkaz klubu</DialogTitle>
      <DialogContent>
        {created === null ? (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select size="small" label="Klub" value={clubId} onChange={(e) => setClubId(e.target.value)}>
              {clubs.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Služba (nepovinné)" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <MenuItem value="">Klub si vybere sám</MenuItem>
              {services.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
            <TextField size="small" label="Poznámka (nepovinné)" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Nic se neodesílá e-mailem — odkaz vám zobrazíme a pošlete ho klubu sami.
            </Typography>
            {error !== null ? <Alert severity="error">{error}</Alert> : null}
          </Stack>
        ) : (
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Typography sx={{ fontWeight: 600 }}>Odkaz pro {created.clubName} je připravený.</Typography>
            <LinkCopyRow label="Odkaz na formulář pro klub" path={created.formUrl} testId="invite-link" big />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Klub vyplní, co potřebuje, a objednávka vám přijde ke zpracování.
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {created === null ? (
          <>
            <Button variant="outlined" onClick={onClose} disabled={busy}>Zavřít</Button>
            <Button variant="contained" disabled={clubId === '' || busy} onClick={() => void submit()}>Vytvořit odkaz</Button>
          </>
        ) : (
          <Button variant="outlined" onClick={onClose}>Hotovo</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default InviteClubDialog;
