import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import CheckCircle from "@mui/icons-material/CheckCircle";
import { BookingApiError } from "../../../api/apiError";
import { formatDateOnly } from "../../../utils/time";
import { usePatientCard } from "./patientCard";
import type { PatientHit } from "./patientTypeahead";

/**
 * The patient once picked: name, surname, date of birth, telephone, e-mail,
 * insurer and address filled in from what the clinic already holds, so nobody
 * types them again.
 *
 * The fields are read-only on purpose. An appointment carries only the
 * patient's id (contract 4.5); a changed telephone number belongs in the
 * registry, where a change to a patient's data is recorded with its author and
 * its reason. A box that looked editable here would accept a correction and
 * then drop it.
 */
export function PatientFilled({
  hit,
  onChange,
}: {
  hit: PatientHit;
  onChange: () => void;
}) {
  const card = usePatientCard(hit.id, true);
  const notInRegistry =
    card.error instanceof BookingApiError && card.error.kind === "notFound";

  const field = (label: string, value: string | null | undefined, loading = false) => (
    <TextField
      size="small"
      fullWidth
      label={label}
      value={loading ? "…" : value ?? ""}
      placeholder="neuvedeno"
      slotProps={{ input: { readOnly: true }, inputLabel: { shrink: true } }}
    />
  );

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "success.light",
        borderRadius: 2,
        p: 1.5,
      }}
    >
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <CheckCircle color="success" fontSize="small" />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Pacient vybrán z databáze
          </Typography>
        </Stack>
        <Button size="small" onClick={onChange}>
          Změnit pacienta
        </Button>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 1.5,
        }}
      >
        {field("Jméno", hit.firstName || hit.fullName)}
        {field("Příjmení", hit.lastName)}
        {field("Datum narození", hit.dateOfBirth ? formatDateOnly(hit.dateOfBirth) : null)}
        {field("Telefon", card.data?.phone, card.isLoading)}
        {field("E-mail", card.data?.email, card.isLoading)}
        {field("Pojišťovna", card.data?.insurerCode, card.isLoading)}
        <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
          {field("Adresa", card.data?.address, card.isLoading)}
        </Box>
      </Box>

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
