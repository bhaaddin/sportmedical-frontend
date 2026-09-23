import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Link,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { calendarsApi } from "../../api/calendars";
import { workingHoursApi } from "../../api/workingHours";
import type { SchedulePeriod, WorkingHour } from "../../api/bookingContracts";
import { AsyncSection } from "../../components/booking/AsyncSection";
import { DayActivityGrid } from "../../components/booking/DayActivityGrid";
import { errorText } from "../../components/booking/errorText";
import { addDaysToDateOnly, formatDateOnly, pragueDateKey } from "../../utils/time";
import {
  DEFAULT_PERIOD_NAME,
  defaultPeriodStart,
  mondayOf,
  pickPeriod,
  planSave,
  setAlternating,
  shiftProblem,
  timetableFrom,
  type DayPlan,
  type Shift,
  type Timetable,
} from "./timetable";

/**
 * Pracovní doba - one timetable per calendar, by weekday, optionally
 * different in alternating weeks.
 *
 * The owner's plan: "Pracovní doba musí být jednoduchá - pro zaměstnance, po
 * dnech, případně jinak v lichém a sudém týdnu." The validity periods this
 * screen used to be built around ("Zimní provoz") are gone from it. The
 * backend still files every row under a period, so one is kept behind the
 * scenes, created on the first save and never named on screen; how rows map
 * to the screen is in `timetable.ts`.
 *
 * Weeks are called A and B rather than odd and even: the backend counts them
 * from the start of that hidden period, not by week number in the year (4.2),
 * and a year with 53 weeks would turn a label "lichý" into a lie. The dates
 * each one falls on come from the server's `…/cycle` answer.
 */

const CODEBOOK_STALE_MS = 5 * 60 * 1000;

/** `21. 9.` - enough to recognise a week. */
const shortDate = (date: string): string => {
  const [, month, day] = date.split("-").map(Number);
  return `${day}. ${month}.`;
};

