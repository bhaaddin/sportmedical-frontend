/* ══════════════════════════════════════════════════════════════
   ODKAZ K DOKONČENÍ REGISTRACE  (route: /nastaveni/odkaz-registrace)

   The personal link the desk sends a patient so that he fills in his own address, insurance and health
   questionnaire. Four things are the clinic's to decide and the link service reads all four every time it
   issues a link:

     completionDeadlineHours   how long the link lives
     publicSiteBaseUrl         the web address the link is built on (without it NO e-mail is queued: the desk
                               is told "v Nastavení chybí adresa webu")
     emailSubject / emailBody  what the e-mail says; {odkaz} is required, the rest are placeholders

     GET/PUT /api/v1/settings/intake-link

   The server refuses what it cannot use, per field; this screen checks the same obvious things first and puts
   the server's own sentences under the field when it still refuses. Nothing is sent: there is no mail provider
   configured on a fresh install, so the screen says what a save does and does not do.
   ══════════════════════════════════════════════════════════════ */

import { useRef, useState } from 'react';
import { Alert, Box, Button, Chip, InputAdornment, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  INTAKE_LINK_QUERY_KEY, intakeLinkSettingsApi, type IntakeLinkSettings, type IntakeLinkSettingsResponse,
} from '../../api/intakeLinkSettings';
import { useDevice, useIsPhone } from '../../layout/useDevice';
import { SoftCard } from '../../components/ui';
import { TYPE } from '../../components/settings/settingsStyle';
import { SettingsAsideCard, SettingsScreen } from './SettingsFrame';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';

interface Draft {
  completionDeadlineHours: string;
  emailSubject: string;
  emailBody: string;
  publicSiteBaseUrl: string;
}
type Field = keyof Draft;

export const SUBJECT_MAX = 200;
export const BODY_MAX = 4000;
export const SITE_URL_MAX = 200;
/** The one placeholder the e-mail cannot do without: without it the patient never gets the link. */
export const REQUIRED_TOKEN = '{odkaz}';

export const toDraft = (s: IntakeLinkSettings): Draft => ({
  completionDeadlineHours: String(s.completionDeadlineHours),
  emailSubject: s.emailSubject,
  emailBody: s.emailBody,
  publicSiteBaseUrl: s.publicSiteBaseUrl,
});

const whole = (text: string): number | null => {
  const t = text.trim();
  return /^\d+$/.test(t) && Number.isSafeInteger(Number(t)) ? Number(t) : null;
};

/** A web address the links can be built on: http(s), no query, no anchor, no credentials. */
export function isUsableSiteUrl(text: string): boolean {
  const value = text.trim();
  if (value === '' || value.length > SITE_URL_MAX) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.search === '' && url.hash === '' && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

/** What is wrong with the draft, per field, in the words the person reads. The server decides in the end. */
export function validateIntakeLink(draft: Draft, minimumHours: number, maximumHours: number): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};

  const hours = whole(draft.completionDeadlineHours);
  if (hours === null || hours < minimumHours || hours > maximumHours) {
    errors.completionDeadlineHours = `Zadejte celý počet hodin od ${minimumHours} do ${maximumHours}.`;
  }

  const subject = draft.emailSubject.trim();
  if (subject === '') errors.emailSubject = 'Předmět e-mailu nesmí být prázdný.';
  else if (subject.length > SUBJECT_MAX) errors.emailSubject = `Předmět smí mít nejvýše ${SUBJECT_MAX} znaků.`;
  else if (/[\r\n]/.test(subject)) errors.emailSubject = 'Předmět e-mailu je jeden řádek.';

  const body = draft.emailBody.trim();
  if (body === '') errors.emailBody = 'Text e-mailu nesmí být prázdný.';
  else if (body.length > BODY_MAX) errors.emailBody = `Text smí mít nejvýše ${BODY_MAX} znaků.`;
  else if (!body.includes(REQUIRED_TOKEN)) errors.emailBody = `Text musí obsahovat ${REQUIRED_TOKEN}, jinak by pacient odkaz nedostal.`;

  const site = draft.publicSiteBaseUrl.trim();
  if (site !== '' && !isUsableSiteUrl(site)) {
    errors.publicSiteBaseUrl = 'Zadejte celou adresu začínající https:// (nebo http://), bez dotazu a kotvy.';
  }

  return errors;
}

/** What the server is sent: trimmed text, the address without a trailing slash, the hours as a number. */
export function toPayload(draft: Draft): IntakeLinkSettings {
  return {
    completionDeadlineHours: Number(draft.completionDeadlineHours.trim()),
    emailSubject: draft.emailSubject.trim(),
    emailBody: draft.emailBody.trim(),
    publicSiteBaseUrl: draft.publicSiteBaseUrl.trim().replace(/\/+$/, ''),
  };
}

