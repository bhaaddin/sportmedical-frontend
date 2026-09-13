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
  Alert, Box, Button, Card, CardContent, IconButton, MenuItem, Stack,
  TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { documentRequirementsApi } from '../../api/documentRequirements';
import { clinicServicesApi } from '../../api/clinicServices';
import { documentsApi } from '../../api/documents';
import { AsyncSection } from '../../components/booking/AsyncSection';
import { errorText } from '../../components/booking/errorText';
import {
  RULE_HEALTH_TEXT, alreadyRequired, canAddRule, ruleHealth, summaryText,
} from './requirementRules';

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
                    </Box>
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
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </AsyncSection>
    </Box>
  );
}
