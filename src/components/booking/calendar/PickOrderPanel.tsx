import { useState } from "react";
import { Alert, Box, Button, Chip, IconButton, LinearProgress, Paper, Stack, Switch, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { Device } from "../../../layout/useDevice";
import { formatMinutes, formatPlayers, plural } from "../../clubs/blockLogic";
import type { Coverage } from "../../clubs/order/coverage";
import { WEEKDAYS } from "../../clubs/order/orderLogic";
import { pickedLabel, type PickedTime } from "./multiSelect";

/*
 * The live calculator of "výběr termínů", beside the calendar while a club order is being picked.
 *
 *   desktop         a sticky panel on the right of the grid
 *   tablet / phone  a bar at the bottom: the one-line state (progress, what is missing) and a button that opens the rest
 *
 * It only shows numbers and reports clicks. Every number comes from `computeCoverage`; the server's own analysis is
 * shown beside it when it says something else.
 */

export interface PickServerNote {
  neededMinutes: number;
  availableMinutes: number;
}

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
  /** The server's numbers when they differ from ours. */
  serverNote: PickServerNote | null;
  /** Where the automatic proposal would start ("po 26. 10. od 09:40"), or null when nothing is picked. */
  proposalFrom: string | null;
  weekdays: number[];
  onWeekdays: (days: number[]) => void;
  proposing: boolean;
  confirming: boolean;
  /** A refusal from the server (409/400) - the picks stay. */
  failure: { message: string; conflict: string | null } | null;
  onRemoveConflict?: (() => void) | null;
  onUndoProposal: (() => void) | null;
  onPropose: () => void;
  onConfirm: () => void;
  onClearPicks: () => void;
  onRemovePick: (id: string) => void;
  onCancel: () => void;
}

