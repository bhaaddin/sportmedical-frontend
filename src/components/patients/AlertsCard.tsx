/*
 * UPOZORNĚNÍ - what the desk should do about this patient before they come
 * (design-15): the questionnaire not filled in, a document an appointment
 * asks for and does not have, one about to run out. Each is a beige box, and
 * under them the one action that answers most of them: send the patient the
 * link through which they fill the rest in themselves.
 *
 * "Poslat odkaz" opens the two links the clinic already issues - the
 * completion link (24 h, finishes a registration) and the personal portal
 * link - rather than inventing a third. Which one the desk sends depends on
 * what is missing, and both are there to pick from.
 */
import { useState } from 'react';
import { Box, Button, Collapse, Stack, Typography } from '@mui/material';
import type { AppointmentRequirementDto } from '../../api/documents';
import { DESIGN, SectionLabel, SoftCard } from '../ui';
import { CompletionLinkButton } from '../booking/patient/CompletionLinkButton';
import { PortalLinkButton } from '../booking/patient/PortalLinkButton';
import { expiringSoon, requirementLine, stillMissing, validityText } from '../../pages/patients/paperworkStanding';
import { formatDateOnly } from '../../utils/time';

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        bgcolor: DESIGN.tone.beige.bg,
        color: DESIGN.tone.beige.fg,
        border: `1px solid ${DESIGN.tone.beige.line}`,
        borderRadius: 2,
        px: 1.5,
        py: 1.25,
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      {children}
    </Box>
  );
}

export function AlertsCard({
  patientId,
  questionnaireIsMissing,
  requirements,
}: {
  patientId: string;
  questionnaireIsMissing: boolean;
  /** What the booked appointments ask for; null while unanswered. */
  requirements: readonly AppointmentRequirementDto[] | null;
}) {
  const [sending, setSending] = useState(false);
  const missing = requirements === null ? [] : stillMissing(requirements);
  const expiring = requirements === null ? [] : expiringSoon(requirements);
  const date = (iso: string) => formatDateOnly(iso.slice(0, 10));
  const nothing = !questionnaireIsMissing && missing.length === 0 && expiring.length === 0;

  return (
    <SoftCard>
      <SectionLabel>Upozornění</SectionLabel>
      <Stack spacing={1}>
        {questionnaireIsMissing && (
          <Notice>Chybí vyplněný vstupní dotazník. Pošlete pacientovi odkaz.</Notice>
        )}
        {missing.map((r) => (
          <Notice key={`${r.appointmentId}-${r.templateId}`}>
            Chybí: {requirementLine(r, date)}
            {r.blocksBooking === true ? ' — bez něj nejde objednat.' : '.'}
          </Notice>
        ))}
        {expiring.map((r) => {
          const until = validityText(r, date);
          return (
            <Notice key={`exp-${r.appointmentId}-${r.templateId}`}>
              Brzy skončí platnost: {requirementLine(r, date)}
              {until === null ? '' : ` — ${until}`}.
            </Notice>
          );
        })}
        {nothing && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {requirements === null ? 'Zjišťuji, co k termínům chybí…' : 'Nic nechybí.'}
          </Typography>
        )}
      </Stack>

      <Button
        fullWidth
        variant="outlined"
        onClick={() => setSending((open) => !open)}
        aria-expanded={sending}
        sx={{ mt: 2 }}
      >
        Poslat odkaz
      </Button>
      <Collapse in={sending} unmountOnExit>
        <Stack spacing={1.5} sx={{ mt: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Odkaz na dokončení registrace vyplní rodné číslo, pojišťovnu a dotazník; odkaz do
            portálu ukáže pacientovi jeho termíny a dokumenty.
          </Typography>
          <CompletionLinkButton patientId={patientId} />
          <PortalLinkButton patientId={patientId} />
        </Stack>
      </Collapse>
    </SoftCard>
  );
}

export default AlertsCard;
