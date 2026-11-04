/* Only with the mock backend on (development): the integration pieces that live inside other screens, drawn side by side on fixtures -
   the booking's movement action and status, the patient's card, and the patient portal's section. */
import { Box } from '@mui/material';
import { PageFrame, Shelf } from '../../ui/shelf';
import MovementAppointmentAction from '../components/MovementAppointmentAction';
import PatientMovementCard from './PatientMovementCard';
import PortalMovementSection from './PortalMovementSection';

export default function PreviewPage() {
  return (
    <PageFrame title="Pohybová analýza" purpose="Náhled částí, které žijí v kalendáři, na kartě pacienta a v portálu (jen zkušební režim)">
      <Shelf id="calendar" title="Objednávka v kalendáři" layout="board" stagger={false}>
        <Box sx={{ p: 2 }}><MovementAppointmentAction appointmentId="appt-demo" patientId="ZZ-test" /></Box>
      </Shelf>
      <Shelf id="patient" title="Karta pacienta" layout="free" stagger={false}>
        <Box role="list"><PatientMovementCard patientId="ZZ-test" /></Box>
      </Shelf>
      <Shelf id="portal" title="Portál pacienta" layout="board" stagger={false}>
        <Box sx={{ p: 2 }}>
          <PortalMovementSection token="demo" wrap={(children) => <>{children}</>} />
        </Box>
      </Shelf>
    </PageFrame>
  );
}
