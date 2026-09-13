/*
 * Which služba makes a patient bring which document.
 *
 *     PRAVIDLO   šablona × služba
 *     ČINNOST    belongs to one service and inherits its rules
 *     TERMÍN     is booked for one činnost
 *
 * Until now this list existed only in the database. The rules were seeded,
 * nobody at the clinic had written them, and they hung off a price-list
 * category - so whether a patient was told to bring a medical record rested on
 * a word nobody had chosen. Two things had to be true before a screen was
 * worth building: the rules had to hang off something real (a service, which
 * somebody created on purpose), and somebody had to be able to see them.
 *
 * This is the second one.
 */
import { useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, IconButton, MenuItem, Stack, Switch,
  TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import DescriptionIcon from '@mui/icons-material/Description';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { documentRequirementsApi } from '../../api/documentRequirements';
import type { RequirementRule, RequirementSettings } from '../../api/documentRequirements';
import { clinicServicesApi } from '../../api/clinicServices';
import { documentsApi } from '../../api/documents';
import { AsyncSection } from '../../components/booking/AsyncSection';
import { errorText } from '../../components/booking/errorText';
import {
  RULE_HEALTH_TEXT, alreadyRequired, canAddRule, ruleHealth, summaryText,
} from './requirementRules';
import {
  BLOCKING_CONFIRM_TEXT, BLOCKING_IGNORED_TEXT, SETTINGS_PROBLEM_TEXT,
  blockingWillHappen, settingsAreValid, settingsProblems, settingsSummary,
} from './requirementSettings';

export default function DocumentRequirementsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [templateId, setTemplateId] = useState('');
  const [serviceId, setServiceId] = useState('');

  const rulesQuery = useQuery({
    queryKey: ['document-requirements'],
    queryFn: documentRequirementsApi.list,
  });
  const servicesQuery = useQuery({
    queryKey: ['clinic-services'],
    queryFn: clinicServicesApi.list,
    staleTime: 5 * 60 * 1000,
  });
  const templatesQuery = useQuery({
    queryKey: ['document-templates'],
    queryFn: documentsApi.getTemplates,
    staleTime: 5 * 60 * 1000,
  });

  const rules = rulesQuery.data ?? [];
  const services = servicesQuery.data ?? [];
  /* Only what can still be chosen. A rule written today against a service
     that was retired yesterday is a rule written into a drawer. */
  const offerableServices = services.filter((s) => s.isActive);
  const offerableTemplates = (templatesQuery.data ?? []).filter((tpl) => tpl.isActive);

  const add = useMutation({
    mutationFn: () => documentRequirementsApi.add(templateId, serviceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['document-requirements'] });
      setTemplateId('');
      setServiceId('');
    },
  });

  const remove = useMutation({
    mutationFn: (ruleId: string) => documentRequirementsApi.remove(ruleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['document-requirements'] }),
  });

  /*
   * The four settings, changed on the rule that already exists.
   *
   * Until the server grew them, everything a rule did was fixed in the source
   * - which is what the owner objected to: "nastavit ci vsetky veci ktore su
   * teraz v kode natvrdo". `PUT` takes all four and all four are required, so
   * the dialog always sends the whole block rather than the field that moved.
   */
  const [editing, setEditing] = useState<RequirementRule | null>(null);
  const [draft, setDraft] = useState<RequirementSettings | null>(null);
  /* Asked once, before the switch goes on. Not asked again to turn it off -
     making the safer direction harder would be the wrong way round. */
  const [confirmBlocking, setConfirmBlocking] = useState(false);

  const save = useMutation({
    mutationFn: ({ ruleId, settings }: { ruleId: string; settings: RequirementSettings }) =>
      documentRequirementsApi.update(ruleId, settings),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['document-requirements'] });
      setEditing(null);
      setDraft(null);
    },
  });

  const openEdit = (rule: RequirementRule) => {
    setEditing(rule);
    setDraft({
      validityMonths: rule.validityMonths,
      warnDaysBefore: rule.warnDaysBefore,
      firstVisitOnly: rule.firstVisitOnly,
      blocksBooking: rule.blocksBooking,
    });
    setConfirmBlocking(false);
    save.reset();
  };

  const templateTypeOf = (templateId: string) =>
    (templatesQuery.data ?? []).find((tpl) => tpl.id === templateId)?.type;

  const problems = draft === null ? [] : settingsProblems(draft);
  /*
   * Turning it on needs the confirmation; turning it off never does. A rule
   * already blocking stays saveable without re-confirming, or every edit to
   * its validity would ask again about a decision already taken.
   */
  const blockingIsNew = draft?.blocksBooking === true && editing?.blocksBooking === false;
  const canSave =
    draft !== null && settingsAreValid(draft) && !save.isPending
    && (!blockingIsNew || confirmBlocking);

  /*
   * Said before the click, not after. The server answers a repeat by handing
   * back the rule that is already there, so adding it twice is not destructive
   * - it is a button that appears to do something and does not.
   */
  const duplicate =
    templateId !== '' && serviceId !== '' && alreadyRequired(rules, templateId, serviceId);
  const canAdd = canAddRule(templateId, serviceId, rules) && !add.isPending;

  const summary = summaryText(rules);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Pravidla dokumentů</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Co musí pacient doložit a ke které službě. Každá činnost pod tou službou
          pravidlo zdědí — nemusí se nastavovat po jedné.
        </Typography>
      </Box>

      <Card sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
            Nové pravidlo
          </Typography>

          {offerableServices.length === 0 && servicesQuery.isSuccess ? (
            <Alert severity="info">
              Zatím tu není žádná služba, ke které by šlo pravidlo připsat.
              Nejdřív ji založte v Nastavení → Služby.
            </Alert>
          ) : (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'flex-start' }}>
              <TextField
                select
                label="Dokument"
                value={templateId}
                onChange={(e) => { setTemplateId(e.target.value); add.reset(); }}
                sx={{ minWidth: 260, flex: 1 }}
                helperText={
                  offerableTemplates.length === 0 && templatesQuery.isSuccess
                    ? 'Žádná šablona dokumentu — bez ní se nedá po pacientovi nic chtít.'
                    : ' '
                }
              >
                {offerableTemplates.map((tpl) => (
                  <MenuItem key={tpl.id} value={tpl.id}>{tpl.name}</MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Služba"
                value={serviceId}
                onChange={(e) => { setServiceId(e.target.value); add.reset(); }}
                sx={{ minWidth: 260, flex: 1 }}
                helperText={duplicate ? 'Tohle pravidlo už v seznamu je.' : ' '}
                error={duplicate}
              >
                {offerableServices.map((service) => (
                  <MenuItem key={service.id} value={service.id}>{service.name}</MenuItem>
                ))}
              </TextField>

              <Button
                variant="contained"
                startIcon={<AddIcon />}
                disabled={!canAdd}
                onClick={() => add.mutate()}
                sx={{ mt: { md: 1 } }}
              >
                Přidat pravidlo
              </Button>
            </Stack>
          )}

          {add.error ? <Alert severity="error" sx={{ mt: 1 }}>{errorText(add.error, t)}</Alert> : null}
        </CardContent>
      </Card>

      {/* A broken row is worth saying once at the top as well: the list can be
          long enough that it scrolls out of sight. */}
      {summary !== '' && rules.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>{summary}</Alert>
      )}

      {remove.error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{errorText(remove.error, t)}</Alert>
      ) : null}

      <AsyncSection
        isLoading={rulesQuery.isLoading}
        isSettled={rulesQuery.isSuccess || rulesQuery.isError}
        error={rulesQuery.error}
        isEmpty={rules.length === 0}
        emptyText={summaryText([])}
        onRetry={() => void rulesQuery.refetch()}
        skeletonRows={3}
      >
        <Stack spacing={1.5}>
          {rules.map((rule) => {
            const health = ruleHealth(rule, services);
            return (
              <Card key={rule.id} sx={{ borderRadius: 3 }}>
                <CardContent sx={{ py: 2 }}>
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
                    <DescriptionIcon
                      sx={{ color: health === 'ok' ? '#0D7377' : 'warning.main', mt: 0.5 }}
                    />
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <Typography sx={{ fontWeight: 700 }}>
                        {rule.templateName === '' ? 'Neznámý dokument' : rule.templateName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {rule.serviceName === ''
                          ? 'u smazané služby'
                          : `u služby ${rule.serviceName}`}
                      </Typography>
                      {/* What the rule does, on the row. Four settings behind
                          a pencil are four settings nobody reads; the sentence
                          is what makes the list worth opening. */}
                      <Typography variant="caption" color="text.secondary">
                        {settingsSummary(rule)}
                      </Typography>
                    </Box>
                    <Tooltip title="Nastavení pravidla">
                      <IconButton
                        aria-label={`Upravit pravidlo ${rule.templateName} u služby ${rule.serviceName}`}
                        onClick={() => openEdit(rule)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Smazat pravidlo">
                      <IconButton
                        aria-label={`Smazat pravidlo ${rule.templateName} u služby ${rule.serviceName}`}
                        disabled={remove.isPending}
                        onClick={() => { remove.reset(); remove.mutate(rule.id); }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  {health !== 'ok' && (
                    <Alert severity="warning" sx={{ mt: 1.5 }}>
                      {RULE_HEALTH_TEXT[health]}
                    </Alert>
                  )}

                  {/* A rule that says "bez něj nejde objednat" on a document
                      booking never looks at is a setting that looks obeyed and
                      is not. Said on the row, where the promise is made. */}
                  {rule.blocksBooking && !blockingWillHappen(templateTypeOf(rule.templateId)) && (
                    <Alert severity="warning" sx={{ mt: 1.5 }} icon={<BlockIcon />}>
                      {BLOCKING_IGNORED_TEXT}
                    </Alert>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </AsyncSection>

      <Dialog
        open={draft !== null}
        onClose={() => { setEditing(null); setDraft(null); }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Nastavení pravidla
        </DialogTitle>
        <DialogContent>
          {draft !== null && editing !== null && (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {`${editing.templateName} u služby ${editing.serviceName}`}
              </Typography>

              <TextField
                label="Platnost (měsíců)"
                type="number"
                value={draft.validityMonths}
                onChange={(e) => setDraft({ ...draft, validityMonths: Number(e.target.value) })}
                error={problems.some((x) => x.startsWith('validity'))}
                /* From the issue date, not from the upload. A výpis written in
                   March and handed in in June has three months already spent,
                   and somebody setting this has to know which date counts. */
                helperText={
                  problems.find((x) => x.startsWith('validity')) !== undefined
                    ? SETTINGS_PROBLEM_TEXT[problems.find((x) => x.startsWith('validity'))!]
                    : 'Počítá se od data vystavení dokladu, ne od nahrání. 0 = nikdy nevyprší.'
                }
                sx={{ maxWidth: 320 }}
              />

              <TextField
                label="Upozornit předem (dní)"
                type="number"
                value={draft.warnDaysBefore}
                onChange={(e) => setDraft({ ...draft, warnDaysBefore: Number(e.target.value) })}
                error={problems.some((x) => x.startsWith('warn'))}
                helperText={
                  problems.find((x) => x.startsWith('warn')) !== undefined
                    ? SETTINGS_PROBLEM_TEXT[problems.find((x) => x.startsWith('warn'))!]
                    : 'Kolik dní před koncem platnosti karta pacienta zoranžoví. 0 = neupozorňovat.'
                }
                sx={{ maxWidth: 320 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={draft.firstVisitOnly}
                    onChange={(e) => setDraft({ ...draft, firstVisitOnly: e.target.checked })}
                  />
                }
                label={draft.firstVisitOnly
                  ? 'Jen při první návštěvě'
                  : 'Při každé návštěvě'}
              />

              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={draft.blocksBooking}
                      onChange={(e) => {
                        setDraft({ ...draft, blocksBooking: e.target.checked });
                        /* Off again drops the confirmation with it, so
                           flicking it on and off does not leave a yes behind. */
                        if (!e.target.checked) setConfirmBlocking(false);
                      }}
                    />
                  }
                  label={draft.blocksBooking
                    ? 'Bez dokladu nejde objednat'
                    : 'Bez dokladu jen upozornit'}
                />

                {/*
                  * Not another switch in a row. This reverses the owner's own
                  * rule from plan 2.4 - paperwork always warns, because the
                  * patient is on the telephone and needs a slot now - so
                  * turning it on is asked about, and turning it off is not.
                  */}
                {blockingIsNew && (
                  <Alert severity="warning" sx={{ mt: 1 }} icon={<BlockIcon />}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {BLOCKING_CONFIRM_TEXT}
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={confirmBlocking}
                          onChange={(e) => setConfirmBlocking(e.target.checked)}
                        />
                      }
                      label="Rozumím, chci to tak"
                    />
                  </Alert>
                )}

                {draft.blocksBooking
                  && !blockingWillHappen(templateTypeOf(editing.templateId)) && (
                  <Alert severity="info" sx={{ mt: 1 }}>{BLOCKING_IGNORED_TEXT}</Alert>
                )}
              </Box>

              <Alert severity="info" icon={false}>
                {settingsSummary(draft)}
              </Alert>

              {save.error ? <Alert severity="error">{errorText(save.error, t)}</Alert> : null}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setEditing(null); setDraft(null); }}>Zrušit</Button>
          <Button
            variant="contained"
            disabled={!canSave}
            onClick={() => {
              if (editing !== null && draft !== null) {
                save.mutate({ ruleId: editing.id, settings: draft });
              }
            }}
          >
            Uložit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
