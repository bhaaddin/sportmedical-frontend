import { Alert, Avatar, Box, Button, Stack, Typography } from "@mui/material";
import { BookingApiError } from "../../../api/apiError";
import { SoftCard } from "../../ui";
import { formatDateOnly } from "../../../utils/time";
import { initials } from "../NewAppointmentDialog.logic";
import { usePatientCard } from "./patientCard";
import { displayName } from "./patientTypeahead";
import type { PatientHit } from "./patientTypeahead";

/**
 * The patient once picked - the board's summary card: initials, name, and
 * under it the telephone and the e-mail the clinic already holds, so nobody
 * types them again. "Změnit" hands the choice back.
 *
 * Nothing here is editable on purpose. An appointment carries only the
 * patient's id (contract 4.5); a changed telephone number belongs in the
 * registry, where a change to a patient's data is recorded with its author and
 * its reason. A box that looked editable here would accept a correction and
 * then drop it.
 */
export function PatientFilled({
  hit,
  onChange,
  changeLabel = "Změnit",
}: {
  hit: PatientHit;
  onChange: () => void;
  changeLabel?: string;
}) {
  const card = usePatientCard(hit.id, true);
  const notInRegistry =
    card.error instanceof BookingApiError && card.error.kind === "notFound";
  const name = displayName(hit);

  const phone = card.data?.phone ?? hit.phone ?? null;
  const email = card.data?.email ?? null;
  const facts = [
    phone ?? (card.isLoading ? "…" : null),
    email,
    hit.dateOfBirth ? `nar. ${formatDateOnly(hit.dateOfBirth)}` : null,
  ].filter((f): f is string => f !== null);

  return (
    <Box>
      <SoftCard tone="soft" sx={{ p: 2 }} aria-label={`Vybraný pacient ${name}`}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Avatar sx={{ width: 40, height: 40, bgcolor: "primary.main", color: "primary.contrastText" }}>
            {initials(name)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, lineHeight: 1.3 }}>{name}</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
              {facts.length > 0 ? facts.join(" · ") : "kontaktní údaje neuvedeny"}
            </Typography>
          </Box>
          <Button size="small" onClick={onChange}>
            {changeLabel}
          </Button>
        </Stack>
      </SoftCard>

      {card.error ? (
        <Alert severity={notInRegistry ? "info" : "warning"} sx={{ mt: 1.5 }}>
          {notInRegistry
            ? "Tento záznam registr nevede, takže k němu nejsou kontaktní údaje. Objednat ho lze; registraci je dobré doplnit."
            : "Kontaktní údaje se nepodařilo načíst. Objednat lze i tak."}
        </Alert>
      ) : null}
    </Box>
  );
}
