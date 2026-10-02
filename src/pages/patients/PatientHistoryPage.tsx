/*
 * One patient's history — what happened to this person, in order.
 *
 * The global audit log could always be searched, but a doctor or admin standing
 * on a patient's file had no way to ask "what changed here, and who changed it."
 * The server already answered it (`GET /api/audit/entity/Patient/{id}`, values
 * masked); this is the view that was missing. Part of making the file feel like
 * one connected place rather than four separate screens.
 */
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Stack, Typography } from '@mui/material';
import { auditApi, AUDIT_ENTITY } from '../../api/audit';
import type { AuditEntry } from '../../api/audit';
import { AsyncSection } from '../../components/booking/AsyncSection';
import { SectionLabel, SoftCard, StatusChip } from '../../components/ui';
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

export default function PatientHistoryPage() {
  const { id } = useParams<{ id: string }>();

  const query = useQuery({
    queryKey: ['patient-audit', id],
    queryFn: () => auditApi.listByEntity(AUDIT_ENTITY.patient, id!),
    enabled: id !== undefined,
  });

  const entries = useMemo(() => query.data ?? [], [query.data]);

  return (
    <SoftCard>
      <SectionLabel sx={{ mb: 0.25 }}>Historie změn</SectionLabel>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Co se u tohoto pacienta změnilo, kdo to změnil a kdy. Citlivé údaje jsou
        skryté.
      </Typography>

      <AsyncSection
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={entries.length === 0}
        isSettled={!query.isLoading}
        emptyText="Zatím není zaznamenaná žádná změna tohoto pacienta."
        onRetry={() => query.refetch()}
      >
        <Stack spacing={0}>
          {entries.map((entry) => {
            const diff = changes(entry);
            return (
              <Box
                key={entry.id}
                sx={{ py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'center', flexWrap: 'wrap', mb: diff.length > 0 || entry.notes ? 0.75 : 0 }}
                >
                  <StatusChip tone={actionTone(entry.action)}>{entry.action}</StatusChip>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {entry.userEmail || 'Systém'}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {new Date(entry.timestamp).toLocaleString('cs-CZ')}
                  </Typography>
                </Stack>

                {entry.notes ? (
                  <Typography variant="body2" sx={{ mb: diff.length > 0 ? 0.75 : 0 }}>
                    {entry.notes}
                  </Typography>
                ) : null}

                {diff.length > 0 ? (
                  <Stack spacing={0.25}>
                    {diff.map((c) => (
                      <Typography key={c.key} variant="body2" sx={{ color: 'text.secondary', fontSize: 13 }}>
                        <strong>{c.key}</strong>: {c.from} → {c.to}
                      </Typography>
                    ))}
                  </Stack>
                ) : null}
              </Box>
            );
          })}
        </Stack>
      </AsyncSection>
    </SoftCard>
  );
}
