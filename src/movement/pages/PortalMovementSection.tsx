/* The patient's own part of the movement module, in their portal: the model-training consent they give and withdraw themselves.
   The reports come in the ordinary document list. The section draws nothing when the server has the module off (it answers 404). */
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { getPortalConsent, grantPortalConsent, withdrawPortalConsent, type PortalConsent } from '../../api/movement';
import { useMoveT } from '../i18n';

export default function PortalMovementSection({ token, wrap }: { token: string; wrap: (children: ReactNode) => ReactNode }) {
  const { t } = useMoveT();
  const [state, setState] = useState<PortalConsent | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    getPortalConsent(token).then((c) => { if (live) setState(c); }).catch(() => undefined);
    return () => { live = false; };
  }, [token]);

  if (state === null) return null;
  const on = state.mlTraining?.active === true;
  const change = async (give: boolean) => {
    setBusy(true);
    setFailed(false);
    try { setState(give ? await grantPortalConsent(token) : await withdrawPortalConsent(token)); } catch { setFailed(true); } finally { setBusy(false); }
  };

  return wrap(
    <Stack spacing={1.5} data-testid="portal-movement">
      <Typography sx={{ fontSize: 14 }}>{t('portal.text')}</Typography>
      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{t('portal.ml')}</Typography>
        <Typography sx={{ fontSize: 14, mt: 0.5 }}>{t('portal.ml.text')}</Typography>
      </Box>
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }} role="group" aria-label={t('portal.ml')}>
        <Button variant={on ? 'contained' : 'outlined'} aria-pressed={on} disabled={busy} onClick={() => void change(true)} sx={{ minHeight: 44 }}>{t('portal.ml.on')}</Button>
        <Button variant={!on ? 'contained' : 'outlined'} aria-pressed={!on} disabled={busy} onClick={() => void change(false)} sx={{ minHeight: 44 }}>{t('portal.ml.off')}</Button>
      </Stack>
      {!state.careActive && <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('portal.care.missing')}</Typography>}
      {failed && <Alert severity="error" role="alert">{t('portal.error')}</Alert>}
    </Stack>,
  );
}
