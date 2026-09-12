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
  Typography,
} from '@mui/material';
import { CheckCircle, PersonAdd, Block, Refresh } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { formatDateOnly } from '../utils/time';
import {
  IntakeOutcome,
  IntakeResolution,
  fetchIntakeDetail,
  fetchIntakeQueue,
  isStaleResolution,
  outcomeOf,
  linkIntake,
  registerIntake,
  dismissIntake,
} from '../api/intakeReview';
import type {
  IntakeCandidate,
  IntakeMatchSignals,
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
  /* Merging asks for a reason too - the server requires one, and it is the
     only action here that cannot be re-read from the record afterwards. */
  const [merging, setMerging] = useState<{ entry: IntakeQueueEntry; candidate: IntakeCandidate } | null>(null);
  const [mergeReason, setMergeReason] = useState('');
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

  /*
   * One handler, three endpoints. The server has no single "resolve" route -
   * that was this screen's invention, and it answered 405 for every button.
   */
  const resolve = async (
    entry: IntakeQueueEntry,
    resolution: IntakeResolution,
    candidate?: IntakeCandidate,
    reason?: string,
  ): Promise<void> => {
    setBusyId(entry.intakeId);
    setError(null);
    try {
      if (resolution === IntakeResolution.Merge) {
        /* Guarded rather than assumed: `link` refuses without both, and a 400
           here would read to the reviewer as "the server is broken". */
        if (candidate === undefined || reason === undefined || reason.trim() === '') {
          setError('K sloučení je potřeba vybraný pacient a důvod.');
          return;
        }
        await linkIntake(entry.intakeId, candidate.patientId, reason.trim());
      } else if (resolution === IntakeResolution.CreateNew) {
        await registerIntake(entry.intakeId);
      } else {
        await dismissIntake(entry.intakeId, (reason ?? '').trim());
      }
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
                {/* A birth date is a date, not an instant: formatted with no
                    zone conversion, and in Czech like everything around it.
                    It rendered as `1989-11-09` next to a Czech timestamp. */}
                nar. {formatDateOnly(entry.dateOfBirth)}
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Možná shoda
                    </Typography>
                    <Chip
                      size="small"
                      color={candidate.score >= 80 ? 'warning' : 'default'}
                      label={`skóre ${candidate.score}`}
                    />
                    {/* The server sends no name for the candidate, only which
                        fields agree. Opening the card is the deliberate act
                        that shows the record itself. */}
                    <Button
                      size="small"
                      component={RouterLink}
                      to={`/patients/${candidate.patientId}`}
                      target="_blank"
                    >
                      Otevřít kartu pacienta
                    </Button>
                  </Box>

                  <SignalSummary signals={candidate.signals} />

                  <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={busyId === entry.intakeId}
                      onClick={() => {
                        setMergeReason('');
                        setMerging({ entry, candidate });
                      }}
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
      <Dialog open={merging !== null} onClose={() => setMerging(null)} fullWidth maxWidth="sm">
        <DialogTitle>Sloučit s pacientem</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Dotazník se připojí ke stávajícímu pacientovi. Důvod se uloží do
            auditu spolu s vaším jménem a časem.
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            autoFocus
            label="Důvod sloučení"
            placeholder="Např. shoduje se rodné číslo i telefon, ověřeno u pacienta."
            value={mergeReason}
            onChange={(event) => setMergeReason(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMerging(null)}>Zrušit</Button>
          <Button
            variant="contained"
            disabled={mergeReason.trim().length < 3}
            onClick={() => {
              const pending = merging;
              setMerging(null);
              if (pending !== null) {
                void resolve(pending.entry, IntakeResolution.Merge, pending.candidate, mergeReason.trim());
              }
            }}
          >
            Sloučit
          </Button>
        </DialogActions>
      </Dialog>

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

/*
 * What the server will say about a duplicate, and nothing more.
 *
 * The match result is booleans only - no name, no birth number, no telephone.
 * This renders them as two plain lists, because "which fields agree" is the
 * question the reviewer is holding, and a grid of "—" against "—" answered it
 * worse while looking like it held data.
 *
 * `anchorMatches` is drawn apart and first: the birth number or insurer number
 * settles the question on its own, and a reviewer who sees it should not have
 * to weigh the rest.
 */
function SignalSummary({ signals }: { signals: IntakeMatchSignals }) {
  const named: Array<{ label: string; matches: boolean; note?: string }> = [
    { label: 'jméno', matches: signals.givenNameMatches },
    { label: 'příjmení', matches: signals.familyNameMatches },
    { label: 'datum narození', matches: signals.dateOfBirthMatches },
    {
      label: 'e-mail',
      matches: signals.emailMatches,
      note: signals.emailMatches && !signals.emailIsVerified ? 'neověřený' : undefined,
    },
    {
      label: 'telefon',
      matches: signals.phoneMatches,
      note: signals.phoneMatches && !signals.phoneIsVerified ? 'neověřený' : undefined,
    },
  ];

  const agreeing = named.filter((f) => f.matches);
  const differing = named.filter((f) => !f.matches);
  const render = (f: { label: string; note?: string }) =>
    f.note === undefined ? f.label : `${f.label} (${f.note})`;

  return (
    <Box sx={{ fontSize: 14 }}>
      {signals.anchorMatches && (
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'warning.dark', mb: 0.5 }}>
          Shoduje se rodné číslo nebo číslo pojištěnce — jde téměř jistě o stejnou osobu.
        </Typography>
      )}
      {signals.nameAndDateOfBirthMatch && !signals.anchorMatches && (
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'warning.dark', mb: 0.5 }}>
          Shoduje se jméno i datum narození.
        </Typography>
      )}

      <Typography variant="body2" color="text.secondary">
        <Box component="span" sx={{ fontWeight: 700 }}>Shoduje se: </Box>
        {agreeing.length === 0 ? 'nic z porovnávaných údajů' : agreeing.map(render).join(', ')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        <Box component="span" sx={{ fontWeight: 700 }}>Neshoduje se: </Box>
        {differing.length === 0 ? 'nic — všechny porovnávané údaje sedí' : differing.map(render).join(', ')}
      </Typography>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        Server porovnává údaje na své straně a posílá jen výsledek, ne hodnoty
        druhého pacienta. Konkrétní záznam si otevřete tlačítkem výše.
      </Typography>
    </Box>
  );
}
