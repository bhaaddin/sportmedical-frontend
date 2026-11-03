/* /pohyb: find a patient, upload a clip, open the admin console. */
import { useNavigate } from 'react-router-dom';
import { Insights, Videocam } from '@mui/icons-material';
import { Box } from '@mui/material';
import { ActionCard, PageFrame, Shelf } from '../../ui/shelf';
import { usePermission } from '../../auth/usePermission';
import { MOVE_PATHS } from '../flags';
import { useMoveT } from '../i18n';
import { PatientPicker } from '../components/PatientPicker';

export default function HomePage() {
  const { t } = useMoveT();
  const navigate = useNavigate();
  const admin = usePermission('settings.clinic.manage');
  return (
    <PageFrame title={t('title')} purpose={t('purpose.home')} primaryAction={{ label: t('action.upload'), to: MOVE_PATHS.upload() }}>
      <Shelf id="patient" title={t('home.patient.title')} hint={t('home.patient.hint')} layout="board" stagger={false}>
        <Box sx={{ p: { xs: 1.5, md: 2 }, maxWidth: 560 }}>
          <PatientPicker onPick={(p) => navigate(MOVE_PATHS.patient(p.id))} />
        </Box>
      </Shelf>
      <Shelf id="next" title={t('home.next.title')} layout="row" fill stagger={false} cardHeight={96}>
        <ActionCard title={t('home.upload.title')} description={t('home.upload.text')} icon={<Videocam />} to={MOVE_PATHS.upload()} />
        {admin && <ActionCard title={t('home.admin.title')} description={t('home.admin.text')} icon={<Insights />} to={MOVE_PATHS.admin} />}
      </Shelf>
    </PageFrame>
  );
}
