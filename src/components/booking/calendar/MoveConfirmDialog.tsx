import { useState } from "react";
import { Alert, Box, Button, Checkbox, FormControlLabel, Popover, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { appointmentsApi } from "../../../api/appointments";
import { DESIGN } from "../../../theme";
import { formatPragueDate, formatPragueTime } from "../../../utils/time";
import { errorText } from "../errorText";
import { GRID_TEXT } from "../grid/gridText";
import { emitMoveNotice, movedNoticeText, rememberNotify, rememberedNotify } from "../grid/moveDrag";
import type { GridMoveRequest } from "../grid/TimeGrid";

/*
 * A booking dropped on another time (Etapa 12, the owner's picture of 10. 10.
 * 2026): the card already sits in its new slot and this small popover hangs
 * off it with a caret - "Přesunutí rezervace", the question, the old → new
 * time in small print, "Upozornit klienta na změnu" (on by default, remembered
 * for the session) and two buttons side by side. Esc, a click outside and
 * "Zrušit" all cancel; the grid then glides the card back.
 *
 * Two ways of committing:
 *   - `onConfirm` given: the caller commits (the grid or the page), with
 *     `notifyPatient` read off the checkbox. A returned promise is awaited here
 *     (pending button, the server's sentence on refusal, the notice and
 *     `onClose` on success); a void return means the caller takes over.
 *   - absent: the old self-contained path - `appointmentsApi.reschedule`, the
 *     day range refetched, the toast emitted - so the page keeps working as it
 *     did before it was rewired.
 *
 * Without `anchorEl` (the page's older use) it opens at the centre of the
 * screen instead of beside a card.
 */

const WIDTH = 300;
const CARET = 10;

export function MoveConfirmDialog({
  move,
  anchorEl,
  onClose,
  onConfirm,
}: {
  move: GridMoveRequest;
  /** The moved card at its new slot; absent → centred. */
  anchorEl?: Element | null;
  /** Cancel: Esc, a click outside, "Zrušit". */
  onClose: () => void;
  onConfirm?: (move: GridMoveRequest) => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { appointment } = move;
  const [notify, setNotify] = useState<boolean>(() => move.notifyPatient ?? rememberedNotify());

  const request = (): GridMoveRequest => ({ ...move, notifyPatient: notify });

  const save = useMutation({
    mutationFn: async (handed: Promise<void> | null) => {
      if (handed !== null) {
        await handed;
        return;
      }
      await appointmentsApi.reschedule(move.calendarId, appointment.id, move.startUtc);
      await queryClient.invalidateQueries({ queryKey: ["day-range"] });
      await queryClient.invalidateQueries({ queryKey: ["blocks"] });
    },
    onSuccess: () => {
      emitMoveNotice({ text: movedNoticeText(notify), tone: "info" });
      onClose();
    },
  });

  const confirm = () => {
    rememberNotify(notify);
    if (onConfirm) {
      const result = onConfirm(request());
      /* A void return: the caller took over (the grid keeps the card and commits). */
      if (result === undefined) return;
      save.mutate(result);
      return;
    }
    save.mutate(null);
  };

  const who = appointment.patientName?.trim() || appointment.activityName;
  const sameDay = formatPragueDate(appointment.startUtc) === formatPragueDate(move.startUtc);
  const from = sameDay
    ? formatPragueTime(appointment.startUtc)
    : `${formatPragueDate(appointment.startUtc)} ${formatPragueTime(appointment.startUtc)}`;
  const to = sameDay
    ? `${formatPragueTime(move.startUtc)}–${formatPragueTime(move.endUtc)}`
    : `${formatPragueDate(move.startUtc)} ${formatPragueTime(move.startUtc)}–${formatPragueTime(move.endUtc)}`;

  /* Beside the card, on whichever side has the room; the caret points at the card. */
  const anchorRect = anchorEl?.getBoundingClientRect() ?? null;
  const viewport = typeof window !== "undefined" ? window.innerWidth : 1440;
  const side: "right" | "left" = anchorRect !== null && anchorRect.right + WIDTH + 24 > viewport ? "left" : "right";
  const anchored = anchorEl != null;

  return (
    <Popover
      open
      anchorEl={anchored ? anchorEl : undefined}
      anchorReference={anchored ? "anchorEl" : "anchorPosition"}
      anchorPosition={anchored ? undefined : { top: typeof window !== "undefined" ? window.innerHeight / 2 : 400, left: viewport / 2 }}
      anchorOrigin={anchored ? { vertical: "center", horizontal: side } : { vertical: "center", horizontal: "center" }}
      transformOrigin={
        anchored
          ? { vertical: "center", horizontal: side === "right" ? "left" : "right" }
          : { vertical: "center", horizontal: "center" }
      }
      marginThreshold={8}
      onClose={onClose}
      data-testid="move-confirm"
      slotProps={{
        paper: {
          role: "dialog",
          "aria-modal": true,
          "aria-labelledby": "move-title",
          sx: {
            width: WIDTH,
            maxWidth: "calc(100vw - 16px)",
            overflow: "visible",
            p: 2,
            ml: anchored && side === "right" ? `${CARET}px` : 0,
            mr: anchored && side === "left" ? `${CARET}px` : 0,
            borderRadius: "12px",
            boxShadow: DESIGN.shadow.menu,
            border: "1px solid",
            borderColor: "divider",
          },
        } as object,
      }}
    >
      {anchored ? (
        <Box
          aria-hidden
          data-testid="move-confirm-caret"
          sx={{
            position: "absolute",
            top: "50%",
            [side === "right" ? "left" : "right"]: -CARET / 2 - 1,
            width: CARET,
            height: CARET,
            transform: "translateY(-50%) rotate(45deg)",
            bgcolor: "background.paper",
            borderLeft: side === "right" ? "1px solid" : "none",
            borderBottom: side === "right" ? "1px solid" : "none",
            borderRight: side === "left" ? "1px solid" : "none",
            borderTop: side === "left" ? "1px solid" : "none",
            borderColor: "divider",
          }}
        />
      ) : null}
      <Typography id="move-title" component="h2" sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>
        {GRID_TEXT.moveTitle}
      </Typography>
      <Typography sx={{ mt: 1, fontSize: 14 }}>{GRID_TEXT.moveQuestion}</Typography>
      <Typography
        data-testid="move-confirm-times"
        sx={{ mt: 0.5, fontSize: 12, color: "text.secondary", fontVariantNumeric: "tabular-nums" }}
      >
        {who} · {from} → {to}
      </Typography>
      <FormControlLabel
        sx={{ mt: 1, ml: -0.75, "& .MuiFormControlLabel-label": { fontSize: 14 } }}
        control={
          <Checkbox
            checked={notify}
            onChange={(_event, checked) => setNotify(checked)}
            slotProps={{ input: { "aria-label": GRID_TEXT.moveNotify } as object }}
          />
        }
        label={GRID_TEXT.moveNotify}
      />
      {save.error ? (
        <Alert severity="error" sx={{ mt: 1 }}>
          {errorText(save.error, t)}
        </Alert>
      ) : null}
      <Box sx={{ mt: 1.5, display: "flex", gap: 1 }}>
        <Button
          variant="contained"
          disabled={save.isPending}
          onClick={confirm}
          sx={{ flex: 1, minHeight: 44 }}
        >
          {GRID_TEXT.moveConfirm}
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          disabled={save.isPending}
          onClick={onClose}
          sx={{ flex: 1, minHeight: 44, borderColor: alpha("#000", 0.25), color: "text.secondary" }}
        >
          {GRID_TEXT.moveCancel}
        </Button>
      </Box>
    </Popover>
  );
}
