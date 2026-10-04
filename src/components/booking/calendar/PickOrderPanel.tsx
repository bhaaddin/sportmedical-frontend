import { useState } from "react";
import { Alert, Box, Button, IconButton, LinearProgress, Paper, Stack, Switch, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { Device } from "../../../layout/useDevice";
import { formatMinutes, plural } from "../../clubs/blockLogic";
import type { ActivityCoverage, Coverage } from "../../clubs/order/coverage";
import { pickedLabel, type PickedTime } from "./multiSelect";

/*
 * The live calculator of "výběr termínů", beside the calendar while a club order is being picked.
 *
 *   desktop         a sticky panel on the right of the grid
 *   tablet / phone  a bar at the bottom: "Zbývá N slotů" and a button that opens the rest
 *
 * The one thing it shows, big: how many SLOTS (one visit of a činnost, its length) are still missing, per činnost
 * and in total. It only shows numbers and reports clicks; every number comes from `computeCoverage`.
 */

export interface PickOrderPanelProps {
  device: Device;
  clubName: string;
  serviceName: string;
  coverage: Coverage;
  picks: readonly PickedTime[];
  calendarName: (calendarId: string) => string;
  allowReserve: boolean;
  onReserve: (on: boolean) => void;
  /** A sentence about the last paint (trimmed, refused), or null. */
  note: string | null;
  /** Processing a request: what the club asked for (a hint only - the picks are the desk's own). */
  requested: readonly string[];
  /** Editing an existing order: the button saves the changes instead of confirming a new order. */
  editing: boolean;
  confirming: boolean;
  /** A refusal from the server (409/400) - the picks stay. */
  failure: { message: string; conflict: string | null } | null;
  onRemoveConflict?: (() => void) | null;
  /** The 409 names athletes whose bookings the change would cancel (editing only), or null. */
  athletesAffected?: number | null;
  onConfirm: () => void;
  onConfirmCancelling?: () => void;
  onClearPicks: () => void;
  onRemovePick: (id: string) => void;
  onCancel: () => void;
}

const slotsWord = (n: number): string => plural(n, ["slot", "sloty", "slotů"]);

/** "12 × Základní (30 min) · 10 × Komplexní (60 min)" - only the činnosti that still miss slots. */
export const remainingLine = (coverage: Coverage): string =>
  coverage.perActivity
    .filter((a) => a.remainingSlots > 0)
    .map((a) => `${a.remainingSlots} × ${a.name} (${a.minutesPerSeat} min)`)
    .join(" · ");

function Progress({ coverage }: { coverage: Coverage }) {
  return (
    <LinearProgress
      variant="determinate"
      value={coverage.percent}
      color={coverage.covered ? "success" : "primary"}
      aria-label="Pokrytí objednávky"
      aria-valuenow={coverage.percent}
      data-testid="pick-progress"
      sx={{ height: 10, borderRadius: 5 }}
    />
  );
}

function ActivityRow({ a }: { a: ActivityCoverage }) {
  const done = a.remainingSlots === 0;
  return (
    <Stack direction="row" data-testid="pick-activity" data-done={done ? "true" : "false"} sx={{ alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
      <Typography variant="body2" sx={{ minWidth: 0, color: done ? "text.secondary" : "text.primary" }}>
        {`${a.name} (${a.minutesPerSeat} min) · ${a.seats} ${plural(a.seats, ["hráč", "hráči", "hráčů"])}`}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: "nowrap", color: done ? "success.main" : "warning.main" }}>
        {done ? "hotovo" : `zbývá ${a.remainingSlots} ${slotsWord(a.remainingSlots)}`}
      </Typography>
    </Stack>
  );
}

/** The big number (or "Hotovo"), per činnost and the progress: the heart of the panel. */
function Remaining({ coverage, compact }: { coverage: Coverage; compact?: boolean }) {
  if (coverage.covered) {
    return (
      <Box data-testid="pick-summary">
        <Typography data-testid="pick-covered" sx={{ fontSize: compact ? 17 : 22, fontWeight: 800, color: "success.main", lineHeight: 1.2 }}>
          Hotovo — všechny sloty pokryty
          {coverage.surplusMinutes > 0 ? (
            <Typography component="span" sx={{ display: "block", fontSize: 13, fontWeight: 500, color: "text.secondary" }}>
              {`Rezerva ${formatMinutes(coverage.surplusMinutes)}`}
            </Typography>
          ) : null}
        </Typography>
      </Box>
    );
  }
  return (
    <Box data-testid="pick-summary">
      <Typography data-testid="pick-slots" sx={{ fontSize: compact ? 20 : 30, fontWeight: 800, lineHeight: 1.1 }}>
        {`Zbývá ${coverage.remainingSlots} ${slotsWord(coverage.remainingSlots)}`}
      </Typography>
      <Typography data-testid="pick-remaining" variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
        {coverage.totalSeats === 0 ? "Nejsou zadaní žádní hráči." : `Zbývá: ${remainingLine(coverage)}`}
      </Typography>
    </Box>
  );
}

function Details(props: PickOrderPanelProps) {
  const { coverage, picks } = props;
  const sorted = [...picks].sort((a, b) => a.dayKey.localeCompare(b.dayKey) || a.range.start - b.range.start);
  const busy = props.confirming;
  return (
    <Stack spacing={1.75}>
      <Box>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{props.clubName}</Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>{props.serviceName}</Typography>
      </Box>

      <Stack spacing={0.5} data-testid="pick-needs">
        {coverage.perActivity.map((a) => <ActivityRow key={a.activityId} a={a} />)}
        <Typography variant="caption" data-testid="pick-minutes" sx={{ color: "text.secondary" }}>
          {`Vybráno ${formatMinutes(coverage.pickedMinutes)} z ${formatMinutes(coverage.neededMinutes)}`}
        </Typography>
      </Stack>

      {props.requested.length > 0 ? (
        <Alert severity="info" data-testid="pick-requested" sx={{ py: 0.25 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>Klub žádá:</Typography>
          {props.requested.map((line) => <Typography key={line} variant="body2">{line}</Typography>)}
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography id="pick-reserve-label" sx={{ fontSize: 13, fontWeight: 600 }}>Přidat rezervu</Typography>
        <Switch
          checked={props.allowReserve}
          onChange={(_, on) => props.onReserve(on)}
          slotProps={{ input: { "aria-labelledby": "pick-reserve-label" } }}
        />
      </Stack>

      {props.note !== null ? <Alert severity="info" data-testid="pick-note" sx={{ py: 0.25 }}>{props.note}</Alert> : null}

      <Box>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{`Vybrané termíny (${sorted.length})`}</Typography>
          {sorted.length > 0 ? (
            <Button size="small" onClick={props.onClearPicks} disabled={busy}>Smazat všechny</Button>
          ) : null}
        </Stack>
        {sorted.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Zatím nic. {props.device === "desktop" ? "Stiskněte v kalendáři a tažením označte čas." : "Klepněte v kalendáři na začátek a potom na konec."}
          </Typography>
        ) : (
          <Stack spacing={0.5} sx={{ maxHeight: 180, overflowY: "auto" }} data-testid="pick-list">
            {sorted.map((p) => (
              <Box
                key={p.id}
                data-testid="pick-row"
                sx={{ display: "flex", alignItems: "center", gap: 0.5, pl: 1.25, borderRadius: 2, bgcolor: "action.hover" }}
              >
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontVariantNumeric: "tabular-nums" }}>
                  {`${pickedLabel(p)} · ${p.range.end - p.range.start} min`}
                  <Typography component="span" variant="caption" sx={{ color: "text.secondary", ml: 0.75 }}>{props.calendarName(p.calendarId)}</Typography>
                </Typography>
                <IconButton size="small" aria-label={`Odebrat termín ${pickedLabel(p)}`} onClick={() => props.onRemovePick(p.id)} disabled={busy} sx={{ width: 36, height: 36 }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      {props.failure !== null ? (
        <Alert
          severity="error"
          data-testid="pick-failure"
          action={
            props.onRemoveConflict ? (
              <Button color="inherit" size="small" onClick={props.onRemoveConflict}>Odebrat</Button>
            ) : undefined
          }
        >
          {props.failure.message}
          {props.failure.conflict !== null ? <Box component="div" sx={{ fontWeight: 700 }}>{`Kolize: ${props.failure.conflict}`}</Box> : null}
          {props.athletesAffected != null && props.onConfirmCancelling ? (
            <Button color="error" variant="outlined" size="small" onClick={props.onConfirmCancelling} disabled={busy} sx={{ mt: 1 }}>
              {`Potvrdit a zrušit rezervace sportovců (${props.athletesAffected})`}
            </Button>
          ) : null}
        </Alert>
      ) : null}
    </Stack>
  );
}

function ConfirmRow(props: PickOrderPanelProps) {
  const { picks } = props;
  return (
    <Stack direction="row" spacing={1}>
      <Button variant="outlined" onClick={props.onCancel} disabled={props.confirming} sx={{ minHeight: 44 }}>Zrušit</Button>
      <Button variant="contained" fullWidth disabled={picks.length === 0 || props.confirming} onClick={props.onConfirm} sx={{ minHeight: 44 }}>
        {props.confirming ? (props.editing ? "Ukládám…" : "Potvrzuji…") : props.editing ? "Uložit změny" : "Potvrdit objednávku"}
      </Button>
    </Stack>
  );
}

export function PickOrderPanel(props: PickOrderPanelProps) {
  const [open, setOpen] = useState(false);
  const { coverage } = props;

  if (props.device === "desktop") {
    return (
      <Paper
        component="aside"
        elevation={0}
        aria-label="Výběr termínů"
        data-testid="pick-panel"
        data-layout="side"
        sx={{
          position: "sticky",
          top: 12,
          width: 340,
          maxHeight: "calc(100vh - 24px)",
          overflowY: "auto",
          p: 2,
          border: "1px solid",
          borderColor: coverage.covered ? "success.main" : "divider",
          borderRadius: 3,
          alignSelf: "start",
        }}
      >
        <Stack spacing={1.5}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "text.secondary" }}>Výběr termínů</Typography>
          <Remaining coverage={coverage} />
          <Progress coverage={coverage} />
          <Details {...props} />
          <ConfirmRow {...props} />
        </Stack>
      </Paper>
    );
  }

  const phone = props.device === "phone";
  return (
    <Paper
      component="aside"
      elevation={8}
      aria-label="Výběr termínů"
      data-testid="pick-panel"
      data-layout="bottom-bar"
      data-open={open ? "true" : "false"}
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: phone ? "var(--bottom-bar-height, 0px)" : 0,
        zIndex: 1200,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderTop: "1px solid",
        borderColor: coverage.covered ? "success.main" : "divider",
        px: 2,
        pt: 1,
        pb: 1.25,
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Remaining coverage={coverage} compact />
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {`${formatMinutes(coverage.pickedMinutes)} z ${formatMinutes(coverage.neededMinutes)}`}
            </Typography>
          </Box>
          <IconButton
            aria-label={open ? "Skrýt podrobnosti výběru" : "Zobrazit podrobnosti výběru"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            sx={{ width: 44, height: 44 }}
          >
            {open ? <ExpandMoreIcon /> : <ExpandLessIcon />}
          </IconButton>
        </Stack>
        <Progress coverage={coverage} />
        {open || props.failure !== null ? (
          <Box sx={{ maxHeight: phone ? "50vh" : "55vh", overflowY: "auto", py: 0.5 }}>
            <Details {...props} />
          </Box>
        ) : props.note !== null ? (
          <Typography variant="caption" data-testid="pick-note-inline" sx={{ color: "text.secondary" }}>{props.note}</Typography>
        ) : null}
        <ConfirmRow {...props} />
      </Stack>
    </Paper>
  );
}
