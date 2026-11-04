/* Processing status: queued / processing / failed (done is the review). Polling is the query's refetchInterval. */
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, LinearProgress, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { CheckCircle, ErrorOutlined, HourglassTop } from '@mui/icons-material';
import { usePermission } from '../../auth/usePermission';
import { useRetryProcess, type ClipDetail } from '../../api/movement';
import { MOVE_PATHS } from '../flags';
import { useMoveT, type MoveKey } from '../i18n';
import { qaLabel } from './Findings';
import { overallPct, stageSteps } from '../lib/progress';

export function StatusView({ clip }: { clip: ClipDetail }) {
  const { t, maybe } = useMoveT();
  const mayCapture = usePermission('movement.capture');
  const retry = useRetryProcess(clip.clipId, clip.status === 'uploaded' ? 'process' : 'retry');
  const failed = clip.status === 'failed';
  const steps = stageSteps(clip.status, clip.progress);
  const overall = overallPct(clip.status, clip.progress);
  const waitingToStart = clip.status === 'uploaded';
  const code = clip.error?.code ?? 'internal';
  const errorKey = `status.error.${code}` as MoveKey;
  const reasons = clip.qaReasons;
  const again = clip.patientId ? MOVE_PATHS.upload(clip.patientId) : MOVE_PATHS.upload();

  return (
    <Box data-testid="status-view" data-status={clip.status} sx={{ p: { xs: 2, md: 3 } }}>
      <Stack component="ol" sx={{ listStyle: 'none', m: 0, p: 0, gap: 1 }} aria-label={t('status.title')} data-testid="stage-stepper">
        {steps.map((step) => {
          const done = step.state === 'done';
          const active = step.state === 'active';
          return (
            <Box
              component="li"
              key={step.id}
              data-stage={step.id}
              data-state={step.state}
              aria-current={active ? 'step' : undefined}
              sx={(theme) => ({
                display: 'grid', gridTemplateColumns: '24px 1fr', alignItems: 'center', columnGap: 1.25, minHeight: 44, px: 1.5, py: 0.75, borderRadius: 2, fontWeight: 600, fontSize: 14,
                border: `1px solid ${active ? (failed ? theme.palette.error.main : theme.palette.primary.main) : theme.palette.divider}`,
                bgcolor: active ? alpha(failed ? theme.palette.error.main : theme.palette.primary.main, 0.1) : 'transparent',
                color: done || active ? 'text.primary' : 'text.secondary',
                transition: 'background-color var(--sm-dur-quick, 160ms) ease, border-color var(--sm-dur-quick, 160ms) ease',
              })}
            >
              {done ? <CheckCircle fontSize="small" color="success" aria-hidden /> : active && !failed && step.id !== 'done' ? <CircularProgress size={18} aria-hidden /> : active && failed ? <ErrorOutlined fontSize="small" color="error" aria-hidden /> : <HourglassTop fontSize="small" aria-hidden sx={{ opacity: 0.45 }} />}
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <span>{failed && active ? t('status.failed') : t(`stage.${step.id}`)}</span>
                  {active && step.pct !== null && <span data-testid="stage-pct" style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(step.pct)} %</span>}
                </Box>
                {active && step.pct !== null && !failed && (
                  <LinearProgress variant="determinate" value={step.pct} aria-label={t(`stage.${step.id}`)} sx={{ mt: 0.5, height: 5, borderRadius: 3, '& .MuiLinearProgress-bar': { transition: 'transform 1.4s linear' }, 'html[data-motion="off"] & .MuiLinearProgress-bar, html[data-motion="reduced"] & .MuiLinearProgress-bar': { transition: 'none' } }} />
                )}
              </Box>
            </Box>
          );
        })}
      </Stack>
      {clip.status === 'processing' && <LinearProgress variant="determinate" value={overall} aria-label={t('status.title')} data-testid="overall-progress" sx={{ mt: 1.5, height: 4, borderRadius: 2 }} />}

      {waitingToStart && (
        <Stack spacing={1} sx={{ mt: 2 }}>
          <Typography role="status">{t('status.uploaded.text')}</Typography>
          {mayCapture && <Box><Button variant="contained" onClick={() => retry.mutate()} disabled={retry.isPending} sx={{ minHeight: 44 }}>{t('action.start_processing')}</Button></Box>}
        </Stack>
      )}

      {!failed && !waitingToStart && clip.status !== 'done' && (
        <Typography role="status" sx={{ mt: 2 }}>
          {clip.status === 'processing' ? t('status.processing.text') : t('status.queued.text')} <Box component="span" sx={{ color: 'text.secondary' }}>{t('status.waiting')}</Box>
        </Typography>
      )}

      {failed && (
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          <Alert severity="error" role="alert">{maybe(errorKey, t('status.failed.text'))}</Alert>
          {reasons.length > 0 && (
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{t('status.qa_title')}</Typography>
              <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                {reasons.map((r) => <li key={r.code}>{qaLabel(r.code, r.messageKey, maybe, t('movement.qa.unknown'))}{r.detail ? ` (${r.detail})` : ''}</li>)}
              </ul>
            </Box>
          )}
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            {mayCapture && code !== 'qa_rejected' && (
              <Button variant="contained" onClick={() => retry.mutate()} disabled={retry.isPending} sx={{ minHeight: 44 }}>{t('action.retry')}</Button>
            )}
            {mayCapture && <Button component={RouterLink} to={again} variant={code === 'qa_rejected' ? 'contained' : 'outlined'} sx={{ minHeight: 44 }}>{t('action.record_again')}</Button>}
            {clip.patientId && (
              <Button component={RouterLink} to={MOVE_PATHS.patient(clip.patientId)} sx={{ minHeight: 44 }}>{t('action.back_timeline')}</Button>
            )}
          </Stack>
        </Stack>
      )}
    </Box>
  );
}
