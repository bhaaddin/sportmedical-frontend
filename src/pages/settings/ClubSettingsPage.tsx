/* ══════════════════════════════════════════════════════════════
   NASTAVENÍ KLUBŮ  (route: /nastaveni/kluby)

   Two numbers the clinic decides about club blocks, nothing hard-coded:

     registrationLinkValidityDays   how long a club's registration link stays
                                    valid
     releaseUnusedDaysBefore        optional (Etapa 4). Empty = never. N days before
                                    a club order's window starts, the capacity the
                                    order does not need is opened to the public
     allowMultiServiceOrders        switch, off by default: one club order may
                                    hold more than one služba
     minimumPlayers                 optional. Empty = no minimum (saved as
                                    null). When set, the calculator warns
                                    below it and the public Kluby page names it
                                    - it never refuses a block

     GET/PUT /api/v1/settings/clubs

   "Uložit" is live only when something changed and the values are numbers the
   server would accept; "Zahodit" puts the saved values back. A refused value
   shows the server's own sentence under its field. A failed load says what
   failed and offers "Zkusit znovu" - never a blank page.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, FormControlLabel, InputAdornment, Stack, Switch, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clubSettingsApi, CLUB_SETTINGS_QUERY_KEY } from '../../api/clubs';
import type { ClubSettings } from '../../api/clubs';
import { useIsPhone } from '../../layout/useDevice';
import { SettingsBoard } from './SettingsBoard';
import { SettingsScreen } from './SettingsFrame';
import { MAX_PAYER_TEXT, MAX_REGISTRATION_LINK_DAYS } from '../../api/fieldLimits';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';

interface Draft {
  registrationLinkValidityDays: string;
  minimumPlayers: string;
  releaseUnusedDaysBefore: string;
  allowMultiServiceOrders: boolean;
  /** R13: days before a club day an unfilled hold is flagged expired; '' while the server has no such setting. */
  holdUntilDaysBefore?: string;
  /** The sentences about who pays; empty = the server's default sentence is shown to parents. */
  payerTextClubInvoice: string;
  payerTextPerPerson: string;
}

const toDraft = (s: ClubSettings): Draft => ({
  registrationLinkValidityDays: String(s.registrationLinkValidityDays),
  minimumPlayers: s.minimumPlayers === null ? '' : String(s.minimumPlayers),
  releaseUnusedDaysBefore: s.releaseUnusedDaysBefore == null ? '' : String(s.releaseUnusedDaysBefore),
  allowMultiServiceOrders: s.allowMultiServiceOrders === true,
  holdUntilDaysBefore: s.holdUntilDaysBefore === undefined ? '' : String(s.holdUntilDaysBefore),
  payerTextClubInvoice: s.payerTextClubInvoice ?? '',
  payerTextPerPerson: s.payerTextPerPerson ?? '',
});

const wholeNumber = (text: string): number | null => {
  const t = text.replace(/\s/g, '');
  return /^\d+$/.test(t) && Number.isSafeInteger(Number(t)) ? Number(t) : null;
};

