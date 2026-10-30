/* ══════════════════════════════════════════════════════════════
   LHŮTA PRO ZMĚNY A DOCHÁZKA  (routes: /nastaveni/zmeny-rezervaci, /nastaveni/dochazka)

   Two clinic rules that had a server and no screen: how long before the start a patient may still move or cancel
   through his link, and after how many minutes a booking that is still "Objednán" is flagged "asi nepřišel".
   One number each; the bounds and the default come from the server. A server that does not have the route yet
   (404) gets a calm note instead of a form.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { Alert, Box, Button, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ATTENDANCE_KEY, BOOKING_CHANGES_KEY, bookingRulesApi, type NumberRuleResponse,
} from '../../api/bookingRulesSettings';
import { usePermission } from '../../auth/usePermission';
import { useIsPhone } from '../../layout/useDevice';
import { TYPE } from '../../components/settings/settingsStyle';
import { SettingsScreen } from './SettingsFrame';
import { SettingsBoard } from './SettingsBoard';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';

const whole = (text: string): number | null => {
  const t = text.trim();
  return /^\d+$/.test(t) && Number.isSafeInteger(Number(t)) ? Number(t) : null;
};

const isNotFound = (error: unknown): boolean => (error as { response?: { status?: number } } | null)?.response?.status === 404;

/** What is wrong with the typed number, in words, or null. The server decides in the end. */
export function ruleProblem(text: string, min: number, max: number, unit: string): string | null {
  const n = whole(text);
  if (n === null) return 'Zadejte celé číslo.';
  return n < min || n > max ? `Zadejte hodnotu od ${min} do ${max} ${unit}.` : null;
}

interface RuleConfig {
  title: string;
  subtitle: string;
  boardId: string;
  boardTitle: string;
  boardHint: string;
  label: string;
  unit: string;
  queryKey: readonly string[];
  read: () => Promise<NumberRuleResponse>;
  write: (value: number) => Promise<NumberRuleResponse>;
  field: string;
  saved: string;
  explain: (value: number) => string;
}

function RuleSettingsPage({ cfg }: { cfg: RuleConfig }) {
  const queryClient = useQueryClient();
  const phone = useIsPhone();
  const mayEdit = usePermission('settings.clinic.manage');
  const query = useQuery({ queryKey: cfg.queryKey, queryFn: cfg.read, retry: false });
  const loaded = query.data;
  const [edit, setEdit] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (value: number) => cfg.write(value),
    onSuccess: (next) => {
      queryClient.setQueryData(cfg.queryKey, next);
      setEdit(null);
      setFailure(null);
      setServerError(null);
      toast.success(cfg.saved);
    },
    onError: (error) => {
      setServerError(fieldErrorsOf(error)[cfg.field] ?? null);
      setFailure(problemMessageOf(error, 'Nastavení se nepodařilo uložit. Zkuste to prosím znovu.'));
    },
  });

  const notDeployed = query.isError && isNotFound(query.error);
  const draft = edit ?? (loaded !== undefined ? String(loaded.value) : '');
  const typed = loaded !== undefined && edit !== null ? whole(edit) : null;
  const problem = loaded !== undefined && edit !== null ? ruleProblem(edit, loaded.min, loaded.max, cfg.unit) : null;
  const dirty = loaded !== undefined && typed !== null && typed !== loaded.value;
  const submit = () => { if (dirty && problem === null && typed !== null) save.mutate(typed); };
  const shown = typed ?? loaded?.value ?? null;

  return (
    <SettingsScreen
      title={cfg.title}
      subtitle={cfg.subtitle}
      save={mayEdit && !notDeployed ? { dirty: dirty && problem === null, saving: save.isPending, onSave: submit, onDiscard: () => { setEdit(null); setFailure(null); setServerError(null); } } : undefined}
      loading={loaded === undefined && !query.isError}
      error={query.isError && !notDeployed ? 'Nastavení se nepodařilo načíst.' : undefined}
      onRetry={() => void query.refetch()}
      aside={false}
    >
      {notDeployed ? (
        <Alert severity="info">Server toto nastavení zatím nemá. Půjde upravit, jakmile se nasadí nová verze.</Alert>
      ) : loaded === undefined ? null : (
        <Stack spacing={2.5}>
          {failure !== null && serverError === null && <Alert severity="error">{failure}</Alert>}
          <SettingsBoard id={cfg.boardId} title={cfg.boardTitle} hint={cfg.boardHint}>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: phone ? '1fr' : 'minmax(0, 360px)', alignItems: 'start' }}>
              <TextField
                label={cfg.label}
                value={draft}
                disabled={!mayEdit}
                onChange={(e) => { setEdit(e.target.value); setServerError(null); }}
                error={problem !== null || serverError !== null}
                helperText={serverError ?? problem ?? `Od ${loaded.min} do ${loaded.max} ${cfg.unit}. Výchozí: ${loaded.defaultValue}.`}
                size={phone ? 'medium' : 'small'}
                fullWidth
                slotProps={{ htmlInput: { inputMode: 'numeric' }, input: { endAdornment: <InputAdornment position="end">{cfg.unit}</InputAdornment> } }}
              />
              {mayEdit && loaded.value !== loaded.defaultValue && (
                <Box>
                  <Button size="small" sx={{ color: 'text.secondary', minHeight: 44 }} disabled={save.isPending} onClick={() => setEdit(String(loaded.defaultValue))}>
                    Vrátit výchozí hodnotu
                  </Button>
                </Box>
              )}
            </Box>
            {shown !== null && problem === null && (
              <Typography sx={[TYPE.caption, { mt: 1.5 }]}>{cfg.explain(shown)}</Typography>
            )}
          </SettingsBoard>
        </Stack>
      )}
    </SettingsScreen>
  );
}

