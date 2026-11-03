/* Admin console: counts only, no names and no ids (GET /admin/stats), and the retry of failed ML-store exports. */
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { MetricCard, PageFrame, Shelf } from '../../ui/shelf';
import { useAdminStats, useRetryFailedExports } from '../../api/movement';
import { useMoveT } from '../i18n';

const pct = (a: number, b: number) => (b === 0 ? '–' : `${Math.round((a / b) * 100)} %`);
const entries = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

/** A list of "name  count" lines with a bar, the biggest first. */
function Bars({ rows, label }: { rows: [string, number][]; label: (key: string) => string }) {
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <Stack component="ul" spacing={1.25} sx={{ listStyle: 'none', m: 0, p: { xs: 1.5, md: 2 } }}>
      {rows.map(([key, n]) => (
        <Box component="li" key={key}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', fontSize: 14, mb: 0.5, gap: 1 }}>
            <span style={{ overflowWrap: 'anywhere' }}>{label(key)}</span>
            <strong>{n}</strong>
          </Stack>
          <Box aria-hidden sx={(th) => ({ height: 6, borderRadius: 3, bgcolor: alpha(th.palette.text.primary, 0.1) })}>
            <Box sx={(th) => ({ height: '100%', width: `${(n / max) * 100}%`, borderRadius: 3, bgcolor: th.palette.primary.main })} />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

export default function AdminPage() {
  const { t, maybe } = useMoveT();
  const q = useAdminStats();
  const retry = useRetryFailedExports();
  const s = q.data;
  const err = q.isError ? t('admin.error') : false;
  const total = s ? sum(s.clipsByStatus) : 0;
  const passed = s?.qaOutcomes.passed ?? 0;
  const failed = s?.qaOutcomes.failed ?? 0;
  const lower = (k: string) => k.toLowerCase();
  const failedExports = s ? Object.entries(s.exports).filter(([k]) => /failed/i.test(k)).reduce((a, [, n]) => a + n, 0) : 0;

  return (
    <PageFrame title={t('title')} purpose={t('admin.purpose')}>
      <Stack spacing={{ xs: 3, md: 3.5 }}>
        <Shelf id="qa" title={t('admin.qa.title')} layout="row" fill loading={q.isLoading} error={err} onRetry={() => void q.refetch()} skeletons={4} cardHeight={96}>
          {s && (
            <>
              <MetricCard label={t('admin.qa.total')} value={total} />
              <MetricCard label={t('admin.qa.passed')} value={passed} tone="green" />
              <MetricCard label={t('admin.qa.rejected')} value={failed} tone={failed > 0 ? 'red' : 'grey'} />
              <MetricCard label={t('admin.qa.rate')} value={pct(passed, passed + failed)} />
            </>
          )}
        </Shelf>

        <Box sx={{ display: 'grid', gap: { xs: 3, md: 3.5 }, gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'start' }}>
          <Shelf id="reasons" title={t('admin.reasons.title')} layout="board" stagger={false} loading={q.isLoading} empty={s !== undefined && Object.keys(s.failureReasons).length === 0} emptyState={{ text: t('admin.reasons.empty') }}>
            {s && <Bars rows={entries(s.failureReasons)} label={(k) => maybe(`status.error.${k}`, maybe(`movement.qa.${k}`, k))} />}
          </Shelf>

          <Shelf id="consents" title={t('admin.consents.title')} layout="board" stagger={false} loading={q.isLoading}>
            {s && (
              <Stack spacing={1.5} sx={{ p: { xs: 1.5, md: 2 } }}>
                {(['care', 'ml'] as const).map((type) => (
                  <Stack key={type} direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{t(`consent.${type}`)}</Typography>
                    <Typography variant="body2" data-testid={`admin-consent-${type}`}>
                      {t('admin.consents.given')}: <strong>{s.consents[`${type}_active`] ?? 0}</strong> · {t('admin.consents.withdrawn')}: <strong>{s.consents[`${type}_withdrawn`] ?? 0}</strong>
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </Shelf>

          <Shelf id="status" title={t('admin.status.title')} layout="board" stagger={false} loading={q.isLoading}>
            {s && <Bars rows={entries(s.clipsByStatus)} label={(k) => maybe(`status.${lower(k)}`, k)} />}
          </Shelf>

          <Shelf id="dataset" title={t('admin.dataset.title')} layout="board" stagger={false} loading={q.isLoading}>
            {s && (
              <Stack spacing={2} sx={{ p: { xs: 1.5, md: 2 } }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>{t('admin.bands.title')}</Typography>
                  <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
                    {entries(s.resultBands).map(([k, n]) => <Chip key={k} size="small" variant="outlined" label={`${maybe(`band.${k}`, k)} ${n}`} />)}
                  </Stack>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>{t('admin.decisions.title')}</Typography>
                  <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
                    {entries(s.decisionsByAction).map(([k, n]) => <Chip key={k} size="small" variant="outlined" label={`${maybe(`decision.${lower(k)}`, k)} ${n}`} />)}
                  </Stack>
                </Box>
              </Stack>
            )}
          </Shelf>

          <Shelf id="exports" title={t('admin.exports.title')} layout="board" stagger={false} loading={q.isLoading} empty={s !== undefined && Object.keys(s.exports).length === 0} emptyState={{ text: t('admin.exports.empty') }}>
            {s && (
              <Stack spacing={1} sx={{ pb: 1.5 }}>
                <Bars rows={entries(s.exports)} label={(k) => k.replace('_', ' · ')} />
                <Stack spacing={1} sx={{ px: { xs: 1.5, md: 2 } }}>
                  <Box>
                    <Button variant="outlined" onClick={() => retry.mutate()} disabled={retry.isPending || failedExports === 0} sx={{ minHeight: 44, textTransform: 'none' }}>
                      {t('admin.exports.retry')}
                    </Button>
                  </Box>
                  {retry.isSuccess && <Alert severity="success" role="status">{t('admin.exports.retried', { n: retry.data })}</Alert>}
                  {retry.isError && <Alert severity="error" role="alert">{t('admin.exports.error')}</Alert>}
                </Stack>
              </Stack>
            )}
          </Shelf>

          <Shelf id="versions" title={t('admin.versions.title')} layout="board" stagger={false} loading={q.isLoading}>
            {s && <Bars rows={entries(s.modelVersions)} label={(k) => k} />}
          </Shelf>
        </Box>
      </Stack>
    </PageFrame>
  );
}