const hoursOf = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h${m > 0 ? ` ${m} min` : ""}` : `${m} min`;
};

function Metric({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</Typography>
      <Typography sx={{ fontSize: 17, fontWeight: 700, color: tone === "ok" ? "success.main" : tone === "warn" ? "warning.main" : "text.primary" }}>{value}</Typography>
    </Box>
  );
}

function Progress({ coverage }: { coverage: Coverage }) {
  return (
    <Box>
      <LinearProgress
        variant="determinate"
        value={coverage.percent}
        color={coverage.covered ? "success" : "primary"}
        aria-label="Pokrytí hráčů"
        aria-valuenow={coverage.percent}
        data-testid="pick-progress"
        sx={{ height: 10, borderRadius: 5 }}
      />
    </Box>
  );
}

function Details(props: PickOrderPanelProps) {
  const { coverage, picks } = props;
  const sorted = [...picks].sort((a, b) => a.dayKey.localeCompare(b.dayKey) || a.range.start - b.range.start);
  const busy = props.proposing || props.confirming;
  return (
    <Stack spacing={1.75}>
      <Box>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{props.clubName}</Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>{props.serviceName}</Typography>
      </Box>

      <Box data-testid="pick-needs">
        <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>{`Potřeba: ${formatPlayers(coverage.totalSeats)}`}</Typography>
        <Stack component="ul" spacing={0.25} sx={{ m: 0, pl: 2, listStyle: "disc" }}>
          {coverage.perActivity.map((a) => (
            <li key={a.activityId} data-testid="pick-activity">
              <Typography variant="body2">
                {`${a.name}: ${a.seats} × ${a.minutesPerSeat} min${a.parallelCapacity > 1 ? ` ÷ ${a.parallelCapacity}` : ""} = ${formatMinutes(Math.ceil(a.neededMinutes - 1e-9))}`}
              </Typography>
            </li>
          ))}
        </Stack>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25 }} data-testid="pick-metrics">
        <Metric label="Potřeba celkem" value={formatMinutes(coverage.neededMinutes)} />
        <Metric label="Vybráno" value={formatMinutes(coverage.pickedMinutes)} />
        <Metric label="Zbývá vybrat" value={formatMinutes(coverage.remainingMinutes)} tone={coverage.remainingMinutes > 0 ? "warn" : "ok"} />
        <Metric label="Nepokryto" value={formatPlayers(coverage.remainingSeats)} tone={coverage.remainingSeats > 0 ? "warn" : "ok"} />
      </Box>

      <Progress coverage={coverage} />

      {coverage.covered ? (
        <Alert severity="success" data-testid="pick-covered" sx={{ py: 0.25 }}>
          {`Pokryto — všech ${formatPlayers(coverage.totalSeats)} má čas.`}
          {coverage.surplusMinutes > 0 ? ` Rezerva ${formatMinutes(coverage.surplusMinutes)}.` : ""}
        </Alert>
      ) : (
        <Typography variant="body2" data-testid="pick-missing" sx={{ color: "text.secondary" }}>
          {`Chybí ${hoursOf(coverage.remainingMinutes)} (${formatPlayers(coverage.remainingSeats)}). Táhněte myší přes volný čas v kalendáři.`}
        </Typography>
      )}

      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography id="pick-reserve-label" sx={{ fontSize: 13, fontWeight: 600 }}>Přidat rezervu</Typography>
        <Switch
          checked={props.allowReserve}
          onChange={(_, on) => props.onReserve(on)}
          slotProps={{ input: { "aria-labelledby": "pick-reserve-label" } }}
        />
      </Stack>

      {props.note !== null ? <Alert severity="info" data-testid="pick-note" sx={{ py: 0.25 }}>{props.note}</Alert> : null}

      {props.serverNote !== null ? (
        <Alert severity="warning" data-testid="pick-server" sx={{ py: 0.25 }}>
          {`Server počítá jinak: potřeba ${formatMinutes(props.serverNote.neededMinutes)}, k dispozici ${formatMinutes(props.serverNote.availableMinutes)} (otevírací doba, svátky).`}
        </Alert>
      ) : null}

      <Box>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{`Vybrané termíny (${sorted.length})`}</Typography>
          {sorted.length > 0 ? (
            <Button size="small" onClick={props.onClearPicks} disabled={busy}>Smazat všechny</Button>
          ) : null}
        </Stack>
        {sorted.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>Zatím nic. Stiskněte v kalendáři a tažením označte čas.</Typography>
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

      <Box>
        <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>Navrhnout automaticky</Typography>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5, mb: 0.75 }} role="group" aria-label="Dny pro automatický návrh">
          {WEEKDAYS.map((d) => {
            const on = props.weekdays.includes(d.value);
            return (
              <Chip
                key={d.value}
                label={d.label}
                size="small"
                color={on ? "primary" : "default"}
                variant={on ? "filled" : "outlined"}
                aria-pressed={on}
                onClick={() => props.onWeekdays(on ? props.weekdays.filter((x) => x !== d.value) : [...props.weekdays, d.value])}
                sx={{ minHeight: 32 }}
              />
            );
          })}
        </Stack>
        <Button
          variant="outlined"
          fullWidth
          disabled={props.proposalFrom === null || busy || coverage.totalSeats === 0}
          onClick={props.onPropose}
          sx={{ minHeight: 44 }}
        >
          {props.proposalFrom === null ? "Navrhnout automaticky od…" : `Navrhnout automaticky od ${props.proposalFrom}`}
        </Button>
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
          {props.proposalFrom === null
            ? "Nejdřív označte v kalendáři začátek — počítá se přesně od něj."
            : "Návrh rozloží čas od prvního označeného místa; potom ho upravíte ručně."}
        </Typography>
        {props.onUndoProposal !== null ? (
          <Button size="small" onClick={props.onUndoProposal} sx={{ mt: 0.5 }}>Vrátit můj výběr před návrhem</Button>
        ) : null}
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
      <Button
        variant="contained"
        fullWidth
        disabled={picks.length === 0 || props.confirming || props.proposing}
        onClick={props.onConfirm}
        sx={{ minHeight: 44 }}
      >
        {props.confirming ? "Potvrzuji…" : "Potvrdit objednávku"}
      </Button>
    </Stack>
  );
}

const summaryOf = (coverage: Coverage): string =>
  coverage.covered
    ? "Pokryto"
    : `Zbývá ${formatMinutes(coverage.remainingMinutes)} · ${coverage.remainingSeats} ${plural(coverage.remainingSeats, ["hráč", "hráči", "hráčů"])}`;

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
          <Typography sx={{ fontSize: 16, fontWeight: 700 }}>Výběr termínů</Typography>
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
            <Typography data-testid="pick-summary" sx={{ fontSize: 14, fontWeight: 700, color: coverage.covered ? "success.main" : "text.primary" }}>
              {summaryOf(coverage)}
            </Typography>
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
        {open ? (
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
