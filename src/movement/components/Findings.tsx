/* Score chip, flag list (by severity) and the left-right metrics table. */
import { Box, Button, Stack, Typography } from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import { StatusChip, type ChipTone } from '../../components/ui';
import type { ClipDetail, Flag, Metric } from '../../api/movement';
import { asymmetryLevel, formatAsymmetry, formatValue, metricRows, outsideNorm } from '../lib/asymmetry';
import { groupFlags, latestDecision, scoreView } from '../lib/review';
import { formatDateTime, useMoveT } from '../i18n';
import { metricName, staffLabel } from '../lib/review';

/** The chip pops when the score changes (a decision arrives): only under Animace "plné". */
const pop = keyframes`from { transform: scale(0.86); opacity: 0.4; } 60% { transform: scale(1.07); } to { transform: scale(1); opacity: 1; }`;

export const BAND_TONE: Record<string, ChipTone> = { green: 'green', watch: 'beige', red: 'red', needs_review: 'blue' };
const SEVERITY_TONE: Record<Flag['severity'], ChipTone> = { red: 'red', watch: 'beige', info: 'grey' };

export function BandChip({ band }: { band: 'green' | 'watch' | 'red' | 'needs_review' }) {
  const { t } = useMoveT();
  return <StatusChip tone={BAND_TONE[band]} dot>{t(`band.${band}`)}</StatusChip>;
}

/** The score: a draft until a clinician decides. */
export function ScoreBlock({ clip }: { clip: ClipDetail }) {
  const { t, maybe } = useMoveT();
  const view = scoreView(clip);
  const result = clip.result;
  if (view === null || !result) return null;
  const decision = latestDecision(clip.decisions);
  return (
    <Stack spacing={1} data-testid="score-block" sx={{ p: { xs: 1.5, md: 2 } }}>
      <Stack
        key={`${view.kind}-${'band' in view ? view.band : ''}`}
        direction="row"
        data-testid="score-chips"
        sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap', animation: `${pop} 420ms ease-out`, 'html:not([data-motion="full"]) &': { animation: 'none' } }}
      >
        {view.kind === 'needs_review' && <BandChip band="needs_review" />}
        {view.kind === 'draft' && <BandChip band={view.band} />}
        {view.kind === 'decided' && <BandChip band={view.band} />}
        {view.kind === 'rejected' && <StatusChip tone="grey" dot>{t('band.rejected')}</StatusChip>}
        <Typography data-testid="score-label" sx={{ fontWeight: 700, fontSize: 15 }}>
          {view.kind === 'decided' ? t('score.decided', { band: t(`band.${view.band}`) })
            : view.kind === 'rejected' ? t('score.rejected')
            : view.kind === 'needs_review' ? t('score.needs_review') : t('score.draft')}
        </Typography>
      </Stack>
      {view.kind === 'needs_review' && (
        <Box sx={(theme) => ({ p: 1.25, borderRadius: 1.5, bgcolor: alpha(theme.palette.info.main, 0.1), border: `1px solid ${alpha(theme.palette.info.main, 0.4)}` })}>
          <Typography variant="body2">{t('score.needs_review.text')}</Typography>
          {result.qa.reasons.map((r) => (
            <Typography key={r.code} variant="body2" sx={{ color: 'text.secondary' }}>
              {qaLabel(r.code, r.messageKey, maybe, t('movement.qa.unknown'))}{r.detail ? ` (${r.detail})` : ''}
            </Typography>
          ))}
        </Box>
      )}
      {(view.kind === 'decided' || view.kind === 'rejected') && decision && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('decision.history.by', { who: staffLabel(decision.decidedBy), when: formatDateTime(decision.decidedAt) })}
        </Typography>
      )}
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {t('score.errors', { n: result.score.errorCount ?? (result.score.redCount ?? 0) + (result.score.watchCount ?? 0) })} · {t('score.scale', { source: t(`scale.${result.scale.source}`) })}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {t('score.versions', { rules: result.versions.rules, model: result.versions.poseModel })}
      </Typography>
    </Stack>
  );
}

export function qaLabel(code: string, messageKey: string | undefined, maybe: (key: string, fallback: string) => string, fallback: string): string {
  return maybe(messageKey ?? `movement.qa.${code}`, fallback);
}

