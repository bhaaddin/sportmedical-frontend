import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Popover,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import { BookingApiError } from "../../../api/apiError";
import { usePermission } from "../../../auth/usePermission";
import { formatDateOnly } from "../../../utils/time";
import { cardRows, usePatientCard } from "./patientCard";
import { displayName } from "./patientTypeahead";
import type { PatientHit } from "./patientTypeahead";

/**
 * The small card beside a namesake - "three Filip Fehér, which one is on the
 * phone?". It is drawn like the row it belongs to (name in bold, date of birth
 * under it) with the contacts below, so it reads as the same patient opened up
 * rather than as a different screen. The profile is fetched only when the card
 * is opened: a list of twenty names is not twenty profile reads.
 */
export function PatientInfoButton({
  hit,
  onPick,
}: {
  hit: PatientHit;
  onPick: (hit: PatientHit) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const name = displayName(hit);

  return (
    <>
      <IconButton
        size="small"
        aria-label={`Údaje pacienta ${name}`}
        aria-haspopup="dialog"
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <InfoOutlined fontSize="small" />
      </IconButton>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { borderRadius: 2 } } }}
      >
        {anchor !== null ? (
          <PatientInfoCard
            hit={hit}
            onPick={() => {
              setAnchor(null);
              onPick(hit);
            }}
          />
        ) : null}
      </Popover>
    </>
  );
}

function PatientInfoCard({
  hit,
  onPick,
}: {
  hit: PatientHit;
  onPick: () => void;
}) {
  const maySeeSensitive = usePermission("patients.sensitive_identity.view");
  const card = usePatientCard(hit.id, true);
  const name = displayName(hit);

  return (
    <Box role="dialog" aria-label={`Údaje pacienta ${name}`} sx={{ p: 1.5, minWidth: 260, maxWidth: 320 }}>
      <Typography sx={{ fontWeight: 600 }}>{name}</Typography>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {hit.dateOfBirth ? `nar. ${formatDateOnly(hit.dateOfBirth)}` : "datum narození neuvedeno"}
      </Typography>

      <Box sx={{ mt: 1 }}>
        {card.isLoading ? (
          <Stack spacing={0.5} aria-busy="true">
            <Skeleton height={20} />
            <Skeleton height={20} />
          </Stack>
        ) : card.error ? (
          <Alert
            severity={
              card.error instanceof BookingApiError && card.error.kind === "notFound"
                ? "info"
                : "error"
            }
            sx={{ py: 0 }}
            action={
              card.error instanceof BookingApiError && card.error.kind === "notFound" ? undefined : (
                <Button color="inherit" size="small" onClick={() => void card.refetch()}>
                  Znovu
                </Button>
              )
            }
          >
            {card.error instanceof BookingApiError && card.error.kind === "notFound"
              ? "Tento záznam registr nevede, kontaktní údaje k němu nejsou."
              : "Údaje se nepodařilo načíst."}
          </Alert>
        ) : card.data ? (
          <Box
            component="dl"
            sx={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              columnGap: 1.5,
              rowGap: 0.25,
              m: 0,
            }}
          >
            {cardRows(card.data, maySeeSensitive).map((row) => (
              <Box key={row.label} sx={{ display: "contents" }}>
                <Typography component="dt" variant="caption" sx={{ color: "text.secondary" }}>
                  {row.label}
                </Typography>
                <Typography
                  component="dd"
                  variant="body2"
                  sx={{ m: 0, color: row.value ? "text.primary" : "text.disabled", wordBreak: "break-word" }}
                >
                  {row.value ?? "neuvedeno"}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : null}
      </Box>

      <Stack direction="row" sx={{ justifyContent: "flex-end", mt: 1 }}>
        <Button size="small" variant="contained" onClick={onPick}>
          Vybrat tohoto pacienta
        </Button>
      </Stack>
    </Box>
  );
}
