/*
 * "Kalendář a připomínky": when the calendar file in a confirmation e-mail rings (alarm chips, at most four), and how many
 * hours before a visit the patient's reminder e-mail is prepared (the old Připomínky screen, same endpoint, same bounds).
 */
import { useState } from 'react';
import { Alert, Box, Button, Chip, Menu, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { Add, Cancel } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MAX_CALENDAR_ALARMS, emailTemplatesApi } from '../../../api/emailTemplates';
import type { CalendarSettings } from '../../../api/emailTemplates';
import { REMINDER_SETTINGS_QUERY_KEY, readReminderSettings, saveReminderSettings } from '../../../api/reminderSettings';
import { usePermission } from '../../../auth/usePermission';
import { errorText } from '../../../components/booking/errorText';
import { TARGET_SX } from '../../../ui/shelf';
import { fieldErrorsOf, problemMessageOf } from '../settingsProblem';
import { ALARM_PRESETS, NOT_DEPLOYED_TEXT, alarmLabel, isNotDeployed, normaliseAlarms, wholeHours } from './messagesModel';

const CALENDAR_KEY = ['email-templates', 'calendar'] as const;

function AlarmChips({ onToast }: { onToast: (text: string) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const query = useQuery({ queryKey: CALENDAR_KEY, queryFn: emailTemplatesApi.getCalendar, retry: false });
  const save = useMutation({
    mutationFn: (minutes: number[]) => emailTemplatesApi.saveCalendar(minutes),
    onSuccess: (_void, minutes) => {
      queryClient.setQueryData<CalendarSettings>(CALENDAR_KEY, { alarmMinutes: minutes });
      onToast('Upozornění v kalendáři uložena.');
    },
  });

  if (query.isPending) return <Typography variant="body2" sx={{ color: 'text.secondary' }}>Načítám…</Typography>;
  if (query.isError) {
    return isNotDeployed(query.error)
      ? <Alert severity="info">{NOT_DEPLOYED_TEXT}</Alert>
      : <Alert severity="error" action={<Button color="inherit" onClick={() => void query.refetch()} sx={TARGET_SX}>Zkusit znovu</Button>}>{errorText(query.error, t)}</Alert>;
  }

  const current = normaliseAlarms(query.data.alarmMinutes);
  const offered = ALARM_PRESETS.filter((minutes) => !current.includes(minutes));
  const full = current.length >= MAX_CALENDAR_ALARMS;
  const change = (next: number[]) => save.mutate(normaliseAlarms(next));

  return (
    <Stack spacing={1}>
      <Typography sx={{ fontWeight: 700 }}>Upozornění v kalendáři</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Pacient dostane s potvrzením soubor do kalendáře. Tady určíte, kdy před termínem zazvoní (nejvýše {MAX_CALENDAR_ALARMS}).
      </Typography>
      {save.error ? <Alert severity="error">{errorText(save.error, t)}</Alert> : null}
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        {current.length === 0 ? <Typography variant="body2" sx={{ color: 'text.secondary' }}>Bez upozornění.</Typography> : null}
        {current.map((minutes) => (
          <Chip
            key={minutes}
            label={alarmLabel(minutes)}
            onDelete={save.isPending ? undefined : () => change(current.filter((m) => m !== minutes))}
            deleteIcon={<Cancel titleAccess={`Odebrat: ${alarmLabel(minutes)}`} />}
            sx={{
              minHeight: { xs: 44, lg: 32 },
              '@media (max-width: 1279.95px)': { '& .MuiChip-deleteIcon': { fontSize: 28, p: '8px', boxSizing: 'content-box', m: '0 -10px 0 -8px' } },
            }}
          />
        ))}
        <Button
          startIcon={<Add />}
          disabled={full || save.isPending || offered.length === 0}
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={TARGET_SX}
        >
          Přidat
        </Button>
        <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
          {offered.map((minutes) => (
            <MenuItem key={minutes} sx={{ minHeight: 44 }} onClick={() => { setAnchor(null); change([...current, minutes]); }}>
              {alarmLabel(minutes)}
            </MenuItem>
          ))}
        </Menu>
      </Stack>
    </Stack>
  );
}

function ReminderHours({ onToast }: { onToast: (text: string) => void }) {
  const queryClient = useQueryClient();
  const mayEdit = usePermission('settings.clinic.manage');
  const query = useQuery({ queryKey: REMINDER_SETTINGS_QUERY_KEY, queryFn: readReminderSettings, retry: false });
  const [edited, setEdited] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (hoursBefore: number) => saveReminderSettings({ hoursBefore }),
    onSuccess: (response) => {
      queryClient.setQueryData(REMINDER_SETTINGS_QUERY_KEY, response);
      setEdited(null);
      onToast('Připomínka uložena.');
    },
  });

  if (query.isPending) return null;
  if (query.isError || !query.data) {
    return <Alert severity="warning">Nastavení připomínek se nepodařilo načíst.</Alert>;
  }
  const { settings, defaults, minHours, maxHours } = query.data;
  const draft = edited ?? String(settings.hoursBefore);
  const parsed = wholeHours(draft);
  const typed = edited !== null && edited.trim() !== '';
  const notWhole = typed && parsed === null;
  const outOfRange = parsed !== null && (parsed < minHours || parsed > maxHours);
  const errors = save.isError ? fieldErrorsOf(save.error) : {};
  const problem = save.isError ? problemMessageOf(save.error, 'Nastavení nelze uložit.') : null;
  const canSave = mayEdit && parsed !== null && !outOfRange && parsed !== settings.hoursBefore && !save.isPending;

  return (
    <Stack spacing={1}>
      <Typography sx={{ fontWeight: 700 }}>Připomínka před termínem</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Kolik hodin před termínem se pacientovi připraví připomínka. Připraví se jednou, jen pacientům z registru a jen u platných termínů.
      </Typography>
      {problem !== null && errors.hoursBefore === undefined ? <Alert severity="error">{problem}</Alert> : null}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <TextField
          type="number"
          label="Předstih (hodin)"
          value={draft}
          disabled={!mayEdit}
          onChange={(event) => setEdited(event.target.value)}
          error={errors.hoursBefore !== undefined || notWhole || outOfRange}
          helperText={
            errors.hoursBefore
            ?? (notWhole ? 'Zadejte celý počet hodin.' : outOfRange ? `Od ${minHours} do ${maxHours} hodin.` : `Od ${minHours} do ${maxHours}. Výchozí: ${defaults.hoursBefore}.`)
          }
          slotProps={{ htmlInput: { min: minHours, max: maxHours, step: 1 } }}
          sx={{ width: 220 }}
        />
        {mayEdit ? (
          <Button variant="contained" disabled={!canSave} onClick={() => parsed !== null && save.mutate(parsed)} sx={{ ...TARGET_SX, minHeight: 56 }}>
            Uložit
          </Button>
        ) : null}
      </Box>
    </Stack>
  );
}

export function CalendarReminders({ onToast, alarms = true }: { onToast: (text: string) => void; alarms?: boolean }) {
  return (
    <Stack spacing={3}>
      {alarms ? <AlarmChips onToast={onToast} /> : null}
      <ReminderHours onToast={onToast} />
    </Stack>
  );
}
