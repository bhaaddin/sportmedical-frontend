/* ══════════════════════════════════════════════════════════════
   B2 — FRONTA KE KONTROLE  (route: /intake-review)

   Daily reception workflow. Each staged questionnaire is shown beside
   its candidate patients with the differences highlighted, and resolves
   in one click: Sloučit / Vytvořit nového / Zamítnout.

   Owner/Administrator only — merging two records is irreversible in
   practice, so Staff can see the queue but not resolve it.
   ══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { CheckCircle, Warning, PersonAdd, Block, Refresh } from '@mui/icons-material';
import {
  IntakeOutcome,
  IntakeResolution,
  fetchIntakeDetail,
  fetchIntakeQueue,
  isStaleResolution,
  outcomeOf,
  resolveIntake,
} from '../api/intakeReview';
import type {
  IntakeCandidate,
  IntakeQueueEntry,
  IntakeReviewDetail,
} from '../api/intakeReview';

export default function IntakeReviewQueue() {
  const [entries, setEntries] = useState<IntakeQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<IntakeQueueEntry | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  /*
   * Candidates are not in the list - the server sends a summary and computes
   * matches only on demand. So a row is opened, and only then does anybody pay
   * for the matching. Kept per intake id rather than as one "open row" so
   * reopening a row the reviewer already looked at does not re-ask.
   */
  const [details, setDetails] = useState<Record<string, IntakeReviewDetail>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [detailFailed, setDetailFailed] = useState<string | null>(null);

  const openEntry = async (entry: IntakeQueueEntry): Promise<void> => {
    const next = openId === entry.intakeId ? null : entry.intakeId;
    setOpenId(next);
    setDetailFailed(null);
    if (next === null || details[entry.intakeId] !== undefined) return;
    try {
      const detail = await fetchIntakeDetail(entry.intakeId);
      setDetails((current) => ({ ...current, [entry.intakeId]: detail }));
    } catch {
      /* Not "no candidates" - nobody was asked. Saying the former would let a
         reviewer create a duplicate patient believing none existed. */
      setDetailFailed(entry.intakeId);
    }
  };

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await fetchIntakeQueue());
    } catch {
      setError('Frontu se nepodařilo načíst. Zkuste to prosím znovu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (
    entry: IntakeQueueEntry,
    resolution: IntakeResolution,
    candidate?: IntakeCandidate,
    reason?: string,
  ): Promise<void> => {
    setBusyId(entry.intakeId);
    setError(null);
    try {
      await resolveIntake({
        intakeId: entry.intakeId,
        resolution,
        patientId: candidate?.patientId,
        candidateRevision: candidate?.revision,
        reason,
      });
      setEntries((current) => current.filter((e) => e.intakeId !== entry.intakeId));
    } catch (caught) {
      setError(
        isStaleResolution(caught)
          ? 'Údaje se mezitím změnily, takže akci nelze provést. Frontu jsem načetl znovu — zkontrolujte prosím záznam ještě jednou.'
          : 'Akci se nepodařilo provést. Zkuste to prosím znovu.',
      );
      if (isStaleResolution(caught)) void load();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Fronta ke kontrole
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {entries.length === 0
              ? 'Nic nečeká na kontrolu.'
              : `${entries.length} ${entries.length === 1 ? 'záznam čeká' : 'záznamů čeká'} na rozhodnutí.`}
          </Typography>
        </Box>
        <Button startIcon={<Refresh />} onClick={() => void load()}>
          Načíst znovu
        </Button>
      </Box>

      {error !== null && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {entries.length === 0 ? (
        <Paper sx={{ p: 6, borderRadius: 3, textAlign: 'center' }}>
          <CheckCircle sx={{ fontSize: 56, color: 'success.main', mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Fronta je prázdná
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Všechny dotazníky jsou vyřízené.
          </Typography>
        </Paper>
      ) : (
        entries.map((entry) => (
          <Paper key={entry.intakeId} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {entry.givenName} {entry.familyName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                nar. {entry.dateOfBirth}
              </Typography>
              <Chip
                size="small"
                label={entry.referenceNumber}
                sx={{ fontFamily: 'monospace', fontSize: 11 }}
              />
              {/*
                What the matcher concluded, in words. It arrives as a number -
                0, 1, 2 - and an unrecognised one is shown as unknown rather
                than folded into a safe-looking default: a reviewer told
                "založit nového" because a value fell through would create the
                duplicate the queue exists to prevent.
              */}
              {(() => {
                const outcome = outcomeOf(entry.outcome);
                if (outcome === null) {
                  return (
                    <Chip
                      size="small"
                      color="warning"
                      label={`neznámý výsledek (${entry.outcome})`}
                    />
                  );
                }
                return (
                  <Chip
                    size="small"
                    color={outcome === IntakeOutcome.ReviewRequired ? 'warning' : 'default'}
                    label={
                      outcome === IntakeOutcome.ReviewRequired
                        ? 'Ke kontrole'
                        : outcome === IntakeOutcome.AutoAssignToExisting
                          ? 'Shoda s pacientem'
                          : 'Nový pacient'
                    }
                  />
                );
              })()}
              <Box sx={{ flexGrow: 1 }} />
              <Typography variant="caption" color="text.secondary">
                {new Date(entry.submittedAtUtc).toLocaleString('cs-CZ')}
              </Typography>
            </Box>

            {/*
              The summary row carries `topScore` but never the candidates, so
              until a reviewer opens the record there is nothing to compare -
              and "no similar patient" must not be printed before anybody has
              looked, or somebody creates a duplicate believing it was checked.
            */}
            <Box sx={{ mb: 2 }}>
              <Button size="small" onClick={() => void openEntry(entry)}>
                {openId === entry.intakeId
                  ? 'Skrýt možné shody'
                  : entry.topScore > 0
                    ? `Zobrazit možné shody (nejvyšší skóre ${entry.topScore})`
                    : 'Zobrazit možné shody'}
              </Button>
            </Box>

            {openId === entry.intakeId && detailFailed === entry.intakeId && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Možné shody se nepodařilo načíst. Neznamená to, že žádné nejsou —
                zkuste to prosím znovu, než záznam vyřídíte.
              </Alert>
            )}

            {openId === entry.intakeId &&
              detailFailed !== entry.intakeId &&
              details[entry.intakeId] === undefined && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={20} />
                </Box>
              )}

            {openId === entry.intakeId &&
            details[entry.intakeId] !== undefined &&
            details[entry.intakeId].candidates.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                Žádný podobný pacient nenalezen. Lze rovnou založit nového.
              </Alert>
            ) : (
              (openId === entry.intakeId
                ? (details[entry.intakeId]?.candidates ?? [])
                : []
              ).map((candidate: IntakeCandidate) => (
                <Box key={candidate.patientId} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Možná shoda: {candidate.fullName}
                    </Typography>
                    <Chip
                      size="small"
                      color={candidate.score >= 80 ? 'warning' : 'default'}
                      label={`skóre ${candidate.score}`}
                    />
                  </Box>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '160px 1fr 1fr' },
                      gap: 0.5,
                      fontSize: 14,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" />
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                      Z dotazníku
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                      Stávající pacient
                    </Typography>

                    {candidate.fields.map((field) => (
                      <FieldRow key={field.field} field={field} />
                    ))}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={busyId === entry.intakeId}
                      onClick={() => void resolve(entry, IntakeResolution.Merge, candidate)}
                    >
                      Sloučit s tímto pacientem
                    </Button>
                  </Box>

                  <Divider sx={{ mt: 2 }} />
                </Box>
              ))
            )}

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<PersonAdd />}
                disabled={busyId === entry.intakeId}
                onClick={() => void resolve(entry, IntakeResolution.CreateNew)}
              >
                Vytvořit nového pacienta
              </Button>
              <Button
                size="small"
                color="error"
                startIcon={<Block />}
                disabled={busyId === entry.intakeId}
                onClick={() => {
                  setRejectReason('');
                  setRejecting(entry);
                }}
              >
                Zamítnout
              </Button>
            </Box>
          </Paper>
        ))
      )}

      {/* Rejection is the one action that destroys a patient's submission, so
          it asks for a reason. Every resolution is audited; this one needs the
          "why" to be readable a year later. */}
      <Dialog open={rejecting !== null} onClose={() => setRejecting(null)} fullWidth maxWidth="sm">
        <DialogTitle>Zamítnout dotazník</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Důvod se uloží do auditu spolu s vaším jménem a časem.
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            autoFocus
            label="Důvod zamítnutí"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Například: testovací odeslání, duplicitní žádost…"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejecting(null)}>Zpět</Button>
          <Button
            color="error"
            variant="contained"
            disabled={rejectReason.trim().length < 3}
            onClick={() => {
              const entry = rejecting;
              setRejecting(null);
              if (entry !== null) {
                void resolve(entry, IntakeResolution.Reject, undefined, rejectReason.trim());
              }
            }}
          >
            Zamítnout
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function FieldRow({ field }: { field: { label: string; submitted: string | null; candidate: string | null; matches: boolean; sensitive: boolean } }) {
  const differs = !field.matches;

  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ py: 0.5 }}>
        {field.label}
        {field.sensitive && (
          <Tooltip title="Citlivý identifikátor — zobrazeno podle vaší role">
            <Warning sx={{ fontSize: 13, ml: 0.5, verticalAlign: 'middle', color: 'text.disabled' }} />
          </Tooltip>
        )}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          py: 0.5,
          px: 1,
          borderRadius: 1,
          fontWeight: differs ? 700 : 400,
          bgcolor: differs ? 'warning.light' : 'transparent',
        }}
      >
        {field.submitted ?? '—'}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          py: 0.5,
          px: 1,
          borderRadius: 1,
          fontWeight: differs ? 700 : 400,
          bgcolor: differs ? 'warning.light' : 'transparent',
        }}
      >
        {field.candidate ?? '—'}
      </Typography>
    </>
  );
}
