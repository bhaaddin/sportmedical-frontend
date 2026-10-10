import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, IconButton, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { Device } from "../../../layout/useDevice";
import { formatMinutes, plural } from "../../clubs/blockLogic";
import { formatCzk } from "../../clubs/order/orderFormat";
import { allowedKey, firstWord, normalizeAllowed, type RoutedActivity } from "../../clubs/order/routing";
import { formatMinutes as clock } from "../grid/timeRange";
import { pickedLabel, type PickedTime } from "./multiSelect";
import { formatFree } from "./pickDays";
import { moreNeeded, moreNeededLine, type PickActivityCoverage, type PickCoverage, type WindowReport } from "./pickPlan";

/*
 * The live calculator of "výběr termínů", beside the calendar while a club order is being picked.
 *
 *   desktop         a sticky panel on the right of the grid
 *   tablet / phone  a bar at the bottom: "Vybráno X z Y hráčů" and a button that opens the rest
 *
 * Etapa 12: every number is counted INDIVIDUALLY per činnost by `pickCoverage` - how many players of each činnost
 * have a slot in the windows that allow it - and the panel only shows and reports clicks. Under a činnost that is
 * still short: what it would take and "Přidat další den". On a window: what it holds, what is unused, what is spare.
 */

export interface PickOrderPanelProps {
  device: Device;
  clubName: string;
  serviceName: string;
  coverage: PickCoverage;
  picks: readonly PickedTime[];
  calendarName: (calendarId: string) => string;
  /** A sentence about the last paint (cut at a booking, refused), or null. */
  note: string | null;
  /** One small action under the note ("Vzít celý den" after a shortcut took only the needed time). */
  noteAction?: { label: string; onClick: () => void } | null;
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
  /** Who they are ("Jan Novák (Spiroergometrie)") and whether the cause is a činnost taken out of a window. */
  athleteNames?: readonly string[];
  athletesRemovedFromWindow?: boolean;
  /** Etapa 10: the order's činnosti (with players) a picked window can be restricted to; fewer than two = no chips. */
  activities?: readonly RoutedActivity[];
  onToggleActivity?: (pickId: string, activityId: string) => void;
  onAllActivities?: (pickId: string) => void;
  /** Etapa 12: "Rozdělit" on a picked window opens the činnost bubble on it. */
  onSplitPick?: (pickId: string) => void;
  /** Etapa 12: "Přidat další den" for a činnost that is still short; `addingDay` names the one being looked up. */
  onAddDay?: (activityId: string) => void;
  addingDay?: string | null;
  /** Etapa 12: after "Doplnit termíny" the panel scrolls to this činnost's row and reports back. */
  focusActivityId?: string | null;
  onFocused?: () => void;
  /** Etapa 12: the grid takes new picks (false once every player has a slot); "Přidat termín navíc" arms one more. */
  accepting?: boolean;
  extraArmed?: boolean;
  onExtraPick?: () => void;
  /** Prices per činnost for the money of spare places (null = catalogue not read yet). */
  prices?: ReadonlyMap<string, number | null> | null;
  /** The length of a working day (minutes) for "≈ N celých dní"; null when unknown. */
  dayMinutes?: number | null;
  /** How many calendars of the služba run at once (the "při N kalendářích" of the estimate); at least 1. */
  calendarCount?: number;
  onConfirm: () => void;
  onConfirmCancelling?: () => void;
  onClearPicks: () => void;
  onRemovePick: (id: string) => void;
  onCancel: () => void;
}

const slotsWord = (n: number): string => plural(n, ["slot", "sloty", "slotů"]);
const playersWord = (n: number): string => plural(n, ["hráč", "hráči", "hráčů"]);
const placesWord = (n: number): string => plural(n, ["místo", "místa", "míst"]);
export const players = (n: number): string => `${n} ${playersWord(n)}`;
export const places = (n: number): string => `${n} ${placesWord(n)}`;

