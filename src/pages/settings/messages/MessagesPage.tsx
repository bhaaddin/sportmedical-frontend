/* ══════════════════════════════════════════════════════════════
   ZPRÁVY  (route: /nastaveni/zpravy)

   Everything the clinic says by e-mail on one screen: the built-in messages (on/off + edit), the clinic's own messages,
   the calendar file and reminder, and how the mail is sent. It replaces three screens (Šablony, E-mail, Připomínky); their
   old addresses redirect here.
   ══════════════════════════════════════════════════════════════ */
import { useMemo, useState } from 'react';
import { Alert, Button, Snackbar, Stack } from '@mui/material';
import { Add } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { emailTemplatesApi } from '../../../api/emailTemplates';
import type { EmailTemplate } from '../../../api/emailTemplates';
import { usePermission } from '../../../auth/usePermission';
import { errorText } from '../../../components/booking/errorText';
import { TARGET_SX } from '../../../ui/shelf';
import { SettingsScreen } from '../SettingsFrame';
import { SettingsBoard } from '../SettingsBoard';
import { CalendarReminders } from './CalendarReminders';
import { AutoRows, CustomRows, GroupLabel, TEMPLATES_KEY } from './MessageRows';
import { NOT_DEPLOYED_TEXT, customOnly, groupBuiltIn, isNotDeployed } from './messagesModel';
import { SendingStatus } from './SendingStatus';
import { TemplateEditor } from './TemplateEditor';

/** `undefined` = closed, `null` = a new custom message, a template = edit it. */
type Editing = EmailTemplate | null | undefined;

export default function MessagesPage() {
  const { t } = useTranslation();
  const maySettings = usePermission('settings.clinic.manage');
  const mayMessages = usePermission('communication.manage');
  const [editing, setEditing] = useState<Editing>(undefined);
  const [toast, setToast] = useState<string | null>(null);

  const listQuery = useQuery({ queryKey: TEMPLATES_KEY, queryFn: emailTemplatesApi.list, retry: false, enabled: mayMessages });
  const templates = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const { patients, clubs } = groupBuiltIn(templates);
  const custom = customOnly(templates);
  const notDeployed = listQuery.isError && isNotDeployed(listQuery.error);
  const failure = listQuery.isError && !notDeployed ? errorText(listQuery.error, t) : false;
  const ready = !listQuery.isPending && !listQuery.isError;

  return (
    <SettingsScreen
      title="Zprávy"
      subtitle="E-maily, které ordinace posílá pacientům a klubům: zapnout, upravit nebo napsat vlastní"
      aside={false}
    >
      <Stack spacing={3}>
      {notDeployed ? <Alert severity="info">{NOT_DEPLOYED_TEXT}</Alert> : null}

      {notDeployed || !mayMessages ? null : (
      <SettingsBoard
        id="auto-messages"
        title="Automatické zprávy"
        hint="Odesílají se samy při rezervaci, přesunu nebo zrušení"
        padding={0}
        count={ready ? patients.length + clubs.length : undefined}
        loading={listQuery.isPending}
        error={failure}
        onRetry={() => { void listQuery.refetch(); }}
        empty={ready && patients.length + clubs.length === 0}
        emptyState={{ text: 'Zatím tu nejsou žádné zprávy.' }}
      >
        <div role="list" aria-label="Automatické zprávy">
          {patients.length > 0 ? <GroupLabel>Pacienti</GroupLabel> : null}
          <AutoRows templates={patients} onEdit={setEditing} onToast={setToast} />
          {clubs.length > 0 ? <GroupLabel>Kluby</GroupLabel> : null}
          <AutoRows templates={clubs} onEdit={setEditing} onToast={setToast} />
        </div>
      </SettingsBoard>
      )}

      {notDeployed || !mayMessages ? null : (
      <SettingsBoard
        id="custom-messages"
        title="Vlastní zprávy"
        hint="Zprávy, které si napíšete sami a pošlete z karty pacienta nebo klubu"
        padding={0}
        count={ready ? custom.length : undefined}
        loading={listQuery.isPending}
        error={failure}
        empty={ready && custom.length === 0}
        emptyState={{ text: 'Zatím žádná vlastní zpráva. Napište třeba oznámení o posunu dne nebo vzkaz hráčům.' }}
        controls={(
          <Button variant="contained" startIcon={<Add />} onClick={() => setEditing(null)} sx={TARGET_SX}>Nová zpráva</Button>
        )}
      >
        <div role="list" aria-label="Vlastní zprávy">
          <CustomRows templates={custom} onEdit={setEditing} onToast={setToast} />
        </div>
      </SettingsBoard>
      )}

      <SettingsBoard id="calendar-reminders" title="Kalendář a připomínky" hint="Kdy zazvoní kalendář a kdy odejde připomínka">
        <CalendarReminders onToast={setToast} alarms={mayMessages && !notDeployed} />
      </SettingsBoard>

      {maySettings ? (
        <SettingsBoard id="sending" title="Odesílání" hint="Odkud e-maily odcházejí a jestli to funguje">
          <SendingStatus />
        </SettingsBoard>
      ) : null}
      </Stack>

      {editing !== undefined ? (
        <TemplateEditor
          key={editing?.code ?? 'new'}
          template={editing}
          onClose={() => setEditing(undefined)}
          onToast={setToast}
        />
      ) : null}

      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </SettingsScreen>
  );
}
