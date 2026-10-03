/* ══════════════════════════════════════════════════════════════
   ÚDAJE O PACIENTOVI  (route: /nastaveni/udaje-pacienta)

   Which of a patient's details the card and the register (Pacienti) show,
   and in what order. The card used to have its rows written into the page
   and the register five fixed columns; the owner's rule is "které údaje o
   pacientovi se zobrazují" is his to decide.

   The list offered is the server's fixed catalogue — a screen can only draw
   a field it knows how to read. The birth number and the insurance number
   stay hidden from anybody without `patients.sensitive_identity.view`
   whatever is chosen here; the server withholds the values themselves.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { SectionLabel, SoftCard } from '../../components/ui';
import { SettingsScreen } from './SettingsFrame';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AddIcon from '@mui/icons-material/Add';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PATIENT_FIELDS_QUERY_KEY,
  savePatientFields,
  usePatientFields,
} from '../../api/displaySettings';
import type { PatientField } from '../../api/displaySettings';
import { moveKey } from './patientFieldOrder';
import { problemMessageOf } from './settingsProblem';

const GROUP_LABEL: Record<PatientField['group'], string> = {
  personal: 'Osobní údaje',
  registration: 'Registrační údaje',
};

function FieldChips({ field }: { field: PatientField }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
      <Chip size="small" variant="outlined" label={GROUP_LABEL[field.group]} />
      {field.onList && <Chip size="small" variant="outlined" label="i v seznamu pacientů" />}
      {field.sensitive && (
        <Chip size="small" color="warning" variant="outlined" label="jen s oprávněním k rodnému číslu" />
      )}
    </Stack>
  );
}

export default function PatientFieldsPage() {
  const queryClient = useQueryClient();
  const query = usePatientFields();
  /* Unsaved edits over what the server has; null means "nothing changed yet". */
  const [edited, setVisible] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);


  const save = useMutation({
    mutationFn: savePatientFields,
    onSuccess: (response) => {
      queryClient.setQueryData(PATIENT_FIELDS_QUERY_KEY, response);
      setVisible(null);
      setSaved(true);
    },
    onError: () => setSaved(false),
  });

  const sentence = 'Které údaje karta pacienta a seznam pacientů ukazují a v jakém pořadí — jméno je vidět vždy';

  if (query.isPending) {
    return <SettingsScreen title="Údaje pacienta" subtitle={sentence} loading>{null}</SettingsScreen>;
  }

  if (query.isError || !query.data) {
    return (
      <SettingsScreen title="Údaje pacienta" subtitle={sentence} error="Nastavení údajů o pacientovi se nepodařilo načíst." onRetry={() => { void query.refetch(); }}>
        {null}
      </SettingsScreen>
    );
  }

  const visible = edited ?? query.data.visible;
  const byKey = new Map(query.data.fields.map((field) => [field.key, field]));
  const shown = visible.map((key) => byKey.get(key)).filter((field): field is PatientField => field !== undefined);
  const hidden = query.data.fields.filter((field) => !visible.includes(field.key));

  const change = (next: string[]) => {
    setSaved(false);
    setVisible(next);
  };

  return (
    <SettingsScreen
      title="Údaje pacienta"
      subtitle="Které údaje karta pacienta a seznam pacientů ukazují a v jakém pořadí — jméno je vidět vždy"
      save={{
        dirty: edited !== null,
        saving: save.isPending,
        onSave: () => save.mutate(visible),
        onDiscard: () => { setSaved(false); setVisible(null); },
      }}
    >
      <Alert severity="info" sx={{ mb: 2 }}>
        Rodné číslo a číslo pojištěnce uvidí jen ten, kdo má oprávnění k citlivým identifikátorům —
        i když jsou tady zapnuté.
      </Alert>

      <SoftCard>
          <SectionLabel>Zobrazené ({shown.length})</SectionLabel>
          {shown.length === 0 && (
            <Typography color="text.secondary" sx={{ py: 1 }}>
              Nic — karta ukáže jen jméno pacienta.
            </Typography>
          )}
          <Stack divider={<Divider flexItem />}>
            {shown.map((field, index) => (
              <Stack key={field.key} direction="row" spacing={1} sx={{ py: 1, alignItems: 'center' }}>
                <Typography sx={{ width: 28, color: 'text.secondary' }}>{index + 1}.</Typography>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>{field.label}</Typography>
                  <FieldChips field={field} />
                </Box>
                <Tooltip title="Výš">
                  <span>
                    <IconButton
                      aria-label={`Posunout ${field.label} výš`}
                      size="small"
                      disabled={index === 0}
                      onClick={() => change(moveKey(visible, field.key, -1))}
                    >
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Níž">
                  <span>
                    <IconButton
                      aria-label={`Posunout ${field.label} níž`}
                      size="small"
                      disabled={index === shown.length - 1}
                      onClick={() => change(moveKey(visible, field.key, 1))}
                    >
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Skrýt">
                  <IconButton
                    aria-label={`Skrýt ${field.label}`}
                    size="small"
                    onClick={() => change(visible.filter((key) => key !== field.key))}
                  >
                    <VisibilityOffIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            ))}
          </Stack>

          {hidden.length > 0 && (
            <>
              <SectionLabel sx={{ mt: 3 }}>Skryté ({hidden.length})</SectionLabel>
              <Stack divider={<Divider flexItem />}>
                {hidden.map((field) => (
                  <Stack key={field.key} direction="row" spacing={1} sx={{ py: 1, alignItems: 'center' }}>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography sx={{ color: 'text.secondary' }}>{field.label}</Typography>
                      <FieldChips field={field} />
                    </Box>
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => change([...visible, field.key])}
                    >
                      Zobrazit
                    </Button>
                  </Stack>
                ))}
              </Stack>
            </>
          )}

          {save.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {problemMessageOf(save.error, 'Nastavení se nepodařilo uložit.')}
            </Alert>
          )}
          {saved && !save.isPending && (
            <Alert severity="success" sx={{ mt: 2 }}>Uloženo. Karta a seznam pacientů to ukazují všem.</Alert>
          )}

          <Box sx={{ mt: 2 }}>
            <Button
              size="small"
              sx={{ color: 'text.secondary' }}
              disabled={save.isPending}
              onClick={() => change(query.data.fields.map((field) => field.key))}
            >
              Zobrazit vše v původním pořadí
            </Button>
          </Box>
      </SoftCard>
    </SettingsScreen>
  );
}