/** "Komplexní 19 hráčů · Spiroergometrie 46 hráčů" - only the činnosti that still miss players. */
export const remainingLine = (coverage: PickCoverage): string =>
  coverage.perActivity
    .filter((a) => a.remainingSeats > 0)
    .map((a) => `${a.name} ${players(a.remainingSeats)}`)
    .join(" · ");

/** "Navíc 6 h (4 místa Komplexní) – nevyužitý čas ≈ 8 800 Kč ušlých tržeb"; without the money when no price is set. */
export function spareLine(a: Pick<PickActivityCoverage, "name" | "spareSeats" | "spareMinutes">, price: number | null | undefined): string {
  const base = `Navíc ${formatFree(a.spareMinutes)} (${places(a.spareSeats)} ${firstWord(a.name)})`;
  if (price === null || price === undefined || price <= 0) return `${base} – nevyužitý čas`;
  return `${base} – nevyužitý čas ≈ ${formatCzk(price * a.spareSeats)} ušlých tržeb`;
}

function Progress({ coverage }: { coverage: PickCoverage }) {
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

function ActivityRow({ a, props }: { a: PickActivityCoverage; props: PickOrderPanelProps }) {
  const done = a.remainingSeats === 0;
  const touch = props.device !== "desktop";
  const calendarCount = Math.max(1, props.calendarCount ?? 1);
  const need = moreNeeded(a, props.dayMinutes ?? null, calendarCount);
  const adding = props.addingDay === a.activityId;
  const price = props.prices?.get(a.activityId) ?? null;
  return (
    <Box data-testid="pick-activity" data-activity-row={a.activityId} data-done={done ? "true" : "false"}>
      <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
        <Typography variant="body2" sx={{ minWidth: 0, color: done ? "text.secondary" : "text.primary" }}>
          {`${a.name} (${a.minutesPerSeat} min) · ${players(a.seats)}`}
        </Typography>
        <Typography variant="body2" data-testid="pick-activity-state" sx={{ fontWeight: 700, whiteSpace: "nowrap", color: done ? "success.main" : "warning.main" }}>
          {done ? "hotovo" : `${a.coveredSlots} ${plural(a.coveredSlots, ["slot vybrán", "sloty vybrány", "slotů vybráno"])} · zbývá ${a.remainingSeats}`}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={a.percent}
        color={done ? "success" : "primary"}
        aria-label={`Pokrytí: ${a.name}`}
        aria-valuenow={a.percent}
        data-testid="pick-activity-bar"
        sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
      />
      {!done ? (
        <Stack direction="row" data-testid="pick-activity-more" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, mt: 0.5, flexWrap: "wrap" }}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>{moreNeededLine(need, calendarCount)}</Typography>
          {props.onAddDay !== undefined ? (
            <Button
              size="small"
              variant="outlined"
              data-testid="pick-add-day"
              disabled={props.confirming || adding || (props.addingDay ?? null) !== null}
              onClick={() => props.onAddDay?.(a.activityId)}
              sx={{ minHeight: touch ? 44 : 32, px: 1.25, textTransform: "none", fontWeight: 700 }}
            >
              {adding ? "Hledám den…" : "Přidat další den"}
            </Button>
          ) : null}
        </Stack>
      ) : null}
      {a.spareSeats > 0 ? (
        <Typography variant="caption" data-testid="pick-activity-spare" sx={{ display: "block", mt: 0.25, color: "warning.main", fontWeight: 600 }}>
          {spareLine(a, price)}
        </Typography>
      ) : null}
    </Box>
  );
}

