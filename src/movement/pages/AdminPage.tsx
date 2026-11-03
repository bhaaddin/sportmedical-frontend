/* Admin console: numbers only, no names. */
import { Box, Chip, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { MetricCard, PageFrame, Shelf } from '../../ui/shelf';
import { useAdminStats } from '../../api/movement';
import { useMoveT } from '../i18n';

const pct = (a: number, b: number) => (b === 0 ? '–' : `${Math.round((a / b) * 100)} %`);

export default function AdminPage() {
  const { t, maybe } = useMoveT();
  const q = useAdminStats();
  const s = q.data;
  const err = q.isError ? t('admin.error') : false;
  const maxReason = Math.max(1, ...(s?.qa.reasons.map((r) => r.count) ?? [1]));

  return (
    <PageFrame title={t('title')} purpose={t('admin.purpose')}>
      <Stack spacing={{ xs: 3, md: 3.5 }}>
        <Shelf id="qa" title={t('admin.qa.title')} layout="row" fill loading={q.isLoading} error={err} onRetry={() => void q.refetch()} skeletons={4} cardHeight={96}>
          {s && (
            <>
              <MetricCard label={t('admin.qa.total')} value={s.qa.total} />
              <MetricCard label={t('admin.qa.passed')} value={s.qa.passed} tone="green" />
              <MetricCard label={t('admin.qa.rejected')} value={s.qa.rejected} tone={s.qa.rejected > 0 ? 'red' : undefined} />
              <MetricCard label={t('admin.qa.rate')} value={pct(s.qa.passed, s.qa.total)} />
            </>
          )}
        </Shelf>

        <Box sx={{ display: 'grid', gap: { xs: 3, md: 3.5 }, gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'start' }}>
          <Shelf id="reasons" title={t('admin.reasons.title')} layout="board" stagger={false} loading={q.isLoading} empty={s !== undefined && s.qa.reasons.length === 0} emptyState={{ text: t('admin.reasons.empty') }}>
            <Stack component="ul" spacing={1.25} sx={{ listStyle: 'none', m: 0, p: { xs: 1.5, md: 2 } }}>
              {s?.qa.reasons.map((r) => (
                <Box component="li" key={r.code}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', fontSize: 14, mb: 0.5 }}>
                    <span>{maybe(`movement.qa.${r.code}`, r.code)}</span>
                    <strong>{r.count}</strong>
                  </Stack>
                  <Box aria-hidden sx={(th) => ({ height: 6, borderRadius: 3, bgcolor: alpha(th.palette.text.primary, 0.1) })}>
                    <Box sx={(th) => ({ height: '100%', width: `${(r.count / maxReason) * 100}%`, borderRadius: 3, bgcolor: th.palette.primary.main })} />
                  </Box>
                </Box>
              ))}
            </Stack>
          </Shelf>

          <Shelf id="consents" title={t('admin.consents.title')} layout="board" stagger={false} loading={q.isLoading}>
            {s && (
              <Stack spacing={1.5} sx={{ p: { xs: 1.5, md: 2 } }}>
                {(['care', 'ml'] as const).map((type) => (
                  <Stack key={type} direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{t(`consent.${type}`)}</Typography>
                    <Typography variant="body2" data-testid={`admin-consent-${type}`}>
                      {t('admin.consents.given')}: <strong>{s.consents[type].given}</strong> · {t('admin.consents.withdrawn')}: <strong>{s.consents[type].withdrawn}</strong>
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </Shelf>

          <Shelf id="dataset" title={t('admin.dataset.title')} layout="board" stagger={false} loading={q.isLoading}>
            {s && (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5, p: { xs: 1.5, md: 2 } }}>
                {([['clips', s.dataset.clips], ['athletes', s.dataset.athletes], ['labelled', s.dataset.labelled], ['exported', s.dataset.exported ?? 0]] as const).map(([k, v]) => (
                  <Box key={k}>
                    <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{v}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t(`admin.dataset.${k}`)}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Shelf>

          <Shelf id="versions" title={t('admin.versions.title')} layout="board" stagger={false} loading={q.isLoading}>
            {s && (
              <Stack spacing={1.5} sx={{ p: { xs: 1.5, md: 2 } }}>
                {(['pipeline', 'rules', 'model'] as const).map((k) => (
                  <Box key={k}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>{t(`admin.versions.${k}`)}</Typography>
                    <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
                      {s.versions[k].map((v) => <Chip key={v} label={v} size="small" variant="outlined" />)}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Shelf>
        </Box>
      </Stack>
    </PageFrame>
  );
}
