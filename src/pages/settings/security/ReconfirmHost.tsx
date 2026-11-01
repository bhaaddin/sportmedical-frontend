/*
 * "Potvrďte, že jste to vy": the window that asks an administrator for the password (and the code from the authenticator app,
 * when the account has one) before the server lets a protected request through.
 *
 * Mounted once in the shell. It registers itself with the HTTP client (auth/adminChallenge.ts): when the server answers
 * 403 `reconfirm_required`, the client asks here, waits for the answer and sends the request again. The Administrace gate
 * (AdminGate) opens the same window from its own buttons.
 *
 * The password and the code live in this window's fields only for as long as it is open; they are sent in one request and
 * never kept, logged or put in an address.
 */
import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { registerReconfirmAsker } from '../../../auth/adminChallenge';
import { RECONFIRM_QUERY_KEY, postReconfirm } from '../../../api/securityPolicy';
import { twoFactorApi } from '../../../api/twoFactor';
import { problemMessageOf } from '../settingsProblem';

export function ReconfirmDialog({ open, onDone }: { open: boolean; onDone: (confirmed: boolean) => void }) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const status = useQuery({ queryKey: ['two-factor-status'], queryFn: twoFactorApi.status, enabled: open, staleTime: 60_000 });
  const needsCode = status.data?.enabled === true;

  useEffect(() => {
    if (open) { setPassword(''); setCode(''); }
  }, [open]);

  const confirm = useMutation({
    mutationFn: () => postReconfirm({ password, code: needsCode && code.trim() !== '' ? code.trim() : null }),
    onSuccess: (state) => {
      queryClient.setQueryData(RECONFIRM_QUERY_KEY, state);
      setPassword('');
      setCode('');
      onDone(true);
    },
  });

  const ready = password !== '' && (!needsCode || code.trim().length >= 6) && !confirm.isPending;

  return (
    <Dialog
      open={open}
      onClose={confirm.isPending ? undefined : () => onDone(false)}
      maxWidth="xs"
      fullWidth
      slotProps={{ transition: { onExited: () => confirm.reset() } }}
    >
      <form
        onSubmit={(event) => { event.preventDefault(); if (ready) confirm.mutate(); }}
        aria-label="Potvrďte, že jste to vy"
      >
        <DialogTitle>Potvrďte, že jste to vy</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Tahle část je chráněná. Zadejte své heslo{needsCode ? ' a kód z ověřovací aplikace' : ''}.
          </Typography>
          <TextField
            autoFocus
            type="password"
            label="Heslo"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            fullWidth
          />
          {needsCode && (
            <TextField
              label="Kód z aplikace"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              fullWidth
              slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 10 } }}
            />
          )}
          {confirm.isError && (
            <Alert severity="error">{problemMessageOf(confirm.error, 'Heslo nebo kód nesedí. Zkuste to znovu.')}</Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button type="button" variant="outlined" onClick={() => onDone(false)} disabled={confirm.isPending} sx={{ minHeight: 44 }}>
            Zrušit
          </Button>
          <Button type="submit" variant="contained" disabled={!ready} sx={{ minHeight: 44 }}>
            {confirm.isPending ? 'Ověřuji…' : 'Potvrdit'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default function ReconfirmHost() {
  const [pending, setPending] = useState<((confirmed: boolean) => void) | null>(null);

  useEffect(
    () => registerReconfirmAsker(() => new Promise<boolean>((resolve) => { setPending(() => resolve); })),
    [],
  );

  /* Nothing is drawn (and no query client needed) until somebody asks. */
  if (pending === null) return null;
  return (
    <ReconfirmDialog
      open
      onDone={(confirmed) => {
        pending?.(confirmed);
        setPending(null);
      }}
    />
  );
}