/** The toggle chips of ONE picked window: each činnost of the order (all on by default), "Vše" puts everything back. */
function ActivityChips({ pick, activities, touch, onToggle, onAll, disabled }: {
  pick: PickedTime;
  activities: readonly RoutedActivity[];
  touch: boolean;
  onToggle: (pickId: string, activityId: string) => void;
  onAll: (pickId: string) => void;
  disabled: boolean;
}) {
  const all = activities.map((a) => a.activityId);
  const allowed = normalizeAllowed(pick.activityIds, all);
  const height = touch ? 40 : 30;
  return (
    <Box data-testid="pick-chips" data-restricted={allowed === null ? "false" : "true"} sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, pb: 0.75, pr: 1 }}>
      <Chip
        label="Vše"
        size="small"
        clickable
        disabled={disabled}
        data-testid="pick-chip-all"
        aria-pressed={allowed === null}
        aria-label={`${pickedLabel(pick)}: povolit všechny činnosti`}
        color={allowed === null ? "primary" : "default"}
        variant={allowed === null ? "filled" : "outlined"}
        onClick={() => onAll(pick.id)}
        sx={{ height, borderRadius: 4, fontWeight: 700 }}
      />
      {activities.map((a) => {
        const on = allowed === null || allowed.includes(a.activityId);
        return (
          <Chip
            key={a.activityId}
            label={firstWord(a.name)}
            title={a.name}
            size="small"
            clickable
            disabled={disabled}
            data-testid="pick-chip"
            data-on={on ? "true" : "false"}
            aria-pressed={on}
            aria-label={`${pickedLabel(pick)}: ${a.name}`}
            color={on ? "primary" : "default"}
            variant={on ? "filled" : "outlined"}
            onClick={() => onToggle(pick.id, a.activityId)}
            sx={{ height, borderRadius: 4, maxWidth: "100%", opacity: on ? 1 : 0.7, "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" } }}
          />
        );
      })}
    </Box>
  );
}

/** "Navíc 4 h 30 min / 9 slotů": what is picked beyond the need. Information only - nothing marked by hand is ever trimmed. */
export const surplusLine = (coverage: PickCoverage): string => {
  const lengths = coverage.perActivity.filter((x) => x.seats > 0 && x.minutesPerSeat > 0).map((x) => x.minutesPerSeat);
  const shortest = lengths.length > 0 ? Math.min(...lengths) : 0;
  const slots = shortest > 0 ? Math.floor(coverage.surplusMinutes / shortest) : 0;
  return slots > 0
    ? `Navíc ${formatMinutes(coverage.surplusMinutes)} / ${slots} ${slotsWord(slots)}`
    : `Navíc ${formatMinutes(coverage.surplusMinutes)}`;
};

/** What one picked window holds, in a line: "Komplexní 08:00–11:20 · 20 hráčů · Spiroergometrie 11:20–14:00 · 3 hráči". */
export const windowPlanLine = (report: WindowReport): string =>
  report.parts.map((p) => `${firstWord(p.name)} ${clock(p.range.start)}–${clock(p.range.end)} · ${players(p.seats)}`).join(" · ");

/** The note under a picked window: spare whole, spare places, or an unused rest; null when it is used whole. */
export function windowNote(report: WindowReport): { text: string; kind: "idle" | "spare" | "unused" } | null {
  if (report.coveredAlready) {
    const who = report.names.length === 1 ? `${report.names[0]} je už pokrytá` : "Všechny činnosti jsou už pokryté";
    const spare = report.spare !== null ? ` · ${report.spare.seats} volných míst` : "";
    return { text: `Termín navíc – ${who} – zbývá ${formatFree(report.unusedMinutes)} volných${spare}`, kind: "idle" };
  }
  if (report.spare !== null) {
    return { text: `+${places(report.spare.seats)} navíc (${firstWord(report.spare.name)}) · ${formatFree(report.spare.minutes)} volných`, kind: "spare" };
  }
  if (report.unusedMinutes > 0) return { text: `${report.unusedMinutes} min nevyužito`, kind: "unused" };
  return null;
}

/** The small link under a note ("Vzít celý den"); nothing when the note has no action. */
function NoteActionButton({ action, touch }: { action?: { label: string; onClick: () => void } | null; touch: boolean }) {
  if (action === null || action === undefined) return null;
  return (
    <Button
      size="small"
      data-testid="pick-note-action"
      onClick={action.onClick}
      sx={{ display: "inline-flex", ml: 0.5, minHeight: touch ? 36 : 24, minWidth: 0, px: 0.75, py: 0, textTransform: "none", fontWeight: 700, textDecoration: "underline", verticalAlign: "baseline" }}
    >
      {action.label}
    </Button>
  );
}

