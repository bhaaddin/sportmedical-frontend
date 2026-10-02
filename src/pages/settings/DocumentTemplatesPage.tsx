/*
 * The kinds of document the clinic keeps.
 *
 * The owner asked why documents he had deleted were back in the picker. They
 * were never gone: all four were seeded on 8. 9. 2026 at 22:58:27, share that
 * one timestamp, and the API has no DELETE for a template - nothing he clicked
 * could have removed one.
 *
 * What he wanted is a list holding only the výpis, and since the merge on
 * 14. 9. 2026 that is possible. `PUT /api/documents/templates/{id}` arrived
 * with it, every picker already hides an inactive template, and turning the
 * other three off empties them out of every dropdown without destroying the
 * name that filed documents still point at.
 *
 * It is also the only place the seeded Výpis can stop describing itself as
 * "(vyžaduje se při první návštěvě)" - a rule he cancelled on 13. 9. and
 * nobody could correct while the endpoint was read-only.
 */
import { useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, IconButton, Stack, Switch,
  TextField, Tooltip, Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DescriptionIcon from '@mui/icons-material/Description';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { documentsApi } from '../../api/documents';
import type { DocumentTemplate } from '../../api/documents';
import { documentRequirementsApi } from '../../api/documentRequirements';
import { AsyncSection } from '../../components/booking/AsyncSection';
import { errorText } from '../../components/booking/errorText';
import {
  STALE_FIRST_VISIT_TEXT, TEMPLATE_PROBLEM_TEXT, describesACancelledRule,
  switchingOffText, templateChanged, templateIsValid, templateProblems,
} from './documentTemplates';
import type { TemplateDraft } from './documentTemplates';

export default function DocumentTemplatesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<DocumentTemplate | null>(null);
  const [draft, setDraft] = useState<TemplateDraft | null>(null);

  /*
   * The only caller that asks for the switched-off ones. Its own query key, so
   * it cannot hand a picker somewhere else a cache holding documents the owner
   * has put away.
   */
  const templatesQuery = useQuery({
    queryKey: ['document-templates', 'all'],
    queryFn: () => documentsApi.getTemplates(true),
  });
  /* Only to say how many rules would be left with nothing to ask for. Not a
     reason to refuse the switch - that is his call, not this screen's. */
  const rulesQuery = useQuery({
    queryKey: ['document-requirements'],
    queryFn: documentRequirementsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const templates = templatesQuery.data ?? [];
  const rules = rulesQuery.data ?? [];

  const save = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TemplateDraft }) =>
      documentsApi.updateTemplate(id, input),
    onSuccess: async () => {
      await Promise.all([
        /* Both: this screen's list, and the pickers' active-only one - a
           switch here changes what they may offer. */
        queryClient.invalidateQueries({ queryKey: ['document-templates'] }),
        /* The rule screen names its template, so a rename has to reach it. */
        queryClient.invalidateQueries({ queryKey: ['document-requirements'] }),
      ]);
      setEditing(null);
      setDraft(null);
    },
  });

  const openEdit = (template: DocumentTemplate) => {
    setEditing(template);
    setDraft({
      name: template.name,
      description: template.description,
      isActive: template.isActive,
    });
    save.reset();
  };

  const rulesFor = (templateId: string) =>
    rules.filter((r) => r.templateId === templateId).length;

  const problems = draft === null ? [] : templateProblems(draft);
  const switchingOff = draft?.isActive === false && editing?.isActive === true;
  const canSave =
    draft !== null && editing !== null
    && templateIsValid(draft) && templateChanged(editing, draft) && !save.isPending;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Dokumenty</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Druhy dokumentů, které ordinace vede. Kdo který musí doložit, se nastavuje
          v Pravidlech dokumentů — tady jen to, jak se jmenují a jestli se používají.
        </Typography>
      </Box>

      {/*
        * Off, never deleted: a filed document keeps its `templateId` forever,
        * so deleting the kind would leave years of paperwork nameless.
        *
        * The second sentence used to promise it could be switched back on
        * whenever. That was false and it was mine: the list endpoint answers
        * with the ACTIVE templates only, so one switched off leaves this
        * screen and takes its own row with it. It is not lost - `PUT` and
        * `GET /{id}` both still reach it - but nothing here can list it. A way
        * to has been asked for; until then this says what really happens.
        */}
      <Alert severity="info" sx={{ mb: 2 }}>
        Dokument se nemaže, jen vypíná. Vypnutý zmizí ze všech nabídek a nepůjde
        ho nahrát, ale dřív nahrané dokumenty si podrží jméno — a tady zůstane
        vidět, takže ho lze kdykoli zapnout zpátky.
      </Alert>

      {save.error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{errorText(save.error, t)}</Alert>
      ) : null}

      <AsyncSection
        isLoading={templatesQuery.isLoading}
        isSettled={templatesQuery.isSuccess || templatesQuery.isError}
        error={templatesQuery.error}
        isEmpty={templates.length === 0}
        emptyText="Ordinace nemá založený žádný druh dokumentu."
        onRetry={() => void templatesQuery.refetch()}
        skeletonRows={4}
      >
        <Stack spacing={1.5}>
          {templates.map((template) => (
            <Card key={template.id} sx={{ borderRadius: 3 }}>
              <CardContent sx={{ py: 2 }}>
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ alignItems: 'flex-start', flexWrap: 'wrap', rowGap: 1 }}
                >
                  <DescriptionIcon
                    sx={{ color: template.isActive ? '#0D7377' : 'text.disabled', mt: 0.5 }}
                  />
                  <Box sx={{ flex: 1, minWidth: 160 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 700 }}>{template.name}</Typography>
                      {!template.isActive && <Chip size="small" label="Vypnuto" />}
                    </Stack>
                    {template.description !== '' && (
                      <Typography variant="body2" color="text.secondary">
                        {template.description}
                      </Typography>
                    )}
                    {rulesFor(template.id) > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {rulesFor(template.id) === 1
                          ? '1 pravidlo ho vyžaduje'
                          : `${rulesFor(template.id)} pravidla ho vyžadují`}
                      </Typography>
                    )}
                  </Box>
                  <Tooltip title="Upravit">
                    <IconButton
                      aria-label={`Upravit dokument ${template.name}`}
                      onClick={() => openEdit(template)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>

                {/* Pointed at, not corrected on his behalf. The text is the
                    clinic's to write, and a screen that silently rewrote it
                    would be making the same kind of decision that put the
                    sentence there. */}
                {describesACancelledRule(template.description) && (
                  <Alert severity="warning" sx={{ mt: 1.5 }}>
                    {STALE_FIRST_VISIT_TEXT}
                  </Alert>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      </AsyncSection>

      <Dialog
        open={draft !== null}
        onClose={() => { setEditing(null); setDraft(null); }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Upravit dokument</DialogTitle>
        <DialogContent>
          {draft !== null && editing !== null && (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <TextField
                label="Název"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                error={problems.includes('name-empty')}
                helperText={
                  problems.includes('name-empty')
                    ? TEMPLATE_PROBLEM_TEXT['name-empty']
                    : 'Jak se dokument jmenuje v nabídkách a na kartě pacienta.'
                }
                fullWidth
              />

              <TextField
                label="Popis"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                multiline
                minRows={2}
                helperText="Věta, kterou recepce řekne pacientovi, co má přinést."
                fullWidth
              />

              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={draft.isActive}
                      onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                    />
                  }
                  label={draft.isActive ? 'Používá se' : 'Vypnuto'}
                />
                {switchingOff && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    {switchingOffText(rulesFor(editing.id))}
                  </Alert>
                )}
              </Box>
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
                save.mutate({ id: editing.id, input: draft });
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
