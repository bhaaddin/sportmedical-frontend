import { useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Collapse,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import Search from "@mui/icons-material/Search";
import { useQuery } from "@tanstack/react-query";
import { clubsApi, type Club } from "../../../services/clubsApi";
import { useDevice } from "../../../layout/useDevice";
import { DESIGN, SectionLabel, SoftCard } from "../../ui";
import { PhoneField } from "../../ui/PhoneField";
import {
  athletesWord,
  clubMatches,
  clubsWord,
  initials,
  type NewClubDraft,
} from "../NewAppointmentDialog.logic";
import { clubDiscountLine } from "../grid/clubLine";

export type { NewClubDraft };

/**
 * "Klub" - the board's "Hromadná rezervace pro klub": find the club by name
 * or contact person, or found a new one under "NEBO ZALOŽIT NOVÝ". Picking is
 * all this does; the reservation itself - how many places, which činnost,
 * the link for the athletes - is the reservation screen's, which this hands
 * off to with the slot.
 *
 * The rows draw what the clubs API carries and nothing else: the name, the
 * contact, "Sleva −N %" from `discountPercent`, and "N sportovců" only when
 * the club actually has a count on record - a missing number is left out, not
 * replaced by a made-up one.
 *
 * Under the rows sits "Rozsah hromadné rezervace" (Od, Do): which days the
 * block covers. It starts on the day of the chosen slot.
 */

/** A club as the list may carry it; the athlete count is not guaranteed by every server. */
type ClubRow = Club & { athleteCount?: number | null; headcount?: number | null };

function athleteCountOf(club: ClubRow): number | null {
  const n = club.athleteCount ?? club.headcount ?? null;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
}

export function ClubPicker({
  selectedId,
  onSelect,
  draft,
  onDraft,
  range,
  onRange,
  error = null,
  disabled = false,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  draft: NewClubDraft;
  onDraft: (next: NewClubDraft) => void;
  /** The days the block covers, `yyyy-MM-dd`. */
  range: { from: string; to: string };
  onRange: (next: { from: string; to: string }) => void;
  /** Why founding the club failed, in the server's words. */
  error?: string | null;
  disabled?: boolean;
}) {
  const phone = useDevice() === "phone";
  const [query, setQuery] = useState("");
  const [founding, setFounding] = useState(false);

  const clubs = useQuery({
    queryKey: ["clubs", "active"],
    queryFn: () => clubsApi.getAll(true),
    staleTime: 60_000,
  });

  const rows = useMemo(
    () => ((clubs.data ?? []) as ClubRow[]).filter((c) => c.isActive !== false && clubMatches(c, query)),
    [clubs.data, query],
  );

  const set = (field: keyof NewClubDraft, next: string) => {
    onDraft({ ...draft, [field]: next });
    if (selectedId !== null) onSelect(null);
  };

  const contactLine = (club: ClubRow) => {
    const count = athleteCountOf(club);
    return (
      [
        count === null ? null : athletesWord(count),
        club.contactPerson,
        club.contactPhone ?? club.contactEmail,
      ]
        .filter((v): v is string => Boolean(v && v.trim()))
        .join(" · ") || "bez kontaktu"
    );
  };

  const rangeInvalid = range.from !== "" && range.to !== "" && range.to < range.from;
  const grid = (two: string) => ({
    display: "grid",
    gridTemplateColumns: phone ? "1fr" : two,
    gap: 1.5,
  });

  const field = (label: string, key: keyof NewClubDraft, props: Partial<React.ComponentProps<typeof TextField>> = {}) => (
    <Box>
      <SectionLabel component="label" sx={{ mb: 0.5 }}>
        {label}
      </SectionLabel>
      <TextField
        fullWidth
        disabled={disabled}
        value={draft[key]}
        onChange={(e) => set(key, e.target.value)}
        slotProps={{ htmlInput: { "aria-label": label } }}
        {...props}
      />
    </Box>
  );

  return (
    <Stack spacing={2.5}>
      <Box>
        <SectionLabel>Vybrat klub</SectionLabel>
        <TextField
          fullWidth
          placeholder="Název klubu nebo kontaktní osoba"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          disabled={disabled}
          slotProps={{
            htmlInput: { "aria-label": "Název klubu nebo kontaktní osoba" },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: clubs.isSuccess ? (
                <InputAdornment position="end">
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {clubsWord(rows.length)}
                  </Typography>
                </InputAdornment>
              ) : undefined,
            },
          }}
        />

        <Box sx={{ mt: 1.5 }}>
          {clubs.isLoading ? (
            <Stack spacing={1} aria-busy="true">
              <Skeleton variant="rectangular" height={64} />
              <Skeleton variant="rectangular" height={64} />
            </Stack>
          ) : clubs.isError ? (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => void clubs.refetch()}>
                  Zkusit znovu
                </Button>
              }
            >
              Seznam klubů se nepodařilo načíst.
            </Alert>
          ) : rows.length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {query.trim() === ""
                ? "Zatím žádný klub. Založte nový níže."
                : "Žádný klub tohoto jména. Zkuste jiný tvar, nebo ho založte níže."}
            </Typography>
          ) : (
            <Stack role="radiogroup" aria-label="Kluby" spacing={1}>
              {rows.map((club) => {
                const selected = club.id === selectedId;
                return (
                  <ButtonBase
                    key={club.id}
                    role="radio"
                    aria-checked={selected}
                    aria-label={club.name}
                    disabled={disabled}
                    onClick={() => {
                      onSelect(selected ? null : club.id);
                      if (!selected) setFounding(false);
                    }}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      textAlign: "left",
                      width: "100%",
                      px: 2,
                      py: 1.5,
                      minHeight: 56,
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: selected ? "primary.main" : "divider",
                      boxShadow: selected
                        ? (t) => `inset 0 0 0 1px ${t.palette.primary.main}`
                        : "none",
                      bgcolor: selected ? DESIGN.softPrimary.bg : "background.paper",
                      fontFamily: "inherit",
                      "&:hover": { bgcolor: selected ? DESIGN.softPrimary.bg : "action.hover" },
                      "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main" },
                    }}
                  >
                    <Avatar sx={{ width: 36, height: 36, fontSize: 13 }}>{initials(club.name)}</Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, lineHeight: 1.3 }}>{club.name}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                        {contactLine(club)}
                      </Typography>
                    </Box>
                    {/* The club's own discount from the server - "Sleva −10 %" - and nothing when it has none. */}
                    {clubDiscountLine(club.discountPercent) ? (
                      <Typography variant="caption" sx={{ color: "text.secondary", whiteSpace: "nowrap", fontWeight: 600 }}>
                        {clubDiscountLine(club.discountPercent)}
                      </Typography>
                    ) : null}
                  </ButtonBase>
                );
              })}
            </Stack>
          )}
        </Box>
      </Box>

      <Box>
        <SectionLabel>Nebo založit nový</SectionLabel>
        <SoftCard sx={{ p: 2 }}>
          <ButtonBase
            onClick={() => setFounding((v) => !v)}
            aria-expanded={founding}
            disabled={disabled}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              width: "100%",
              justifyContent: "flex-start",
              fontFamily: "inherit",
              borderRadius: 2,
              py: 0.5,
            }}
          >
            <Add fontSize="small" sx={{ color: "primary.main" }} />
            <Typography sx={{ fontWeight: 700 }}>Nový klub — není v seznamu</Typography>
          </ButtonBase>
          <Collapse in={founding}>
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              {field("Název klubu", "name", { placeholder: "např. TJ Sokol Slaný" })}
              <Box sx={grid("1fr 1fr")}>
                {field("Kontaktní osoba", "contactPerson", { placeholder: "Jméno a příjmení" })}
                <Box>
                  <SectionLabel component="label" sx={{ mb: 0.5 }}>
                    Telefon
                  </SectionLabel>
                  <PhoneField
                    label="Telefon"
                    value={draft.phone}
                    onChange={(next) => set("phone", next)}
                    disabled={disabled}
                  />
                </Box>
              </Box>
              <Box sx={grid("1fr 1fr")}>
                {field("E-mail", "email", { type: "email", placeholder: "klub@email.cz" })}
                {field("Počet sportovců", "athleteCount", {
                  type: "number",
                  placeholder: "např. 12",
                  slotProps: { htmlInput: { "aria-label": "Počet sportovců", min: 1, step: 1 } },
                })}
              </Box>
              {field("IČO", "ico", {
                placeholder: "8 číslic — nepovinné",
                helperText: "S IČO se klub založí hned. Bez něj údaje předáme rezervaci a IČO se doplní tam.",
                slotProps: { htmlInput: { "aria-label": "IČO", inputMode: "numeric", maxLength: 12 } },
              })}
            </Stack>
          </Collapse>
        </SoftCard>
      </Box>

      <Box>
        <SectionLabel>Rozsah hromadné rezervace</SectionLabel>
        <Box sx={grid("1fr 1fr")}>
          <Box>
            <SectionLabel component="label" sx={{ mb: 0.5 }}>
              Od
            </SectionLabel>
            <TextField
              fullWidth
              type="date"
              disabled={disabled}
              value={range.from}
              onChange={(e) => onRange({ from: e.target.value, to: range.to })}
              slotProps={{ htmlInput: { "aria-label": "Od" } }}
            />
          </Box>
          <Box>
            <SectionLabel component="label" sx={{ mb: 0.5 }}>
              Do
            </SectionLabel>
            <TextField
              fullWidth
              type="date"
              disabled={disabled}
              value={range.to}
              onChange={(e) => onRange({ from: range.from, to: e.target.value })}
              error={rangeInvalid}
              helperText={rangeInvalid ? "Konec nesmí být před začátkem." : undefined}
              slotProps={{ htmlInput: { "aria-label": "Do" } }}
            />
          </Box>
        </Box>
      </Box>

      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}

export default ClubPicker;
