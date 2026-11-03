/* One clip: status while it is processed or failed, the review when it is done. */
import { useParams } from 'react-router-dom';
import { Alert, Button, Skeleton } from '@mui/material';
import { PageFrame, Shelf } from '../../ui/shelf';
import { useClip } from '../../api/movement';
import { MOVE_PATHS } from '../flags';
import { formatDate, useMoveT } from '../i18n';
import { ReviewView } from '../components/ReviewView';
import { StatusView } from '../components/StatusView';
import { usePatientLabel } from '../components/PatientPicker';

export default function ClipPage() {
  const { t } = useMoveT();
  const { clipId } = useParams<{ clipId: string }>();
  const query = useClip(clipId);
  const clip = query.data;
  const name = usePatientLabel(clip?.patientId ?? undefined);

  const purpose = clip ? `${t(`movement.${clip.movement}`)} · ${t(`view.${clip.view}`)}${name ? ` · ${name}` : ''}` : t('status.title');
  const entities = clip?.patientId && name ? [{ kind: 'patient' as const, id: clip.patientId, label: name }] : undefined;

  return (
    <PageFrame
      title={t('title')}
      purpose={purpose}
      entities={entities}
      actions={clip?.patientId ? <Button href={MOVE_PATHS.patient(clip.patientId)} sx={{ minHeight: 44, textTransform: 'none' }}>{t('action.back_timeline')}</Button> : undefined}
    >
      {query.isLoading && <Skeleton variant="rounded" height={320} aria-busy />}
      {query.isError && (
        <Alert severity="error" role="alert" action={<Button color="inherit" onClick={() => void query.refetch()} sx={{ minHeight: 44 }}>{t('action.retry')}</Button>}>
          {t('status.not_found')}
        </Alert>
      )}
      {clip && clip.status === 'done' && clip.result ? <ReviewView clip={clip} /> : null}
      {clip && !(clip.status === 'done' && clip.result) && (
        <Shelf id="status" title={t('status.title')} hint={formatDate(new Date().toISOString())} layout="board" stagger={false}>
          <StatusView clip={clip} />
        </Shelf>
      )}
    </PageFrame>
  );
}
