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
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
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
import EditIcon from "@mui/icons-material/Edit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { calendarsApi } from "../../api/calendars";
import { workingHoursApi } from "../../api/workingHours";
import type {
  ImpactReport,
  PreviewDay,
  SchedulePeriod,
  SchedulePeriodInput,
  WorkingHour,
  WorkingHourInput,
} from "../../api/bookingContracts";
import { AsyncSection } from "../../components/booking/AsyncSection";
import { DayActivityGrid } from "../../components/booking/DayActivityGrid";
import { errorText } from "../../components/booking/errorText";
import {
  addDaysToDateOnly,
  dayOfWeekOf,
  formatDateOnly,
  formatPragueTime,
  toDateOnly,
} from "../../utils/time";

/**
 * The cycle picker's four labels are only a way of writing
 * `repeatEveryNWeeks`/`weekOffset` in words - no dates are derived here.
 * Which dates a row falls on comes from `…/preview` and from nowhere else.
 */
type CycleMode = "every" | "even" | "odd" | "everyNth";

function cycleToMode(cycle: {
  repeatEveryNWeeks: number;
  weekOffset: number;
}): CycleMode {
  if (cycle.repeatEveryNWeeks <= 1) return "every";
  if (cycle.repeatEveryNWeeks === 2)
    return cycle.weekOffset % 2 === 0 ? "even" : "odd";
  return "everyNth";
}

function modeToCycle(
  mode: CycleMode,
  everyNth = 3,
): { repeatEveryNWeeks: number; weekOffset: number } {
  switch (mode) {
    case "every":
      return { repeatEveryNWeeks: 1, weekOffset: 0 };
    case "even":
      return { repeatEveryNWeeks: 2, weekOffset: 0 };
    case "odd":
      return { repeatEveryNWeeks: 2, weekOffset: 1 };
    case "everyNth":
      return { repeatEveryNWeeks: Math.max(2, everyNth), weekOffset: 0 };
  }
}

/** Days of preview asked for at once, enough for five turns of a long cycle. */
const PREVIEW_DAYS = 200;

/**
 * Working hours - contract screen 5.4, the hardest one.
 *
 * Validity periods, the days inside a period, the week cycle with a preview of
 * the dates it lands on, and - when shortening a period would strand booked
 * appointments - the list of who is hit, shown before anything is saved.
 */

const CODEBOOK_STALE_MS = 5 * 60 * 1000;

/** Displayed Monday first, stored 0 = Sunday as .NET spells it. */
const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0];

function emptyWorkingHour(dayOfWeek: number): WorkingHourInput {
  return {
    dayOfWeek,
    startTime: "08:00",
    endTime: "16:00",
    breakStart: null,
    breakEnd: null,
    repeatEveryNWeeks: 1,
    weekOffset: 0,
    workerUserId: null,
    isActive: true,
  };
}

function periodsOverlap(
  a: SchedulePeriod | SchedulePeriodInput,
  b: SchedulePeriod,
): boolean {
  const aTo = a.validTo ?? "9999-12-31";
  const bTo = b.validTo ?? "9999-12-31";
  return a.validFrom <= bTo && b.validFrom <= aTo;
}

