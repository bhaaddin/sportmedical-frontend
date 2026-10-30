/*
 * One patient's history — what happened to this person, in order.
 *
 * The global audit log could always be searched, but a doctor or admin standing
 * on a patient's file had no way to ask "what changed here, and who changed it."
 * The server already answered it (`GET /api/audit/entity/Patient/{id}`, values
 * masked); this is the view that was missing. Part of making the file feel like
 * one connected place rather than four separate screens.
 *
 * Shelves: Změny karty (who, when, why - every change of identifying data
 * carries a reason and an author) and Přístupy (opening or exporting the file,
 * only when the server recorded any).
 */
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Stack, Typography } from '@mui/material';
import { auditApi, AUDIT_ENTITY } from '../../api/audit';
import type { AuditEntry } from '../../api/audit';
import { StatusChip } from '../../components/ui';
import { Shelf } from '../../ui/shelf';
import { usePermission } from '../../auth/usePermission';
import { ShelfRow } from './ShelfRow';
import type { ChipTone } from '../../components/ui';

/** A recorded value is either a field map or a plain string; normalise to a map. */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/** The fields that differ between before and after, for a compact "x: a → b". */
function changes(entry: AuditEntry): { key: string; from: string; to: string }[] {
  const before = asRecord(entry.oldValue);
  const after = asRecord(entry.newValue);
  if (after === null) return [];
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after)]);
  const out: { key: string; from: string; to: string }[] = [];
  for (const key of keys) {
    const from = show(before?.[key]);
    const to = show(after[key]);
    if (from !== to) out.push({ key, from, to });
  }
  return out;
}

/** Colour a few known action families; anything else stays neutral. */
function actionTone(action: string): ChipTone {
  if (/creat|register/i.test(action)) return 'green';
  if (/delet|archiv|revoke|merge/i.test(action)) return 'red';
  if (/chang|updat|edit|correct|move/i.test(action)) return 'blue';
  return 'grey';
}

/** Opening, reading or exporting the file: not a change of it, so it stands on its own shelf. */
export function isAccess(action: string): boolean {
  return /view|read|open|access|export|download|print/i.test(action) && !/creat|updat|chang|edit|delet|merg|archiv/i.test(action);
}

function EntryRow({ entry }: { entry: AuditEntry }) {
  const diff = changes(entry);
  return (
    <ShelfRow
      testId="history-entry"
      title={(
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
          <StatusChip tone={actionTone(entry.action)}>{entry.action}</StatusChip>
          <Box component="span">{entry.userEmail || 'Systém'}</Box>
        </Stack>
      )}
      trailing={(
        <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
          {new Date(entry.timestamp).toLocaleString('cs-CZ')}
        </Typography>
      )}
      below={entry.notes || diff.length > 0 ? (
        <Box sx={{ mt: 0.75 }}>
          {entry.notes ? (
            <Typography variant="body2" sx={{ mb: diff.length > 0 ? 0.5 : 0 }}>
              <Box component="span" sx={{ color: 'text.secondary' }}>Důvod: </Box>{entry.notes}
            </Typography>
          ) : null}
          {diff.length > 0 ? (
            <Stack spacing={0.25}>
              {diff.map((c) => (
                <Typography key={c.key} variant="body2" sx={{ color: 'text.secondary', fontSize: 13, overflowWrap: 'anywhere' }}>
                  <strong>{c.key}</strong>: {c.from} → {c.to}
                </Typography>
              ))}
            </Stack>
          ) : null}
        </Box>
      ) : undefined}
    />
  );
}

export default function PatientHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const mayEdit = usePermission('patients.edit');
  /* The audit log answers only whoever oversees the clinic (`settings.clinic.manage`); nobody else is asked, and the shelf
     says why it is empty rather than failing. */
  const mayRead = usePermission('settings.clinic.manage');

  const query = useQuery({
    queryKey: ['patient-audit', id],
    queryFn: () => auditApi.listByEntity(AUDIT_ENTITY.patient, id!),
    enabled: id !== undefined && mayRead,
  });

  const entries = useMemo(() => query.data ?? [], [query.data]);
  const changed = useMemo(() => entries.filter((e) => !isAccess(e.action)), [entries]);
  const accessed = useMemo(() => entries.filter((e) => isAccess(e.action)), [entries]);
  const settled = mayRead && !query.isLoading && !query.isError;

  return (
    <Stack spacing={3} data-shelf-section="historie">
      <Shelf
        id="changes"
        title="Změny karty"
        hint="Kdo, kdy a proč. Citlivé údaje jsou skryté."
        count={settled ? changed.length : undefined}
        viewAll={mayRead && id !== undefined ? { to: `/audit-log?entity=${AUDIT_ENTITY.patient}&entityId=${encodeURIComponent(id)}`, label: 'Auditní log' } : undefined}
        layout="list"
        stagger={false}
        loading={mayRead && query.isLoading}
        error={mayRead && query.isError ? 'Historii se nepodařilo načíst.' : false}
        onRetry={() => void query.refetch()}
        empty={!mayRead || changed.length === 0}
        emptyState={!mayRead ? { text: 'Historii změn karty vidí správce kliniky.' } : {
          text: 'Zatím není zaznamenaná žádná změna tohoto pacienta.',
          ...(id !== undefined && mayEdit ? { action: { label: 'Upravit kartu', to: `/patients/${id}/edit` } } : {}),
        }}
      >
        {changed.map((entry) => <EntryRow key={entry.id} entry={entry} />)}
      </Shelf>

      {settled && accessed.length > 0 && (
        <Shelf id="access" title="Přístupy" hint="Kdo kartu otevřel nebo exportoval" count={accessed.length} countTone="grey" layout="list" stagger={false} maxHeight="min(46dvh, 440px)">
          {accessed.map((entry) => <EntryRow key={entry.id} entry={entry} />)}
        </Shelf>
      )}
    </Stack>
  );
}
