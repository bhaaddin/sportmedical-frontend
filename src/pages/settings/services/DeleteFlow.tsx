/*
 * "Smazat" for a služba or a činnost, one flow for every place that offers it.
 *
 *   confirm  -> "Opravdu smazat „X“? Smazání nelze vrátit."
 *   200      -> closes, toast, the caller refreshes its lists
 *   409      -> the server's sentence + what hangs off it ("12 objednávek, 2 kalendáře")
 *               and a primary "Archivovat místo toho", so there is always a safe way out
 *
 * The api calls come in as props: the screens decide what to refresh, and a
 * screen test can hand in plain functions.
 */
import { useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar, Stack, Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { isInUse, type DeleteUsage } from '../../../api/deleteInUse';
import { errorText } from '../../../components/booking/errorText';
import { useDevice } from '../../../layout/useDevice';
import { plural } from './ServiceList';

export type DeleteKind = 'service' | 'activity';
export interface DeleteTarget { id: string; name: string }
export type DeleteOutcome = 'deleted' | 'archived';

export const DELETE_TEXT = {
  delete: 'Smazat',
  cancel: 'Zrušit',
  close: 'Zavřít',
  archiveInstead: 'Archivovat místo toho',
  noPermission: 'Mazat může jen ten, kdo smí upravovat nastavení ordinace.',
  title: (kind: DeleteKind) => (kind === 'service' ? 'Smazat službu?' : 'Smazat činnost?'),
  body: (name: string) => `Opravdu smazat „${name}“? Smazání nelze vrátit.`,
  hint: 'Pokud na ní něco závisí, smazání se neprovede a nabídneme archivaci.',
  usageHeading: 'Co na ní závisí:',
  archiveNote: 'Archivace nic nesmaže — jen přestane se nabízet pro nové objednávky. Termíny a historie zůstanou.',
  deleted: (kind: DeleteKind, name: string) => `${kind === 'service' ? 'Služba' : 'Činnost'} „${name}“ byla smazána.`,
  archived: (kind: DeleteKind, name: string) => `${kind === 'service' ? 'Služba' : 'Činnost'} „${name}“ byla archivována.`,
  inUseFallback: 'Smazat to nejde, něco na tom ještě závisí.',
};

/** "12 objednávek", "3 klubové objednávky", ... - zero counts are left out. */
export function usageParts(usage: DeleteUsage): string[] {
  const parts: string[] = [];
  const add = (n: number, one: string, few: string, many: string) => { if (n > 0) parts.push(plural(n, one, few, many)); };
  add(usage.appointments, 'objednávka', 'objednávky', 'objednávek');
  add(usage.clubOrders, 'klubová objednávka', 'klubové objednávky', 'klubových objednávek');
  add(usage.clubBlocks, 'klubový blok', 'klubové bloky', 'klubových bloků');
  add(usage.priceItems, 'položka ceníku', 'položky ceníku', 'položek ceníku');
  add(usage.calendars, 'kalendář', 'kalendáře', 'kalendářů');
  add(usage.activities, 'činnost', 'činnosti', 'činností');
  return parts;
}
export const usageLine = (usage: DeleteUsage): string => usageParts(usage).join(', ');

export default function DeleteFlow({
  kind, target, onClose, remove, archive, onDone,
}: {
  kind: DeleteKind;
  /** `null` = closed. */
  target: DeleteTarget | null;
  onClose: () => void;
  remove: (id: string) => Promise<unknown>;
  archive: (id: string) => Promise<unknown>;
  /** Called once the change is in; the caller refreshes its lists (and leaves a deleted služba's detail). */
  onDone: (outcome: DeleteOutcome, target: DeleteTarget) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const device = useDevice();
  const [toast, setToast] = useState<string | null>(null);

  const finish = async (outcome: DeleteOutcome, done: DeleteTarget) => {
    await onDone(outcome, done);
    setToast(outcome === 'deleted' ? DELETE_TEXT.deleted(kind, done.name) : DELETE_TEXT.archived(kind, done.name));
    del.reset();
    arch.reset();
    onClose();
  };

  const del = useMutation({
    mutationFn: (done: DeleteTarget) => remove(done.id),
    onSuccess: (_r, done) => finish('deleted', done),
  });
  const arch = useMutation({
    mutationFn: (done: DeleteTarget) => archive(done.id),
    onSuccess: (_r, done) => finish('archived', done),
  });

  const inUse = isInUse(del.error) ? del.error : null;
  const parts = inUse !== null ? usageParts(inUse.usage) : [];
  const otherError = del.error && inUse === null ? del.error : arch.error;
  const busy = del.isPending || arch.isPending;
  const close = () => { del.reset(); arch.reset(); onClose(); };

  return (
    <>
      <Dialog open={target !== null} onClose={busy ? undefined : close} fullWidth maxWidth="xs" fullScreen={device === 'phone'}>
        <DialogTitle sx={{ fontWeight: 700 }}>{DELETE_TEXT.title(kind)}</DialogTitle>
        <DialogContent>
          <Typography>{DELETE_TEXT.body(target?.name ?? '')}</Typography>
          {inUse === null && <Typography sx={{ mt: 1.5 }} color="text.secondary">{DELETE_TEXT.hint}</Typography>}

          {inUse !== null && (
            <Stack spacing={1.5} sx={{ mt: 2 }} data-testid="delete-in-use">
              <Alert severity="warning">{inUse.serverMessage ?? DELETE_TEXT.inUseFallback}</Alert>
              {parts.length > 0 && (
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>{DELETE_TEXT.usageHeading}</Typography>
                  <Box component="ul" sx={{ m: 0, pl: 3 }} aria-label={DELETE_TEXT.usageHeading}>
                    {parts.map((part) => <li key={part}>{part}</li>)}
                  </Box>
                </Box>
              )}
              <Typography color="text.secondary">{DELETE_TEXT.archiveNote}</Typography>
            </Stack>
          )}

          {otherError ? <Alert severity="error" sx={{ mt: 2 }}>{errorText(otherError, t)}</Alert> : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={close} disabled={busy} sx={{ minHeight: 44 }}>
            {inUse !== null ? DELETE_TEXT.close : DELETE_TEXT.cancel}
          </Button>
          {inUse !== null ? (
            <Button
              variant="contained"
              disabled={busy}
              onClick={() => target && arch.mutate(target)}
              sx={{ minHeight: 44 }}
            >
              {DELETE_TEXT.archiveInstead}
            </Button>
          ) : (
            <Button
              variant="contained"
              color="error"
              disabled={busy}
              onClick={() => target && del.mutate(target)}
              sx={{ minHeight: 44 }}
            >
              {DELETE_TEXT.delete}
            </Button>
          )}
        </DialogActions>
      </Dialog>
      <Snackbar
        open={toast !== null}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        message={toast ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}
