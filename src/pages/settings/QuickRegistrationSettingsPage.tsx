/* ══════════════════════════════════════════════════════════════
   RYCHLÁ REGISTRACE  (route: /nastaveni/rychla-registrace)

   The receptionist books a slot first, enters four things and the patient gets
   a completion link. Three numbers/switches the clinic decides:

     expiryHours                      how long the link (and the reservation) holds
     reminderHoursBeforeExpiry        when a reminder is queued before that
     requireDateOfBirthOnCompletion   whether the patient must give a date of birth
                                      when completing the link

     GET/PUT /api/v1/settings/quick-registration      (contract C2)

   Nothing is sent: there is no e-mail or SMS provider, so a reminder is only
   queued. The screen says so, and says what happens at expiry, in the clinic's
   own numbers as they are typed.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { Alert, Box, FormControlLabel, InputAdornment, Stack, Switch, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  QUICK_REGISTRATION_QUERY_KEY, quickRegistrationSettingsApi, type QuickRegistrationSettings,
} from '../../api/quickRegistrationSettings';
import { useDevice, useIsPhone } from '../../layout/useDevice';
import { SoftCard } from '../../components/ui';
import { TYPE } from '../../components/settings/settingsStyle';
import { SettingsAsideCard, SettingsScreen } from './SettingsFrame';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';

const NBSP = ' ';

interface Draft {
  expiryHours: string;
  reminderHoursBeforeExpiry: string;
  requireDateOfBirthOnCompletion: boolean;
}
type TextField_ = 'expiryHours' | 'reminderHoursBeforeExpiry';

const toDraft = (s: QuickRegistrationSettings): Draft => ({
  expiryHours: String(s.expiryHours),
  reminderHoursBeforeExpiry: String(s.reminderHoursBeforeExpiry),
  requireDateOfBirthOnCompletion: s.requireDateOfBirthOnCompletion,
});

const whole = (text: string): number | null => {
  const t = text.replace(/\s/g, '');
  return /^\d+$/.test(t) && Number.isSafeInteger(Number(t)) ? Number(t) : null;
};

/** Czech count words: 1 hodina, 2–4 hodiny, 5 hodin. */
const plural = (n: number, one: string, few: string, many: string): string =>
  `${n}${NBSP}${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;
export const hoursText = (n: number): string => plural(n, 'hodina', 'hodiny', 'hodin');

/** "= 1 den", "= 1 den a 4 h", "= 30 dní"; under a day it says so. */
export function daysHelper(hours: number): string {
  if (hours < 24) return 'méně než jeden den';
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  const dayText = plural(days, 'den', 'dny', 'dní');
  return rest === 0 ? `= ${dayText}` : `= ${dayText} a${NBSP}${rest}${NBSP}h`;
}

export function validateQuickRegistration(draft: Draft): Partial<Record<TextField_, string>> {
  const errors: Partial<Record<TextField_, string>> = {};
  const expiry = whole(draft.expiryHours);
  if (expiry === null || expiry < 1 || expiry > 720) errors.expiryHours = 'Zadejte celý počet hodin od 1 do 720 (30 dní).';
  const reminder = whole(draft.reminderHoursBeforeExpiry);
  if (reminder === null) errors.reminderHoursBeforeExpiry = 'Zadejte celý počet hodin, 0 = bez připomínky.';
  else if (expiry !== null && expiry >= 1 && reminder > expiry) {
    errors.reminderHoursBeforeExpiry = `Připomínka může přijít nejvýš ${hoursText(expiry)} před vypršením — víc než trvá celá lhůta nejde.`;
  }
  return errors;
}

const serverFieldError = (errors: Record<string, string>, field: TextField_): string | undefined =>
  errors[field] ?? errors[field.charAt(0).toUpperCase() + field.slice(1)];

export default function QuickRegistrationSettingsPage() {
  const queryClient = useQueryClient();
  const device = useDevice();
  const phone = useIsPhone();

  const query = useQuery({ queryKey: QUICK_REGISTRATION_QUERY_KEY, queryFn: quickRegistrationSettingsApi.get, retry: false });
  const saved = query.data;

  const [edits, setEdits] = useState<Draft | null>(null);
  const draft: Draft | null = edits ?? (saved !== undefined ? toDraft(saved) : null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const save = useMutation({
    mutationFn: (settings: QuickRegistrationSettings) => quickRegistrationSettingsApi.put(settings),
    onSuccess: (next) => {
      queryClient.setQueryData(QUICK_REGISTRATION_QUERY_KEY, next);
      setEdits(null);
      setServerErrors({});
      setFailure(null);
      setAttempted(false);
      toast.success('Nastavení rychlé registrace uloženo');
    },
    onError: (error) => {
      setServerErrors(fieldErrorsOf(error));
      setFailure(problemMessageOf(error, 'Nastavení se nepodařilo uložit. Zkuste to prosím znovu.'));
    },
  });

  const dirty = saved !== undefined && edits !== null && JSON.stringify(edits) !== JSON.stringify(toDraft(saved));
  const clientErrors = draft === null ? {} : validateQuickRegistration(draft);
  const valid = Object.keys(clientErrors).length === 0;

  const submit = () => {
    setAttempted(true);
    if (draft === null || !valid) return;
    save.mutate({
      expiryHours: whole(draft.expiryHours) as number,
      reminderHoursBeforeExpiry: whole(draft.reminderHoursBeforeExpiry) as number,
      requireDateOfBirthOnCompletion: draft.requireDateOfBirthOnCompletion,
    });
  };
  const discard = () => { setEdits(null); setServerErrors({}); setFailure(null); setAttempted(false); };

  const edit = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    if (draft === null) return;
    setEdits({ ...draft, [field]: value });
    setServerErrors((e) => ({ ...e, [field]: '', [field.charAt(0).toUpperCase() + field.slice(1)]: '' }));
  };

  const fieldError = (field: TextField_): string | undefined => {
    const server = serverFieldError(serverErrors, field);
    if (server) return server;
    return attempted || dirty ? clientErrors[field] : undefined;
  };

  const expiry = draft === null ? null : whole(draft.expiryHours);
  const reminder = draft === null ? null : whole(draft.reminderHoursBeforeExpiry);
  const expiryOk = expiry !== null && expiry >= 1 && expiry <= 720;

  const explainer = draft === null ? null : (
    <Stack spacing={1.5}>
      <Typography sx={TYPE.itemName}>
        {expiryOk ? `Pacient má na dokončení ${hoursText(expiry)} od objednání.` : 'Pacient má na dokončení omezenou lhůtu od objednání.'}
      </Typography>
      <Typography sx={TYPE.caption}>
        <strong>Po vypršení:</strong> rezervace zanikne, termín se uvolní a provizorní záznam pacienta se smaže
        (jen když na něm nic dalšího nevisí).
      </Typography>
      <Typography sx={TYPE.caption}>
        <strong>Připomínka:</strong>{' '}
        {reminder === null || !expiryOk || reminder > expiry
          ? 'zadejte, kolik hodin před vypršením se zařadí.'
          : reminder === 0
            ? 'vypnutá.'
            : `zařadí se ${hoursText(reminder)} před vypršením.`}{' '}
        Zatím se nic neposílá automaticky — není napojený poskytovatel e-mailů ani SMS, odkaz předává recepce pacientovi ručně.
      </Typography>
      <Typography sx={TYPE.caption}>Platí jen pro rezervace vytvořené u přepážky. Online objednávky mají svůj vlastní postup.</Typography>
    </Stack>
  );

  return (
    <SettingsScreen
      title="Rychlá registrace"
      subtitle="Jak dlouho platí odkaz na dokončení registrace po objednání u přepážky a co se pak stane."
      scope="quick-registration"
      save={{ dirty, saving: save.isPending, onSave: submit, onDiscard: discard }}
      loading={draft === null && !query.isError}
      error={query.isError ? 'Nastavení rychlé registrace se nepodařilo načíst.' : undefined}
      onRetry={() => void query.refetch()}
      aside={device === 'desktop' && explainer !== null ? explainer : undefined}
      asideTitle="Co se stane"
    >
      {draft === null ? null : (
        <Stack spacing={2.5}>
          {failure !== null && <Alert severity="error">{failure}</Alert>}

          <SoftCard component="section" aria-labelledby="qr-lhuta">
            <Typography id="qr-lhuta" component="h2" sx={TYPE.sectionTitle}>Lhůta na dokončení</Typography>
            <Typography sx={[TYPE.caption, { mt: 0.5, mb: 2 }]}>Od objednání u přepážky běží hodiny. Pacient musí registraci dokončit včas.</Typography>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: phone ? '1fr' : 'repeat(2, minmax(0, 1fr))', alignItems: 'start' }}>
              <TextField
                label="Platnost odkazu"
                value={draft.expiryHours}
                onChange={(e) => edit('expiryHours', e.target.value)}
                error={fieldError('expiryHours') !== undefined}
                helperText={fieldError('expiryHours') ?? (expiryOk ? daysHelper(expiry) : 'Od 1 do 720 hodin.')}
                size={phone ? 'medium' : 'small'}
                fullWidth
                slotProps={{ htmlInput: { inputMode: 'numeric' }, input: { endAdornment: <InputAdornment position="end">hodin</InputAdornment> } }}
              />
              <TextField
                label="Připomínka před vypršením"
                value={draft.reminderHoursBeforeExpiry}
                onChange={(e) => edit('reminderHoursBeforeExpiry', e.target.value)}
                error={fieldError('reminderHoursBeforeExpiry') !== undefined}
                helperText={fieldError('reminderHoursBeforeExpiry') ?? 'Kolik hodin před koncem se připomínka zařadí. 0 = bez připomínky.'}
                size={phone ? 'medium' : 'small'}
                fullWidth
                slotProps={{ htmlInput: { inputMode: 'numeric' }, input: { endAdornment: <InputAdornment position="end">hodin</InputAdornment> } }}
              />
            </Box>
          </SoftCard>

          <SoftCard component="section" aria-labelledby="qr-datum">
            <Typography id="qr-datum" component="h2" sx={TYPE.sectionTitle}>Datum narození</Typography>
            <Typography sx={[TYPE.caption, { mt: 0.5, mb: 1 }]}>
              Rychlá registrace u přepážky datum narození nikdy nežádá. Tady rozhodnete, zda ho pacient musí vyplnit při dokončení přes odkaz.
            </Typography>
            <FormControlLabel
              sx={{ minHeight: 44, m: 0 }}
              control={<Switch checked={draft.requireDateOfBirthOnCompletion} onChange={(e) => edit('requireDateOfBirthOnCompletion', e.target.checked)} />}
              label="Při dokončení vyžadovat datum narození"
            />
          </SoftCard>

          {device !== 'desktop' && explainer !== null && (
            <SettingsAsideCard title="Co se stane">{explainer}</SettingsAsideCard>
          )}
        </Stack>
      )}
    </SettingsScreen>
  );
}