export default function WorkingHoursPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const today = pragueDateKey(new Date());

  const [calendarId, setCalendarId] = useState<string>("");
  const [removing, setRemoving] = useState<SchedulePeriod | null>(null);
  /* Lives here, not in the editor: a save refetches, and the editor starts over. */
  const [justSaved, setJustSaved] = useState(false);

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

  const periods = useMemo(() => periodsQuery.data ?? [], [periodsQuery.data]);
  const { main, others } = useMemo(() => pickPeriod(periods, today), [periods, today]);
  /* Left-overs that end before today change nothing any more. */
  const stillInForce = others.filter((p) => p.validTo === null || p.validTo >= today);

  const hoursQuery = useQuery({
    queryKey: ["working-hours", activeCalendarId, main?.id ?? ""],
    queryFn: () => workingHoursApi.listWorkingHours(activeCalendarId, main?.id ?? ""),
    enabled: activeCalendarId !== "" && main !== null,
  });

  /** Who may be put on a day: the people who can see this calendar (5.3). */
  const workersQuery = useQuery({
    queryKey: ["calendar-access", activeCalendarId],
    queryFn: () => calendarsApi.getAccess(activeCalendarId),
    enabled: activeCalendarId !== "",
    staleTime: CODEBOOK_STALE_MS,
  });

  const workers = (workersQuery.data ?? []).map((w) => ({ id: w.userId, name: w.displayName }));

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["periods", activeCalendarId] });
    await queryClient.invalidateQueries({ queryKey: ["working-hours", activeCalendarId] });
  };

  const makeOpenEnded = useMutation({
    mutationFn: (period: SchedulePeriod) =>
      workingHoursApi.updatePeriod(activeCalendarId, period.id, {
        name: period.name,
        validFrom: period.validFrom,
        validTo: null,
      }),
    onSuccess: invalidate,
  });

  const removePeriod = useMutation({
    mutationFn: (period: SchedulePeriod) => workingHoursApi.deletePeriod(activeCalendarId, period.id),
    onSuccess: async () => {
      setRemoving(null);
      await invalidate();
    },
  });

  const rows = main === null ? [] : (hoursQuery.data ?? []);
  const rowsReady = main === null || hoursQuery.isSuccess;

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      <Typography variant="h4" sx={{ fontWeight: 800 }}>
        {t("booking.workingHours.title")}
      </Typography>
      <Typography sx={{ color: "text.secondary", mb: 3 }}>
        Kdy se v kalendáři pracuje, po dnech v týdnu. Jednotlivé dny jinak (dovolená, jiný čas)
        nastavíte ve{" "}
        <Link component={RouterLink} to="/exceptions">
          výjimkách
        </Link>
        , státní svátky ve{" "}
        <Link component={RouterLink} to="/svatky">
          svátcích a volnu
        </Link>
        .
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
            setJustSaved(false);
          }}
          sx={{ minWidth: 260, mb: 3 }}
        >
          {calendars.map((calendar) => (
            <MenuItem key={calendar.id} value={calendar.id}>
              {calendar.name}
            </MenuItem>
          ))}
        </TextField>

        <AsyncSection
          isLoading={periodsQuery.isLoading || (main !== null && hoursQuery.isLoading)}
          isSettled={periodsQuery.isSuccess && rowsReady}
          error={periodsQuery.error ?? hoursQuery.error}
          isEmpty={false}
          emptyText=""
          onRetry={() => void invalidate()}
          skeletonRows={7}
        >
          {main !== null && main.validFrom > today ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Tato pracovní doba začne platit {formatDateOnly(main.validFrom)}. Do té doby se do
              kalendáře objednat nedá.
            </Alert>
          ) : null}

          {main !== null && main.validTo !== null ? (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  disabled={makeOpenEnded.isPending}
                  onClick={() => makeOpenEnded.mutate(main)}
                >
                  Platit bez konce
                </Button>
              }
            >
              Tato pracovní doba platí jen do {formatDateOnly(main.validTo)}. Potom se do kalendáře
              nedá objednat.
            </Alert>
          ) : null}
          {makeOpenEnded.error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorText(makeOpenEnded.error, t)}
            </Alert>
          ) : null}

          {stillInForce.length > 0 ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Z dřívějšího nastavení podle období zůstaly v tomto kalendáři ještě další pracovní
                doby. Platí dál ve svých datech, i když je tady nevidíte:
              </Typography>
              <Stack spacing={0.5}>
                {stillInForce.map((period) => (
                  <Box key={period.id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {period.name} · {formatDateOnly(period.validFrom)}
                      {period.validTo ? ` – ${formatDateOnly(period.validTo)}` : " – bez konce"}
                    </Typography>
                    <Button size="small" color="inherit" onClick={() => setRemoving(period)}>
                      {t("booking.common.delete")}
                    </Button>
                  </Box>
                ))}
              </Stack>
            </Alert>
          ) : null}

          <TimetableEditor
            key={`${activeCalendarId}:${main?.id ?? "none"}:${hoursQuery.dataUpdatedAt}`}
            calendarId={activeCalendarId}
            period={main}
            periods={periods}
            today={today}
            saved={rows}
            workers={workers}
            workersFailed={workersQuery.isError}
            justSaved={justSaved}
            onEdited={() => setJustSaved(false)}
            onSaved={async () => {
              setJustSaved(true);
              await invalidate();
            }}
            onFailed={invalidate}
          />

          {/* 5.7 hangs off the period; the period is simply not named. */}
          {main !== null ? (
            <>
              <Divider sx={{ my: 3 }} />
              <DayActivityGrid
                calendarId={activeCalendarId}
                periodId={main.id}
                workingDays={new Set(rows.map((row) => row.dayOfWeek))}
              />
            </>
          ) : null}
        </AsyncSection>
      </AsyncSection>

      <Dialog open={removing !== null} onClose={() => setRemoving(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Smazat starou pracovní dobu?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {removing?.name} · {formatDateOnly(removing?.validFrom)}
            {removing?.validTo ? ` – ${formatDateOnly(removing.validTo)}` : ""}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1.5, color: "text.secondary" }}>
            V těchto dnech pak kalendář nebude mít pracovní dobu a nepůjde do něj objednat. Termíny,
            které tam už jsou objednané, zůstanou a nikdo se neruší.
          </Typography>
          {removePeriod.error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorText(removePeriod.error, t)}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoving(null)}>{t("booking.common.cancel")}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={removePeriod.isPending}
            onClick={() => removing && removePeriod.mutate(removing)}
          >
            {t("booking.common.delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

interface TimetableEditorProps {
  calendarId: string;
  /** The period the rows live in; null until the first save creates it. */
  period: SchedulePeriod | null;
  periods: SchedulePeriod[];
  today: string;
  saved: WorkingHour[];
  workers: { id: string; name: string }[];
  workersFailed: boolean;
  justSaved: boolean;
  onEdited: () => void;
  onSaved: () => Promise<void>;
  /** Some requests may have gone through before one failed. */
  onFailed: () => Promise<void>;
}

function TimetableEditor({
  calendarId,
  period,
  periods,
  today,
  saved,
  workers,
  workersFailed,
  justSaved,
  onEdited,
  onSaved,
  onFailed,
}: TimetableEditorProps) {
  const { t } = useTranslation();
  const initial = useMemo(() => timetableFrom(saved), [saved]);
  const [draft, setDraft] = useState<Timetable>(initial);

  const ops = useMemo(() => planSave(saved, initial, draft), [saved, initial, draft]);
  const problems = draft.days.flatMap((day) =>
    [day.a, ...(draft.alternating ? [day.b] : [])]
      .map(shiftProblem)
      .filter((p): p is string => p !== null),
  );

  const save = useMutation({
    mutationFn: async () => {
      let periodId = period?.id;
      if (periodId === undefined) {
        const created = await workingHoursApi.createPeriod(calendarId, {
          name: DEFAULT_PERIOD_NAME,
          validFrom: defaultPeriodStart(periods, today),
          validTo: null,
        });
        periodId = created.id;
      }
      for (const op of ops) {
        if (op.kind === "delete") await workingHoursApi.deleteWorkingHour(calendarId, op.id);
        else if (op.kind === "update")
          await workingHoursApi.updateWorkingHour(calendarId, op.id, op.input);
        else await workingHoursApi.createWorkingHour(calendarId, periodId, op.input);
      }
    },
    onSuccess: onSaved,
    // Some requests may have gone through: show what is really stored now.
    onError: () => void onFailed(),
  });

  const updateDay = (dayOfWeek: number, week: "a" | "b", shift: Shift) => {
    onEdited();
    setDraft((current) => ({
      ...current,
      days: current.days.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, [week]: shift } : day)),
    }));
  };

  /* Which Mondays each week kind falls on - the server's own rule (4.2). */
  const cycleFrom = mondayOf(today);
  const cycleTo = addDaysToDateOnly(cycleFrom, 56);
  const periodId = period?.id ?? "";
  const weekA = useQuery({
    queryKey: ["cycle", calendarId, periodId, 1, 2, 0, cycleFrom, cycleTo],
    queryFn: () => workingHoursApi.cycleDates(calendarId, periodId, 1, 2, 0, cycleFrom, cycleTo),
    enabled: draft.alternating && period !== null,
  });
  const weekB = useQuery({
    queryKey: ["cycle", calendarId, periodId, 1, 2, 1, cycleFrom, cycleTo],
    queryFn: () => workingHoursApi.cycleDates(calendarId, periodId, 1, 2, 1, cycleFrom, cycleTo),
    enabled: draft.alternating && period !== null,
  });

  const weekCaption = (dates: string[] | undefined, fallback: string) =>
    period === null
      ? fallback
      : dates && dates.length > 0
        ? `týdny od ${dates.slice(0, 4).map(shortDate).join(", ")} …`
        : "";

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <FormControlLabel
        control={
          <Switch
            checked={draft.alternating}
            onChange={(e) => {
              onEdited();
              setDraft((current) => setAlternating(current, e.target.checked));
            }}
          />
        }
        label="Jiná pracovní doba v lichém a sudém týdnu (týden A a týden B se střídají)"
      />

      {draft.alternating ? (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 1, mb: 1 }}>
          <Typography variant="body2">
            <strong>Týden A:</strong>{" "}
            {weekCaption(weekA.data, `tento týden (od ${shortDate(cycleFrom)}), pak každý druhý`)}
          </Typography>
          <Typography variant="body2">
            <strong>Týden B:</strong>{" "}
            {weekCaption(
              weekB.data,
              `příští týden (od ${shortDate(addDaysToDateOnly(cycleFrom, 7))}), pak každý druhý`,
            )}
          </Typography>
        </Stack>
      ) : null}

      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t("booking.workingHours.day")}</TableCell>
              {draft.alternating ? <TableCell>Týden</TableCell> : null}
              <TableCell>Pracuje</TableCell>
              <TableCell>{t("booking.workingHours.hours")}</TableCell>
              <TableCell>Pauza</TableCell>
              <TableCell>{t("booking.workingHours.worker")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {draft.days.map((day) => (
              <DayRows
                key={day.dayOfWeek}
                day={day}
                alternating={draft.alternating}
                workers={workers}
                workersFailed={workersFailed}
                onChange={updateDay}
              />
            ))}
          </TableBody>
        </Table>
      </Box>

      <Stack direction="row" spacing={2} sx={{ mt: 2, alignItems: "center", flexWrap: "wrap" }}>
        <Button
          variant="contained"
          disabled={ops.length === 0 || problems.length > 0 || save.isPending}
          onClick={() => save.mutate()}
        >
          {t("booking.common.save")}
        </Button>
        {ops.length > 0 ? (
          <Button
            disabled={save.isPending}
            onClick={() => {
              setDraft(initial);
              save.reset();
            }}
          >
            Vrátit změny
          </Button>
        ) : null}
        {justSaved && ops.length === 0 ? (
          <Typography variant="body2" sx={{ color: "success.main" }}>
            Uloženo.
          </Typography>
        ) : null}
      </Stack>
      {save.error ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {errorText(save.error, t)} Zobrazeno je to, co je teď opravdu uložené.
        </Alert>
      ) : null}
    </Paper>
  );
}

