/*
 * "Pauza mezi vyšetřeními": how long after the end of one booking the system offers the next start. It is one
 * number for the whole clinic (0 = none), kept by `/api/v1/settings/booking-slots` and saved with its own button,
 * because it is a different setting from how the calendar is drawn. The range comes from the server.
 */
import { useState } from 'react';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SectionLabel, SoftCard } from '../../components/ui';
import { BOOKING_SLOTS_QUERY_KEY, readBookingSlots, saveBookingSlots } from '../../api/bookingSlots';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';

export function BookingSlotsCard() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: BOOKING_SLOTS_QUERY_KEY, queryFn: readBookingSlots, retry: false });
  const [text, setText] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (minutes: number) => saveBookingSlots({ examinationPauseMinutes: minutes }),
    onSuccess: (response) => {
      queryClient.setQueryData(BOOKING_SLOTS_QUERY_KEY, response);
      setText(null);
      setSaved(true);
    },
    onError: () => setSaved(false),
  });

  const data = query.data;
  const min = data?.minMinutes ?? 0;
  const max = data?.maxMinutes ?? 240;
  const current = text ?? String(data?.settings.examinationPauseMinutes ?? 0);
  const parsed = /^\d{1,4}$/.test(current.trim()) ? Number(current.trim()) : null;
  const rangeProblem = parsed === null || parsed < min || parsed > max ? `Zadejte celé číslo od ${min} do ${max}.` : undefined;
  const serverProblem = save.isError ? fieldErrorsOf(save.error).examinationPauseMinutes : undefined;
  const dirty = text !== null && parsed !== data?.settings.examinationPauseMinutes;

  return (
    <SoftCard data-testid="booking-slots-card" sx={{ mt: 2 }}>
      <Stack spacing={2}>
        <SectionLabel sx={{ mb: 0 }}>Nabídka termínů</SectionLabel>
        {query.isPending ? (
          <Typography variant="body2" color="text.secondary">Načítám…</Typography>
        ) : query.isError || data === undefined ? (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void query.refetch()}>Zkusit znovu</Button>}>
            Nastavení pauzy se nepodařilo načíst.
          </Alert>
        ) : (
          <>
            <TextField
              label="Pauza mezi vyšetřeními (min)"
              value={current}
              onChange={(event) => { setSaved(false); setText(event.target.value); }}
              error={dirty && (rangeProblem !== undefined || serverProblem !== undefined)}
              helperText={
                (dirty ? (serverProblem ?? rangeProblem) : undefined)
                ?? 'Systém nabídne další termín po této pauze od konce předchozí rezervace'
              }
              slotProps={{ htmlInput: { inputMode: 'numeric', min, max } }}
              sx={{ maxWidth: 320 }}
            />
            {save.isError && serverProblem === undefined ? (
              <Alert severity="error">{problemMessageOf(save.error, 'Nastavení se nepodařilo uložit.')}</Alert>
            ) : null}
            {saved && !save.isPending ? <Alert severity="success">Uloženo. Pauza platí pro nabídku termínů v celé ordinaci.</Alert> : null}
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                disabled={!dirty || rangeProblem !== undefined || save.isPending}
                onClick={() => { if (parsed !== null) save.mutate(parsed); }}
                sx={{ minHeight: 44 }}
              >
                Uložit pauzu
              </Button>
              {dirty ? <Button onClick={() => { setText(null); save.reset(); }} disabled={save.isPending} sx={{ minHeight: 44 }}>Zahodit</Button> : null}
            </Stack>
          </>
        )}
      </Stack>
    </SoftCard>
  );
}

export default BookingSlotsCard;
