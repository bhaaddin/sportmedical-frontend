/*
 * Pravidla a dokumenty: what a patient has to do or bring for this služba.
 *
 *  - per služba: the document rules (read here, edited on "Pravidla dokumentů"),
 *  - per činnost: the questionnaire, the optional consents and the documents
 *    the činnost asks for - the first two editable right here.
 * Consent to the examination itself is not an option and is not listed:
 * it is required by law for every činnost.
 */
import { Alert, Box, Button, Chip, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { documentRequirementsApi } from '../../../api/documentRequirements';
import { documentsApi } from '../../../api/documents';
import type { Activity } from '../../../api/bookingContracts';
import type { ClinicService } from '../../../api/clinicServices';
import { usePermission } from '../../../auth/usePermission';
import { AsyncSection } from '../../../components/booking/AsyncSection';
import { errorText } from '../../../components/booking/errorText';
import { SoftCard } from '../../../components/ui';
import { TYPE } from '../../../components/settings/settingsStyle';
import { QUESTIONNAIRE_LABEL, useActivityPatch, useServiceActivities } from './ActivitiesSection';

export default function RulesSection({ service }: { service: ClinicService }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canEdit = usePermission('settings.clinic.manage');
  const { query, mine } = useServiceActivities(service.id);
  const patch = useActivityPatch();

  const rules = useQuery({ queryKey: ['document-requirements'], queryFn: documentRequirementsApi.list, retry: false });
  const templates = useQuery({
    queryKey: ['cenik', 'document-templates'], queryFn: () => documentsApi.getTemplates(), retry: false, enabled: canEdit,
  });
  const templateName = (id: string): string => templates.data?.find((x) => x.id === id)?.name ?? 'Dokument';
  const myRules = (rules.data ?? []).filter((r) => r.clinicServiceId === service.id);
  const active: Activity[] = mine.filter((a) => a.isActive);

  const set = (a: Activity, p: Parameters<typeof patch.mutate>[0]['patch']) => patch.mutate({ activity: a, patch: p });

  return (
    <Stack spacing={2}>
      <SoftCard>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
          <Typography sx={{ ...TYPE.sectionTitle, flex: 1 }}>Dokumenty, které pacient přinese</Typography>
          <Button variant="outlined" onClick={() => navigate('/pravidla-dokumentu')} sx={{ minHeight: 44 }}>Pravidla dokumentů</Button>
        </Stack>
        {rules.isLoading && <Typography sx={TYPE.caption}>Načítám pravidla…</Typography>}
        {rules.isError && (
          <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => void rules.refetch()}>Zkusit znovu</Button>}>
            Pravidla dokumentů se nepodařilo načíst.
          </Alert>
        )}
        {rules.isSuccess && myRules.length === 0 && (
          <Typography sx={TYPE.caption}>Pro tuhle službu pacient žádný dokument přinášet nemusí.</Typography>
        )}
        <Stack spacing={1}>
          {myRules.map((r) => (
            <Stack key={r.id} direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography sx={TYPE.itemName}>{r.templateName}</Typography>
              <Chip size="small" variant="outlined" label={r.validityMonths === 0 ? 'bez omezení platnosti' : `platí ${r.validityMonths} měsíců`} />
              <Chip size="small" variant="outlined" label={r.firstVisitOnly ? 'jen při první návštěvě' : 'při každé návštěvě'} />
              <Chip size="small" color={r.blocksBooking ? 'warning' : 'default'} variant="outlined" label={r.blocksBooking ? 'chybějící dokument zablokuje objednání' : 'chybějící dokument jen upozorní'} />
            </Stack>
          ))}
        </Stack>
      </SoftCard>

      {patch.error !== null && <Alert severity="error">{errorText(patch.error, t)}</Alert>}

      <AsyncSection
        isLoading={query.isLoading}
        isSettled={query.isSuccess || query.isError}
        error={query.error}
        isEmpty={active.length === 0}
        emptyText="Služba nemá žádnou aktivní činnost, takže tu není co nastavovat."
        onRetry={() => void query.refetch()}
        skeletonRows={2}
      >
        <Stack spacing={2}>
          {active.map((a) => (
            <SoftCard key={a.id} data-testid={`rules-${a.id}`}>
              <Typography sx={{ ...TYPE.sectionTitle, mb: 1.5 }}>{a.name}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                <TextField
                  select
                  size="small"
                  label={`Dotazník — ${a.name}`}
                  value={a.questionnaireRequirement in QUESTIONNAIRE_LABEL ? a.questionnaireRequirement : ''}
                  disabled={!canEdit || patch.isPending}
                  onChange={(e) => set(a, { questionnaireRequirement: e.target.value as Activity['questionnaireRequirement'] })}
                  fullWidth
                >
                  {(Object.keys(QUESTIONNAIRE_LABEL) as Activity['questionnaireRequirement'][]).map((k) => (
                    <MenuItem key={k} value={k}>{QUESTIONNAIRE_LABEL[k]}</MenuItem>
                  ))}
                </TextField>
                <Box>
                  <Typography sx={TYPE.label}>Dokumenty činnosti</Typography>
                  {a.requiredDocumentTemplateIds.length === 0 ? (
                    <Typography sx={TYPE.caption}>Žádné. Vybírají se v „Barva a dokumenty“ v záložce Činnosti.</Typography>
                  ) : (
                    <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75, mt: 0.5 }}>
                      {a.requiredDocumentTemplateIds.map((id) => <Chip key={id} size="small" label={templateName(id)} />)}
                    </Stack>
                  )}
                </Box>
              </Box>
              <Stack direction="row" sx={{ mt: 1, flexWrap: 'wrap', columnGap: 3 }}>
                <FormControlLabel
                  control={<Switch checked={a.requiresReportByEmail} disabled={!canEdit || patch.isPending} onChange={(e) => set(a, { requiresReportByEmail: e.target.checked })} />}
                  label={`Souhlas se zasláním zprávy e-mailem — ${a.name}`}
                />
                <FormControlLabel
                  control={<Switch checked={a.requiresClubSharing} disabled={!canEdit || patch.isPending} onChange={(e) => set(a, { requiresClubSharing: e.target.checked })} />}
                  label={`Souhlas se sdílením s klubem — ${a.name}`}
                />
              </Stack>
            </SoftCard>
          ))}
        </Stack>
      </AsyncSection>
    </Stack>
  );
}
