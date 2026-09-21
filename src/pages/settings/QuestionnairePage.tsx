/* ══════════════════════════════════════════════════════════════
   ZDRAVOTNÍ DOTAZNÍK  (route: /dotaznik-nastaveni)

   The questions the clinic asks, edited by the clinic.

   ── Why this screen exists ──

   Until 21. 9. 2026 the seventy-seven questions a patient answers were a
   TypeScript file in this bundle, and fifty-two more sat unused in the C#
   domain. Two questionnaires, both written in source, disagreeing, and the
   patient only ever saw one of them. Adding a question — or fixing a single
   word — meant a developer, a build and a deploy.

   ── Drafts, not live edits ──

   Nothing on this screen changes what patients are answering right now. The
   clinic opens a KONCEPT, which starts as a copy of the published version,
   edits that, and publishes when it is ready. Somebody halfway through the
   booking page keeps the questionnaire they started, and an answer already
   stored still names the version it was given to.

   ── What is deliberately not editable ──

   A question's KEY and its TYPE. Both are what a stored answer is filed
   under: renaming a key orphans every answer given to it, and turning a
   yes/no into a number makes the answers already stored meaningless. To
   change either, the clinic removes the question and writes another — which
   on a draft nobody has answered costs nothing.
   ══════════════════════════════════════════════════════════════ */

import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  draftOf,
  possibleTriggers,
  toOptions,
  publishedOf,
  questionnaireEditorApi,
  refusalText,
  sectionsOf,
} from '../../api/questionnaireEditor';
import type {
  EditorDefinition,
  EditorQuestion,
  EditorVersion,
  NewQuestion,
} from '../../api/questionnaireEditor';

/**
 * The kinds a clinic can choose, in the words it would use.
 *
 * Not every type the domain has: `Consent` and `Date` have no drawing on the
 * patient's form, and offering a kind that renders as a plain text box under a
 * different name would be a promise the form does not keep.
 */
const KINDS: ReadonlyArray<{ value: string; label: string; hint: string }> = [
  { value: 'Boolean', label: 'Ano / ne', hint: 'Jediný typ, pod který lze pověsit doplňující otázku' },
  { value: 'Text', label: 'Krátký text', hint: 'Jeden řádek' },
  { value: 'LongText', label: 'Delší text', hint: 'Víc řádků — popis, upřesnění' },
  { value: 'Number', label: 'Číslo', hint: 'Lze omezit rozsahem' },
  { value: 'SingleChoice', label: 'Výběr z možností', hint: 'Pacient vybere jednu' },
  { value: 'Information', label: 'Informace', hint: 'Věta, na kterou se neodpovídá' },
];

const kindLabel = (type: string): string =>
  KINDS.find((kind) => kind.value === type)?.label ?? type;

/** Empty is a valid starting state; the server decides whether it is allowed. */
const blankQuestion = (sectionNumber: string, sectionTitle: string): NewQuestion => ({
  type: 'Boolean',
  prompt: '',
  questionKey: '',
  sectionNumber,
  sectionTitle,
  sectionNote: null,
  helpText: null,
  placeholder: null,
  isRequired: false,
  femaleOnly: false,
  minValue: null,
  maxValue: null,
  maxTextLength: null,
  showWhenAnswered: null,
  options: null,
});

/**
 * A machine key suggested from the Czech wording.
 *
 * Only a SUGGESTION, and only while the field is untouched: the key is
 * permanent and the person writing the question is the one who should decide
 * it. Diacritics are folded because a key has to be ASCII.
 */
const suggestKey = (prompt: string, sectionNumber: string): string => {
  const folded = prompt
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .split('_')
    .slice(0, 3)
    .join('_');

  const prefix = sectionNumber.replace(/[^a-z0-9]/gi, '').toLowerCase();

  return folded.length === 0 ? '' : `${prefix ? `s${prefix}_` : ''}${folded}`;
};