/** What stops the draft being sent - the server has the last word, this spares the round trip. */
export function validateClubSettings(draft: Draft): Partial<Record<keyof Draft, string>> {
  const errors: Partial<Record<keyof Draft, string>> = {};
  /* Empty is a valid answer: never release. 0 = on the day itself. */
  if (draft.releaseUnusedDaysBefore.trim() !== '') {
    const release = wholeNumber(draft.releaseUnusedDaysBefore);
    if (release === null) errors.releaseUnusedDaysBefore = 'Zadejte celý počet dní (0 a víc), nebo pole nechte prázdné.';
    else if (release > 3650) errors.releaseUnusedDaysBefore = 'Víc než deset let je nejspíš překlep.';
  }
  /* R13: 0 = never expires, 7 by default, at most a year (the server refuses more with `settings.invalid`). */
  if ((draft.holdUntilDaysBefore ?? '') !== '') {
    const hold = wholeNumber(draft.holdUntilDaysBefore ?? '');
    if (hold === null || hold > 365) errors.holdUntilDaysBefore = 'Zadejte celý počet dní od 0 do 365 (0 = držení nikdy nevyprší).';
  }
  const days = wholeNumber(draft.registrationLinkValidityDays);
  if (days === null) errors.registrationLinkValidityDays = 'Zadejte celý počet dní.';
  else if (days < 1) errors.registrationLinkValidityDays = 'Odkaz musí platit aspoň jeden den.';
  else if (days > MAX_REGISTRATION_LINK_DAYS) {
    /* The server's own limit (measured: 1 to 1095); 3650 used to pass here and come back as a 400. */
    errors.registrationLinkValidityDays = `Odkaz může platit nejvýše ${MAX_REGISTRATION_LINK_DAYS} dní (tři roky).`;
  }
  for (const field of ['payerTextClubInvoice', 'payerTextPerPerson'] as const) {
    if (draft[field].trim().length > MAX_PAYER_TEXT) errors[field] = `Věta smí mít nejvýše ${MAX_PAYER_TEXT} znaků.`;
  }
  /* Empty is a valid answer: no minimum. */
  if (draft.minimumPlayers.trim() !== '') {
    const players = wholeNumber(draft.minimumPlayers);
    if (players === null || players < 1) errors.minimumPlayers = 'Zadejte celý počet sportovců od 1, nebo pole nechte prázdné.';
  }
  return errors;
}

/** The payer sentences the owner changed, as the PUT wants them (text, or "" to clear); nothing for one left alone. */
export function changedPayerTexts(saved: ClubSettings, draft: Draft): Partial<Pick<ClubSettings, 'payerTextClubInvoice' | 'payerTextPerPerson'>> {
  const out: Partial<Pick<ClubSettings, 'payerTextClubInvoice' | 'payerTextPerPerson'>> = {};
  for (const field of ['payerTextClubInvoice', 'payerTextPerPerson'] as const) {
    const next = draft[field].trim();
    if (next !== (saved[field] ?? '').trim()) out[field] = next;
  }
  return out;
}

/** The server's field names come back in either case; match the draft's. */
const serverFieldError = (errors: Record<string, string>, field: keyof Draft): string | undefined =>
  errors[field] ?? errors[field.charAt(0).toUpperCase() + field.slice(1)];

