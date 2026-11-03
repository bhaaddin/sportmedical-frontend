/* The clinician's decision (accept / edit / reject), its append-only history and the report button. */
import { useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { PictureAsPdf } from '@mui/icons-material';
import { StatusChip } from '../../components/ui';
import { usePermission } from '../../auth/usePermission';
import { BANDS, getReportBlob, useDecision, type Band, type ClipDetail, type DecisionInput, type FaultTag } from '../../api/movement';
import { decisionReady, decisionsNewestFirst, latestDecision, staffLabel, tagsForMovement } from '../lib/review';
import { formatDateTime, useMoveT } from '../i18n';
import { BAND_TONE } from './Findings';

type Action = DecisionInput['action'];

export function DecisionPanel({ clip }: { clip: ClipDetail }) {
  const { t } = useMoveT();
  const mayDecide = usePermission('movement.review');
  const mutation = useDecision(clip.clipId);
  const draftBand = clip.result?.score.band;
  const last = latestDecision(clip.decisions);
  const [action, setAction] = useState<Action | null>(null);
  const [band, setBand] = useState<Band | null>(null);
  const [tags, setTags] = useState<FaultTag[]>([]);
  const [unsure, setUnsure] = useState(false);
  const [note, setNote] = useState('');
  const [more, setMore] = useState(false);
  const [saved, setSaved] = useState(false);

  const { main, other } = tagsForMovement(clip.movement);
  const choose = (next: Action | null) => {
    if (next === null) return;
    setAction(next);
    setSaved(false);
    /* Accepting takes the draft's band as it stands; editing starts from it. */
    if (next !== 'reject' && band === null && draftBand !== undefined && draftBand !== 'needs_review') setBand(draftBand);
  };
  const ready = mayDecide && decisionReady(action, action === 'reject' ? 'x' : band);
  const toggleTag = (tag: FaultTag) => setTags((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]));

  const submit = () => {
    if (action === null) return;
    /* A rejection carries no band (the API does not ask for one); accept and edit do. */
    const sent: Band | null = action === 'reject' ? null : band;
    mutation.mutate(
      { action, band: sent, faultTags: tags, unsure, note: note.trim() },
      { onSuccess: () => { setSaved(true); setAction(null); setBand(null); setTags([]); setUnsure(false); setNote(''); } },
    );
  };

  const shownTags = more ? [...main, ...other] : main;

  return (
    <Stack spacing={2} sx={{ p: { xs: 1.5, md: 2 } }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('decision.hint')}</Typography>
      {!mayDecide && <Alert severity="info">{t('decision.readonly')}</Alert>}

      <Box component="fieldset" disabled={!mayDecide} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
        <Typography component="legend" sx={{ fontSize: 13, fontWeight: 700, mb: 0.75 }}>{t('decision.action')}</Typography>
        <ToggleButtonGroup exclusive value={action} onChange={(_, v: Action | null) => choose(v)} aria-label={t('decision.action')} fullWidth>
          {(['accept', 'edit', 'reject'] as const).map((a) => (
            <ToggleButton key={a} value={a} sx={{ minHeight: 44, textTransform: 'none', fontWeight: 600 }}>{t(`decision.${a}`)}</ToggleButton>
          ))}
        </ToggleButtonGroup>

        {action !== null && (
          <Stack spacing={2} sx={{ mt: 2 }}>
            {action !== 'reject' && (
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.75 }}>{t('decision.band')}</Typography>
                <ToggleButtonGroup exclusive value={band} onChange={(_, v: Band | null) => setBand(v)} aria-label={t('decision.band')} fullWidth>
                  {BANDS.map((b) => (
                    <ToggleButton key={b} value={b} sx={{ minHeight: 44, textTransform: 'none', fontWeight: 600 }}>{t(`band.${b}`)}</ToggleButton>
                  ))}
                </ToggleButtonGroup>
                {band === null && <Typography variant="caption" sx={{ color: 'error.main' }}>{t('decision.band.needed')}</Typography>}
              </Box>
            )}
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.75 }}>{t('decision.tags')}</Typography>
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                {shownTags.map((tag) => {
                  const on = tags.includes(tag);
                  return (
                    <Button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      aria-pressed={on}
                      variant={on ? 'contained' : 'outlined'}
                      size="small"
                      sx={{ minHeight: 44, textTransform: 'none', borderRadius: 999, px: 1.75 }}
                    >
                      {t(`tag.${tag}`)}
                    </Button>
                  );
                })}
                <Button onClick={() => setMore((m) => !m)} size="small" sx={{ minHeight: 44, textTransform: 'none' }}>
                  {more ? t('decision.tags.less') : t('decision.tags.more')}
                </Button>
              </Stack>
            </Box>
            <FormControlLabel
              sx={{ minHeight: 44, m: 0 }}
              control={<Checkbox checked={unsure} onChange={(e) => setUnsure(e.target.checked)} sx={{ p: 1.25 }} />}
              label={<Box><Typography sx={{ fontSize: 14, fontWeight: 600 }}>{t('decision.unsure')}</Typography><Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('decision.unsure.hint')}</Typography></Box>}
            />
            <TextField
              label={t('decision.note')}
              helperText={t('decision.note.hint')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              multiline
              minRows={2}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
            />
          </Stack>
        )}
      </Box>

      {mutation.isError && <Alert severity="error">{t('decision.failed')}</Alert>}
      {saved && <Alert severity="success" role="status">{t('decision.saved')}</Alert>}
      {action !== null && (
        <Button variant="contained" onClick={submit} disabled={!ready || mutation.isPending} sx={{ minHeight: 44 }}>
          {t('action.save')}
        </Button>
      )}

      <ReportButton clipId={clip.clipId} enabled={last !== null} />
      <DecisionHistory decisions={clip.decisions} />
    </Stack>
  );
}

