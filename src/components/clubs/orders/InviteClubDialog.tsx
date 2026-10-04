/*
 * "Poslat formulář klubu": the desk picks a club (and maybe a service and a note), the order is created as
 * Invited and its form link is shown big, to copy. Nothing is e-mailed - the desk sends the link itself.
 */
import { useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clubsApi } from '../../../api/clubs';
import { clinicServicesApi } from '../../../api/clinicServices';
import { clubOrdersApi } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';
import { useIsPhone } from '../../../layout/useDevice';

export async function copyText(text: string, ok = 'Odkaz zkopírován'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(ok);
  } catch {
    toast.error('Odkaz se nepodařilo zkopírovat');
  }
}

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
      <DialogTitle>Poslat formulář klubu</DialogTitle>
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
              Nic se neodesílá e-mailem — odkaz na formulář vám zobrazíme a pošlete ho klubu sami.
            </Typography>
            {error !== null ? <Alert severity="error">{error}</Alert> : null}
          </Stack>
        ) : (
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Typography sx={{ fontWeight: 600 }}>Formulář pro {created.clubName} je připravený.</Typography>
            <Box
              data-testid="invite-link"
              sx={{ p: 1.75, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', bgcolor: 'background.default', fontFamily: 'monospace', fontSize: 15, wordBreak: 'break-all' }}
            >
              {created.formUrl || 'Odkaz zatím není k dispozici.'}
            </Box>
            <Button variant="contained" startIcon={<ContentCopy />} disabled={created.formUrl === ''} onClick={() => void copyText(created.formUrl)} sx={{ minHeight: 44 }}>
              Kopírovat
            </Button>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {created === null ? (
          <>
            <Button variant="outlined" onClick={onClose} disabled={busy}>Zavřít</Button>
            <Button variant="contained" disabled={clubId === '' || busy} onClick={() => void submit()}>Vytvořit formulář</Button>
          </>
        ) : (
          <Button variant="contained" onClick={onClose}>Hotovo</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default InviteClubDialog;