export default function ClubSettingsPage() {
  const queryClient = useQueryClient();
  const phone = useIsPhone();

  const query = useQuery({ queryKey: CLUB_SETTINGS_QUERY_KEY, queryFn: clubSettingsApi.get, retry: false });
  const saved: ClubSettings | undefined = query.data;

  /* What the user has typed; `null` until they type, so the form shows the saved values. */
  const [edits, setEdits] = useState<Draft | null>(null);
  const draft: Draft | null = edits ?? (saved !== undefined ? toDraft(saved) : null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (settings: ClubSettings) => clubSettingsApi.put(settings),
    onSuccess: (next) => {
      queryClient.setQueryData(CLUB_SETTINGS_QUERY_KEY, next);
      setEdits(null);
      setServerErrors({});
      setFailure(null);
      toast.success('Nastavení klubů uloženo');
    },
    onError: (error) => {
      setServerErrors(fieldErrorsOf(error));
      setFailure(problemMessageOf(error, 'Nastavení se nepodařilo uložit. Zkuste to prosím znovu.'));
    },
  });

  const dirty = saved !== undefined && edits !== null && JSON.stringify(edits) !== JSON.stringify(toDraft(saved));
  const clientErrors = draft === null ? {} : validateClubSettings(draft);
  const valid = Object.keys(clientErrors).length === 0;
  const [attempted, setAttempted] = useState(false);

  const submit = () => {
    setAttempted(true);
    if (draft === null || !valid) return;
    if (saved === undefined) return;
    save.mutate({
      ...saved,
      registrationLinkValidityDays: wholeNumber(draft.registrationLinkValidityDays) as number,
      minimumPlayers: draft.minimumPlayers.trim() === '' ? null : (wholeNumber(draft.minimumPlayers) as number),
      releaseUnusedDaysBefore:
        draft.releaseUnusedDaysBefore.trim() === '' ? null : (wholeNumber(draft.releaseUnusedDaysBefore) as number),
      allowMultiServiceOrders: draft.allowMultiServiceOrders,
      /* a server that has no hold setting is never sent one */
      ...(saved.holdUntilDaysBefore !== undefined && (draft.holdUntilDaysBefore ?? '') !== '' ? { holdUntilDaysBefore: wholeNumber(draft.holdUntilDaysBefore ?? '') as number } : {}),
      /* Sent only when changed. "" clears a sentence (the default shows again); null would KEEP the stored one. */
      ...changedPayerTexts(saved, draft),
    });
  };

  const discard = () => {
    setEdits(null);
    setServerErrors({});
    setFailure(null);
    setAttempted(false);
  };

  const edit = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    setEdits((e) => ({
      ...(e ?? (saved !== undefined ? toDraft(saved) : { registrationLinkValidityDays: '', minimumPlayers: '', releaseUnusedDaysBefore: '', allowMultiServiceOrders: false, holdUntilDaysBefore: '', payerTextClubInvoice: '', payerTextPerPerson: '' })),
      [field]: value,
    }));
    setServerErrors((e) => ({ ...e, [field]: '', [field.charAt(0).toUpperCase() + field.slice(1)]: '' }));
  };

  const fieldError = (field: keyof Draft): string | undefined => {
    const server = serverFieldError(serverErrors, field);
    if (server) return server;
    return attempted || dirty ? clientErrors[field] : undefined;
  };

  return (
    <SettingsScreen
      title="Nastavení klubů"
      subtitle="Platnost registračních odkazů, minimum sportovců v bloku a pravidla klubových objednávek."
      width={760}
      scope="clubs"
      save={{ dirty, saving: save.isPending, onSave: submit, onDiscard: discard }}
      loading={draft === null && !query.isError}
      error={query.isError ? 'Nastavení klubů se nepodařilo načíst.' : undefined}
      onRetry={() => void query.refetch()}
    >
      {draft === null ? null : (
        <Stack spacing={2.5} component="form" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {failure !== null ? <Alert severity="error">{failure}</Alert> : null}

          <SettingsBoard id="club-1" title="Registrační odkaz klubu">
            <TextField
              label="Platnost odkazu"
              value={draft.registrationLinkValidityDays}
              onChange={(e) => edit('registrationLinkValidityDays', e.target.value)}
              error={fieldError('registrationLinkValidityDays') !== undefined}
              helperText={fieldError('registrationLinkValidityDays') ?? 'Po tolika dnech od založení bloku sportovci přes odkaz už nevstoupí.'}
              size={phone ? 'medium' : 'small'}
              fullWidth
              slotProps={{
                htmlInput: { inputMode: 'numeric' },
                input: { endAdornment: <InputAdornment position="end">dní</InputAdornment> },
              }}
            />
          </SettingsBoard>

          <SettingsBoard id="club-2" title="Velikost bloku">
            <TextField
              label="Minimální počet sportovců pro blok (nepovinné)"
              value={draft.minimumPlayers}
              onChange={(e) => edit('minimumPlayers', e.target.value)}
              error={fieldError('minimumPlayers') !== undefined}
              helperText={fieldError('minimumPlayers') ?? 'Pro mobilní testování. Prázdné pole = bez minima. Je-li číslo vyplněno, kalkulačka u menšího bloku upozorní a veřejná stránka Kluby minimum uvede; blok jde vytvořit i tak.'}
              size={phone ? 'medium' : 'small'}
              fullWidth
              slotProps={{
                htmlInput: { inputMode: 'numeric' },
                input: { endAdornment: <InputAdornment position="end">sportovců</InputAdornment> },
              }}
            />
          </SettingsBoard>

          <SettingsBoard id="club-3" title="Klubové objednávky">
            <Stack spacing={2}>
              <TextField
                label="Otevřít nevyužitou kapacitu veřejnosti X dní před termínem"
                value={draft.releaseUnusedDaysBefore}
                onChange={(e) => edit('releaseUnusedDaysBefore', e.target.value)}
                error={fieldError('releaseUnusedDaysBefore') !== undefined}
                helperText={
                  fieldError('releaseUnusedDaysBefore') ??
                  'Prázdné pole = nikdy. Tolik dní před začátkem termínu se čas, který objednávka klubu nepotřebuje pro ještě neobsazená místa, vrátí do veřejné nabídky. Už zapsaní sportovci se nikdy nemění.'
                }
                size={phone ? 'medium' : 'small'}
                fullWidth
                slotProps={{
                  htmlInput: { inputMode: 'numeric' },
                  input: { endAdornment: <InputAdornment position="end">dní</InputAdornment> },
                }}
              />
              {saved?.holdUntilDaysBefore !== undefined ? (
                <TextField
                  label="Držet čas klubu do X dní před termínem"
                  value={draft.holdUntilDaysBefore ?? ''}
                  onChange={(e) => edit('holdUntilDaysBefore', e.target.value)}
                  error={fieldError('holdUntilDaysBefore') !== undefined}
                  helperText={
                    fieldError('holdUntilDaysBefore') ??
                    'Klubem zadržený čas, který hráči zatím nevyplnili, se tolik dní před termínem označí „Hold vypršel“ a jde ho uvolnit. Výchozí 7 dní, 0 = nikdy. Nic se neruší samo, uvolnění potvrzuje recepce; zapsaní hráči se nikdy nemění.'
                  }
                  size={phone ? 'medium' : 'small'}
                  fullWidth
                  data-testid="club-hold-days"
                  slotProps={{
                    htmlInput: { inputMode: 'numeric' },
                    input: { endAdornment: <InputAdornment position="end">dní</InputAdornment> },
                  }}
                />
              ) : null}
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={draft.allowMultiServiceOrders}
                      onChange={(e) => edit('allowMultiServiceOrders', e.target.checked)}
                    />
                  }
                  label="Povolit v jedné objednávce více služeb"
                />
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', ml: 6 }}>
                  {fieldError('allowMultiServiceOrders') ??
                    'Vypnuto: objednávka klubu patří vždy jedné službě. Zapnuto: klub může v jedné objednávce kombinovat činnosti více služeb.'}
                </Typography>
              </Box>
            </Stack>
          </SettingsBoard>

          <SettingsBoard id="club-4" title="Kdo hradí vyšetření — věty pro rodiče">
            <Stack spacing={2}>
              <TextField
                label="Když platí klub fakturou"
                value={draft.payerTextClubInvoice}
                onChange={(e) => edit('payerTextClubInvoice', e.target.value)}
                error={fieldError('payerTextClubInvoice') !== undefined}
                helperText={fieldError('payerTextClubInvoice') ?? 'Prázdné pole = výchozí věta (viz šedý text). Rodiče ji čtou na stránce klubu.'}
                placeholder={saved?.defaultPayerTextClubInvoice ?? ''}
                multiline
                minRows={2}
                fullWidth
                slotProps={{ htmlInput: { maxLength: MAX_PAYER_TEXT } }}
              />
              <TextField
                label="Když platí každý rodič sám"
                value={draft.payerTextPerPerson}
                onChange={(e) => edit('payerTextPerPerson', e.target.value)}
                error={fieldError('payerTextPerPerson') !== undefined}
                helperText={fieldError('payerTextPerPerson') ?? 'Prázdné pole = výchozí věta (viz šedý text).'}
                placeholder={saved?.defaultPayerTextPerPerson ?? ''}
                multiline
                minRows={2}
                fullWidth
                slotProps={{ htmlInput: { maxLength: MAX_PAYER_TEXT } }}
              />
            </Stack>
          </SettingsBoard>

          <SettingsBoard id="club-5" title="Jak se to používá">
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Horní strop počtu hráčů neexistuje — kalkulačka spočítá, kolik dní blok potřebuje.
              Slevu pro klub nastavuje administrátor v kartě klubu v sekci{' '}
              <Box component={RouterLink} to="/clubs" sx={{ color: 'primary.main', display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>Kluby a týmy</Box>.
            </Typography>
          </SettingsBoard>
        </Stack>
      )}
    </SettingsScreen>
  );
}
