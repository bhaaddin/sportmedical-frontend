/* A patient's movement timeline: score trend per movement, the sessions, before/after, and the consents. */
import { Suspense, lazy, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Box, Button, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { StatusChip } from '../../components/ui';
import { PageFrame, Shelf } from '../../ui/shelf';
import { usePermission } from '../../auth/usePermission';
import { getClip, movementKeys, useMovementSessions, type Movement } from '../../api/movement';
import { MOVE_PATHS } from '../flags';
import { formatDate, useMoveT } from '../i18n';
import { metricName } from '../lib/review';
import { compareMetrics, doneClipOf, movementsIn, scoreTrend, type TrendPoint } from '../lib/review';
import { formatValue } from '../lib/asymmetry';
import { ConsentPanel } from '../components/ConsentPanel';
import { usePatientLabel } from '../components/PatientPicker';
import { BAND_TONE } from '../components/Findings';

function Trend({ points }: { points: TrendPoint[] }) {
  const { t } = useMoveT();
  const W = 300;
  const H = 90;
  /* the band as a level: green at the bottom, red at the top - lower is better */
  const xy = points.map((p, i) => [points.length === 1 ? W / 2 : 12 + (i / (points.length - 1)) * (W - 24), H - 12 - ((p.level - 1) / 2) * (H - 24)] as const);
  return (
    <Box sx={{ minWidth: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${t('timeline.trend.title')}: ${points.map((p) => t(`band.${p.band}`)).join(', ')}`} style={{ display: 'block', maxHeight: 130 }}>
        {xy.length > 1 && <Box component="polyline" points={xy.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" strokeWidth={2} sx={(th) => ({ stroke: th.palette.text.secondary })} />}
        {xy.map(([x, y], i) => (
          <Box key={points[i].sessionId} component="circle" cx={x} cy={y} r={6}
            sx={(th) => ({ fill: points[i].band === 'green' ? th.palette.success.main : points[i].band === 'red' ? th.palette.error.main : th.palette.warning.main, stroke: th.palette.background.paper, strokeWidth: 2 })} />
        ))}
      </svg>
    </Box>
  );
}

/* the 3D engine is a lazy chunk: it loads only when the 3D comparison is opened */
const Compare3D = lazy(() => import('../anatomy3d/Compare3D').then((m) => ({ default: m.Compare3D })));

export default function TimelinePage() {
  const { t, maybe, lang } = useMoveT();
  const { patientId } = useParams<{ patientId: string }>();
  const name = usePatientLabel(patientId);
  const query = useMovementSessions(patientId);
  const mayCapture = usePermission('movement.capture');
  const sessions = useMemo(() => [...(query.data ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [query.data]);
  const movements = useMemo(() => movementsIn(sessions), [sessions]);

  const [cmpMovement, setCmpMovement] = useState<Movement | null>(null);
  const movement = cmpMovement ?? movements[0] ?? 'running';
  const eligible = sessions.filter((s) => s.clips.some((c) => c.movement === movement && c.status === 'done'));
  const [compare3d, setCompare3d] = useState(false);
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);
  const before = eligible.find((s) => s.id === (beforeId ?? eligible[eligible.length - 1]?.id));
  const after = eligible.find((s) => s.id === (afterId ?? eligible[0]?.id));
  const different = before !== undefined && after !== undefined && before.id !== after.id;
  const beforeClip = useQuery({ queryKey: movementKeys.clip(doneClipOf(before, movement) ?? ''), queryFn: () => getClip(doneClipOf(before, movement)!), enabled: different && doneClipOf(before, movement) !== null });
  const afterClip = useQuery({ queryKey: movementKeys.clip(doneClipOf(after, movement) ?? ''), queryFn: () => getClip(doneClipOf(after, movement)!), enabled: different && doneClipOf(after, movement) !== null });
  const rows = different ? compareMetrics(beforeClip.data?.result?.metrics, afterClip.data?.result?.metrics) : [];

  return (
    <PageFrame
      title={t('title')}
      purpose={name ? `${name} · ${t('timeline.purpose')}` : t('timeline.purpose')}
      entities={patientId && name ? [{ kind: 'patient', id: patientId, label: name }] : undefined}
      primaryAction={mayCapture ? { label: t('action.upload'), to: MOVE_PATHS.upload(patientId) } : undefined}
    >
      <Stack spacing={{ xs: 3, md: 3.5 }}>
        <Shelf id="trend" title={t('timeline.trend.title')} hint={t('timeline.trend.hint')} layout="board" stagger={false}
          loading={query.isLoading} error={query.isError ? t('timeline.error') : false} onRetry={() => void query.refetch()}
          empty={movements.length === 0} emptyState={{ text: t('timeline.trend.empty'), ...(mayCapture ? { action: { label: t('action.upload'), to: MOVE_PATHS.upload(patientId) } } : {}) }}>
          <Box sx={{ display: 'grid', gap: 2, p: { xs: 1.5, md: 2 }, gridTemplateColumns: { xs: '1fr', md: `repeat(${Math.max(1, movements.length)}, minmax(0, 1fr))` } }}>
            {movements.map((m) => {
              const points = scoreTrend(sessions, m);
              const last = points[points.length - 1];
              return (
                <Box key={m} data-testid={`trend-${m}`}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography component="h3" sx={{ fontSize: 14, fontWeight: 700 }}>{t(`movement.${m}`)}</Typography>
                    {last && <StatusChip tone={BAND_TONE[last.band]} dot size="sm">{t(`band.${last.band}`)}</StatusChip>}
                  </Stack>
                  <Trend points={points} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{points.map((p) => t(`band.${p.band}`)).join(' → ')}</Typography>
                </Box>
              );
            })}
          </Box>
        </Shelf>

        <Shelf id="sessions" title={t('timeline.sessions.title')} hint={t('timeline.sessions.hint')} count={sessions.length} layout="board" stagger={false}
          loading={query.isLoading} empty={sessions.length === 0} emptyState={{ text: t('timeline.sessions.empty'), ...(mayCapture ? { action: { label: t('action.upload'), to: MOVE_PATHS.upload(patientId) } } : {}) }}>
          <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: { xs: 1, md: 1.5 }, gap: 1.5 }}>
            {sessions.map((s) => (
              <Box component="li" key={s.id} data-testid="session-row" sx={(th) => ({ p: 1.25, borderRadius: 2, border: `1px solid ${th.palette.divider}` })}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.75 }}>{formatDate(s.date)}</Typography>
                <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                  {s.clips.map((c) => (
                    <Button key={c.clipId} component={RouterLink} to={MOVE_PATHS.clip(c.clipId)} variant="outlined" sx={{ minHeight: 44, textTransform: 'none', gap: 1, borderRadius: 999 }}>
                      {t(`movement.${c.movement}`)} · {t(`view.${c.view}`)}
                      {c.status === 'done' && c.band ? <><StatusChip tone={BAND_TONE[c.band]} size="sm" dot>{t(`band.${c.band}`)}</StatusChip>{c.hasDecision && <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>{t('timeline.clip.decided')}</Typography>}</>
                        : <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>{c.status === 'failed' ? t('timeline.clip.failed') : t('timeline.clip.processing')}</Typography>}
                    </Button>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        </Shelf>

        <Shelf id="compare" title={t('timeline.compare.title')} hint={t('timeline.compare.hint')} layout="board" stagger={false}
          empty={eligible.length < 2} emptyState={{ text: t('timeline.compare.empty') }}>
          <Stack spacing={2} sx={{ p: { xs: 1.5, md: 2 } }}>
            {movements.length > 1 && (
              <ToggleButtonGroup exclusive value={movement} onChange={(_, v: Movement | null) => { if (v) { setCmpMovement(v); setBeforeId(null); setAfterId(null); } }} aria-label={t('upload.movement')}>
                {movements.map((m) => <ToggleButton key={m} value={m} sx={{ minHeight: 44, textTransform: 'none' }}>{t(`movement.${m}`)}</ToggleButton>)}
              </ToggleButtonGroup>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField select fullWidth label={t('timeline.compare.before')} value={before?.id ?? ''} onChange={(e) => setBeforeId(e.target.value)}>
                {eligible.map((s) => <MenuItem key={s.id} value={s.id} sx={{ minHeight: 44 }}>{formatDate(s.date)}</MenuItem>)}
              </TextField>
              <TextField select fullWidth label={t('timeline.compare.after')} value={after?.id ?? ''} onChange={(e) => setAfterId(e.target.value)}>
                {eligible.map((s) => <MenuItem key={s.id} value={s.id} sx={{ minHeight: 44 }}>{formatDate(s.date)}</MenuItem>)}
              </TextField>
            </Stack>
            {beforeClip.data?.result?.anatomy?.available === true && afterClip.data?.result?.anatomy?.available === true && (
              <Box>
                <Button variant={compare3d ? 'contained' : 'outlined'} aria-pressed={compare3d} onClick={() => setCompare3d((v) => !v)} data-testid="compare3d-toggle" sx={{ minHeight: 44, textTransform: 'none' }}>{t('timeline.compare3d')}</Button>
              </Box>
            )}
            {compare3d && beforeClip.data && afterClip.data && <Suspense fallback={null}><Compare3D before={beforeClip.data} after={afterClip.data} /></Suspense>}
            {rows.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('timeline.compare.pick_two')}</Typography>
            ) : (
              <Box component="table" data-testid="compare-table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <Box component="tr" sx={{ textAlign: 'left', color: 'text.secondary', fontSize: 12 }}>
                    <th scope="col">{t('review.metrics.metric')}</th><th scope="col">{t('timeline.compare.before')}</th><th scope="col">{t('timeline.compare.after')}</th><th scope="col">{t('timeline.compare.change')}</th>
                  </Box>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <Box component="tr" key={r.key} sx={(th) => ({ borderTop: `1px solid ${th.palette.divider}`, '& td, & th': { p: 1, textAlign: 'left' } })}>
                      <th scope="row">{metricName(r.label, r.id, lang, maybe)}{r.side ? ` ${t(`side.short.${r.side}`)}` : ''}</th>
                      <td>{r.before === null ? '–' : formatValue(r.before, r.unit)}</td>
                      <td>{r.after === null ? '–' : formatValue(r.after, r.unit)}</td>
                      <Box component="td" sx={(th) => ({ fontWeight: 700, color: r.delta === null || r.delta === 0 ? 'text.secondary' : th.palette.text.primary, bgcolor: r.delta ? alpha(th.palette.primary.main, 0.06) : undefined })}>
                        {r.delta === null ? '–' : `${r.delta > 0 ? '+' : ''}${formatValue(r.delta, r.unit)}`}
                      </Box>
                    </Box>
                  ))}
                </tbody>
              </Box>
            )}
          </Stack>
        </Shelf>

        {patientId && (
          <Shelf id="consents" title={t('consent.title')} layout="board" stagger={false}>
            <Box sx={{ p: { xs: 1.5, md: 2 } }}><ConsentPanel patientId={patientId} /></Box>
          </Shelf>
        )}
      </Stack>
    </PageFrame>
  );
}

