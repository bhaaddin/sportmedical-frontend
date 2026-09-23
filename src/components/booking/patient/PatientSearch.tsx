import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  InputAdornment,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Search from "@mui/icons-material/Search";
import { useTranslation } from "react-i18next";
import { formatDateOnly } from "../../../utils/time";
import { errorText } from "../errorText";
import { PatientInfoButton } from "./PatientInfoButton";
import {
  MIN_QUERY_LENGTH,
  displayName,
  duplicateNameIds,
  usePatientTypeahead,
} from "./patientTypeahead";
import type { PatientHit } from "./patientTypeahead";

/** At most this many rows on screen; the rest is a "type more" hint. */
const SHOWN = 12;

/**
 * The patient step: one box, results as you type, namesakes told apart.
 *
 * Searching is still what comes before creating - an empty answer says what it
 * means ("nobody by that name here") and only then offers the registration,
 * which opens in a new tab so the time already chosen in this dialog is not
 * thrown away while the new patient is written down.
 */
export function PatientSearch({
  onPick,
  autoFocus = false,
  enabled,
  mayRegister,
}: {
  onPick: (hit: PatientHit) => void;
  autoFocus?: boolean;
  enabled: boolean;
  mayRegister: boolean;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const search = usePatientTypeahead(text, enabled);
  const duplicates = duplicateNameIds(search.hits);
  const shown = search.hits.slice(0, SHOWN);
  const typedEnough = text.trim().length >= MIN_QUERY_LENGTH;

  return (
    <Stack spacing={1}>
      <TextField
        fullWidth
        size="small"
        autoFocus={autoFocus}
        label="Jméno nebo příjmení"
        placeholder="např. Fehér nebo Filip Fehér"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoComplete="off"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: search.isFetching && typedEnough ? (
              <InputAdornment position="end">
                <CircularProgress size={16} aria-label="Hledám" />
              </InputAdornment>
            ) : undefined,
          },
        }}
      />

      {!typedEnough ? (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Začněte psát jméno nebo příjmení — systém nabídne pacienty, které už zná.
        </Typography>
      ) : search.error ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={search.refetch}>
              {t("booking.common.retry")}
            </Button>
          }
        >
          {errorText(search.error, t)}
        </Alert>
      ) : search.isSettled && !search.isFetching && search.hits.length === 0 ? (
        <Alert severity="info">
          V databázi nikoho takového nenacházím. Zkuste jiný tvar jména, třeba jen
          příjmení — teprve potom zakládejte nového pacienta, jinak vznikne druhý
          záznam téhož člověka.
        </Alert>
      ) : shown.length > 0 ? (
        <Box
          role="list"
          aria-label="Nalezení pacienti"
          sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}
        >
          {shown.map((hit, i) => (
            <Box key={hit.id} role="listitem">
              {i > 0 ? <Divider /> : null}
              <Stack direction="row" sx={{ alignItems: "center", pr: 0.5 }}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => onPick(hit)}
                  sx={{
                    flex: 1,
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    font: "inherit",
                    color: "inherit",
                    cursor: "pointer",
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    "&:hover": { backgroundColor: "action.hover" },
                    "&:focus-visible": {
                      outline: "3px solid",
                      outlineColor: "primary.main",
                    },
                  }}
                >
                  <Typography sx={{ fontWeight: 600 }}>{displayName(hit)}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {hit.dateOfBirth
                      ? `nar. ${formatDateOnly(hit.dateOfBirth)}`
                      : "datum narození neuvedeno"}
                  </Typography>
                </Box>
                {duplicates.has(hit.id) ? (
                  <PatientInfoButton hit={hit} onPick={onPick} />
                ) : null}
              </Stack>
            </Box>
          ))}
        </Box>
      ) : null}

      {typedEnough && (search.truncated || search.hits.length > SHOWN) ? (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Zobrazena jen část shod — upřesněte jméno.
        </Typography>
      ) : null}

      {typedEnough && mayRegister ? (
        <Typography variant="body2">
          Pacient v databázi není?{" "}
          <MuiLink href="/patients/register" target="_blank" rel="noopener">
            Založit nového pacienta
          </MuiLink>{" "}
          <Typography component="span" variant="caption" sx={{ color: "text.secondary" }}>
            (otevře se v nové záložce, zvolený čas zůstane zde)
          </Typography>
        </Typography>
      ) : null}
    </Stack>
  );
}
