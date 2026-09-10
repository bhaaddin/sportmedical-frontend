import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { calendarsApi } from "../../api/calendars";
import { appointmentsApi } from "../../api/appointments";
import { AsyncSection } from "../../components/booking/AsyncSection";
import { errorText } from "../../components/booking/errorText";
import {
  addDaysToDateOnly,
  formatDateOnly,
  formatPragueTime,
  pragueWallClockToInstant,
  toDateOnly,
} from "../../utils/time";

/**
 * Blocked time - contract screen for §2.2 "Zablokovat čas bez pacienta":
 * servicing a device, a meeting, training. Time that is not for sale and has
 * no patient attached.
 *
 * The API had all three calls (`blocks`, `createBlock`, `deleteBlock`) and no
 * screen ever called any of them - a grep for them across every `.tsx` came
 * back empty. This is that screen.
 *
 * 3.3 on both edges: the operator picks a Prague date and a Prague wall-clock
 * time, `pragueWallClockToInstant` turns that into the right instant on the
 * two clock-change days as well, and what comes back is shown in Prague again.
 * Nothing here does date arithmetic in UTC.
 *
 * That helper exists because the first version of this screen got it wrong.
 * It added `hours * 3600000` to the start of the Prague day, which is only the
 * same thing on the 363 days that have 24 wall-clock hours. Blocking 13:00 on
 * 25. 10. 2026 stored 11:00Z and came back as 12:00 - an hour before what was
 * typed, on the one day nobody would think to check.
 *
 * Measured against the running API before this was written, because the client
 * existing does not mean the endpoint works:
 *
 *     POST   …/blocks  -> 201 and the block appears in the list
 *     DELETE …/blocks/{id} -> 200 and it leaves
 *     POST   …/appointments into a blocked time -> 409
 *
 * And one thing that does not hold, which is why the warning below is on the
 * screen rather than in a comment: `GET …/availability` still offers a time a
 * block covers. Booking refuses it at 409, so nobody is double-booked - but
 * the picker will show a slot that then fails. Reported to the booking lane;
 * this screen says so out loud instead of letting a receptionist find out from
 * a patient on the phone. Filtering blocks out client-side would be a second
 * availability calculation, which 6.1 forbids.
 */

const CODEBOOK_STALE_MS = 5 * 60 * 1000;

interface Draft {
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
}

function emptyDraft(today: string): Draft {
  return { date: today, startTime: "08:00", endTime: "09:00", reason: "" };
}