/** The big line ("Vybráno X z Y hráčů", or "Hotovo ✓"), the remaining per činnost and the money of spare places. */
function Remaining({ coverage, compact, prices }: { coverage: PickCoverage; compact?: boolean; prices?: ReadonlyMap<string, number | null> | null }) {
  const spare = coverage.perActivity.filter((a) => a.spareSeats > 0);
  if (coverage.covered) {
    return (
      <Box data-testid="pick-summary">
        <Typography data-testid="pick-covered" sx={{ fontSize: compact ? 17 : 22, fontWeight: 800, color: "success.main", lineHeight: 1.2 }}>
          Hotovo ✓ — všichni hráči mají termín
          {coverage.surplusMinutes > 0 ? (
            <Typography component="span" sx={{ display: "block", fontSize: 13, fontWeight: 500, color: "text.secondary" }}>
              {surplusLine(coverage)}
            </Typography>
          ) : null}
        </Typography>
        {spare.map((a) => (
          <Typography key={a.activityId} data-testid="pick-spare-warning" variant="caption" sx={{ display: "block", mt: 0.25, color: "warning.main", fontWeight: 600 }}>
            {spareLine(a, prices?.get(a.activityId) ?? null)}
          </Typography>
        ))}
      </Box>
    );
  }
  return (
    <Box data-testid="pick-summary">
      {coverage.additional === true ? (
        <Typography data-testid="pick-additional" variant="caption" sx={{ display: "block", color: "text.secondary", fontWeight: 600 }}>
          Navíc k původní objednávce
        </Typography>
      ) : null}
      <Typography data-testid="pick-slots" sx={{ fontSize: compact ? 20 : 30, fontWeight: 800, lineHeight: 1.1 }}>
        {`Vybráno ${coverage.coveredSeats} z ${players(coverage.totalSeats)}`}
      </Typography>
      <Typography data-testid="pick-remaining" variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
        {coverage.totalSeats === 0 ? "Nejsou zadaní žádní hráči." : `Zbývá: ${remainingLine(coverage)}`}
      </Typography>
      {coverage.totalSeats > 0 ? (
        <Typography data-testid="pick-shortfall" variant="caption" sx={{ display: "block", color: "warning.main", fontWeight: 700 }}>
          {`Chybí termíny pro ${players(coverage.remainingSeats)}`}
        </Typography>
      ) : null}
      {spare.map((a) => (
        <Typography key={a.activityId} data-testid="pick-spare-warning" variant="caption" sx={{ display: "block", mt: 0.25, color: "warning.main", fontWeight: 600 }}>
          {spareLine(a, prices?.get(a.activityId) ?? null)}
        </Typography>
      ))}
    </Box>
  );
}

