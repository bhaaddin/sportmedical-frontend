import { useEffect, useMemo, useState } from "react";
import { Box, Checkbox, Divider, FormControlLabel, IconButton, Skeleton, Stack, TextField, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { Device } from "../../../layout/useDevice";
import type { CoverageActivity } from "../../clubs/order/coverage";
import { formatCzk } from "../../clubs/order/orderFormat";
import { firstWord, normalizeAllowed, toggleAllowed } from "../../clubs/order/routing";
import { formatMinutes as clock, type MinuteRange } from "../grid/timeRange";
import { pickedLabel } from "./multiSelect";
import { BubbleButton, BubbleButtons, PickBubble } from "./PickBubble";
import { formatFree } from "./pickDays";
import {
  canSplit,
  cutPart,
  mergeCut,
  midpointOf,
  moveCut,
  partsFromPlan,
  pickCoverage,
  stepFor,
  type AskPart,
  type PickCoverage,
  type PlanWindow,
  type WindowReport,
} from "./pickPlan";
import { players } from "./PickOrderPanel";
import type { AskResult, PickAsk } from "./usePickOrder";

/*
 * Etapa 12 (the owner, 10. 10. 2026): "When I pick a slot quickly, a small window must pop up for the činnost, and
 * I'll have EVERYTHING or one činnost." The moment a window is picked (a paint, a tap, the one-tap shortcut) this
 * bubble hangs off it and asks which činnosti it is for: "Vše" (preselected) or a tick per činnost - two of three is
 * allowed, "Vše" is the master. It opens AT ONCE with the time; the plan and the numbers come a frame later
 * ("Počítám…"), never after a query.
 *
 *   Rozdělit okno        the window is cut into parts, each with its own choice; a cut is a time field, "+ další
 *                        část" cuts again, the cross merges. A part is never shorter than one grid step.
 *   plan under "Vše"     one činnost after another in the order's order (the whole komplexní prohlídka for everybody,
 *                        then spiroergometrie); what does not fit is said ("Nevejde se: …"). "Rozdělit podle plánu"
 *                        turns it into parts for one činnost each - that is what the server enforces per window.
 *   Potvrdit / Enter     the parts become the window(s) in the pick (`activityIds` per part - exactly what the chips
 *                        in the panel edit). Zrušit / Esc removes a just-picked window again (keeps one being edited).
 *   click outside        keeps what is ticked (= Potvrdit): nothing picked is ever lost by a tap beside the bubble.
 */

export const PICK_ASK_TEXT = {
  title: "Činnosti termínu",
  question: "Pro které činnosti je tento termín?",
  all: "Vše",
  split: "Rozdělit okno",
  splitMore: "+ další část",
  splitByPlan: "Rozdělit podle plánu",
  cutAt: "Dělit v",
  removeCut: "Zrušit dělení",
  plan: "Pořadí při „Vše“",
  computing: "Počítám…",
  overflow: "Nevejde se",
  confirm: "Potvrdit",
  cancel: "Zrušit",
  cancelKeep: "Zpět",
} as const;

interface Group {
  id: string;
  calendarId: string;
  dayKey: string;
  range: MinuteRange;
  step: number;
  label: string;
  parts: AskPart[];
}

const partId = (groupId: string, index: number) => `${groupId}#${index}`;

function parseClock(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (m === null) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function PickActivityPopover({ ask, device, onConfirm, onCancel }: {
  ask: PickAsk;
  device: Device;
  onConfirm: (results: readonly AskResult[]) => void;
  onCancel: () => void;
}) {
  const all = useMemo(() => ask.activities.map((a) => a.activityId), [ask.activities]);
  const [groups, setGroups] = useState<Group[]>(() =>
    ask.windows.map((w) => {
      const step = stepFor(w.range, ask.stepOf(w.calendarId));
      return {
        id: w.id,
        calendarId: w.calendarId,
        dayKey: w.dayKey,
        range: w.range,
        step,
        label: pickedLabel(w),
        parts: [{ range: { ...w.range }, activityIds: normalizeAllowed(w.activityIds, all) }],
      };
    }),
  );

  /* The bubble is on screen first; the plan and the numbers follow in the next frame. */
  const [computed, setComputed] = useState<PickCoverage | null>(null);
  useEffect(() => {
    const windows: PlanWindow[] = [
      ...ask.others,
      ...groups.flatMap((g) => g.parts.map((p, k): PlanWindow => ({ id: partId(g.id, k), range: p.range, dayKey: g.dayKey, activityIds: normalizeAllowed(p.activityIds, all), step: g.step }))),
    ];
    const handle = window.setTimeout(() => setComputed(pickCoverage(ask.activities, windows, ask.baseline === undefined ? {} : { baseline: ask.baseline })), 0);
    return () => window.clearTimeout(handle);
  }, [groups, ask.others, ask.activities, ask.baseline, all]);

  /* Hangs off the picked bar (or the month cell it came from); centred when neither is on screen. */
  const [anchorEl, setAnchorEl] = useState<Element | null>(null);
  const first = ask.windows[0];
  useEffect(() => {
    if (first === undefined) return;
    const bar = document.querySelector(`[data-pick-id="${first.id}"]`);
    const cell = bar ?? document.querySelector(`[data-testid="pick-month-day-${first.dayKey}"]`);
    setAnchorEl(cell);
  }, [first]);

  const update = (groupId: string, parts: AskPart[]) => setGroups((gs) => gs.map((g) => (g.id === groupId ? { ...g, parts } : g)));
  const confirm = () => onConfirm(groups.map((g) => ({ id: g.id, parts: g.parts })));
  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter") return;
    const tag = (event.target as HTMLElement).tagName;
    if (tag === "INPUT" && (event.target as HTMLInputElement).type !== "checkbox") return;
    if (tag === "BUTTON" || tag === "TEXTAREA") return;
    event.preventDefault();
    confirm();
  };

  const reportOf = (groupId: string, k: number): WindowReport | undefined => computed?.windows.find((w) => w.id === partId(groupId, k));
  const seatsLeft = computed === null ? null : computed.perActivity.filter((a) => a.remainingSeats > 0);
  const several = groups.length > 1 || groups.some((g) => g.parts.length > 1);

  return (
    <PickBubble device={device} anchorEl={anchorEl} titleId="pick-ask-title" testId="pick-ask" onEscape={onCancel} onOutside={confirm} onKeyDown={onKeyDown}>
      <Typography id="pick-ask-title" component="h2" sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>
        {PICK_ASK_TEXT.title}
      </Typography>
      <Typography sx={{ mt: 0.5, fontSize: 14 }}>{PICK_ASK_TEXT.question}</Typography>

      <Box sx={{ mt: 1, overflowY: "auto", flex: 1, minHeight: 0, pr: 0.5, mr: -0.5 }}>
        <Stack spacing={1.5} divider={groups.length > 1 ? <Divider /> : undefined}>
          {groups.map((g) => (
            <Box key={g.id} data-testid="pick-ask-window">
              <Typography data-testid="pick-ask-time" sx={{ fontSize: 13, fontWeight: 700, color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
                {g.label}
                {ask.windows.length > 1 && ask.windows.some((w) => w.calendarId !== g.calendarId) ? ` · ${ask.calendarName(g.calendarId)}` : ""}
              </Typography>
              {g.parts.map((part, k) => {
                const allowed = normalizeAllowed(part.activityIds, all);
                const report = reportOf(g.id, k);
                const planned = allowed === null || allowed.length > 1;
                const splitByPlan = report !== undefined && report.parts.length > 0 && (report.parts.length > 1 || report.unusedMinutes > 0);
                const overflow = seatsLeft === null ? [] : seatsLeft.filter((a) => allowed === null || allowed.includes(a.activityId));
                return (
                  <Box key={k} data-testid="pick-ask-part" data-range={`${part.range.start}-${part.range.end}`}>
                    {k > 0 ? (
                      <Stack direction="row" data-testid="pick-ask-cut" sx={{ alignItems: "center", gap: 1, mt: 1, mb: 0.5 }}>
                        <TextField
                          type="time"
                          size="small"
                          label={PICK_ASK_TEXT.cutAt}
                          value={clock(part.range.start)}
                          onChange={(event) => {
                            const minute = parseClock(event.target.value);
                            if (minute !== null) update(g.id, moveCut(g.parts, k - 1, minute, g.step));
                          }}
                          slotProps={{ htmlInput: { step: g.step * 60, "aria-label": `${PICK_ASK_TEXT.cutAt} (část ${k + 1})`, "data-testid": "pick-ask-cut-time" }, inputLabel: { shrink: true } }}
                          sx={{ width: 140 }}
                        />
                        <IconButton aria-label={`${PICK_ASK_TEXT.removeCut} ${clock(part.range.start)}`} data-testid="pick-ask-merge" onClick={() => update(g.id, mergeCut(g.parts, k - 1))} sx={{ width: 44, height: 44 }}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    ) : null}
                    {g.parts.length > 1 ? (
                      <Typography data-testid="pick-ask-part-time" sx={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", mt: k > 0 ? 0 : 0.75 }}>
                        {`${clock(part.range.start)}–${clock(part.range.end)} · ${part.range.end - part.range.start} min`}
                      </Typography>
                    ) : null}
                    <Stack data-testid="pick-ask-list" sx={{ ml: -0.75 }}>
                      <FormControlLabel
                        sx={{ "& .MuiFormControlLabel-label": { fontSize: 14, fontWeight: 700 } }}
                        control={
                          <Checkbox
                            checked={allowed === null}
                            indeterminate={allowed !== null}
                            onChange={() => update(g.id, g.parts.map((p, i) => (i === k ? { ...p, activityIds: null } : p)))}
                            slotProps={{ input: { "data-testid": "pick-ask-all" } as object }}
                          />
                        }
                        label={PICK_ASK_TEXT.all}
                      />
                      {ask.activities.map((a: CoverageActivity) => {
                        const on = allowed === null || allowed.includes(a.activityId);
                        const price = ask.prices === null ? undefined : (ask.prices.get(a.activityId) ?? null);
                        return (
                          <FormControlLabel
                            key={a.activityId}
                            sx={{ alignItems: "flex-start", "& .MuiFormControlLabel-label": { fontSize: 14, pt: "9px" } }}
                            control={
                              <Checkbox
                                checked={on}
                                onChange={() => update(g.id, g.parts.map((p, i) => (i === k ? { ...p, activityIds: toggleAllowed(p.activityIds, a.activityId, all) } : p)))}
                                slotProps={{ input: { "data-testid": "pick-ask-activity", "data-activity-id": a.activityId, "data-on": on ? "true" : "false" } as object }}
                              />
                            }
                            label={
                              <Box component="span" sx={{ display: "block" }}>
                                {a.name}
                                <Typography component="span" sx={{ display: "block", fontSize: 12, color: "text.secondary" }}>
                                  {players(a.seats)}
                                  {price === undefined ? <> · <Skeleton component="span" variant="text" width={48} sx={{ display: "inline-block", verticalAlign: "middle" }} /></> : price === null ? "" : ` · ${formatCzk(price)}`}
                                </Typography>
                              </Box>
                            }
                          />
                        );
                      })}
                    </Stack>

                    {planned ? (
                      <Box data-testid="pick-ask-plan" sx={{ mt: 0.5, p: 1, borderRadius: 2, bgcolor: "action.hover" }}>
                        <Typography variant="caption" sx={{ display: "block", fontWeight: 700, color: "text.secondary" }}>{PICK_ASK_TEXT.plan}</Typography>
                        {report === undefined ? (
                          <Box data-testid="pick-ask-computing">
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>{PICK_ASK_TEXT.computing}</Typography>
                            <Skeleton variant="text" width="80%" />
                            <Skeleton variant="text" width="60%" />
                          </Box>
                        ) : (
                          <>
                            {report.parts.length === 0 ? (
                              <Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>Všichni hráči těchto činností už mají termín jinde.</Typography>
                            ) : (
                              report.parts.map((p) => (
                                <Typography key={p.activityId + p.range.start} data-testid="pick-ask-plan-row" variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
                                  {`${p.name} ${clock(p.range.start)}–${clock(p.range.end)} · ${players(p.seats)}`}
                                </Typography>
                              ))
                            )}
                            {report.unusedMinutes > 0 ? (
                              <Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>{`${formatFree(report.unusedMinutes)} nevyužito`}</Typography>
                            ) : null}
                            {overflow.length > 0 ? (
                              <Typography data-testid="pick-ask-overflow" variant="caption" sx={{ display: "block", color: "warning.main", fontWeight: 600 }}>
                                {`${PICK_ASK_TEXT.overflow}: ${overflow.map((a) => `${firstWord(a.name)} ${players(a.remainingSeats)}`).join(", ")}`}
                              </Typography>
                            ) : null}
                            {splitByPlan ? (
                              <BubbleButton testId="pick-ask-plan-split" onClick={() => update(g.id, [...g.parts.slice(0, k), ...partsFromPlan(part, report.parts), ...g.parts.slice(k + 1)])}>
                                {PICK_ASK_TEXT.splitByPlan}
                              </BubbleButton>
                            ) : null}
                          </>
                        )}
                      </Box>
                    ) : null}
                  </Box>
                );
              })}
              {(() => {
                const last = g.parts.length - 1;
                const lastPart = g.parts[last];
                if (lastPart === undefined || !canSplit(lastPart.range, g.step)) return null;
                return (
                  <BubbleButton testId="pick-ask-split" onClick={() => update(g.id, cutPart(g.parts, last, midpointOf(lastPart.range, g.step), g.step))}>
                    {g.parts.length === 1 ? PICK_ASK_TEXT.split : PICK_ASK_TEXT.splitMore}
                  </BubbleButton>
                );
              })()}
            </Box>
          ))}
        </Stack>
      </Box>

      <Typography data-testid="pick-ask-left" sx={{ mt: 1.5, fontSize: 13, fontWeight: 700, color: computed?.covered === true ? "success.main" : "text.secondary" }}>
        {computed === null ? (
          <>
            {PICK_ASK_TEXT.computing} <Skeleton component="span" variant="text" width={120} sx={{ display: "inline-block", verticalAlign: "middle" }} />
          </>
        ) : computed.covered ? (
          "Hotovo – všichni hráči mají termín"
        ) : (
          `Zbývá ${players(computed.remainingSeats)}${several ? "" : ""} · ${computed.perActivity.filter((a) => a.remainingSeats > 0).map((a) => `${firstWord(a.name)} ${a.remainingSeats}`).join(", ")}`
        )}
      </Typography>

      <BubbleButtons>
        <BubbleButton primary testId="pick-ask-confirm" onClick={confirm}>{PICK_ASK_TEXT.confirm}</BubbleButton>
        <BubbleButton testId="pick-ask-cancel" onClick={onCancel}>{ask.mode === "edit" ? PICK_ASK_TEXT.cancelKeep : PICK_ASK_TEXT.cancel}</BubbleButton>
      </BubbleButtons>
    </PickBubble>
  );
}

export default PickActivityPopover;
