/*
 * "Pracovník dělá jen jednu věc najednou" (Stage 2, R4): the clinic-wide switch behind the shared-worker rule, and the people it does not
 * apply to. Kept by `/api/v1/settings/booking-slots` (`singleWorkerAtATime`, `workerExceptions`) and saved with its own button.
 *
 * ON  - a worker booked in one služba / činnost is unavailable for any other at the same time: in the offers of free times, in a new
 *       booking, in a move, in the club blocks; the calendar draws the clash in the other column and says why. The owner or an
 *       administrator may override it with a reason (the reason is written into the history).
 * OFF - today's behaviour.
 * Exceptions - people who may hold two things at once (they take no worker slot).
 *
 * The card is drawn only when the server has the setting: an older server answers without the fields and the card stays away
 * rather than offering a switch that does nothing.
 */
import { useState } from 'react';
import { Alert, Button, Checkbox, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SectionLabel, SoftCard } from '../../components/ui';
import { BOOKING_SLOTS_QUERY_KEY, hasSingleWorkerSetting, readBookingSlots, saveBookingSlots } from '../../api/bookingSlots';
import { userAccountsApi, type UserAccount } from '../../api/userAccounts';
import { problemMessageOf } from './settingsProblem';

export const SINGLE_WORKER_TEXT = {
  section: 'Sdílený pracovník',
  switchLabel: 'Pracovník dělá jen jednu věc najednou',
  switchHelp:
    'Zapnuto: pracovník, který je v jednom kalendáři objednaný, je ve stejný čas nedostupný pro jakoukoli jinou službu a činnost - v nabídce termínů, při objednání, při přesunu i u klubových bloků. Kalendář kolizi ukáže ve druhém sloupci. Vypnuto: platí to, co dosud.',
  exceptions: 'Výjimky',
  exceptionsHelp: 'Tito lidé smějí dělat dvě věci najednou, pravidlo se na ně nevztahuje.',
  noPeople: 'Seznam zaměstnanců se nepodařilo načíst.',
  save: 'Uložit pravidlo',
  discard: 'Zahodit',
  saved: 'Uloženo. Pravidlo platí v celé ordinaci.',
  loadFailed: 'Nastavení sdíleného pracovníka se nepodařilo načíst.',
} as const;

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

export function SingleWorkerCard() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: BOOKING_SLOTS_QUERY_KEY, queryFn: readBookingSlots, retry: false });
  const people = useQuery({ queryKey: ['users', 'for-exceptions'], queryFn: userAccountsApi.list, retry: false, enabled: hasSingleWorkerSetting(query.data?.settings) });
  const [on, setOn] = useState<boolean | null>(null);
  const [exempt, setExempt] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (input: { singleWorkerAtATime: boolean; workerExceptions: string[] }) => saveBookingSlots(input),
    onSuccess: (response) => {
      queryClient.setQueryData(BOOKING_SLOTS_QUERY_KEY, response);
      setOn(null);
      setExempt(null);
      setSaved(true);
    },
    onError: () => setSaved(false),
  });

  const settings = query.data?.settings;
  if (query.isPending) return null;
  if (query.isError) {
    return (
      <SoftCard data-testid="single-worker-card" sx={{ mt: 2 }}>
        <Alert severity="error">{SINGLE_WORKER_TEXT.loadFailed}</Alert>
      </SoftCard>
    );
  }
  /* an older server: no switch to offer */
  if (!hasSingleWorkerSetting(settings)) return null;

  const storedOn = settings?.singleWorkerAtATime === true;
  const storedExempt = settings?.workerExceptions ?? [];
  const currentOn = on ?? storedOn;
  const currentExempt = exempt ?? storedExempt;
  const dirty = (on !== null && on !== storedOn) || (exempt !== null && !sameList(exempt, storedExempt));
  const list: UserAccount[] = (people.data ?? []).filter((u) => u.isActive);
  /* an exempt id the list does not know (a deleted account) stays in the list the server holds */
  const toggle = (id: string) => {
    setSaved(false);
    setExempt(currentExempt.includes(id) ? currentExempt.filter((x) => x !== id) : [...currentExempt, id]);
  };

  return (
    <SoftCard data-testid="single-worker-card" sx={{ mt: 2 }}>
      <Stack spacing={2}>
        <SectionLabel sx={{ mb: 0 }}>{SINGLE_WORKER_TEXT.section}</SectionLabel>
        <div>
          <FormControlLabel
            control={<Switch checked={currentOn} onChange={(event) => { setSaved(false); setOn(event.target.checked); }} slotProps={{ input: { 'aria-label': SINGLE_WORKER_TEXT.switchLabel } }} />}
            label={SINGLE_WORKER_TEXT.switchLabel}
          />
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', ml: 6 }}>{SINGLE_WORKER_TEXT.switchHelp}</Typography>
        </div>
        <div data-testid="worker-exceptions" aria-disabled={!currentOn}>
          <Typography sx={{ fontWeight: 700 }}>{SINGLE_WORKER_TEXT.exceptions}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{SINGLE_WORKER_TEXT.exceptionsHelp}</Typography>
          {people.isError ? (
            <Alert severity="warning">{SINGLE_WORKER_TEXT.noPeople}</Alert>
          ) : (
            <Stack>
              {list.map((u) => (
                <FormControlLabel
                  key={u.userId}
                  control={<Checkbox checked={currentExempt.includes(u.userId)} onChange={() => toggle(u.userId)} disabled={!currentOn} />}
                  label={u.displayName || u.email}
                />
              ))}
              {people.isSuccess && list.length === 0 ? <Typography variant="body2" color="text.secondary">Žádní aktivní zaměstnanci.</Typography> : null}
            </Stack>
          )}
        </div>
        {save.isError ? <Alert severity="error">{problemMessageOf(save.error, 'Nastavení se nepodařilo uložit.')}</Alert> : null}
        {saved && !save.isPending ? <Alert severity="success">{SINGLE_WORKER_TEXT.saved}</Alert> : null}
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate({ singleWorkerAtATime: currentOn, workerExceptions: currentExempt })}
            sx={{ minHeight: 44 }}
          >
            {SINGLE_WORKER_TEXT.save}
          </Button>
          {dirty ? <Button onClick={() => { setOn(null); setExempt(null); save.reset(); }} disabled={save.isPending} sx={{ minHeight: 44 }}>{SINGLE_WORKER_TEXT.discard}</Button> : null}
        </Stack>
      </Stack>
    </SoftCard>
  );
}

export default SingleWorkerCard;
