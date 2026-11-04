/* One clip: status while it is processed or failed, the review when it is done. */
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Button, Skeleton, Stack } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { PageFrame, Shelf } from '../../ui/shelf';
import { useClip } from '../../api/movement';
import { MOVE_PATHS } from '../flags';
import { formatDate, useMoveT } from '../i18n';
import { ReviewView } from '../components/ReviewView';
import { StatusView } from '../components/StatusView';
import { usePatientLabel } from '../components/PatientPicker';

const reveal = keyframes`from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; }`;
/** Only the Animace setting "plné" shows the pause on "Hotovo" and the fade into the review. */
const motionFull = (): boolean => document.documentElement.dataset.motion === 'full';

export default function ClipPage() {
  const { t } = useMoveT();
  const { clipId } = useParams<{ clipId: string }>();
  const query = useClip(clipId);
  const clip = query.data;
  const name = usePatientLabel(clip?.patientId ?? undefined);
  /* A clip that was being processed while we watched ends on "Hotovo" for a moment, then the review fades in. */
  const watched = useRef(false);
  const [hold, setHold] = useState(false);
  if (clip && (clip.status === 'queued' || clip.status === 'processing' || clip.status === 'uploading' || clip.status === 'uploaded')) watched.current = true;
  const justFinished = clip?.status === 'done' && watched.current;
  useEffect(() => {
    if (!justFinished) return undefined;
    if (!motionFull()) { watched.current = false; return undefined; }
    setHold(true);
    const id = window.setTimeout(() => { setHold(false); watched.current = false; }, 900);
    return () => window.clearTimeout(id);
  }, [justFinished]);

  const purpose = clip ? `${t(`movement.${clip.movement}`)} · ${t(`view.${clip.view}`)}${name ? ` · ${name}` : ''}` : t('status.title');
  const entities = clip?.patientId && name ? [{ kind: 'patient' as const, id: clip.patientId, label: name }] : undefined;

  return (
    <PageFrame
      title={t('title')}
      purpose={purpose}
      entities={entities}
      actions={clip?.patientId ? <Button href={MOVE_PATHS.patient(clip.patientId)} sx={{ minHeight: 44, textTransform: 'none' }}>{t('action.back_timeline')}</Button> : undefined}
    >
      {query.isLoading && (
        <Stack spacing={2} aria-busy data-testid="clip-skeleton">
          <Skeleton variant="rounded" height={44} width="60%" />
          <Skeleton variant="rounded" height={320} />
          <Skeleton variant="rounded" height={120} />
        </Stack>
      )}
      {query.isError && (
        <Alert severity="error" role="alert" action={<Button color="inherit" onClick={() => void query.refetch()} sx={{ minHeight: 44 }}>{t('action.retry')}</Button>}>
          {t('status.not_found')}
        </Alert>
      )}
      {clip && clip.status === 'done' && clip.result && !hold ? (
        <Box data-testid="review-reveal" sx={justFinished || watched.current ? { animation: `${reveal} 420ms ease-out`, 'html:not([data-motion="full"]) &': { animation: 'none' } } : undefined}><ReviewView clip={clip} /></Box>
      ) : null}
      {clip && !(clip.status === 'done' && clip.result && !hold) && (
        <Shelf id="status" title={t('status.title')} hint={formatDate(new Date().toISOString())} layout="board" stagger={false}>
          <StatusView clip={clip} />
        </Shelf>
      )}
    </PageFrame>
  );
}
