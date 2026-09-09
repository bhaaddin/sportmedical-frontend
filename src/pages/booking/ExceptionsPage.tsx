import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
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
import { workingHoursApi } from "../../api/workingHours";
import type { ScheduleExceptionInput } from "../../api/bookingContracts";
import { AsyncSection } from "../../components/booking/AsyncSection";
import { errorText } from "../../components/booking/errorText";
import { formatDateOnly, toDateOnly } from "../../utils/time";

/**
 * Exceptions - contract screen 5.5: closed, different hours, different worker.
 *
 * The date is a date-only value and stays one all the way to the API. Sending
 * it through UTC would move it a day (3.3).
 */

const CODEBOOK_STALE_MS = 5 * 60 * 1000;

type ExceptionKind = "closed" | "differentHours" | "differentWorker";

function draftFor(kind: ExceptionKind, date: string): ScheduleExceptionInput {
  return {
    date,
    isClosed: kind === "closed",
    startTime: kind === "differentHours" ? "08:00" : null,
    endTime: kind === "differentHours" ? "16:00" : null,
    workerUserId: null,
    reason: "",
  };
}

function kindOf(exception: {
  isClosed: boolean;
  workerUserId: string | null;
}): ExceptionKind {
  if (exception.isClosed) return "closed";
  return exception.workerUserId ? "differentWorker" : "differentHours";
}

export default function ExceptionsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const today = toDateOnly(new Date());

  const [calendarId, setCalendarId] = useState<string>("");
  const [kind, setKind] = useState<ExceptionKind>("closed");
  const [draft, setDraft] = useState<ScheduleExceptionInput | null>(null);

  const calendarsQuery = useQuery({
    queryKey: ["calendars"],
    queryFn: calendarsApi.list,
    staleTime: CODEBOOK_STALE_MS,
  });

  const calendars = calendarsQuery.data ?? [];
  const activeCalendarId = calendarId || calendars[0]?.id || "";

  const exceptionsQuery = useQuery({
    queryKey: ["exceptions", activeCalendarId],
    queryFn: () => workingHoursApi.listExceptions(activeCalendarId),
    enabled: activeCalendarId !== "",
  });

  const workersQuery = useQuery({
    queryKey: ["calendar-access", activeCalendarId],
    queryFn: () => calendarsApi.getAccess(activeCalendarId),
    enabled: activeCalendarId !== "",
    staleTime: CODEBOOK_STALE_MS,
  });

  const exceptions = useMemo(
    () =>
      [...(exceptionsQuery.data ?? [])].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    [exceptionsQuery.data],
  );

  const save = useMutation({
    mutationFn: (input: ScheduleExceptionInput) =>
      workingHoursApi.createException(activeCalendarId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["exceptions", activeCalendarId],
      });
      setDraft(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      workingHoursApi.deleteException(activeCalendarId, id),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["exceptions", activeCalendarId],
      }),
  });

  const openCreate = () => {
    setKind("closed");
    setDraft(draftFor("closed", today));
    save.reset();
  };

  const workers = (workersQuery.data ?? []).map((w) => ({
    id: w.userId,
    name: w.displayName,
  }));

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
            {t("booking.exceptions.title")}
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            {t("booking.exceptions.subtitle")}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={activeCalendarId === ""}
        >
          {t("booking.exceptions.new")}
        </Button>
      </Box>

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

        <AsyncSection
          isLoading={exceptionsQuery.isLoading}
          isSettled={exceptionsQuery.isSuccess}
          error={exceptionsQuery.error}
          isEmpty={exceptions.length === 0}
          emptyText={t("booking.exceptions.empty")}
          emptyAction={{
            label: t("booking.exceptions.new"),
            onClick: openCreate,
          }}
          onRetry={() => void exceptionsQuery.refetch()}
        >
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("booking.exceptions.date")}</TableCell>
                  <TableCell>{t("booking.exceptions.kindColumn")}</TableCell>
                  <TableCell>{t("booking.exceptions.detail")}</TableCell>
                  <TableCell>{t("booking.exceptions.reason")}</TableCell>
                  <TableCell align="right">
                    {t("booking.common.actions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {exceptions.map((exception) => (
                  <TableRow key={exception.id} hover>
                    <TableCell>{formatDateOnly(exception.date)}</TableCell>
                    <TableCell>
                      {/* Text, not colour: 7.1 forbids colour as the only carrier. */}
                      <Chip
                        size="small"
                        label={t(
                          `booking.exceptions.kind.${kindOf(exception)}`,
                        )}
                        color={exception.isClosed ? "error" : "default"}
                      />
                    </TableCell>
                    <TableCell>
                      {exception.isClosed
                        ? "-"
                        : [
                            exception.startTime && exception.endTime
                              ? `${exception.startTime.slice(0, 5)}–${exception.endTime.slice(0, 5)}`
                              : null,
                            workers.find((w) => w.id === exception.workerUserId)
                              ?.name ?? null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "-"}
                    </TableCell>
                    <TableCell>{exception.reason || "-"}</TableCell>
                    <TableCell align="right">
                      <Tooltip title={t("booking.common.delete")}>
                        <IconButton
                          aria-label={t("booking.common.delete")}
                          onClick={() => remove.mutate(exception.id)}
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

        {remove.error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorText(remove.error, t)}
          </Alert>
        ) : null}
      </AsyncSection>

      <Dialog
        open={draft !== null}
        onClose={() => setDraft(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t("booking.exceptions.newTitle")}</DialogTitle>
        <DialogContent>
          {draft ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                required
                fullWidth
                type="date"
                label={t("booking.exceptions.date")}
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                select
                fullWidth
                label={t("booking.exceptions.kindColumn")}
                value={kind}
                onChange={(e) => {
                  const next = e.target.value as ExceptionKind;
                  setKind(next);
                  setDraft(draftFor(next, draft.date));
                }}
              >
                <MenuItem value="closed">
                  {t("booking.exceptions.kind.closed")}
                </MenuItem>
                <MenuItem value="differentHours">
                  {t("booking.exceptions.kind.differentHours")}
                </MenuItem>
                <MenuItem value="differentWorker">
                  {t("booking.exceptions.kind.differentWorker")}
                </MenuItem>
              </TextField>

              {kind === "differentHours" ? (
                <Stack direction="row" spacing={1}>
                  <TextField
                    type="time"
                    fullWidth
                    label={t("booking.workingHours.from")}
                    value={draft.startTime ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, startTime: e.target.value || null })
                    }
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    type="time"
                    fullWidth
                    label={t("booking.workingHours.to")}
                    value={draft.endTime ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, endTime: e.target.value || null })
                    }
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Stack>
              ) : null}

              {kind === "differentWorker" ? (
                <TextField
                  select
                  fullWidth
                  label={t("booking.workingHours.worker")}
                  value={draft.workerUserId ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, workerUserId: e.target.value || null })
                  }
                >
                  {workers.map((worker) => (
                    <MenuItem key={worker.id} value={worker.id}>
                      {worker.name}
                    </MenuItem>
                  ))}
                </TextField>
              ) : null}

              <TextField
                fullWidth
                label={t("booking.exceptions.reason")}
                value={draft.reason}
                onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
              />

              {save.error ? (
                <Alert severity="error">{errorText(save.error, t)}</Alert>
              ) : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDraft(null)}>
            {t("booking.common.cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={
              save.isPending ||
              draft === null ||
              draft.date === "" ||
              (kind === "differentWorker" && !draft.workerUserId)
            }
            onClick={() => draft && save.mutate(draft)}
          >
            {t("booking.common.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