interface DayRowsProps {
  day: DayPlan;
  alternating: boolean;
  workers: { id: string; name: string }[];
  workersFailed: boolean;
  onChange: (dayOfWeek: number, week: "a" | "b", shift: Shift) => void;
}

function DayRows({ day, alternating, workers, workersFailed, onChange }: DayRowsProps) {
  const { t } = useTranslation();
  const weeks: ("a" | "b")[] = alternating ? ["a", "b"] : ["a"];

  return (
    <>
      {weeks.map((week, index) => (
        <TableRow key={week}>
          {index === 0 ? (
            <TableCell rowSpan={weeks.length} sx={{ verticalAlign: "top", pt: 2, fontWeight: 700 }}>
              {t(`booking.workingHours.weekday.${day.dayOfWeek}`)}
              {day.unsupported ? (
                <Typography variant="caption" sx={{ display: "block", color: "warning.main", maxWidth: 180 }}>
                  Nastaveno složitěji, než tu jde ukázat. Když den upravíte, uloží se takto.
                </Typography>
              ) : null}
            </TableCell>
          ) : null}
          {alternating ? (
            <TableCell sx={{ verticalAlign: "top", pt: 2 }}>{week === "a" ? "A" : "B"}</TableCell>
          ) : null}
          <ShiftCells
            label={`${t(`booking.workingHours.weekday.${day.dayOfWeek}`)}${alternating ? `, týden ${week.toUpperCase()}` : ""}`}
            shift={day[week]}
            workers={workers}
            workersFailed={workersFailed}
            onChange={(shift) => onChange(day.dayOfWeek, week, shift)}
          />
        </TableRow>
      ))}
    </>
  );
}