const NBSP = ' ';
export function daysHelper(hours: number): string {
  if (hours < 24) return 'méně než jeden den';
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  const word = days === 1 ? 'den' : days >= 2 && days <= 4 ? 'dny' : 'dní';
  return rest === 0 ? `= ${days}${NBSP}${word}` : `= ${days}${NBSP}${word} a${NBSP}${rest}${NBSP}h`;
}

export default function IntakeLinkSettingsPage() {
  const queryClient = useQueryClient();
  const device = useDevice();
  const phone = useIsPhone();
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const query = useQuery({ queryKey: INTAKE_LINK_QUERY_KEY, queryFn: intakeLinkSettingsApi.get, retry: false });
  const loaded: IntakeLinkSettingsResponse | undefined = query.data;

  const [edits, setEdits] = useState<Draft | null>(null);
  const draft: Draft | null = edits ?? (loaded !== undefined ? toDraft(loaded.settings) : null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const save = useMutation({
    mutationFn: (settings: IntakeLinkSettings) => intakeLinkSettingsApi.put(settings),
    onSuccess: (next) => {
      queryClient.setQueryData(INTAKE_LINK_QUERY_KEY, next);
      setEdits(null);
      setServerErrors({});
      setFailure(null);
      setAttempted(false);
      toast.success('Nastavení odkazu uloženo');
    },
    onError: (error) => {
      setServerErrors(fieldErrorsOf(error));
      setFailure(problemMessageOf(error, 'Nastavení se nepodařilo uložit. Zkuste to prosím znovu.'));
    },
  });

  const minimumHours = loaded?.minimumHours ?? 1;
  const maximumHours = loaded?.maximumHours ?? 720;
  const dirty = loaded !== undefined && edits !== null && JSON.stringify(toPayload(edits)) !== JSON.stringify(loaded.settings);
  const clientErrors = draft === null ? {} : validateIntakeLink(draft, minimumHours, maximumHours);
  const valid = Object.keys(clientErrors).length === 0;

  const submit = () => {
    setAttempted(true);
    if (draft === null || !valid) return;
    save.mutate(toPayload(draft));
  };
  const discard = () => { setEdits(null); setServerErrors({}); setFailure(null); setAttempted(false); };

  const edit = (field: Field, value: string) => {
    if (draft === null) return;
    setEdits({ ...draft, [field]: value });
    setServerErrors((e) => ({ ...e, [field]: '' }));
  };

  const fieldError = (field: Field): string | undefined => {
    const server = serverErrors[field] || serverErrors[field.charAt(0).toUpperCase() + field.slice(1)];
    if (server) return server;
    return attempted || dirty ? clientErrors[field] : undefined;
  };

  const insert = (token: string) => {
    if (draft === null) return;
    const el = bodyRef.current;
    const start = el?.selectionStart ?? draft.emailBody.length;
    const end = el?.selectionEnd ?? draft.emailBody.length;
    edit('emailBody', draft.emailBody.slice(0, start) + token + draft.emailBody.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const useDefaults = () => {
    if (draft === null || loaded === undefined) return;
    setEdits({ ...draft, emailSubject: loaded.defaults.emailSubject, emailBody: loaded.defaults.emailBody });
    setServerErrors((e) => ({ ...e, emailSubject: '', emailBody: '' }));
  };

  const hours = draft === null ? null : whole(draft.completionDeadlineHours);
  const hoursOk = hours !== null && hours >= minimumHours && hours <= maximumHours;
  const noSite = draft !== null && draft.publicSiteBaseUrl.trim() === '';

  const explainer = draft === null ? null : (
    <Stack spacing={1.5}>
      <Typography sx={TYPE.itemName}>
        {hoursOk ? `Odkaz platí ${hours} h od chvíle, kdy ho recepce vytvoří.` : 'Odkaz platí omezenou dobu od chvíle, kdy ho recepce vytvoří.'}
      </Typography>
      <Typography sx={TYPE.caption}>
        <strong>Adresa webu:</strong>{' '}
        {noSite
          ? 'není vyplněná — e-mail s odkazem se nezařadí a recepce musí odkaz předat sama.'
          : 'odkaz v e-mailu se skládá z této adresy a osobního kódu pacienta.'}
      </Typography>
      <Typography sx={TYPE.caption}>
        <strong>Co tohle nenastavuje:</strong> lhůtu u rychlé registrace u přepážky — ta má vlastní nastavení a odkaz u ní končí současně s rezervací.
      </Typography>
    </Stack>
  );

  return (
    <SettingsScreen
      title="Odkaz k dokončení registrace"
      subtitle="Jak dlouho platí osobní odkaz, který recepce pošle pacientovi, jak zní e-mail s ním a na jaké adrese webu se odkaz skládá."
      scope="intake"
      save={{ dirty, saving: save.isPending, onSave: submit, onDiscard: discard }}
      loading={draft === null && !query.isError}
      error={query.isError ? 'Nastavení odkazu se nepodařilo načíst.' : undefined}
      onRetry={() => void query.refetch()}
      aside={device === 'desktop' && explainer !== null ? explainer : undefined}
      asideTitle="Co se stane"
    >
      {draft === null || loaded === undefined ? null : (
        <Stack spacing={2.5}>
          {failure !== null && <Alert severity="error">{failure}</Alert>}

          <SoftCard component="section" aria-labelledby="il-lhuta">
            <Typography id="il-lhuta" component="h2" sx={TYPE.sectionTitle}>Platnost a adresa</Typography>
            <Typography sx={[TYPE.caption, { mt: 0.5, mb: 2 }]}>Po vypršení pacient odkaz nepoužije a recepce vytvoří nový.</Typography>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: phone ? '1fr' : 'repeat(2, minmax(0, 1fr))', alignItems: 'start' }}>
              <TextField
                label="Platnost odkazu"
                value={draft.completionDeadlineHours}
                onChange={(e) => edit('completionDeadlineHours', e.target.value)}
                error={fieldError('completionDeadlineHours') !== undefined}
                helperText={fieldError('completionDeadlineHours') ?? (hoursOk ? daysHelper(hours) : `Od ${minimumHours} do ${maximumHours} hodin.`)}
                size={phone ? 'medium' : 'small'}
                fullWidth
                slotProps={{ htmlInput: { inputMode: 'numeric' }, input: { endAdornment: <InputAdornment position="end">hodin</InputAdornment> } }}
              />
              <TextField
                label="Adresa webu pro pacienty"
                value={draft.publicSiteBaseUrl}
                onChange={(e) => edit('publicSiteBaseUrl', e.target.value)}
                error={fieldError('publicSiteBaseUrl') !== undefined}
                helperText={fieldError('publicSiteBaseUrl') ?? 'Např. https://www.sportmedical.cz — bez ní se e-mail s odkazem neodešle.'}
                size={phone ? 'medium' : 'small'}
                fullWidth
                slotProps={{ htmlInput: { inputMode: 'url', autoComplete: 'off', maxLength: SITE_URL_MAX } }}
              />
            </Box>
          </SoftCard>

          <SoftCard component="section" aria-labelledby="il-email">
            <Typography id="il-email" component="h2" sx={TYPE.sectionTitle}>E-mail s odkazem</Typography>
            <Typography sx={[TYPE.caption, { mt: 0.5, mb: 2 }]}>Zástupné údaje se při odeslání nahradí údaji pacienta.</Typography>
            <Stack spacing={2}>
              <TextField
                label="Předmět e-mailu"
                value={draft.emailSubject}
                onChange={(e) => edit('emailSubject', e.target.value)}
                error={fieldError('emailSubject') !== undefined}
                helperText={fieldError('emailSubject') ?? 'Jeden řádek.'}
                size={phone ? 'medium' : 'small'}
                fullWidth
              />
              <TextField
                label="Text e-mailu"
                value={draft.emailBody}
                onChange={(e) => edit('emailBody', e.target.value)}
                inputRef={bodyRef}
                error={fieldError('emailBody') !== undefined}
                helperText={fieldError('emailBody') ?? `Musí obsahovat ${REQUIRED_TOKEN}.`}
                fullWidth
                multiline
                minRows={8}
              />
              {loaded.placeholders.length > 0 && (
                <Box>
                  <Typography sx={[TYPE.caption, { mb: 0.5 }]}>Zástupné údaje — kliknutím vložíte na místo kurzoru:</Typography>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    {loaded.placeholders.map((placeholder) => (
                      <Tooltip key={placeholder.token} title={placeholder.meaning}>
                        <Chip label={placeholder.token} onClick={() => insert(placeholder.token)} sx={{ cursor: 'pointer', minHeight: 44 }} />
                      </Tooltip>
                    ))}
                  </Stack>
                </Box>
              )}
              <Box>
                <Button size="small" sx={{ color: 'text.secondary', minHeight: 44 }} onClick={useDefaults} disabled={save.isPending}>
                  Vrátit výchozí znění e-mailu
                </Button>
              </Box>
            </Stack>
          </SoftCard>

          {device !== 'desktop' && explainer !== null && (
            <SettingsAsideCard title="Co se stane">{explainer}</SettingsAsideCard>
          )}
        </Stack>
      )}
    </SettingsScreen>
  );
}
