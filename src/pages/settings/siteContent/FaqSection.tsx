/* ══════════════════════════════════════════════════════════════
   ČASTÉ OTÁZKY — the FAQ of the public site

   Question + answer, order with the arrows. While the list is empty the public
   site shows the default questions; the first one added would replace them, so
   the empty list offers to take the defaults over first.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { TYPE } from '../../../components/settings/settingsStyle';
import { DESIGN } from '../../../theme';
import { DEFAULT_FAQ } from '../../../site/defaults';
import { siteContentAdminApi, type AdminFaq, type FaqInput } from '../../../api/siteContentAdmin';
import { useSiteMutation } from './useSiteContentAdmin';
import type { ConfirmRequest } from './ConfirmDialog';
import { FormDialog, ListBox, ListRow, ReorderButtons, changedSort, moveItem } from './ListParts';

export const faqProblem = (question: string, answer: string): { question?: string; answer?: string } => {
  const problems: { question?: string; answer?: string } = {};
  if (question.trim() === '') problems.question = 'Napište otázku.';
  if (answer.trim() === '') problems.answer = 'Napište odpověď.';
  return problems;
};

function FaqDialog({ item, saving, error, onClose, onSave }: {
  item: AdminFaq | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (input: FaqInput) => void;
}) {
  const [question, setQuestion] = useState(item?.question ?? '');
  const [answer, setAnswer] = useState(item?.answer ?? '');
  const [attempted, setAttempted] = useState(false);
  const problems = faqProblem(question, answer);

  const submit = () => {
    setAttempted(true);
    if (Object.keys(problems).length > 0) return;
    onSave({ question: question.trim(), answer: answer.trim() });
  };

  return (
    <FormDialog title={item === null ? 'Nová otázka' : 'Upravit otázku'} open onClose={onClose} onSubmit={submit} submitLabel="Uložit otázku" saving={saving}>
      {error !== null && <Alert severity="error">{error}</Alert>}
      <TextField
        label="Otázka" value={question} onChange={(e) => setQuestion(e.target.value)} required fullWidth autoFocus multiline minRows={2}
        error={attempted && problems.question !== undefined} helperText={attempted ? problems.question : undefined}
      />
      <TextField
        label="Odpověď" value={answer} onChange={(e) => setAnswer(e.target.value)} required fullWidth multiline minRows={4}
        error={attempted && problems.answer !== undefined} helperText={attempted ? problems.answer : undefined}
      />
    </FormDialog>
  );
}

export function FaqSection({ items, onConfirm }: { items: AdminFaq[]; onConfirm: (request: ConfirmRequest) => void }) {
  const [dialog, setDialog] = useState<{ item: AdminFaq | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = useSiteMutation<{ id?: string; input: FaqInput }, AdminFaq | null>({
    run: ({ id, input }) => (id !== undefined ? siteContentAdminApi.updateFaq(id, input) : siteContentAdminApi.createFaq(input)),
    optimistic: (content, { id, input }) => ({
      ...content,
      faq: id !== undefined
        ? content.faq.map((f) => (f.id === id ? { ...f, question: input.question, answer: input.answer } : f))
        : [...content.faq, { id: `tmp-${Date.now()}`, question: input.question, answer: input.answer, sort: input.sort ?? 0 }],
    }),
    success: 'Otázka uložena',
    failure: 'Otázku se nepodařilo uložit.',
    onError: setError,
    onDone: () => { setError(null); setDialog(null); },
  });

  const remove = useSiteMutation<AdminFaq>({
    run: (item) => siteContentAdminApi.deleteFaq(item.id),
    optimistic: (content, item) => ({ ...content, faq: content.faq.filter((f) => f.id !== item.id) }),
    success: 'Otázka smazána',
    failure: 'Otázku se nepodařilo smazat.',
    onError: setError,
  });

  const reorder = useSiteMutation<{ before: AdminFaq[]; after: AdminFaq[] }>({
    run: async ({ before, after }) => {
      for (const item of changedSort(before, after)) {
        await siteContentAdminApi.updateFaq(item.id, { question: item.question, answer: item.answer, sort: item.sort });
      }
    },
    optimistic: (content, { after }) => ({ ...content, faq: after }),
    failure: 'Pořadí se nepodařilo uložit.',
    onError: setError,
  });

  const takeDefaults = useSiteMutation<void>({
    run: async () => {
      for (const item of DEFAULT_FAQ) {
        await siteContentAdminApi.createFaq({ question: item.question, answer: item.answer, sort: item.sort });
      }
    },
    success: 'Výchozí otázky převzaty — teď je můžete upravit',
    failure: 'Výchozí otázky se nepodařilo převzít.',
    onError: setError,
  });

  const ordered = [...items].sort((a, b) => a.sort - b.sort);
  const move = (id: string, direction: -1 | 1) => {
    setError(null);
    reorder.mutate({ before: ordered, after: moveItem(ordered, id, direction) });
  };
  const nextSort = ordered.reduce((max, f) => Math.max(max, f.sort), 0) + 1;

  return (
    <Stack spacing={2} component="section" aria-label="Časté otázky">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography component="h2" sx={TYPE.sectionTitle}>Časté otázky</Typography>
          <Typography sx={TYPE.caption}>Otázky a odpovědi, které návštěvník najde na webu a v rezervaci.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setError(null); setDialog({ item: null }); }} sx={{ minHeight: 44, fontWeight: 700 }}>
          Přidat otázku
        </Button>
      </Stack>

      {error !== null && dialog === null && <Alert severity="error">{error}</Alert>}

      {ordered.length === 0 ? (
        <Alert
          severity="info"
          action={(
            <Button color="inherit" onClick={() => takeDefaults.mutate()} disabled={takeDefaults.isPending} sx={{ minHeight: 44, fontWeight: 700 }}>
              {takeDefaults.isPending ? 'Přebírám…' : 'Převzít výchozí otázky'}
            </Button>
          )}
        >
          Zatím tu nejsou žádné otázky, web ukazuje výchozích {DEFAULT_FAQ.length}. Jakmile přidáte první, výchozí seznam zmizí
          — chcete-li jej zachovat a upravovat, převezměte ho.
        </Alert>
      ) : (
        <ListBox label="Seznam otázek">
          {ordered.map((item, index) => (
            <ListRow key={item.id}>
              <ReorderButtons name={item.question} index={index} count={ordered.length} onMove={(d) => move(item.id, d)} disabled={reorder.isPending} />
              <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
                <Typography sx={TYPE.itemName}>{item.question}</Typography>
                <Typography sx={[TYPE.caption, { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }]}>{item.answer}</Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button color="inherit" onClick={() => { setError(null); setDialog({ item }); }} aria-label={`Upravit otázku: ${item.question}`} sx={{ minHeight: 44, color: 'text.primary', fontWeight: 600 }}>
                  Upravit
                </Button>
                <Button
                  color="inherit"
                  aria-label={`Smazat otázku: ${item.question}`}
                  onClick={() => onConfirm({
                    title: 'Smazat otázku?',
                    body: `„${item.question}“ zmizí z webu. Tuto změnu nelze vrátit.`,
                    confirmLabel: 'Ano, smazat',
                    onConfirm: () => { setError(null); remove.mutate(item); },
                  })}
                  sx={{ minHeight: 44, color: DESIGN.danger, fontWeight: 600 }}
                >
                  Smazat
                </Button>
              </Stack>
            </ListRow>
          ))}
        </ListBox>
      )}

      {dialog !== null && (
        <FaqDialog
          key={dialog.item?.id ?? 'new'}
          item={dialog.item}
          saving={save.isPending}
          error={error}
          onClose={() => { setDialog(null); setError(null); }}
          onSave={(input) => {
            setError(null);
            save.mutate({ id: dialog.item?.id, input: { ...input, sort: dialog.item?.sort ?? nextSort } });
          }}
        />
      )}
    </Stack>
  );
}
