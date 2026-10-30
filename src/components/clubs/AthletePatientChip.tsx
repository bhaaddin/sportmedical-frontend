import { EntityChip } from '../../ui/shelf/EntityLink';
import { safeLabel } from '../../ui/shelf/entities';

/** The patient an athlete is linked to (NET-02). Its own chunk, so the calendar's bundle does not carry the shelf chip. */
export function AthletePatientChip({ patientId, name }: { patientId: string; name: string }) {
  return <EntityChip entity={{ kind: 'patient', id: patientId, label: safeLabel(name, 'patient') || 'Pacient' }} size="sm" />;
}