export default function BlockedTimePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const today = toDateOnly(new Date());

  const [calendarId, setCalendarId] = useState<string>("");
  const [draft, setDraft] = useState<Draft | null>(null);

  const calendarsQuery = useQuery({
    queryKey: ["calendars"],
    queryFn: calendarsApi.list,
    staleTime: CODEBOOK_STALE_MS,
  });

  const calendars = calendarsQuery.data ?? [];
  const activeCalendarId = calendarId || calendars[0]?.id || "";

  /** The endpoint needs a range; this is the window the list covers. */
  const windowFrom = addDaysToDateOnly(today, -30);
  const windowTo = addDaysToDateOnly(today, 180);

  const blocksQuery = useQuery({
    queryKey: ["blocks", activeCalendarId, windowFrom, windowTo],
    queryFn: () =>
      appointmentsApi.blocks(activeCalendarId, windowFrom, windowTo),
    enabled: activeCalendarId !== "",
  });

  const blocks = useMemo(
    () =>
      [...(blocksQuery.data ?? [])].sort((a, b) =>
        a.startUtc.localeCompare(b.startUtc),
      ),
    [blocksQuery.data],
  );

  const save = useMutation({
    mutationFn: (input: Draft) =>
      appointmentsApi.createBlock(
        activeCalendarId,
        pragueWallClockToInstant(input.date, input.startTime),
        pragueWallClockToInstant(input.date, input.endTime),
        input.reason.trim(),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["blocks", activeCalendarId],
      });
      setDraft(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      appointmentsApi.deleteBlock(activeCalendarId, id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["blocks", activeCalendarId] }),
  });

  const openCreate = () => {
    setDraft(emptyDraft(today));
    save.reset();
  };

  /*
   * The end has to be after the start, and the reason is required: a blocked
   * hour with no reason is indistinguishable from a mistake three weeks later,
   * and somebody has to decide whether to clear it.
   */
  const draftProblem = (d: Draft): string | null => {
    if (d.endTime <= d.startTime) return t("booking.blocks.endBeforeStart");
    if (d.reason.trim() === "") return t("booking.blocks.reasonRequired");
    return null;
  };

  const problem = draft ? draftProblem(draft) : null;

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {t("booking.blocks.title")}
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            {t("booking.blocks.subtitle")}{" "}
            {t("booking.blocks.window", {
              from: formatDateOnly(windowFrom),
              to: formatDateOnly(windowTo),
            })}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={activeCalendarId === ""}
        >
          {t("booking.blocks.new")}
        </Button>
      </Box>

      {/*
        Said on the screen, not only in the code: today a block stops the
        booking (409) but does not remove the time from the offered slots.
        Whoever uses this should know before a patient tells them.
      */}
      <Alert severity="info" sx={{ mb: 3 }}>
        {t("booking.blocks.availabilityCaveat")}
      </Alert>

      <AsyncSection
        isLoading={calendarsQuery.isLoading}
        isSettled={calendarsQuery.isSuccess}
        error={calendarsQuery.error}
        isEmpty={calendars.length === 0}
        emptyText={t("booking.workingHours.noCalendars")}
        onRetry={() => void calendarsQuery.refetch()}
        skeletonRows={2}
      >
        <TextField
          select
          label={t("booking.workingHours.calendar")}
          value={activeCalendarId}
          onChange={(e) => setCalendarId(e.target.value)}
          sx={{ minWidth: 260, mb: 3 }}
        >
          {calendars.map((calendar) => (
            <MenuItem key={calendar.id} value={calendar.id}>
              {calendar.name}
            </MenuItem>
          ))}
        </TextField>

        {remove.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorText(remove.error, t)}
          </Alert>
        )}

        <AsyncSection
          isLoading={blocksQuery.isLoading}
          isSettled={blocksQuery.isSuccess}
          error={blocksQuery.error}
          isEmpty={blocks.length === 0}
          emptyText={t("booking.blocks.empty")}
          emptyAction={{ label: t("booking.blocks.new"), onClick: openCreate }}
          onRetry={() => void blocksQuery.refetch()}
        >
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("booking.blocks.date")}</TableCell>
                  <TableCell>{t("booking.blocks.time")}</TableCell>
                  <TableCell>{t("booking.blocks.reason")}</TableCell>
                  <TableCell align="right">
                    {t("booking.common.actions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {blocks.map((block) => (
                  <TableRow key={block.id} hover>
                    <TableCell>
                      {formatDateOnly(toDateOnly(new Date(block.startUtc)))}
                    </TableCell>
                    <TableCell>
                      {formatPragueTime(block.startUtc)}–
                      {formatPragueTime(block.endUtc)}
                    </TableCell>
                    {/* The reason is required on the way in, so this is never blank. */}
                    <TableCell>{block.reason}</TableCell>
                    <TableCell align="right">
                      <Tooltip title={t("booking.blocks.release")}>
                        <IconButton
                          aria-label={t("booking.blocks.release")}
                          onClick={() => remove.mutate(block.id)}
                          disabled={remove.isPending}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </AsyncSection>
      </AsyncSection>

      <Dialog
        open={draft !== null}
        onClose={() => setDraft(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t("booking.blocks.newTitle")}</DialogTitle>
        <DialogContent>
          {draft && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                type="date"
                label={t("booking.blocks.date")}
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  type="time"
                  label={t("booking.blocks.from")}
                  value={draft.startTime}
                  onChange={(e) =>
                    setDraft({ ...draft, startTime: e.target.value })
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  type="time"
                  label={t("booking.blocks.to")}
                  value={draft.endTime}
                  onChange={(e) =>
                    setDraft({ ...draft, endTime: e.target.value })
                  }
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ flex: 1 }}
                />
              </Stack>
              <TextField
                label={t("booking.blocks.reason")}
                value={draft.reason}
                onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                placeholder={t("booking.blocks.reasonPlaceholder")}
                required
              />

              {problem && <Alert severity="warning">{problem}</Alert>}
              {save.isError && (
                <Alert severity="error">{errorText(save.error, t)}</Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDraft(null)}>
            {t("booking.common.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={() => draft && save.mutate(draft)}
            disabled={draft === null || problem !== null || save.isPending}
          >
            {t("booking.blocks.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