export function FlagList({ flags, selectedId, lang, onSelect }: {
  flags: readonly Flag[];
  selectedId: string | null;
  lang: 'cs' | 'en';
  onSelect: (flag: Flag) => void;
}) {
  const { t } = useMoveT();
  return (
    <Stack spacing={2} sx={{ p: { xs: 1.5, md: 2 } }}>
      {groupFlags(flags).map((g) => (
        <Box key={g.severity} component="section" aria-label={t(`severity.${g.severity}`)} data-severity={g.severity}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 0.75 }}>
            <StatusChip tone={SEVERITY_TONE[g.severity]} size="sm">{t(`severity.${g.severity}`)}</StatusChip>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{g.flags.length}</Typography>
          </Stack>
          <Stack component="ul" spacing={0.75} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {g.flags.map((f) => {
              const on = f.id === selectedId;
              const ev = f.evidence;
              return (
                <li key={f.id}>
                  <Button
                    onClick={() => onSelect(f)}
                    aria-pressed={on}
                    data-flag={f.id}
                    sx={(theme) => ({
                      display: 'block', width: '100%', textAlign: 'left', textTransform: 'none', minHeight: 44, px: 1.5, py: 1, color: 'text.primary',
                      border: '1px solid', borderColor: on ? theme.palette.primary.main : theme.palette.divider,
                      bgcolor: on ? alpha(theme.palette.primary.main, 0.1) : 'transparent', borderRadius: 1.5,
                    })}
                  >
                    <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>{f.sentence[lang]}</Typography>
                    {(f.confidence !== null && f.confidence !== undefined) && (
                      <Stack direction="row" sx={{ gap: 1, alignItems: 'center', mt: 0.25 }}>
                        <ConfidenceMeter value={f.confidence} label={t('review.confidence')} />
                        {f.uncertain && <StatusChip tone="beige" size="sm" testId="flag-uncertain">{t('review.uncertain')}</StatusChip>}
                      </Stack>
                    )}
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {t('review.evidence', { frame: ev.frame + 1 })}
                      {ev.value !== null && ev.value !== undefined && ev.unit ? ` · ${formatValue(ev.value, ev.unit)}` : ''}
                      {ev.threshold !== null && ev.threshold !== undefined && ev.unit ? ` · ${t('review.threshold', { value: formatValue(ev.threshold, ev.unit) })}` : ''}
                    </Typography>
                  </Button>
                </li>
              );
            })}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

/** A small confidence meter of a finding (0..1). */
function ConfidenceMeter({ value, label }: { value: number; label: string }) {
  return (
    <Box role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={1} aria-valuenow={value} title={`${label}: ${Math.round(value * 100)} %`} data-testid="flag-confidence"
      sx={(th) => ({ display: 'inline-block', width: 44, height: 5, borderRadius: 3, bgcolor: alpha(th.palette.text.primary, 0.14), verticalAlign: 'middle', overflow: 'hidden' })}>
      <Box sx={(th) => ({ height: '100%', width: `${Math.round(value * 100)}%`, bgcolor: value < 0.5 ? th.palette.warning.main : th.palette.primary.main })} />
    </Box>
  );
}

export function MetricsTable({ metrics, onSeek }: { metrics: readonly Metric[]; onSeek: (frame: number) => void }) {
  const { t, maybe, lang } = useMoveT();
  const rows = metricRows(metrics);
  const cell = (m: (typeof rows)[number]['left'], twin: Metric | null = null) => {
    if (m === null) return <Box component="span" sx={{ color: 'text.secondary' }}>–</Box>;
    const out = outsideNorm(m);
    const text = twin ? `${formatValue(m.value, m.unit)} / ${formatValue(twin.value, twin.unit)}` : formatValue(m.value, m.unit);
    const color = out === true ? 'error.main' : 'text.primary';
    return m.frame === null || m.frame === undefined ? (
      <Box component="span" sx={{ color, fontWeight: 600 }}>{text}</Box>
    ) : (
      <Button onClick={() => onSeek(m.frame!)} sx={{ minWidth: 44, minHeight: 44, color, fontWeight: 600, textTransform: 'none', px: 0.5, fontVariantNumeric: 'tabular-nums' }}>
        {text}
      </Button>
    );
  };
  return (
    <Box sx={{ p: { xs: 0.5, md: 1 }, overflowX: 'auto' }}>
      <Box component="table" data-testid="metrics-table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <Box component="tr" sx={{ textAlign: 'left', color: 'text.secondary', fontSize: 12 }}>
            <Box component="th" scope="col" sx={{ p: 1, fontWeight: 600 }}>{t('review.metrics.metric')}{rows.some((r) => r.twin) && <Box component="span" title={t('review.metrics.twin_hint')} data-testid="twin-hint" sx={{ display: 'block', fontWeight: 400, cursor: 'help' }}>{t('review.metrics.twin')}</Box>}</Box>
            <Box component="th" scope="col" sx={{ p: 1, fontWeight: 600 }}>{t('side.short.L')}</Box>
            <Box component="th" scope="col" sx={{ p: 1, fontWeight: 600 }}>{t('side.short.R')}</Box>
            <Box component="th" scope="col" sx={{ p: 1, fontWeight: 600 }}>{t('review.metrics.asym')}</Box>
          </Box>
        </thead>
        <tbody>
          {rows.map((r) => {
            const level = asymmetryLevel(r.asymmetryPct);
            const norm = (r.left ?? r.right ?? r.single)?.normBand;
            return (
              <Box component="tr" key={r.id} data-metric={r.id} sx={(theme) => ({ borderTop: `1px solid ${theme.palette.divider}` })}>
                <Box component="th" scope="row" sx={{ p: 1, fontWeight: 600, textAlign: 'left' }}>
                  {metricName(r.label, r.id, lang, maybe)}
                  {norm && (
                    <Typography component="span" variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 400 }}>
                      {t('review.metrics.norm', { from: String(norm[0]).replace('.', ','), to: String(norm[1]).replace('.', ',') })}
                    </Typography>
                  )}
                </Box>
                {r.single ? (
                  <Box component="td" colSpan={2} sx={{ p: 0.5 }}>{cell(r.single, r.twin?.single ?? null)}</Box>
                ) : (
                  <>
                    <Box component="td" sx={{ p: 0.5 }}>{cell(r.left, r.twin?.left ?? null)}</Box>
                    <Box component="td" sx={{ p: 0.5 }}>{cell(r.right, r.twin?.right ?? null)}</Box>
                  </>
                )}
                <Box component="td" sx={{ p: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {r.single ? '' : (
                    <StatusChip size="sm" tone={level === 'red' ? 'red' : level === 'watch' ? 'beige' : 'grey'}>{formatAsymmetry(r.asymmetryPct)}</StatusChip>
                  )}
                </Box>
              </Box>
            );
          })}
        </tbody>
      </Box>
    </Box>
  );
}
