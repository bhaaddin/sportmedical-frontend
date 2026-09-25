/* ══════════════════════════════════════════════════════════════
   ODCHOZÍ E-MAILY  (route: /nastaveni/odchozi-emaily)

   What GET /api/system/outbox returns and nothing else: the messages the
   system generated for patients and for the clinic, with the text each
   would be sent as, and whether it left. Read-only — nothing here sends,
   retries or deletes.

   Why it exists: a message is queued even when no SMTP server is set up,
   so the owner has to be able to read what would go out rather than take
   it on trust. Until this screen the queue was a table nobody could see.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { ExpandMore, ExpandLess, Refresh } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { OUTBOX_QUERY_KEY, readOutbox, templateLabel } from '../../api/systemOutbox';
import type { OutboxMessage } from '../../api/systemOutbox';
import { formatPragueDateTime } from '../../utils/time';

const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  pending: 'warning',
  sent: 'success',
  failed: 'error',
};

/**
 * The body is our own generated HTML, so it is shown as text with the tags
 * stripped: the owner wants to read the sentences, not the markup, and a
 * screen that rendered HTML from a database table would be one more place
 * to get injection wrong for no gain.
 */
export function bodyAsText(html: string): string {
  return html
    .replace(/<\/p>\s*/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#x2B;/gi, '+')
    .replace(/&amp;/g, '&')
    .trim();
}

export default function OutboxQueuePage() {
  const query = useQuery({ queryKey: OUTBOX_QUERY_KEY, queryFn: () => readOutbox(100), refetchInterval: 30_000 });
  const [open, setOpen] = useState<string | null>(null);

  if (query.isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (query.isError || !query.data) {
    return <Alert severity="error">Frontu e-mailů se nepodařilo načíst.</Alert>;
  }

  const { items, pending, senderConfigured } = query.data;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Odchozí e-maily</Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            Každý e-mail, který systém vygeneroval pacientovi nebo ordinaci — potvrzení, přesuny,
            zrušení. Tady je vidět celý text a jestli zpráva odešla. Jen ke čtení: nic se odsud neposílá
            ani nemaže.
          </Typography>
        </Box>
        <Tooltip title="Načíst znovu">
          <span>
            <IconButton onClick={() => { void query.refetch(); }} disabled={query.isFetching}>
              <Refresh />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {!senderConfigured && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          Odesílání e-mailů není nastaveno (chybí SMTP server), takže zprávy zůstávají ve frontě
          a čekají. Nic se neztratí — odejdou, jakmile bude odesílání nastaveno.
          {pending > 0 ? ` Ve frontě teď čeká ${pending}.` : ''}
        </Alert>
      )}
      {senderConfigured && pending > 0 && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          Ve frontě čeká {pending} — odesílání běží každých 30 sekund.
        </Alert>
      )}

      {items.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Zatím žádný e-mail. První se objeví, jakmile někdo objedná, přesune nebo zruší termín.
        </Alert>
      ) : (
        <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40 }} />
                <TableCell>Vytvořeno</TableCell>
                <TableCell>Komu</TableCell>
                <TableCell>Co</TableCell>
                <TableCell>Předmět</TableCell>
                <TableCell>Stav</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((message) => (
                <MessageRows
                  key={message.id}
                  message={message}
                  open={open === message.id}
                  onToggle={() => setOpen(open === message.id ? null : message.id)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

function MessageRows({
  message,
  open,
  onToggle,
}: {
  message: OutboxMessage;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow hover sx={{ cursor: 'pointer' }} onClick={onToggle}>
        <TableCell>
          <IconButton size="small" aria-label={open ? 'Skrýt text' : 'Zobrazit text'}>
            {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatPragueDateTime(message.createdAtUtc)}</TableCell>
        <TableCell>{message.to}</TableCell>
        <TableCell>{templateLabel(message.templateCode)}</TableCell>
        <TableCell>{message.subject}</TableCell>
        <TableCell>
          <Tooltip
            title={
              message.status === 'failed' && message.lastError
                ? `Poslední chyba: ${message.lastError}`
                : message.sentAtUtc
                  ? `Odesláno ${formatPragueDateTime(message.sentAtUtc)}`
                  : `Pokusů o odeslání: ${message.attempts}`
            }
          >
            <Chip size="small" label={message.statusLabel} color={STATUS_COLOR[message.status] ?? 'default'} />
          </Tooltip>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={6} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ py: 2, px: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Text zprávy tak, jak by odešla
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>
                {bodyAsText(message.body)}
              </Typography>
              {message.lastError && (
                <Alert severity="error" sx={{ mt: 1.5 }}>Poslední chyba: {message.lastError}</Alert>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}