function Details(props: PickOrderPanelProps) {
  const { coverage, picks } = props;
  const sorted = [...picks].sort((a, b) => a.dayKey.localeCompare(b.dayKey) || a.range.start - b.range.start);
  const busy = props.confirming;
  const routable = props.activities ?? [];
  const touch = props.device !== "desktop";
  /* A činnost with players that no picked window allows (only once something is picked). */
  const noWindow = picks.length > 0 ? coverage.perActivity.filter((a) => a.noWindow) : [];
  const reportOf = (id: string) => coverage.windows.find((w) => w.id === id);

  /* "Doplnit termíny": the short činnost comes into view with its "Přidat další den". */
  const focus = props.focusActivityId ?? null;
  const onFocused = props.onFocused;
  useEffect(() => {
    if (focus === null) return;
    const node = document.querySelector<HTMLElement>(`[data-activity-row="${focus}"]`);
    if (node !== null && typeof node.scrollIntoView === "function") node.scrollIntoView({ block: "center", behavior: "smooth" });
    onFocused?.();
  }, [focus, onFocused]);

  return (
    <Stack spacing={1.75}>
      <Box>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{props.clubName}</Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>{props.serviceName}</Typography>
      </Box>

      <Stack spacing={1} data-testid="pick-needs">
        {coverage.perActivity.map((a) => <ActivityRow key={a.activityId} a={a} props={props} />)}
        <Typography variant="caption" data-testid="pick-minutes" sx={{ color: "text.secondary" }}>
          {`${coverage.additional === true ? "Navíc vybráno" : "Vybráno"} ${formatMinutes(coverage.pickedMinutes)} z ${formatMinutes(coverage.neededMinutes)}`}
          {coverage.unusedMinutes > 0 ? ` · nevyužito ${formatMinutes(coverage.unusedMinutes)}` : ""}
        </Typography>
      </Stack>

      {props.requested.length > 0 ? (
        <Alert severity="info" data-testid="pick-requested" sx={{ py: 0.25 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>Klub žádá:</Typography>
          {props.requested.map((line) => <Typography key={line} variant="body2">{line}</Typography>)}
        </Alert>
      ) : null}

      {noWindow.length > 0 ? (
        <Stack spacing={0.5} data-testid="pick-no-window">
          {noWindow.map((a) => (
            <Alert key={a.activityId} severity="warning" sx={{ py: 0.25 }}>{`Pro ${a.name} zatím není žádný termín`}</Alert>
          ))}
        </Stack>
      ) : null}

      {props.note !== null ? (
        <Alert severity="info" data-testid="pick-note" sx={{ py: 0.25 }}>
          {props.note}
          <NoteActionButton action={props.noteAction} touch={touch} />
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
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Zatím nic. {props.device === "desktop" ? "Stiskněte v kalendáři a tažením označte čas." : "Klepněte v kalendáři na začátek a potom na konec."}
          </Typography>
        ) : (
          <Stack spacing={0.5} sx={{ maxHeight: 220, overflowY: "auto" }} data-testid="pick-list">
            {sorted.map((p) => {
              const report = reportOf(p.id);
              const note = report === undefined ? null : windowNote(report);
              const plan = report !== undefined && (report.activityIds === null || report.activityIds.length > 1) && report.parts.length > 0 ? windowPlanLine(report) : null;
              return (
                <Box
                  key={p.id}
                  data-testid="pick-row"
                  data-activities={allowedKey(normalizeAllowed(p.activityIds, routable.map((a) => a.activityId)))}
                  sx={{ pl: 1.25, borderRadius: 2, bgcolor: "action.hover" }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontVariantNumeric: "tabular-nums" }}>
                      {`${pickedLabel(p)} · ${p.range.end - p.range.start} min`}
                      <Typography component="span" variant="caption" sx={{ color: "text.secondary", ml: 0.75 }}>{props.calendarName(p.calendarId)}</Typography>
                    </Typography>
                    {routable.length > 1 && props.onSplitPick !== undefined ? (
                      <Button
                        size="small"
                        data-testid="pick-split"
                        aria-label={`Rozdělit termín ${pickedLabel(p)}`}
                        onClick={() => props.onSplitPick?.(p.id)}
                        disabled={busy}
                        sx={{ minHeight: touch ? 44 : 32, minWidth: 0, px: 1, textTransform: "none", fontWeight: 700 }}
                      >
                        Rozdělit
                      </Button>
                    ) : null}
                    <IconButton size="small" aria-label={`Odebrat termín ${pickedLabel(p)}`} onClick={() => props.onRemovePick(p.id)} disabled={busy} sx={{ width: touch ? 44 : 36, height: touch ? 44 : 36 }}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  {plan !== null ? (
                    <Typography variant="caption" data-testid="pick-row-plan" sx={{ display: "block", color: "text.secondary", pr: 1 }}>{plan}</Typography>
                  ) : null}
                  {note !== null ? (
                    <Typography
                      variant="caption"
                      data-testid={`pick-row-${note.kind}`}
                      sx={{ display: "block", pr: 1, pb: 0.5, fontWeight: 600, color: note.kind === "unused" ? "text.secondary" : "warning.main" }}
                    >
                      {note.text}
                    </Typography>
                  ) : null}
                  {routable.length > 1 && props.onToggleActivity !== undefined && props.onAllActivities !== undefined ? (
                    <ActivityChips pick={p} activities={routable} touch={touch} onToggle={props.onToggleActivity} onAll={props.onAllActivities} disabled={busy} />
                  ) : null}
                </Box>
              );
            })}
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
          {props.athletesRemovedFromWindow === true ? (
            <Box component="div" data-testid="pick-removed-from-window" sx={{ mt: 0.5 }}>
              {`Činnost už v termínu nebude povolena. Rezervace by se zrušily: ${(props.athleteNames ?? []).join(", ")}`}
            </Box>
          ) : null}
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

/** "Potvrdit objednávku · chybí 20 hráčů" / "Potvrdit · 4 místa navíc" - the button says what the confirm will ask. */
export function confirmLabel(props: Pick<PickOrderPanelProps, "coverage" | "confirming" | "editing">): string {
  const { coverage } = props;
  if (props.confirming) return props.editing ? "Ukládám…" : "Potvrzuji…";
  const base = props.editing ? "Uložit změny" : "Potvrdit objednávku";
  if (coverage.totalSeats > 0 && coverage.remainingSeats > 0) return `${base} · chybí ${players(coverage.remainingSeats)}`;
  if (coverage.spareSeats > 0) return `${props.editing ? "Uložit" : "Potvrdit"} · ${places(coverage.spareSeats)} navíc`;
  return base;
}

function ConfirmRow(props: PickOrderPanelProps) {
  const { picks, coverage } = props;
  const full = coverage.covered && props.onExtraPick !== undefined;
  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" onClick={props.onCancel} disabled={props.confirming} sx={{ minHeight: 44 }}>Zrušit</Button>
        <Button variant="contained" fullWidth data-testid="pick-confirm" disabled={picks.length === 0 || props.confirming} onClick={props.onConfirm} sx={{ minHeight: 44 }}>
          {confirmLabel(props)}
        </Button>
      </Stack>
      {full ? (
        <Button
          variant="outlined"
          color="inherit"
          data-testid="pick-extra"
          disabled={props.confirming || props.extraArmed === true}
          onClick={props.onExtraPick}
          sx={{ minHeight: 44, textTransform: "none", fontWeight: 700, color: "text.secondary" }}
        >
          {props.extraArmed === true ? "Označte termín navíc v kalendáři…" : "Přidat termín navíc"}
        </Button>
      ) : null}
    </Stack>
  );
}

export function PickOrderPanel(props: PickOrderPanelProps) {
  const [open, setOpen] = useState(false);
  const { coverage } = props;
  const focus = props.focusActivityId ?? null;
  /* "Doplnit termíny" on a touch layout opens the details so the row can be seen. */
  useEffect(() => {
    if (focus !== null) setOpen(true);
  }, [focus]);

  if (props.device === "desktop") {
    return (
      <Paper
        component="aside"
        elevation={0}
        aria-label="Výběr termínů"
        data-testid="pick-panel"
        data-layout="side"
        data-full={coverage.covered ? "true" : "false"}
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
          <Remaining coverage={coverage} prices={props.prices} />
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
      data-full={coverage.covered ? "true" : "false"}
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
            <Remaining coverage={coverage} compact prices={props.prices} />
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
        ) : (
          <>
            {props.picks.length > 0 && coverage.perActivity.some((a) => a.noWindow) ? (
              <Typography variant="caption" data-testid="pick-no-window-inline" sx={{ color: "warning.main", fontWeight: 600 }}>
                {coverage.perActivity.filter((a) => a.noWindow).map((a) => `Pro ${a.name} zatím není žádný termín`).join(" · ")}
              </Typography>
            ) : null}
            {props.note !== null ? (
              <Typography variant="caption" data-testid="pick-note-inline" sx={{ color: "text.secondary" }}>
                {props.note}
                <NoteActionButton action={props.noteAction} touch />
              </Typography>
            ) : null}
          </>
        )}
        <ConfirmRow {...props} />
      </Stack>
    </Paper>
  );
}