export default function WorkingHoursPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const today = toDateOnly(new Date());

  const [calendarId, setCalendarId] = useState<string>("");
  const [periodId, setPeriodId] = useState<string>("");
  const [periodDraft, setPeriodDraft] = useState<SchedulePeriodInput | null>(
    null,
  );
  const [editingPeriod, setEditingPeriod] = useState<SchedulePeriod | null>(
    null,
  );
  const [impact, setImpact] = useState<ImpactReport | null>(null);

  const calendarsQuery = useQuery({
    queryKey: ["calendars"],
    queryFn: calendarsApi.list,
    staleTime: CODEBOOK_STALE_MS,
  });

  const calendars = calendarsQuery.data ?? [];
  const activeCalendarId = calendarId || calendars[0]?.id || "";

  const periodsQuery = useQuery({
    queryKey: ["periods", activeCalendarId],
    queryFn: () => workingHoursApi.listPeriods(activeCalendarId),
    enabled: activeCalendarId !== "",
  });

  const periods = useMemo(
    () =>
      [...(periodsQuery.data ?? [])].sort((a, b) =>
        a.validFrom.localeCompare(b.validFrom),
      ),
    [periodsQuery.data],
  );
  const activePeriodId = periodId || periods[0]?.id || "";
  const activePeriod = periods.find((p) => p.id === activePeriodId) ?? null;

  const hoursQuery = useQuery({
    queryKey: ["working-hours", activeCalendarId, activePeriodId],
    queryFn: () =>
      workingHoursApi.listWorkingHours(activeCalendarId, activePeriodId),
    enabled: activeCalendarId !== "" && activePeriodId !== "",
  });

  /** Who may be put on a day: the people who can see this calendar (5.3). */
  const workersQuery = useQuery({
    queryKey: ["calendar-access", activeCalendarId],
    queryFn: () => calendarsApi.getAccess(activeCalendarId),
    enabled: activeCalendarId !== "",
    staleTime: CODEBOOK_STALE_MS,
  });

  /**
   * One call for the whole window (7.3), shared by all seven rows. This is the
   * only source of "which dates does this row fall on".
   */
  const previewQuery = useQuery({
    queryKey: ["preview", activeCalendarId, today],
    queryFn: () =>
      workingHoursApi.preview(
        activeCalendarId,
        today,
        addDaysToDateOnly(today, PREVIEW_DAYS),
      ),
    enabled: activeCalendarId !== "",
  });

  const savePeriod = useMutation({
    mutationFn: ({
      input,
      token,
    }: {
      input: SchedulePeriodInput;
      token?: string;
    }) =>
      editingPeriod
        ? workingHoursApi.updatePeriod(
            activeCalendarId,
            editingPeriod.id,
            input,
            token,
          )
        : workingHoursApi.createPeriod(activeCalendarId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["periods", activeCalendarId],
      });
      setPeriodDraft(null);
      setEditingPeriod(null);
      setImpact(null);
    },
  });

  const deletePeriod = useMutation({
    mutationFn: (id: string) =>
      workingHoursApi.deletePeriod(activeCalendarId, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["periods", activeCalendarId],
      });
      setPeriodId("");
    },
  });

  /**
   * Ask who the new validity would strand, then save. Never the other way round
   * (4.2): the list is shown first and the owner decides.
   */
  const checkImpactThenSave = useMutation({
    mutationFn: async (
      input: SchedulePeriodInput,
    ): Promise<ImpactReport | null> => {
      if (!editingPeriod) return null;
      const report = await workingHoursApi.periodImpact(
        activeCalendarId,
        editingPeriod.id,
        input.validFrom,
        input.validTo,
      );
      return report.appointments.length > 0 ? report : null;
    },
    onSuccess: (report, input) => {
      // Nobody is stranded, so there is no token to carry.
      if (report === null) savePeriod.mutate({ input });
      else setImpact(report);
    },
  });

  const overlapping = useMemo(() => {
    if (!periodDraft) return false;
    return periods
      .filter((p) => p.id !== editingPeriod?.id)
      .some((p) => periodsOverlap(periodDraft, p));
  }, [periodDraft, periods, editingPeriod]);

  const periodIsValid =
    periodDraft !== null &&
    periodDraft.name.trim() !== "" &&
    periodDraft.validFrom !== "" &&
    (periodDraft.validTo === null ||
      periodDraft.validTo >= periodDraft.validFrom) &&
    !overlapping;

  const submitPeriod = () => {
    if (!periodDraft) return;
    // A new period strands nobody; only a change of validity can.
    if (editingPeriod) checkImpactThenSave.mutate(periodDraft);
    else savePeriod.mutate({ input: periodDraft });
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      <Typography variant="h4" sx={{ fontWeight: 800 }}>
        {t("booking.workingHours.title")}
      </Typography>
      <Typography sx={{ color: "text.secondary", mb: 3 }}>
        {t("booking.workingHours.subtitle")}
      </Typography>

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
          onChange={(e) => {
            setCalendarId(e.target.value);
            setPeriodId("");
          }}
          sx={{ minWidth: 260, mb: 3 }}
        >
          {calendars.map((calendar) => (
            <MenuItem key={calendar.id} value={calendar.id}>
              {calendar.name}
            </MenuItem>
          ))}
        </TextField>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
          <Typography variant="h6">
            {t("booking.workingHours.periods")}
          </Typography>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingPeriod(null);
              setPeriodDraft({ name: "", validFrom: today, validTo: null });
              savePeriod.reset();
            }}
          >
            {t("booking.workingHours.newPeriod")}
          </Button>
        </Box>

        <AsyncSection
          isLoading={periodsQuery.isLoading}
          isSettled={periodsQuery.isSuccess}
          error={periodsQuery.error}
          isEmpty={periods.length === 0}
          emptyText={t("booking.workingHours.noPeriods")}
          emptyAction={{
            label: t("booking.workingHours.newPeriod"),
            onClick: () => {
              setEditingPeriod(null);
              setPeriodDraft({ name: "", validFrom: today, validTo: null });
            },
          }}
          onRetry={() => void periodsQuery.refetch()}
          skeletonRows={2}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{ flexWrap: "wrap", gap: 1, mb: 3 }}
          >
            {periods.map((period) => (
              <Chip
                key={period.id}
                label={`${period.name} · ${formatDateOnly(period.validFrom)}${
                  period.validTo ? ` – ${formatDateOnly(period.validTo)}` : ""
                }`}
                color={period.id === activePeriodId ? "primary" : "default"}
                onClick={() => setPeriodId(period.id)}
                onDelete={() => deletePeriod.mutate(period.id)}
                deleteIcon={
                  <Tooltip title={t("booking.common.delete")}>
                    <DeleteIcon />
                  </Tooltip>
                }
              />
            ))}
            {activePeriod ? (
              <Tooltip title={t("booking.workingHours.editPeriod")}>
                <IconButton
                  aria-label={t("booking.workingHours.editPeriod")}
                  onClick={() => {
                    setEditingPeriod(activePeriod);
                    setPeriodDraft({
                      name: activePeriod.name,
                      validFrom: activePeriod.validFrom,
                      validTo: activePeriod.validTo,
                    });
                    savePeriod.reset();
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>
        </AsyncSection>

        {deletePeriod.error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorText(deletePeriod.error, t)}
          </Alert>
        ) : null}

        {activePeriod ? (
          <>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              {t("booking.workingHours.days", { name: activePeriod.name })}
            </Typography>
            <AsyncSection
              isLoading={hoursQuery.isLoading}
              error={hoursQuery.error}
              isEmpty={false}
              emptyText=""
              onRetry={() => void hoursQuery.refetch()}
              skeletonRows={7}
            >
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t("booking.workingHours.day")}</TableCell>
                      <TableCell>{t("booking.workingHours.hours")}</TableCell>
                      <TableCell>{t("booking.workingHours.lunch")}</TableCell>
                      <TableCell>{t("booking.workingHours.cycle")}</TableCell>
                      <TableCell>{t("booking.workingHours.worker")}</TableCell>
                      <TableCell align="right">
                        {t("booking.common.actions")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {WEEK_DAYS.map((dayOfWeek) => (
                      <DayRow
                        key={dayOfWeek}
                        dayOfWeek={dayOfWeek}
                        period={activePeriod}
                        calendarId={activeCalendarId}
                        existing={
                          (hoursQuery.data ?? []).find(
                            (h) => h.dayOfWeek === dayOfWeek,
                          ) ?? null
                        }
                        preview={previewQuery.data ?? []}
                        workers={(workersQuery.data ?? []).map((w) => ({
                          id: w.userId,
                          name: w.displayName,
                        }))}
                      />
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </AsyncSection>

            {/* 5.7 hangs off the selected period, so it lives with it. */}
            <Divider sx={{ my: 3 }} />
            <DayActivityGrid
              calendarId={activeCalendarId}
              periodId={activePeriod.id}
              workingDays={
                new Set(
                  (hoursQuery.data ?? [])
                    .filter((h) => h.isActive)
                    .map((h) => h.dayOfWeek),
                )
              }
            />
          </>
        ) : null}
      </AsyncSection>

      {/* Period create / edit */}
      <Dialog
        open={periodDraft !== null && impact === null}
        onClose={() => setPeriodDraft(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editingPeriod
            ? t("booking.workingHours.editPeriod")
            : t("booking.workingHours.newPeriod")}
        </DialogTitle>
        <DialogContent>
          {periodDraft ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                autoFocus
                required
                fullWidth
                label={t("booking.workingHours.periodName")}
                value={periodDraft.name}
                onChange={(e) =>
                  setPeriodDraft({ ...periodDraft, name: e.target.value })
                }
              />
              <TextField
                required
                fullWidth
                type="date"
                label={t("booking.workingHours.validFrom")}
                value={periodDraft.validFrom}
                onChange={(e) =>
                  setPeriodDraft({ ...periodDraft, validFrom: e.target.value })
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                fullWidth
                type="date"
                label={t("booking.workingHours.validTo")}
                value={periodDraft.validTo ?? ""}
                onChange={(e) =>
                  setPeriodDraft({
                    ...periodDraft,
                    validTo: e.target.value || null,
                  })
                }
                helperText={t("booking.workingHours.validToHelp")}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              {overlapping ? (
                <Alert severity="error">
                  {t("booking.workingHours.overlap")}
                </Alert>
              ) : null}
              {savePeriod.error ? (
                <Alert severity="error">{errorText(savePeriod.error, t)}</Alert>
              ) : null}
              {checkImpactThenSave.error ? (
                <Alert severity="error">
                  {errorText(checkImpactThenSave.error, t)}
                </Alert>
              ) : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPeriodDraft(null)}>
            {t("booking.common.cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={
              !periodIsValid ||
              savePeriod.isPending ||
              checkImpactThenSave.isPending
            }
            onClick={submitPeriod}
          >
            {t("booking.common.save")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 4.2: who the shortened validity would strand. Never saved silently. */}
      <Dialog
        open={impact !== null}
        onClose={() => setImpact(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {t("booking.workingHours.impactTitle", {
            count: impact?.appointments.length ?? 0,
          })}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t("booking.workingHours.impactLead")}
          </Alert>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("booking.workingHours.impactWhen")}</TableCell>
                  <TableCell>
                    {t("booking.workingHours.impactLength")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* 4.2 sends no patient here on purpose: a name has no business
                    on the working-hours screen. Who needs to know who opens the
                    appointment where they have the right to. */}
                {(impact?.appointments ?? []).map((appointment) => (
                  <TableRow key={appointment.appointmentId}>
                    <TableCell>
                      {formatDateOnly(appointment.startUtc.slice(0, 10))}{" "}
                      {formatPragueTime(appointment.startUtc)}
                    </TableCell>
                    <TableCell>
                      {t("booking.workingHours.minutes", {
                        minutes: appointment.durationMinutes,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImpact(null)}>
            {t("booking.common.cancel")}
          </Button>
          <Button
            color="warning"
            variant="contained"
            disabled={savePeriod.isPending || !impact?.token}
            onClick={() =>
              periodDraft &&
              impact?.token &&
              savePeriod.mutate({ input: periodDraft, token: impact.token })
            }
          >
            {t("booking.workingHours.impactConfirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

interface DayRowProps {
  dayOfWeek: number;
  period: SchedulePeriod;
  calendarId: string;
  existing: WorkingHour | null;
  workers: { id: string; name: string }[];
  preview: PreviewDay[];
}

function DayRow({
  dayOfWeek,
  period,
  calendarId,
  existing,
  workers,
  preview,
}: DayRowProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [edited, setEdited] = useState<WorkingHourInput | null>(null);

  const value: WorkingHourInput =
    edited ??
    (existing
      ? {
          dayOfWeek: existing.dayOfWeek,
          startTime: existing.startTime.slice(0, 5),
          endTime: existing.endTime.slice(0, 5),
          breakStart: existing.breakStart?.slice(0, 5) ?? null,
          breakEnd: existing.breakEnd?.slice(0, 5) ?? null,
          repeatEveryNWeeks: existing.repeatEveryNWeeks,
          weekOffset: existing.weekOffset,
          workerUserId: existing.workerUserId,
          isActive: existing.isActive,
        }
      : { ...emptyWorkingHour(dayOfWeek), isActive: false });

  const mode = cycleToMode(value);
  const dirty = edited !== null;

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["working-hours", calendarId, period.id],
    });

  const save = useMutation({
    mutationFn: (input: WorkingHourInput) =>
      existing
        ? workingHoursApi.updateWorkingHour(calendarId, existing.id, input)
        : workingHoursApi.createWorkingHour(calendarId, period.id, input),
    onSuccess: async () => {
      await invalidate();
      setEdited(null);
    },
  });

  const remove = useMutation({
    mutationFn: () =>
      workingHoursApi.deleteWorkingHour(calendarId, existing?.id ?? ""),
    onSuccess: async () => {
      await invalidate();
      setEdited(null);
    },
  });

  const { isActive } = value;

  /**
   * The dates this row actually lands on, read off the server's preview (4.2).
   * 5.4 is explicit that without them nobody knows what they set - but they are
   * not computed here: a second computation of the cycle would agree with the
   * server right up until one of the two changed.
   *
   * A day the owner has just edited but not saved has no preview yet, which the
   * row says instead of showing dates that no longer match the switches.
   */
  const previewDates = useMemo(
    () =>
      preview
        .filter(
          (day) =>
            dayOfWeekOf(day.date) === dayOfWeek &&
            day.isOpen &&
            !day.isChangedByOverride &&
            day.date >= period.validFrom &&
            (period.validTo === null || day.date <= period.validTo) &&
            (value.workerUserId === null ||
              day.workerUserId === value.workerUserId),
        )
        .slice(0, 5)
        .map((day) => day.date),
    [preview, dayOfWeek, period.validFrom, period.validTo, value.workerUserId],
  );

  return (
    <TableRow hover>
      <TableCell sx={{ verticalAlign: "top", pt: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={value.isActive}
              onChange={(e) =>
                setEdited({ ...value, isActive: e.target.checked })
              }
            />
          }
          label={t(`booking.workingHours.weekday.${dayOfWeek}`)}
        />
      </TableCell>

      <TableCell sx={{ verticalAlign: "top", pt: 2 }}>
        <Stack direction="row" spacing={1}>
          <TextField
            type="time"
            size="small"
            label={t("booking.workingHours.from")}
            value={value.startTime}
            disabled={!value.isActive}
            onChange={(e) => setEdited({ ...value, startTime: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 120 }}
          />
          <TextField
            type="time"
            size="small"
            label={t("booking.workingHours.to")}
            value={value.endTime}
            disabled={!value.isActive}
            onChange={(e) => setEdited({ ...value, endTime: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 120 }}
          />
        </Stack>
      </TableCell>

      <TableCell sx={{ verticalAlign: "top", pt: 2 }}>
        <Stack direction="row" spacing={1}>
          <TextField
            type="time"
            size="small"
            label={t("booking.workingHours.from")}
            value={value.breakStart ?? ""}
            disabled={!value.isActive}
            onChange={(e) =>
              setEdited({ ...value, breakStart: e.target.value || null })
            }
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 120 }}
          />
          <TextField
            type="time"
            size="small"
            label={t("booking.workingHours.to")}
            value={value.breakEnd ?? ""}
            disabled={!value.isActive}
            onChange={(e) =>
              setEdited({ ...value, breakEnd: e.target.value || null })
            }
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 120 }}
          />
        </Stack>
      </TableCell>

      <TableCell sx={{ verticalAlign: "top", pt: 2, minWidth: 240 }}>
        <TextField
          select
          size="small"
          fullWidth
          label={t("booking.workingHours.cycle")}
          value={mode}
          disabled={!value.isActive}
          onChange={(e) =>
            setEdited({
              ...value,
              ...modeToCycle(
                e.target.value as CycleMode,
                value.repeatEveryNWeeks,
              ),
            })
          }
        >
          <MenuItem value="every">
            {t("booking.workingHours.cycleEvery")}
          </MenuItem>
          <MenuItem value="even">
            {t("booking.workingHours.cycleEven")}
          </MenuItem>
          <MenuItem value="odd">{t("booking.workingHours.cycleOdd")}</MenuItem>
          <MenuItem value="everyNth">
            {t("booking.workingHours.cycleNth")}
          </MenuItem>
        </TextField>
        {mode === "everyNth" ? (
          <TextField
            type="number"
            size="small"
            sx={{ mt: 1, width: 120 }}
            label={t("booking.workingHours.everyNth")}
            value={value.repeatEveryNWeeks}
            onChange={(e) =>
              setEdited({
                ...value,
                repeatEveryNWeeks: Math.max(2, Number(e.target.value) || 2),
              })
            }
          />
        ) : null}
        {isActive ? (
          <Typography sx={{ mt: 1, fontSize: 13, color: "text.secondary" }}>
            {dirty
              ? t("booking.workingHours.previewStale")
              : previewDates.length > 0
                ? t("booking.workingHours.preview", {
                    dates: previewDates
                      .map((d) => formatDateOnly(d))
                      .join(" · "),
                  })
                : t("booking.workingHours.previewNone")}
          </Typography>
        ) : null}
      </TableCell>

      <TableCell sx={{ verticalAlign: "top", pt: 2, minWidth: 180 }}>
        <TextField
          select
          size="small"
          fullWidth
          label={t("booking.workingHours.worker")}
          value={value.workerUserId ?? ""}
          disabled={!value.isActive}
          onChange={(e) =>
            setEdited({ ...value, workerUserId: e.target.value || null })
          }
        >
          <MenuItem value="">{t("booking.workingHours.noWorker")}</MenuItem>
          {workers.map((worker) => (
            <MenuItem key={worker.id} value={worker.id}>
              {worker.name}
            </MenuItem>
          ))}
        </TextField>
      </TableCell>

      <TableCell align="right" sx={{ verticalAlign: "top", pt: 2 }}>
        <Stack spacing={1} sx={{ alignItems: "flex-end" }}>
          <Button
            size="small"
            variant="contained"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate(value)}
          >
            {t("booking.common.save")}
          </Button>
          {existing ? (
            <Button
              size="small"
              color="error"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {t("booking.common.delete")}
            </Button>
          ) : null}
          {save.error ? (
            <Typography sx={{ fontSize: 12, color: "error.main" }}>
              {errorText(save.error, t)}
            </Typography>
          ) : null}
        </Stack>
      </TableCell>
    </TableRow>
  );
}
