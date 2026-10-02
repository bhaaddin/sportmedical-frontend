import { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Search from "@mui/icons-material/Search";
import { useTranslation } from "react-i18next";
import { formatDateOnly } from "../../../utils/time";
import { errorText } from "../errorText";
import { foundPatientsWord, initials } from "../NewAppointmentDialog.logic";
import { PatientInfoButton } from "./PatientInfoButton";
import { QuickRegister } from "./QuickRegister";
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
 * Drawn the way the board's "Z databáze" screen draws it: the search box with
 * the count of hits on its right, and under it one card per patient - initials,
 * name, "nar. … · telefon". Searching is still what comes before creating - an
 * empty answer says what it means ("nobody by that name here") and only then
 * offers the registration. Inside the booking drawer that is the drawer's own
 * "Rychlá registrace" card (`onQuickRegister`); on its own, the inline
 * `QuickRegister` form.
 */
export function PatientSearch({
  onPick,
  onLink,
  onQuickRegister,
  autoFocus = false,
  enabled,
  mayRegister,
}: {
  onPick: (hit: PatientHit) => void;
  /** A quick-registration link was generated, lifted for the booked screen. */
  onLink?: (link: string) => void;
  /**
   * The drawer's quick registration, handed what was typed so the name need not
   * be typed twice. When given, the inline form is not shown.
   */
  onQuickRegister?: (typed: string) => void;
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
  const settled = typedEnough && search.isSettled && !search.isFetching && !search.error;

  return (
    <Stack spacing={1.5}>
      <TextField
        fullWidth
        autoFocus={autoFocus}
        placeholder="Jméno nebo příjmení"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoComplete="off"
        slotProps={{
          htmlInput: { "aria-label": "Jméno nebo příjmení" },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
            endAdornment:
              search.isFetching && typedEnough ? (
                <InputAdornment position="end">
                  <CircularProgress size={16} aria-label="Hledám" />
                </InputAdornment>
              ) : settled ? (
                <InputAdornment position="end">
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {foundPatientsWord(search.hits.length)}
                  </Typography>
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
        <Alert
          severity="info"
          action={
            onQuickRegister && mayRegister ? (
              <Button color="inherit" size="small" onClick={() => onQuickRegister(text.trim())}>
                Rychlá registrace
              </Button>
            ) : undefined
          }
        >
          V databázi nikoho takového nenacházím. Zkuste jiný tvar jména, třeba jen
          příjmení — teprve potom zakládejte nového pacienta, jinak vznikne druhý
          záznam téhož člověka.
        </Alert>
      ) : shown.length > 0 ? (
        <Stack role="list" aria-label="Nalezení pacienti" spacing={1}>
          {shown.map((hit) => (
            <Stack
              key={hit.id}
              role="listitem"
              direction="row"
              sx={{
                alignItems: "center",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 3,
                bgcolor: "background.paper",
                pr: 1,
              }}
            >
              <Box
                component="button"
                type="button"
                onClick={() => onPick(hit)}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  textAlign: "left",
                  border: "none",
                  background: "none",
                  font: "inherit",
                  color: "inherit",
                  cursor: "pointer",
                  px: 2,
                  py: 1.5,
                  borderRadius: 3,
                  "&:hover": { backgroundColor: "action.hover" },
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: -2,
                  },
                }}
              >
                <Avatar sx={{ width: 36, height: 36, fontSize: 13 }}>
                  {initials(displayName(hit))}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                    {displayName(hit)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                    {hit.dateOfBirth
                      ? `nar. ${formatDateOnly(hit.dateOfBirth)}`
                      : "datum narození neuvedeno"}
                    {hit.phone ? ` · ${hit.phone}` : ""}
                  </Typography>
                </Box>
              </Box>
              {duplicates.has(hit.id) ? (
                <PatientInfoButton hit={hit} onPick={onPick} />
              ) : null}
            </Stack>
          ))}
        </Stack>
      ) : null}

      {typedEnough && (search.truncated || search.hits.length > SHOWN) ? (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Zobrazena jen část shod — upřesněte jméno.
        </Typography>
      ) : null}

      {mayRegister && !onQuickRegister ? (
        <QuickRegister onRegistered={onPick} onLink={onLink} defaultLastName={text.trim()} />
      ) : null}
    </Stack>
  );
}
