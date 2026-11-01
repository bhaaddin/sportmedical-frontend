/* ══════════════════════════════════════════════════════════════
   BEZPEČNOSTNÍ PRAVIDLA  (route: /nastaveni/bezpecnostni-pravidla, Administrace)

   Three plain switches, all OFF until the owner turns them on, each with one line saying what it does - like a Word
   dialog. The rest of the app does what it did before until a switch is on.

     reconfirmForAdmin          do Administrace se vstupuje znovu přes heslo a potvrzení platí N minut
     requireTwoFactorForAdmins  administrátoři musí mít dvoufázové ověření
     adminIdleLock              po N minutách nečinnosti se Administrace zamkne

   The server enforces them (403 `reconfirm_required` / `two_factor_required`); the gate in the shell
   (security/AdminGate) and the confirmation window (security/ReconfirmHost) are only the screen's half. A server that does
   not have the route yet: the screen is not offered (availability.ts) and a direct address goes back to the Administrace.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { Alert, Box, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import {
  SECURITY_POLICY_QUERY_KEY, readSecurityPolicy, saveSecurityPolicy, type SecurityPolicy,
} from '../../api/securityPolicy';
import { twoFactorApi } from '../../api/twoFactor';
import { MUTED_SX } from '../../ui/shelf/shelfStyle';
import { SettingsBoard } from './SettingsBoard';
import { SettingsScreen } from './SettingsFrame';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';

const TITLE = 'Bezpečnostní pravidla';
const SENTENCE = 'Co se má při práci v Administraci chránit navíc. Dokud to nezapnete, nic se nemění.';

/** The minutes people pick from; a value the server holds that is not here is still shown. */
const MINUTE_CHOICES = [5, 10, 15, 30, 60, 120] as const;

type Flag = 'reconfirmForAdmin' | 'requireTwoFactorForAdmins' | 'adminIdleLock';
type Minutes = 'reconfirmMinutes' | 'adminIdleLockMinutes';

interface Rule {
  flag: Flag;
  title: string;
  line: string;
  minutes?: { key: Minutes; label: string };
}

const RULES: readonly Rule[] = [
  {
    flag: 'reconfirmForAdmin',
    title: 'Při vstupu do Administrace znovu zadat heslo',
    line: 'Při otevření Administrace a při důležité změně se zeptáme na heslo. Potvrzení pak chvíli platí.',
    minutes: { key: 'reconfirmMinutes', label: 'Potvrzení platí' },
  },
  {
    flag: 'requireTwoFactorForAdmins',
    title: 'Administrátoři musí mít dvoufázové ověření',
    line: 'Kdo nemá k heslu i kód z ověřovací aplikace, do Administrace nevstoupí, dokud si ho nezapne.',
  },
  {
    flag: 'adminIdleLock',
    title: 'Po nečinnosti Administraci zamknout',
    line: 'Když v Administraci nikdo chvíli nic nedělá, zamkne se. Zbytek aplikace to neovlivní.',
    minutes: { key: 'adminIdleLockMinutes', label: 'Zamknout po' },
  },
];

function MinutesField({ label, value, disabled, onChange, error }: { label: string; value: number; disabled: boolean; onChange: (v: number) => void; error?: string }) {
  const choices = (MINUTE_CHOICES as readonly number[]).includes(value) ? [...MINUTE_CHOICES] : [...MINUTE_CHOICES, value].sort((a, b) => a - b);
  return (
    <TextField
      select
      label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
      error={Boolean(error)}
      helperText={error}
      sx={{ minWidth: 200, maxWidth: 260 }}
      slotProps={{ input: { sx: { minHeight: 48 } } }}
    >
      {choices.map((m) => (
        <MenuItem key={m} value={m} sx={{ minHeight: 44 }}>{m === 60 ? '1 hodina' : m === 120 ? '2 hodiny' : `${m} minut`}</MenuItem>
      ))}
    </TextField>
  );
}

