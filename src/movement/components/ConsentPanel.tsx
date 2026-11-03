/* The two separate consents of the movement module: care and model training. Each is its own switch. */
import { useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Skeleton, Stack, Switch, Typography } from '@mui/material';
import { usePermission } from '../../auth/usePermission';
import { CONSENT_TYPES, useMovementConsents, useSetConsent, type ConsentType } from '../../api/movement';
import { formatDate, useMoveT } from '../i18n';

export function ConsentPanel({ patientId }: { patientId: string }) {
  const { t } = useMoveT();
  const may = usePermission('movement.capture');
  const query = useMovementConsents(patientId);
  const set = useSetConsent(patientId);
  const [confirm, setConfirm] = useState<ConsentType | null>(null);

  if (query.isLoading) return <Skeleton variant="rounded" height={96} aria-busy />;
  if (query.isError) return <Alert severity="error" role="alert" action={<Button color="inherit" onClick={() => void query.refetch()} sx={{ minHeight: 44 }}>{t('action.retry')}</Button>}>{t('consent.load_error')}</Alert>;

  const rows = query.data ?? [];
  const toggle = (type: ConsentType, given: boolean) => {
    if (type === 'ml' && !given) { setConfirm('ml'); return; }
    set.mutate({ type, given });
  };

  return (
    <Stack spacing={1} data-testid="consent-panel">
      {CONSENT_TYPES.map((type) => {
        const row = rows.find((r) => r.type === type);
        const given = row?.given === true;
        const id = `movement-consent-${type}`;
        return (
          <Box key={type} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, minHeight: 44 }}>
            <Switch
              id={id}
              checked={given}
              disabled={!may || set.isPending}
              onChange={(e) => toggle(type, e.target.checked)}
              slotProps={{ input: { 'aria-describedby': `${id}-text` } }}
              sx={{ mt: 0.25, flexShrink: 0 }}
            />
            <Box component="label" htmlFor={id} sx={{ minWidth: 0, cursor: may ? 'pointer' : 'default' }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{t(`consent.${type}`)}</Typography>
              <Typography id={`${id}-text`} variant="body2" sx={{ color: 'text.secondary' }}>{t(`consent.${type}.text`)}</Typography>
              <Typography variant="caption" data-testid={`consent-state-${type}`} sx={{ color: given ? 'success.main' : 'text.secondary', fontWeight: 600 }}>
                {given && row ? t('consent.given', { when: row.at ? formatDate(row.at) : '–', version: row.version }) : t('consent.not_given')}
              </Typography>
            </Box>
          </Box>
        );
      })}
      {!may && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('consent.readonly')}</Typography>}
      {set.isError && <Alert severity="error" role="alert">{t('consent.error')}</Alert>}

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} aria-labelledby="movement-withdraw-title">
        <DialogTitle id="movement-withdraw-title">{t('consent.withdraw.title')}</DialogTitle>
        <DialogContent><DialogContentText>{t('consent.withdraw.text')}</DialogContentText></DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} sx={{ minHeight: 44 }}>{t('action.cancel')}</Button>
          <Button color="error" variant="contained" sx={{ minHeight: 44 }} onClick={() => { set.mutate({ type: 'ml', given: false }); setConfirm(null); }}>
            {t('consent.withdraw.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
