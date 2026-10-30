/*
 * One switch: every e-mail about a termín carries the patient's own "Změnit nebo zrušit termín" button, so a patient
 * moves or cancels by a click instead of calling the desk. On by default; saved the moment it is flipped.
 */
import { Alert, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { emailLayoutApi } from '../../../api/emailLayout';
import { errorText } from '../../../components/booking/errorText';

const KEY = ['email-self-service'];

export function SelfServiceSwitch({ onToast }: { onToast: (text: string) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: KEY, queryFn: emailLayoutApi.selfService, retry: false });
  const save = useMutation({
    mutationFn: emailLayoutApi.saveSelfService,
    onSuccess: (enabled) => {
      queryClient.setQueryData(KEY, enabled);
      onToast(enabled ? 'Pacienti dostanou v e-mailu tlačítko Změnit nebo zrušit termín.' : 'Tlačítko Změnit nebo zrušit termín se v e-mailech nezobrazí.');
    },
  });

  if (query.isError) return <Alert severity="info">Tohle nastavení půjde změnit po nasazení nové verze serveru.</Alert>;

  return (
    <Stack spacing={1} sx={{ p: 2 }}>
      <FormControlLabel
        control={(
          <Switch
            checked={query.data ?? true}
            disabled={query.isPending || save.isPending}
            onChange={(e) => save.mutate(e.target.checked)}
          />
        )}
        label="Pacient může termín sám změnit nebo zrušit přes tlačítko v e-mailu"
        sx={{ minHeight: 44 }}
      />
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Každý e-mail o termínu dostane osobní tlačítko „Změnit nebo zrušit termín“. Pacient nemusí volat a vy nemusíte nic přepisovat.
      </Typography>
      {save.error != null ? <Alert severity="error">{errorText(save.error, t)}</Alert> : null}
    </Stack>
  );
}
