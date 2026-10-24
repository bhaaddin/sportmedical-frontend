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
  Link,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { calendarsApi } from "../../api/calendars";
import { workingHoursApi } from "../../api/workingHours";
import type { ScheduleExceptionInput } from "../../api/bookingContracts";
import { EntityChip, Shelf, TARGET_SX } from "../../ui/shelf";
import { INLINE_LINK_SX, SettingsItemCard } from "./SettingsItemCard";
import { shelfState } from "./shelfState";
import { errorText } from "../../components/booking/errorText";
import { addDaysToDateOnly, formatDateOnly, pragueDateKey } from "../../utils/time";
import { SettingsScreen } from "../settings/SettingsFrame";
import { FIELD_LIMITS } from "../../api/fieldLimits";
import { EXCEPTION_PROBLEM_TEXT, exceptionProblem, type ExceptionKind } from "./exceptionForm";

/**
 * Exceptions - contract screen 5.5: closed, different hours, different worker.
 *
 * The date is a date-only value and stays one all the way to the API. Sending
 * it through UTC would move it a day (3.3).
 */

const CODEBOOK_STALE_MS = 5 * 60 * 1000;

/*
 * "onlineOff" is 4.2 v38 `isClosedToPublic` on its own: the desk books as
 * usual, the website does not offer the day. Before it the only way to keep
 * the web out of a day was to close it for everybody.
 */

function draftFor(kind: ExceptionKind, date: string): ScheduleExceptionInput {
  return {
    date,
    isClosed: kind === "closed",
    startTime: kind === "differentHours" ? "08:00" : null,
    endTime: kind === "differentHours" ? "16:00" : null,
    workerUserId: null,
    reason: "",
    isClosedToPublic: kind === "onlineOff",
  };
}

function kindOf(exception: {
  isClosed: boolean;
  startTime: string | null;
  workerUserId: string | null;
  isClosedToPublic: boolean;
}): ExceptionKind {
  if (exception.isClosed) return "closed";
  if (exception.workerUserId) return "differentWorker";
  if (exception.startTime) return "differentHours";
  return exception.isClosedToPublic ? "onlineOff" : "differentHours";
}