export default function SecurityPolicyPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: SECURITY_POLICY_QUERY_KEY, queryFn: readSecurityPolicy, retry: false });
  /* Needed only to warn about switching on a rule the owner's own account would fail. */
  const factor = useQuery({ queryKey: ['two-factor-status'], queryFn: twoFactorApi.status, staleTime: 60_000 });
  const [edited, setEdited] = useState<SecurityPolicy | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: saveSecurityPolicy,
    onSuccess: (policy) => {
      queryClient.setQueryData(SECURITY_POLICY_QUERY_KEY, policy);
      setEdited(null);
      setSaved(true);
    },
    onError: () => setSaved(false),
  });

  if (query.isPending) {
    return <SettingsScreen title={TITLE} subtitle={SENTENCE} loading>{null}</SettingsScreen>;
  }
  if (query.isError) {
    return (
      <SettingsScreen title={TITLE} subtitle={SENTENCE} error="Pravidla se nepodařilo načíst." onRetry={() => { void query.refetch(); }}>
        {null}
      </SettingsScreen>
    );
  }
  /* An older server: the screen is simply not there. */
  if (query.data === null) return <Navigate to="/administrace" replace />;

  const draft = edited ?? query.data;
  const errors = save.isError ? fieldErrorsOf(save.error) : {};
  const set = <K extends keyof SecurityPolicy>(key: K, value: SecurityPolicy[K]) => {
    setSaved(false);
    setEdited({ ...draft, [key]: value });
  };
  const noSecondFactor = factor.data !== undefined && !factor.data.enabled;

  return (
    <SettingsScreen
      title={TITLE}
      subtitle={SENTENCE}
      save={{
        dirty: edited !== null && JSON.stringify(edited) !== JSON.stringify(query.data),
        saving: save.isPending,
        onSave: () => save.mutate(draft),
        onDiscard: () => { setSaved(false); setEdited(null); },
      }}
      aside={
        <Typography sx={{ fontSize: 14, color: 'text.primary' }}>
          Pravidla platí pro každého, kdo smí do Administrace. Každou změnu pravidel najdete pod formulářem a v Historii změn.
        </Typography>
      }
      asideTitle="Co to znamená"
    >
      <SettingsBoard id="security-policy" title="Chránit Administraci" hint="Vše je vypnuté, dokud to nezapnete">
        <Stack spacing={0} divider={<Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}>
          {RULES.map((rule) => {
            const on = draft[rule.flag];
            const blocked = rule.flag === 'requireTwoFactorForAdmins' && on && noSecondFactor;
            return (
              <Box key={rule.flag} sx={{ py: 2, display: 'grid', gap: 1 }}>
                <FormControlLabel
                  sx={{ m: 0, alignItems: 'flex-start', gap: 1.5, minHeight: 44 }}
                  control={
                    <Switch
                      checked={on}
                      onChange={(event) => set(rule.flag, event.target.checked)}
                      sx={{ mt: -0.5 }}
                    />
                  }
                  label={
                    <Box sx={{ pt: 0.5 }}>
                      <Typography sx={{ fontSize: 15, fontWeight: 650, lineHeight: 1.35 }}>{rule.title}</Typography>
                      <Typography sx={{ ...MUTED_SX, fontSize: 13, lineHeight: 1.45, mt: 0.25 }}>{rule.line}</Typography>
                    </Box>
                  }
                />
                {blocked && (
                  <Alert severity="warning" sx={{ ml: { sm: 7 } }}>
                    Vy sám/sama dvoufázové ověření zatím nemáte. Zapněte si ho nejdřív v „Můj účet a zabezpečení“,
                    jinak se do Administrace nedostanete ani vy.
                  </Alert>
                )}
                {rule.minutes !== undefined && on && (
                  <Box sx={{ ml: { sm: 7 } }}>
                    <MinutesField
                      label={rule.minutes.label}
                      value={draft[rule.minutes.key]}
                      disabled={false}
                      onChange={(v) => set(rule.minutes!.key, v)}
                      error={errors[rule.minutes.key]}
                    />
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>
        {save.isError && Object.keys(errors).length === 0 && (
          <Alert severity="error" sx={{ mt: 2 }}>{problemMessageOf(save.error, 'Pravidla se nepodařilo uložit.')}</Alert>
        )}
        {saved && <Alert severity="success" sx={{ mt: 2 }}>Uloženo.</Alert>}
      </SettingsBoard>
    </SettingsScreen>
  );
}