export default function QuestionnairePage() {
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [adding, setAdding] = useState<NewQuestion | null>(null);
  const [editing, setEditing] = useState<EditorQuestion | null>(null);
  const [renamingSection, setRenamingSection] = useState<{
    sectionNumber: string;
    newNumber: string;
    newTitle: string;
    newNote: string;
    femaleOnly: boolean;
  } | null>(null);

  const list = useQuery({
    queryKey: ['questionnaire-definitions'],
    queryFn: questionnaireEditorApi.list,
  });

  /*
   * Which questionnaire is open.
   *
   * Defaults to the one the booking page actually serves rather than to the
   * first row: a clinic that also has the older sample catalogue would
   * otherwise land on it and edit questions nobody is ever asked.
   */
  const definition: EditorDefinition | null = useMemo(() => {
    const all = list.data ?? [];

    if (all.length === 0) {
      return null;
    }

    return (
      all.find((candidate) => candidate.id === selectedId)
      ?? all.find((candidate) => candidate.key === 'sportmedical-cz-zdravotni-dotaznik')
      ?? all[0]
    );
  }, [list.data, selectedId]);

  const draft = definition ? draftOf(definition) : null;
  const published = definition ? publishedOf(definition) : null;

  /** What is on screen: the draft when there is one, otherwise the live one. */
  const shown: EditorVersion | null = draft ?? published;

  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: ['questionnaire-definitions'] });
  };

  /*
   * One mutation for everything.
   *
   * Every call here is "ask the server, then reload the whole questionnaire".
   * Reloading rather than patching the list in place is deliberate: a move
   * renumbers every question after it, and a removal closes the gap, so a
   * client-side guess at the new state would drift from the real one within
   * two edits.
   */
  const act = useMutation({
    mutationFn: async (run: () => Promise<void>) => {
      await run();
    },
    onSuccess: async () => {
      setRefusal(null);
      await reload();
    },
    onError: (error) => {
      setRefusal(refusalText(error));
    },
  });

  const run = (work: () => Promise<void>) => act.mutate(work);

  if (list.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (list.isError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Dotazníky se nepodařilo načíst.
      </Alert>
    );
  }

  if (!definition || !shown) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        Ordinace zatím žádný dotazník nemá.
      </Alert>
    );
  }

  const sections = sectionsOf(shown);
  const editable = draft !== null && shown.id === draft.id;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5">{definition.displayName}</Typography>
          <Typography variant="body2" color="text.secondary">
            {shown.questions.length} otázek ve {sections.length} sekcích
          </Typography>
        </Box>

        {(list.data?.length ?? 0) > 1 && (
          <TextField
            select
            size="small"
            label="Dotazník"
            value={definition.id}
            onChange={(event) => setSelectedId(event.target.value)}
            sx={{ minWidth: 240 }}
          >
            {(list.data ?? []).map((candidate) => (
              <MenuItem key={candidate.id} value={candidate.id}>
                {candidate.displayName}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Stack>

      {refusal && (
        <Alert severity="warning" sx={{ mt: 2 }} onClose={() => setRefusal(null)}>
          {refusal}
        </Alert>
      )}

      {/*
        The state of play, in one sentence.

        Somebody who does not know this module has to be able to tell, without
        clicking anything, whether what they are looking at is live or a copy
        they may safely take apart.
      */}
      <Card variant="outlined" sx={{ mt: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
            <Box sx={{ flexGrow: 1 }}>
              {editable ? (
                <>
                  <Chip size="small" color="warning" label={`Koncept — verze ${shown.versionNumber}`} />
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Úpravy se pacientům neukazují. Pacienti zatím vyplňují{' '}
                    {published ? `verzi ${published.versionNumber}` : 'jinou verzi'}. Zveřejněním
                    koncept nahradí to, co je nasazené.
                  </Typography>
                </>
              ) : (
                <>
                  <Chip size="small" color="success" label={`Nasazeno — verze ${shown.versionNumber}`} />
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Toto pacienti právě vyplňují, a proto se to nedá měnit. Otevřete koncept — je to
                    kopie, na které se pracuje, dokud ji nezveřejníte.
                  </Typography>
                </>
              )}
            </Box>

            <Stack direction="row" spacing={1}>
              {editable ? (
                <>
                  <Button
                    variant="contained"
                    disabled={act.isPending}
                    onClick={() =>
                      run(() => questionnaireEditorApi.publish(definition.id, shown.id))
                    }
                  >
                    Zveřejnit
                  </Button>
                  <Button
                    color="inherit"
                    disabled={act.isPending}
                    onClick={() =>
                      run(() => questionnaireEditorApi.discardDraft(definition.id, shown.id))
                    }
                  >
                    Zahodit koncept
                  </Button>
                </>
              ) : (
                <Button
                  variant="contained"
                  disabled={act.isPending}
                  onClick={() => run(() => questionnaireEditorApi.startDraft(definition.id, null))}
                >
                  Otevřít koncept
                </Button>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={2} sx={{ mt: 3 }}>
        {sections.map((section) => (
          <Card key={`${section.number}-${section.title}`} variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  {section.number} {section.title}
                  {section.femaleOnly && (
                    <Chip size="small" label="jen ženy" sx={{ ml: 1 }} variant="outlined" />
                  )}
                </Typography>

                {editable && (
                  <>
                    <Tooltip title="Přejmenovat sekci">
                      <IconButton
                        aria-label="Přejmenovat sekci"
                        size="small"
                        onClick={() =>
                          setRenamingSection({
                            sectionNumber: section.number,
                            newNumber: section.number,
                            newTitle: section.title,
                            newNote: section.note ?? '',
                            femaleOnly: section.femaleOnly,
                          })
                        }
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Přidat otázku do sekce">
                      <IconButton
                        aria-label="Přidat otázku do sekce"
                        size="small"
                        onClick={() => setAdding(blankQuestion(section.number, section.title))}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Stack>

              {section.note && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {section.note}
                </Typography>
              )}

              <Divider sx={{ my: 1.5 }} />

              <Stack divider={<Divider flexItem />}>
                {section.questions.map((question) => (
                  <Stack
                    key={question.id}
                    direction="row"
                    spacing={1}
                    sx={{ py: 1, alignItems: 'flex-start' }}
                  >
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body1">{question.prompt}</Typography>

                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                        <Chip size="small" variant="outlined" label={kindLabel(question.type)} />
                        {question.isRequired && (
                          <Chip size="small" color="primary" variant="outlined" label="povinná" />
                        )}
                        {question.showWhenAnswered && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`jen když ano: ${question.showWhenAnswered}`}
                          />
                        )}
                        {/*
                          The key is shown, not hidden. It is what a condition
                          names and what an answer is filed under, so somebody
                          attaching a follow-up needs to be able to read it.
                        */}
                        {question.questionKey && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={question.questionKey}
                            sx={{ fontFamily: 'monospace' }}
                          />
                        )}
                      </Stack>

                      {question.helpText && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {question.helpText}
                        </Typography>
                      )}

                      {question.options.length > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {question.options.map((option) => option.displayText).join(' · ')}
                        </Typography>
                      )}
                    </Box>

                    {editable && (
                      <Stack direction="row">
                        <Tooltip title="Posunout výš">
                          <span>
                            <IconButton
                              aria-label="Posunout výš"
                              size="small"
                              disabled={question.sortOrder === 1 || act.isPending}
                              onClick={() =>
                                run(() =>
                                  questionnaireEditorApi.moveQuestion(
                                    definition.id,
                                    shown.id,
                                    question.id,
                                    question.sortOrder - 1,
                                  ),
                                )
                              }
                            >
                              <ArrowUpwardIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Posunout níž">
                          <span>
                            <IconButton
                              aria-label="Posunout níž"
                              size="small"
                              disabled={
                                question.sortOrder === shown.questions.length || act.isPending
                              }
                              onClick={() =>
                                run(() =>
                                  questionnaireEditorApi.moveQuestion(
                                    definition.id,
                                    shown.id,
                                    question.id,
                                    question.sortOrder + 1,
                                  ),
                                )
                              }
                            >
                              <ArrowDownwardIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Upravit znění">
                          <IconButton
                            aria-label="Upravit znění"
                            size="small"
                            onClick={() => setEditing(question)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Odebrat z konceptu">
                          <span>
                            <IconButton
                              aria-label="Odebrat z konceptu"
                              size="small"
                              disabled={act.isPending}
                              onClick={() =>
                                run(() =>
                                  questionnaireEditorApi.removeQuestion(
                                    definition.id,
                                    shown.id,
                                    question.id,
                                  ),
                                )
                              }
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    )}
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {editable && (
        <Button
          startIcon={<AddIcon />}
          sx={{ mt: 2 }}
          onClick={() => setAdding(blankQuestion('', ''))}
        >
          Přidat otázku v nové sekci
        </Button>
      )}

      {adding && (
        <QuestionDialog
          title="Nová otázka"
          version={shown}
          draft={adding}
          onChange={setAdding}
          onClose={() => setAdding(null)}
          onSave={() => {
            const question = adding;

            setAdding(null);
            run(() => questionnaireEditorApi.addQuestion(definition.id, shown.id, question));
          }}
          saving={act.isPending}
        />
      )}

      {editing && (
        <RewordDialog
          question={editing}
          version={shown}
          onClose={() => setEditing(null)}
          onSave={(reworded) => {
            const id = editing.id;

            setEditing(null);
            run(() =>
              questionnaireEditorApi.editQuestion(definition.id, shown.id, id, reworded),
            );
          }}
          saving={act.isPending}
        />
      )}

      {renamingSection && (
        <Dialog open fullWidth maxWidth="sm" onClose={() => setRenamingSection(null)}>
          <DialogTitle>Sekce {renamingSection.sectionNumber}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="info">
                Přejmenování se propíše do všech otázek v sekci najednou — jinak by se sekce
                rozpadla na dvě.
              </Alert>
              <TextField
                label="Číslo sekce"
                value={renamingSection.newNumber}
                onChange={(event) =>
                  setRenamingSection({ ...renamingSection, newNumber: event.target.value })
                }
              />
              <TextField
                label="Název sekce"
                value={renamingSection.newTitle}
                onChange={(event) =>
                  setRenamingSection({ ...renamingSection, newTitle: event.target.value })
                }
              />
              <TextField
                label="Poznámka pod nadpisem"
                helperText="Nepovinné. Věta, která sekci vysvětlí pacientovi."
                value={renamingSection.newNote}
                onChange={(event) =>
                  setRenamingSection({ ...renamingSection, newNote: event.target.value })
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={renamingSection.femaleOnly}
                    onChange={(event) =>
                      setRenamingSection({
                        ...renamingSection,
                        femaleOnly: event.target.checked,
                      })
                    }
                  />
                }
                label="Ptát se jen žen"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRenamingSection(null)}>Zrušit</Button>
            <Button
              variant="contained"
              disabled={act.isPending}
              onClick={() => {
                const section = renamingSection;

                setRenamingSection(null);
                run(() =>
                  questionnaireEditorApi.renameSection(definition.id, shown.id, {
                    sectionNumber: section.sectionNumber,
                    newNumber: section.newNumber,
                    newTitle: section.newTitle,
                    newNote: section.newNote.trim() === '' ? null : section.newNote,
                    femaleOnly: section.femaleOnly,
                  }),
                );
              }}
            >
              Uložit
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

/* ── Adding ───────────────────────────────────────────────────────── */

interface QuestionDialogProps {
  title: string;
  version: EditorVersion;
  draft: NewQuestion;
  onChange: (draft: NewQuestion) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}

function QuestionDialog({
  title,
  version,
  draft,
  onChange,
  onClose,
  onSave,
  saving,
}: QuestionDialogProps) {
  const [keyTouched, setKeyTouched] = useState(false);

  const triggers = possibleTriggers(version, null);
  const choices = draft.type === 'SingleChoice';

  const setPrompt = (prompt: string) => {
    onChange({
      ...draft,
      prompt,
      // Suggested only while nobody has typed a key of their own.
      questionKey: keyTouched ? draft.questionKey : suggestKey(prompt, draft.sectionNumber),
    });
  };

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label="Typ otázky"
            value={draft.type}
            onChange={(event) => onChange({ ...draft, type: event.target.value })}
            helperText={KINDS.find((kind) => kind.value === draft.type)?.hint}
          >
            {KINDS.map((kind) => (
              <MenuItem key={kind.value} value={kind.value}>
                {kind.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Otázka"
            value={draft.prompt}
            onChange={(event) => setPrompt(event.target.value)}
            multiline
            minRows={2}
          />

          <TextField
            label="Klíč"
            value={draft.questionKey}
            onChange={(event) => {
              setKeyTouched(true);
              onChange({ ...draft, questionKey: event.target.value });
            }}
            helperText="Pod tímhle se ukládají odpovědi a na tohle se odkazují doplňující otázky. Později už se nemění."
            slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }}
          />

          <Stack direction="row" spacing={2}>
            <TextField
              label="Číslo sekce"
              value={draft.sectionNumber}
              onChange={(event) => onChange({ ...draft, sectionNumber: event.target.value })}
              sx={{ width: 140 }}
            />
            <TextField
              label="Název sekce"
              value={draft.sectionTitle}
              onChange={(event) => onChange({ ...draft, sectionTitle: event.target.value })}
              sx={{ flexGrow: 1 }}
            />
          </Stack>

          <TextField
            label="Nápověda"
            value={draft.helpText ?? ''}
            onChange={(event) =>
              onChange({ ...draft, helpText: event.target.value === '' ? null : event.target.value })
            }
          />

          {choices && (
            <TextField
              label="Možnosti"
              helperText="Každá na svém řádku."
              multiline
              minRows={3}
              value={(draft.options ?? []).map((option) => option.displayText).join('\n')}
              onChange={(event) =>
                onChange({
                  ...draft,
                  options: toOptions(draft.questionKey, event.target.value),
                })
              }
            />
          )}

          <TextField
            select
            label="Zobrazit jen po odpovědi ano"
            value={draft.showWhenAnswered ?? ''}
            onChange={(event) =>
              onChange({
                ...draft,
                showWhenAnswered: event.target.value === '' ? null : event.target.value,
              })
            }
            helperText="Nabízí se jen otázky ano/ne položené dřív — na pozdější by se čekalo marně."
          >
            <MenuItem value="">Vždy na obrazovce</MenuItem>
            {triggers.map((trigger) => (
              <MenuItem key={trigger.id} value={trigger.questionKey}>
                {trigger.questionKey} — {trigger.prompt}
              </MenuItem>
            ))}
          </TextField>

          <FormControlLabel
            control={
              <Switch
                checked={draft.isRequired}
                onChange={(event) => onChange({ ...draft, isRequired: event.target.checked })}
              />
            }
            label="Povinná"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Zrušit</Button>
        <Button
          variant="contained"
          disabled={saving || draft.prompt.trim() === ''}
          onClick={onSave}
        >
          Přidat
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ── Rewording ────────────────────────────────────────────────────── */

interface RewordDialogProps {
  question: EditorQuestion;
  version: EditorVersion;
  onClose: () => void;
  onSave: (reworded: {
    prompt: string;
    helpText: string | null;
    placeholder: string | null;
    isRequired: boolean;
    minValue: number | null;
    maxValue: number | null;
    maxTextLength: number | null;
    showWhenAnswered: string | null;
    options: Array<{ key: string; displayText: string; sortOrder: number }> | null;
  }) => void;
  saving: boolean;
}

function RewordDialog({ question, version, onClose, onSave, saving }: RewordDialogProps) {
  const [prompt, setPrompt] = useState(question.prompt);
  const [helpText, setHelpText] = useState(question.helpText ?? '');
  const [placeholder, setPlaceholder] = useState(question.placeholder ?? '');
  const [isRequired, setIsRequired] = useState(question.isRequired);
  const [trigger, setTrigger] = useState(question.showWhenAnswered ?? '');
  const [optionText, setOptionText] = useState(
    question.options.map((option) => option.displayText).join('\n'),
  );

  const triggers = possibleTriggers(version, question);
  const choices = question.options.length > 0 || question.type === 'SingleChoice';

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onClose}>
      <DialogTitle>Upravit znění</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/*
            Both are permanent, and saying so here is cheaper than a refusal
            afterwards: the key is what answers are filed under, the type is
            what makes them readable.
          */}
          <Alert severity="info">
            Klíč <code>{question.questionKey || '—'}</code> a typ „{kindLabel(question.type)}“ se
            nemění — odpovědi už se pod ně ukládají. Jiný typ znamená otázku odebrat a napsat novou.
          </Alert>

          <TextField
            label="Otázka"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            multiline
            minRows={2}
          />

          <TextField
            label="Nápověda"
            value={helpText}
            onChange={(event) => setHelpText(event.target.value)}
          />

          <TextField
            label="Našeptávaný text v prázdném poli"
            value={placeholder}
            onChange={(event) => setPlaceholder(event.target.value)}
          />

          {choices && (
            <TextField
              label="Možnosti"
              helperText="Každá na svém řádku. Pořadí je pořadí na obrazovce."
              multiline
              minRows={3}
              value={optionText}
              onChange={(event) => setOptionText(event.target.value)}
            />
          )}

          <TextField
            select
            label="Zobrazit jen po odpovědi ano"
            value={trigger}
            onChange={(event) => setTrigger(event.target.value)}
          >
            <MenuItem value="">Vždy na obrazovce</MenuItem>
            {triggers.map((candidate) => (
              <MenuItem key={candidate.id} value={candidate.questionKey}>
                {candidate.questionKey} — {candidate.prompt}
              </MenuItem>
            ))}
          </TextField>

          <FormControlLabel
            control={
              <Switch
                checked={isRequired}
                onChange={(event) => setIsRequired(event.target.checked)}
              />
            }
            label="Povinná"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Zrušit</Button>
        <Button
          variant="contained"
          disabled={saving || prompt.trim() === ''}
          onClick={() =>
            onSave({
              prompt,
              helpText: helpText.trim() === '' ? null : helpText,
              placeholder: placeholder.trim() === '' ? null : placeholder,
              isRequired,
              minValue: question.minValue,
              maxValue: question.maxValue,
              maxTextLength: question.maxTextLength,
              showWhenAnswered: trigger === '' ? null : trigger,
              // Null leaves the choices alone, which is what a question with
              // none means here. An empty list would try to clear them.
              options: choices ? toOptions(question.questionKey, optionText) : null,
            })
          }
        >
          Uložit
        </Button>
      </DialogActions>
    </Dialog>
  );
}
