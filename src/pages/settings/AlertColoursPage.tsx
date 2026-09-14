/*
 * The three colours a document's standing is drawn in.
 *
 * The owner asked for these and was told he would have them; then nobody
 * built the screen, and he found it: "bavili sme sa s backendom ze budem moct
 * nastavit i farby alertov ... nevidim to nikde". He was right - it existed
 * as an answer and not as anything he could open.
 *
 * Once for the whole application, never per rule: a colour is the word for a
 * state, and the same state must not be green on one screen and amber on
 * another. What does belong on the rule is `warnDaysBefore` - when amber
 * starts is a clinical decision and can differ by service; what amber looks
 * like is not.
 *
 * The preview shows each colour next to the sentence it will really sit
 * beside, because the rule that outranks all of this is that a colour never
 * appears alone. A green nobody can read is still a sentence somebody can.
 */
import { useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Stack, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { alertColoursApi } from '../../api/alertColours';
import type { AlertColours } from '../../api/alertColours';
import { AsyncSection } from '../../components/booking/AsyncSection';
import { errorText } from '../../components/booking/errorText';
import {
  COLOUR_PROBLEM_TEXT, COLOUR_SLOTS, badColours, coloursAreValid,
  coloursChanged, colourIsValid, normalise,
} from './alertColours';

export default function AlertColoursPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<AlertColours | null>(null);

  const coloursQuery = useQuery({
    queryKey: ['alert-colours'],
    queryFn: alertColoursApi.get,
  });

  const saved = coloursQuery.data;
  /* The server never answers empty - an unset palette comes back as a plain
     traffic light - so there is no state where this screen has to invent a
     colour of its own. */
  const current = draft ?? saved ?? null;

  const save = useMutation({
    mutationFn: (colours: AlertColours) => alertColoursApi.save(normalise(colours)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['alert-colours'] });
      setDraft(null);
    },
  });

  const bad = current === null ? [] : badColours(current);
  const canSave =
    current !== null && saved !== undefined
    && coloursAreValid(current) && coloursChanged(saved, current) && !save.isPending;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Barvy upozornění</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Jak se na kartě pacienta barevně odlišuje, jak na tom doklad je.
          Platí pro celou aplikaci — kdy se co rozsvítí, se nastavuje u pravidla.
        </Typography>
      </Box>

      {/* The rule that outranks the choosing, said where the choosing happens. */}
      <Alert severity="info" sx={{ mb: 2 }}>
        Barva nikdy nestojí sama — vždycky je u ní věta i datum. Kdo barvy
        nerozliší, se to dočte.
      </Alert>

      {save.error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{errorText(save.error, t)}</Alert>
      ) : null}

      <AsyncSection
        isLoading={coloursQuery.isLoading}
        isSettled={coloursQuery.isSuccess || coloursQuery.isError}
        error={coloursQuery.error}
        isEmpty={false}
        emptyText=""
        onRetry={() => void coloursQuery.refetch()}
        skeletonRows={3}
      >
        {current !== null && (
          <Stack spacing={2}>
            {COLOUR_SLOTS.map((slot) => {
              const value = current[slot.key];
              const isBad = bad.includes(slot.key);
              return (
                <Card key={slot.key} sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Typography sx={{ fontWeight: 700 }}>{slot.label}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      {slot.detail}
                    </Typography>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: 'flex-start' }}>
                      <TextField
                        label="Barva"
                        value={value}
                        onChange={(e) => setDraft({ ...current, [slot.key]: e.target.value })}
                        error={isBad}
                        helperText={isBad ? COLOUR_PROBLEM_TEXT : ' '}
                        sx={{ width: { xs: '100%', sm: 180 } }}
                        slotProps={{ htmlInput: { 'aria-label': `Barva — ${slot.label}` } }}
                      />

                      {/* Beside the sentence it will really sit next to, not as
                          a bare swatch. A swatch would show the colour and hide
                          the thing this screen is not allowed to forget. */}
                      <Box
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          borderLeft: '4px solid',
                          borderColor: colourIsValid(value) ? value : 'divider',
                          borderRadius: 1,
                          px: 1.5,
                          py: 1,
                          bgcolor: 'action.hover',
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ color: colourIsValid(value) ? value : 'text.disabled', fontWeight: 600 }}
                        >
                          {slot.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {slot.sample}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}

            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                disabled={!canSave}
                onClick={() => save.mutate(current)}
              >
                Uložit
              </Button>
              <Button
                disabled={draft === null || save.isPending}
                onClick={() => setDraft(null)}
              >
                Vrátit zpět
              </Button>
            </Stack>
          </Stack>
        )}
      </AsyncSection>
    </Box>
  );
}