interface ShiftCellsProps {
  label: string;
  shift: Shift;
  workers: { id: string; name: string }[];
  workersFailed: boolean;
  onChange: (shift: Shift) => void;
}

function ShiftCells({ label, shift, workers, workersFailed, onChange }: ShiftCellsProps) {
  const { t } = useTranslation();
  const problem = shiftProblem(shift);
  const off = !shift.working;

  return (
    <>
      <TableCell sx={{ verticalAlign: "top", pt: 1.5 }}>
        <Switch
          checked={shift.working}
          onChange={(e) => onChange({ ...shift, working: e.target.checked })}
          slotProps={{ input: { "aria-label": `${label}: pracuje` } }}
        />
      </TableCell>
      <TableCell sx={{ verticalAlign: "top", pt: 2 }}>
        <Stack direction="row" spacing={1}>
          <TextField
            type="time"
            size="small"
            label={t("booking.workingHours.from")}
            value={shift.start}
            disabled={off}
            onChange={(e) => onChange({ ...shift, start: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 120 }}
          />
          <TextField
            type="time"
            size="small"
            label={t("booking.workingHours.to")}
            value={shift.end}
            disabled={off}
            onChange={(e) => onChange({ ...shift, end: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 120 }}
          />
        </Stack>
        {problem ? (
          <Typography variant="caption" sx={{ display: "block", color: "error.main", mt: 0.5 }}>
            {problem}
          </Typography>
        ) : null}
      </TableCell>
      <TableCell sx={{ verticalAlign: "top", pt: 2 }}>
        <Stack direction="row" spacing={1}>
          <TextField
            type="time"
            size="small"
            label={t("booking.workingHours.from")}
            value={shift.breakStart ?? ""}
            disabled={off}
            onChange={(e) => onChange({ ...shift, breakStart: e.target.value || null })}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 120 }}
          />
          <TextField
            type="time"
            size="small"
            label={t("booking.workingHours.to")}
            value={shift.breakEnd ?? ""}
            disabled={off}
            onChange={(e) => onChange({ ...shift, breakEnd: e.target.value || null })}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 120 }}
          />
        </Stack>
      </TableCell>
      <TableCell sx={{ verticalAlign: "top", pt: 2, minWidth: 180 }}>
        <TextField
          select
          size="small"
          fullWidth
          label={t("booking.workingHours.worker")}
          error={workersFailed}
          helperText={workersFailed ? t("booking.workingHours.workersFailed") : undefined}
          value={shift.workerUserId ?? ""}
          disabled={off}
          onChange={(e) => onChange({ ...shift, workerUserId: e.target.value || null })}
        >
          <MenuItem value="">{t("booking.workingHours.noWorker")}</MenuItem>
          {shift.workerUserId && !workers.some((w) => w.id === shift.workerUserId) ? (
            <MenuItem value={shift.workerUserId}>{t("booking.workingHours.workerUnknown")}</MenuItem>
          ) : null}
          {workers.map((worker) => (
            <MenuItem key={worker.id} value={worker.id}>
              {worker.name}
            </MenuItem>
          ))}
        </TextField>
      </TableCell>
    </>
  );
}