export default function ExceptionsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const today = pragueDateKey(new Date());

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

  /** The window the list covers; the endpoint requires a range. */
  const windowFrom = addDaysToDateOnly(today, -90);
  const windowTo = addDaysToDateOnly(today, 365);

  const exceptionsQuery = useQuery({
    queryKey: ["exceptions", activeCalendarId, windowFrom, windowTo],
    queryFn: () =>
      workingHoursApi.listExceptions(activeCalendarId, windowFrom, windowTo),
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

  /* Only the accounts ticked for this calendar can stand in on it. */
  const workers = (workersQuery.data ?? [])
    .filter((w) => w.hasAccess)
    .map((w) => ({
      id: w.userId,
      name: w.displayName,
    }));

  const problem = draft === null ? null : exceptionProblem(kind, draft);
  /* Shown only once a time is typed: an untouched form should not open in red. */
  const hoursProblem =
    problem === "hoursMissing" || problem === "hoursOrder" ? EXCEPTION_PROBLEM_TEXT[problem] : null;

  const kindLabel = (value: ExceptionKind) => t(`booking.exceptions.kind.${value}`);

  const calState = shelfState(calendarsQuery, t);
  const calReady = !calState.loading && calState.error === false;
  const listState = shelfState(exceptionsQuery, t);
  const listReady = !listState.loading && listState.error === false;
  const upcoming = exceptions.filter((e) => e.date >= today);
  const past = exceptions.filter((e) => e.date < today).reverse();

  const card = (exception: (typeof exceptions)[number]) => {
    const worker = exception.workerUserId ? workers.find((w) => w.id === exception.workerUserId) : undefined;
    const hours = exception.startTime && exception.endTime ? `${exception.startTime.slice(0, 5)}–${exception.endTime.slice(0, 5)}` : null;
    return (
      <SettingsItemCard
        key={exception.id}
        kind="exception"
        id={exception.id}
        title={formatDateOnly(exception.date)}
        dim={exception.date < today}
        status={
          <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 0.5 }}>
            {/* Text, not colour: 7.1 forbids colour as the only carrier. */}
            <Chip
              size="small"
              label={kindLabel(kindOf(exception))}
              color={exception.isClosed ? "error" : exception.isClosedToPublic ? "warning" : "default"}
            />
            {/* Different hours or a stand-in AND off the web: the second chip says so, because the first cannot. */}
            {exception.isClosedToPublic && !exception.isClosed && kindOf(exception) !== "onlineOff" ? (
              <Chip size="small" color="warning" variant="outlined" label={kindLabel("onlineOff")} />
            ) : null}
          </Box>
        }
        actions={
          <>
            <Box sx={{ flex: 1 }} />
            <Tooltip title={t("booking.common.delete")}>
              <IconButton aria-label={t("booking.common.delete")} onClick={() => remove.mutate(exception.id)} sx={TARGET_SX}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        }
      >
        {exception.isClosed ? null : (
          <>
            {hours === null ? null : <span>{hours}</span>}
            {exception.workerUserId ? (
              worker !== undefined ? (
                <span><EntityChip entity={{ kind: "worker", id: worker.id, label: worker.name }} size="sm" /></span>
              ) : (
                <span>{t("booking.workingHours.workerUnknown")}</span>
              )
            ) : null}
          </>
        )}
        {exception.reason ? <span>{exception.reason}</span> : null}
      </SettingsItemCard>
    );
  };

  return (
    <SettingsScreen
      title={t("booking.exceptions.title")}
      subtitle={
        <>
          {t("booking.exceptions.subtitle")}{" "}
          {t("booking.exceptions.window", {
            from: formatDateOnly(windowFrom),
            to: formatDateOnly(windowTo),
          })}{" "}
          Celý týden nebo měsíc najednou nastavíte v{" "}
          <Link component={RouterLink} to="/working-hours" sx={INLINE_LINK_SX}>
            Rychlém plánu
          </Link>
          .
        </>
      }
      actions={
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={activeCalendarId === ""}
        >
          {t("booking.exceptions.new")}
        </Button>
      }
    >

      <Shelf
        id="exceptions-calendar"
        title={t("booking.workingHours.calendar")}
        layout="board"
        loading={calState.loading}
        error={calState.error}
        onRetry={calState.onRetry}
        empty={calReady && calendars.length === 0}
        emptyState={{ text: t("booking.workingHours.noCalendars"), action: { label: "Kalendáře", to: "/calendars" } }}
      >
        <Box sx={{ p: 2 }}>
        <TextField
          select
          label={t("booking.workingHours.calendar")}
          value={activeCalendarId}
          onChange={(e) => setCalendarId(e.target.value)}
          sx={{ minWidth: 260, maxWidth: "100%" }}
        >
          {calendars.map((calendar) => (
            <MenuItem key={calendar.id} value={calendar.id}>
              {calendar.name}
            </MenuItem>
          ))}
        </TextField>
        </Box>
      </Shelf>

      {calReady && calendars.length > 0 ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 3 }}>
          {remove.error ? <Alert severity="error">{errorText(remove.error, t)}</Alert> : null}
          <Shelf
            id="exceptions-upcoming"
            title="Nadcházející"
            count={listReady ? upcoming.length : undefined}
            layout="grid"
            minCardWidth={300}
            cardHeight={130}
            loading={listState.loading}
            error={listState.error}
            onRetry={listState.onRetry}
            empty={listReady && upcoming.length === 0}
            emptyState={{
              text: past.length === 0 ? t("booking.exceptions.empty") : "Žádná nadcházející výjimka.",
              action: { label: t("booking.exceptions.new"), onClick: openCreate },
            }}
          >
            {upcoming.map(card)}
          </Shelf>
          {listReady && past.length > 0 ? (
            <Shelf id="exceptions-past" title="Minulé" count={past.length} layout="grid" minCardWidth={300} cardHeight={130}>
              {past.map(card)}
            </Shelf>
          ) : null}
        </Box>
      ) : null}

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
                <MenuItem value="onlineOff">
                  {t("booking.exceptions.kind.onlineOff")}
                </MenuItem>
              </TextField>

              {kind === "onlineOff" ? (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {t("booking.exceptions.onlineOffHelp")}
                </Typography>
              ) : null}

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
              {kind === "differentHours" && hoursProblem !== null ? (
                <Typography variant="caption" sx={{ color: "error.main" }}>
                  {hoursProblem}
                </Typography>
              ) : null}

              {kind === "differentWorker" ? (
                <TextField
                  select
                  fullWidth
                  label={t("booking.workingHours.worker")}
                  error={workersQuery.isError}
                  helperText={
                    workersQuery.isError
                      ? t("booking.workingHours.workersFailed")
                      : undefined
                  }
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
                slotProps={{ htmlInput: { maxLength: FIELD_LIMITS.reason } }}
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
            disabled={save.isPending || draft === null || problem !== null}
            onClick={() => draft && save.mutate(draft)}
          >
            {t("booking.common.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </SettingsScreen>
  );
}