const hoursWord = (n: number): string => (n === 1 ? 'hodinu' : n >= 2 && n <= 4 ? 'hodiny' : 'hodin');
const minutesWord = (n: number): string => (n === 1 ? 'minutu' : n >= 2 && n <= 4 ? 'minuty' : 'minut');

const BOOKING_CHANGES: RuleConfig = {
  title: 'Lhůta pro změny pacientem',
  subtitle: 'Do kdy před začátkem si pacient může svůj termín přesunout nebo zrušit přes svůj odkaz.',
  boardId: 'zr-lhuta',
  boardTitle: 'Lhůta pro změnu nebo zrušení',
  boardHint: 'Platí pro celou ordinaci',
  label: 'Nejpozději před začátkem',
  unit: 'hodin',
  queryKey: BOOKING_CHANGES_KEY,
  read: bookingRulesApi.getBookingChanges,
  write: bookingRulesApi.saveBookingChanges,
  field: 'patientChangeDeadlineHours',
  saved: 'Lhůta uložena',
  explain: (n) => `Pacient může termín změnit nebo zrušit nejpozději ${n} ${hoursWord(n)} před začátkem.`,
};

const ATTENDANCE: RuleConfig = {
  title: 'Docházka',
  subtitle: 'Kdy se objednávka, ke které nikdo nepřišel, v kalendáři označí „asi nepřišel“.',
  boardId: 'dz-nepritomen',
  boardTitle: 'Označení „asi nepřišel“',
  boardHint: 'Stav objednávky se tím nemění',
  label: 'Označit po',
  unit: 'minut',
  queryKey: ATTENDANCE_KEY,
  read: bookingRulesApi.getAttendance,
  write: bookingRulesApi.saveAttendance,
  field: 'noShowAfterMinutes',
  saved: 'Pravidlo docházky uloženo',
  explain: (n) => `Objednávka, která je ${n} ${minutesWord(n)} po začátku pořád „Objednán“, dostane v kalendáři značku. Stav sama nezmění.`,
};

export function BookingChangesPage() { return <RuleSettingsPage cfg={BOOKING_CHANGES} />; }
export function AttendancePage() { return <RuleSettingsPage cfg={ATTENDANCE} />; }