export function ReportButton({ clipId, enabled }: { clipId: string; enabled: boolean }) {
  const { t } = useMoveT();
  /* The PDF leaves the system: it needs the download right as well as the right to open movement analysis. */
  const mayDownload = usePermission('exports.download');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const open = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const blob = await getReportBlob(clipId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box data-testid="report-block">
      <Button variant="outlined" startIcon={<PictureAsPdf />} onClick={() => void open()} disabled={!enabled || !mayDownload || busy} sx={{ minHeight: 44 }}>
        {t('action.report')}
      </Button>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
        {!mayDownload ? t('report.no_download') : enabled ? t('report.hint') : t('report.locked')}
      </Typography>
      {failed && <Alert severity="error" sx={{ mt: 1 }}>{t('report.failed')}</Alert>}
    </Box>
  );
}

export function DecisionHistory({ decisions }: { decisions: ClipDetail['decisions'] }) {
  const { t } = useMoveT();
  const list = decisionsNewestFirst(decisions);
  return (
    <Box component="section" aria-label={t('decision.history')} data-testid="decision-history">
      <Typography component="h3" sx={{ fontSize: 14, fontWeight: 700, mb: 0.75 }}>{t('decision.history')}</Typography>
      {list.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('decision.history.empty')}</Typography>
      ) : (
        <Stack component="ol" spacing={0.75} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {list.map((d) => (
            <Box
              component="li"
              key={d.id}
              sx={(theme) => ({ p: 1.25, borderRadius: 1.5, border: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.text.primary, 0.03) })}
            >
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                {d.band !== null && <StatusChip tone={BAND_TONE[d.band]} size="sm" dot>{t(`band.${d.band}`)}</StatusChip>}
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{t(`decision.${d.action}`)}</Typography>
                {d.unsure && <StatusChip tone="beige" size="sm">{t('decision.unsure.tag')}</StatusChip>}
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {t('decision.history.by', { who: staffLabel(d.decidedBy), when: formatDateTime(d.decidedAt) })}
              </Typography>
              {d.faultTags.length > 0 && (
                <Typography variant="body2">{d.faultTags.map((tag) => t(`tag.${tag as FaultTag}`)).join(', ')}</Typography>
              )}
              {d.note !== '' && <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{d.note}</Typography>}
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
