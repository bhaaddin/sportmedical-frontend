/*
 * Fronta e-mailů - what the clinic's e-mail has done: waiting, sent, failed, cancelled. A row opens the message (the text
 * as plain text, never as markup); a failed one can be sent again, a waiting or failed one can be cancelled.
 * On a server without the route the screen says so calmly.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { SettingsScreen } from '../SettingsFrame';
import { SettingsBoard } from '../SettingsBoard';
import { FilterChips, StatusChip, type ChipTone } from '../../../components/ui';
import { TARGET_SX } from '../../../ui/shelf';
import { formatPragueDateTime } from '../../../utils/time';
import { outboxApi, outboxActionProblem, outboxStatusOf, OUTBOX_STATUS_LABEL, type OutboxList, type OutboxMessage, type OutboxStatus } from '../../../api/outbox';

type Filter = OutboxStatus | 'all';

const TONE: Record<string, ChipTone> = { pending: 'beige', sent: 'green', failed: 'red', cancelled: 'grey' };

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Vše' },
  { key: 'failed', label: 'Selhalo' },
  { key: 'pending', label: 'Čeká' },
  { key: 'sent', label: 'Odesláno' },
  { key: 'cancelled', label: 'Zrušeno' },
];

/** A message body as readable text: markup is turned into text, never rendered. */
export function plainText(body: string): string {
  if (!/<[a-z!/][^>]*>/i.test(body)) return body;
  const doc = new DOMParser().parseFromString(body, 'text/html');
  doc.querySelectorAll('style,script,head').forEach((n) => n.remove());
  doc.querySelectorAll('br,p,div,tr,li,h1,h2,h3').forEach((n) => n.append('\n'));
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

export const labelOf = (m: OutboxMessage): string => m.statusLabel !== '' ? m.statusLabel : (OUTBOX_STATUS_LABEL[m.status as OutboxStatus] ?? m.status);
const whenOf = (m: OutboxMessage): string => {
  const at = m.sentAtUtc ?? m.createdAtUtc;
  return at === null ? '' : formatPragueDateTime(at);
};

export default function OutboxPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [list, setList] = useState<OutboxList | null>(null);
  const [oldServer, setOldServer] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState<OutboxMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setList(await outboxApi.list(filter === 'all' ? '' : filter));
      setOldServer(false);
    } catch (error) {
      const status = outboxStatusOf(error);
      if (status === 404 || status === 405) setOldServer(true);
      else if (status === 403) setLoadError('Frontu e-mailů smí zobrazit jen ten, kdo spravuje nastavení ordinace.');
      else setLoadError('Frontu e-mailů se nepodařilo načíst.');
    }
  }, [filter]);
  useEffect(() => { void load(); }, [load]);

  const act = async (verb: 'retry' | 'cancel') => {
    if (open === null || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const next = verb === 'retry' ? await outboxApi.retry(open.id) : await outboxApi.cancel(open.id);
      setOpen(null);
      setNote(verb === 'retry' ? 'Zpráva čeká na odeslání.' : 'Zpráva byla zrušena.');
      void next;
      await load();
    } catch (error) {
      setProblem(outboxActionProblem(error, verb));
    } finally {
      setBusy(false);
    }
  };

  const items = list?.items ?? [];

  return (
    <SettingsScreen
      title="Fronta e-mailů"
      subtitle="Co se s e-maily ordinace stalo: čekají, odešly, nebo selhaly"
      aside={false}
      loading={list === null && !oldServer && loadError === null}
      error={loadError ?? undefined}
      onRetry={() => { void load(); }}
      actions={oldServer ? undefined : <Button startIcon={<Refresh />} onClick={() => { void load(); }} sx={TARGET_SX}>Obnovit</Button>}
    >
      {oldServer ? (
        <Alert severity="info">Fronta e-mailů zatím není na serveru k dispozici. Jakmile bude, objeví se tady.</Alert>
      ) : list === null ? null : (
        <Stack spacing={2}>
          {note !== null ? <Alert severity="success" onClose={() => setNote(null)}>{note}</Alert> : null}
          {!list.senderConfigured ? (
            <Alert severity="warning">Odesílání e-mailů není nastaveno. Zprávy čekají ve frontě a odejdou, jakmile bude nastaveno.</Alert>
          ) : null}
          <FilterChips ariaLabel="Stav zpráv" options={FILTERS.map((f) => ({ ...f, ...(f.key === 'pending' ? { count: list.pending } : {}) }))} value={filter} onChange={setFilter} />
          <SettingsBoard id="outbox-list" title="Zprávy" padding={0}>
            {items.length === 0 ? (
              <Typography sx={{ p: 3, color: 'text.secondary' }}>Žádné zprávy k zobrazení.</Typography>
            ) : (
              <Box component="ul" aria-label="E-maily" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {items.map((m) => (
                  <Box component="li" key={m.id} sx={{ borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 0 } }}>
                    <ButtonBase
                      onClick={() => { setOpen(m); setProblem(null); }}
                      sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, minHeight: 56, textAlign: 'left', justifyContent: 'flex-start' }}
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography noWrap sx={{ fontWeight: 600 }}>{m.subject !== '' ? m.subject : '(bez předmětu)'}</Typography>
                        <Typography noWrap variant="body2" sx={{ color: 'text.secondary' }}>{m.to} · {whenOf(m)}</Typography>
                      </Box>
                      <StatusChip tone={TONE[m.status] ?? 'grey'}>{labelOf(m)}</StatusChip>
                    </ButtonBase>
                  </Box>
                ))}
              </Box>
            )}
          </SettingsBoard>
        </Stack>
      )}

      <Dialog open={open !== null} onClose={() => { if (!busy) setOpen(null); }} fullWidth maxWidth="sm" aria-labelledby="outbox-title">
        {open === null ? null : (
          <>
            <DialogTitle id="outbox-title" sx={{ overflowWrap: 'anywhere' }}>{open.subject !== '' ? open.subject : '(bez předmětu)'}</DialogTitle>
            <DialogContent>
              <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 1.5 }}>
                <StatusChip tone={TONE[open.status] ?? 'grey'}>{labelOf(open)}</StatusChip>
                <Typography variant="body2" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
                  Komu: {open.to} · pokusů {open.attempts}{whenOf(open) !== '' ? ` · ${whenOf(open)}` : ''}
                </Typography>
              </Stack>
              {open.lastError !== null && open.lastError !== '' ? <Alert severity="error" sx={{ mb: 1.5 }}>{open.lastError}</Alert> : null}
              {problem !== null ? <Alert severity="warning" sx={{ mb: 1.5 }}>{problem}</Alert> : null}
              <Typography component="pre" aria-label="Text zprávy" sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'inherit', fontSize: 14 }}>
                {plainText(open.body)}
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Button onClick={() => setOpen(null)} disabled={busy} sx={TARGET_SX}>Zavřít</Button>
              {open.status === 'pending' || open.status === 'failed' ? (
                <Button color="inherit" onClick={() => { void act('cancel'); }} disabled={busy} sx={TARGET_SX}>Zrušit odeslání</Button>
              ) : null}
              {open.status === 'failed' ? (
                <Button variant="contained" onClick={() => { void act('retry'); }} disabled={busy} sx={TARGET_SX}>Odeslat znovu</Button>
              ) : null}
            </DialogActions>
          </>
        )}
      </Dialog>
    </SettingsScreen>
  );
}
