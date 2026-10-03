import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { activitiesApi } from '../../../api/activities';
import { appointmentsApi } from '../../../api/appointments';
import { workingHoursApi } from '../../../api/workingHours';
import type {
  DayAppointment,
  SchedulePeriod,
  ScheduleException,
} from '../../../api/bookingContracts';
import { dayOfWeekOf, formatPragueDateTime, pragueDateKey } from '../../../utils/time';
import { SectionLabel, SoftCard, FilterChips } from '../../ui';
import { useCalendarDisplay } from '../../../api/displaySettings';
import { hourToTime } from '../../../utils/dayHours';
import { errorText } from '../errorText';
import {
  FROM_DAY,
  LONG_DAY,
  appointmentsOutsideDay,
  appointmentsOutsidePlan,
  chunkRange,
  dayException,
  dayPreview,
  dayProblems,
  describeConflict,
  findConflicts,
  formatRange,
  planName,
  planOperations,
  planPreview,
  planProblems,
  runPlanOperations,
  scopeRange,
  type CoveringContext,
  type DayDraft,
  type PlanDraft,
  type PlanScope,
} from './quickPlan';

/**
 * Rychlý plán - opening hours AND činnosti for a day, a week, a month or any
 * stretch, in one dialog (Matko, 3. 10. 2026: "there must be a quick option, or
 * a plan for a month, for a week, for a given day").
 *
 * How it meets what is stored is explained in `quickPlan.ts`: one date is an
 * exception, anything longer is a schedule period, and because the server
 * refuses overlapping periods the dialog says which existing period it would
 * cut and waits for a confirmation. Nothing is overwritten silently.
 */

const WORKDAYS = [1, 2, 3, 4, 5];
/** Monday first. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface Covering extends CoveringContext {
  impactCount: number;
}

interface Analysis {
  appointments: DayAppointment[];
  contexts: Covering[];
  exception: ScheduleException | null;
}

export interface QuickPlanDialogProps {
  open: boolean;
  onClose: () => void;
  calendarId: string;
  calendarName: string;
  /** Only the činnosti of the calendar's service can be offered by it (server rule). */
  clinicServiceId: string | null;
  periods: SchedulePeriod[];
  /** A one-line confirmation for the screen behind the dialog. */
  onSaved: (message: string) => void;
}

export function QuickPlanDialog(props: QuickPlanDialogProps) {
  /* Mounted only while open, so nothing is fetched and no state outlives a close. */
  return props.open ? <QuickPlanBody {...props} /> : null;
}

function QuickPlanBody({
  onClose,
  calendarId,
  calendarName,
  clinicServiceId,
  periods,
  onSaved,
}: QuickPlanDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const today = pragueDateKey(new Date());

  const [scope, setScope] = useState<PlanScope>('month');
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [weekdays, setWeekdays] = useState<number[]>(WORKDAYS);
  /* The working day starts and ends as the clinic's calendar settings say; typing overrides it. */
  const { settings: display } = useCalendarDisplay();
  const [startEdited, setStart] = useState<string | null>(null);
  const [endEdited, setEnd] = useState<string | null>(null);
  const start = startEdited ?? hourToTime(display.dayStartHour);
  const end = endEdited ?? hourToTime(display.dayEndHour);
  const [breakStart, setBreakStart] = useState('');
  const [breakEnd, setBreakEnd] = useState('');
  /** null = every činnost, until somebody unticks one. */
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [dayWorks, setDayWorks] = useState(true);
  const [reason, setReason] = useState('');
  /** What the person has agreed to, keyed by the situation they agreed to. */
  const [agreed, setAgreed] = useState<Record<'conflict' | 'outside' | 'exception', string | null>>({
    conflict: null,
    outside: null,
    exception: null,
  });

  const range = scopeRange({ scope, date, month, from: customFrom, to: customTo });

  const activitiesQuery = useQuery({
    queryKey: ['activities'],
    queryFn: activitiesApi.list,
    staleTime: 5 * 60 * 1000,
  });
  const activities = useMemo(
    () =>
      (activitiesQuery.data?.activities ?? [])
        .filter((a) => a.isActive && clinicServiceId !== null && a.clinicServiceId === clinicServiceId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [activitiesQuery.data, clinicServiceId],
  );
  const activityIds = chosen ?? activities.map((a) => a.id);

  const draft: PlanDraft | null = range
    ? {
        range,
        weekdays,
        start,
        end,
        breakStart: breakStart || null,
        breakEnd: breakEnd || null,
        activityIds,
      }
    : null;
  const day: DayDraft = { date, works: dayWorks, start, end, reason };

  const conflicts = range && scope !== 'day' ? findConflicts(periods, range) : [];
  const periodsKey = periods.map((p) => `${p.id}:${p.validFrom}:${p.validTo ?? ''}`).join('|');

  /*
   * Everything that has to be known before saving, asked once per range: who
   * is booked in it, what the cut periods look like and the impact report's
   * token for each cut.
   */
  const analysisQuery = useQuery({
    queryKey: ['quick-plan', calendarId, scope, range?.from ?? '', range?.to ?? '', periodsKey],
    enabled: range !== null,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Analysis> => {
      const window = range!;
      const appointments = (
        await Promise.all(
          chunkRange(window).map((chunk) => appointmentsApi.range(chunk.from, chunk.to, [calendarId])),
        )
      ).flat();

      if (scope === 'day') {
        const found = await workingHoursApi.listExceptions(calendarId, window.from, window.to);
        return {
          appointments,
          contexts: [],
          exception: found.find((e) => e.date === window.from) ?? null,
        };
      }

      const contexts = await Promise.all(
        findConflicts(periods, window).map(async (conflict): Promise<Covering> => {
          const { period, kind, head, tail } = conflict;
          // The report for exactly the cut that will be saved: the token is bound to it.
          const kept = kind === 'trimStart' ? tail : head;
          const impact = kept
            ? await workingHoursApi.periodImpact(calendarId, period.id, kept.from, kept.to)
            : null;
          const rows =
            kind === 'split' || kind === 'trimStart'
              ? await workingHoursApi.listWorkingHours(calendarId, period.id)
              : [];
          const grid =
            kind === 'split' ? (await workingHoursApi.listDayActivities(calendarId, period.id)).rows : [];

          return {
            conflict,
            rows,
            grid,
            token: impact?.token ?? null,
            impactCount: impact?.appointments.length ?? 0,
          };
        }),
      );

      return { appointments, contexts, exception: null };
    },
  });
  const analysis = analysisQuery.data;

  const problems = scope === 'day' ? dayProblems(day) : draft ? planProblems(draft) : [];
  /* Cheap, and it has to follow every field, so it is not memoised. */
  const outside = !analysis
    ? []
    : scope === 'day'
      ? appointmentsOutsideDay(analysis.appointments, day)
      : draft
        ? appointmentsOutsidePlan(analysis.appointments, draft)
        : [];

  const conflictKey = conflicts.map((c) => `${c.period.id}:${c.kind}`).join('|');
  const conflictAgreed = conflicts.length === 0 || agreed.conflict === `${range?.from}|${range?.to}|${conflictKey}`;
  const outsideKey = `${range?.from}|${range?.to}|${outside.length}`;
  const outsideAgreed = outside.length === 0 || agreed.outside === outsideKey;
  const exceptionKey = `${date}|${analysis?.exception?.id ?? ''}`;
  const exceptionAgreed = !analysis?.exception || agreed.exception === exceptionKey;

  const message =
    scope === 'day'
      ? `Výjimka pro ${formatRange({ from: date, to: date })} je uložena.`
      : range
        ? `Plán „${planName(range)}“ je uložen.`
        : '';

  const refresh = async () => {
    await Promise.all(
      ['periods', 'working-hours', 'day-activities', 'exceptions', 'quick-plan', 'cycle'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!analysis) return;
      if (scope === 'day') {
        if (analysis.exception) await workingHoursApi.deleteException(calendarId, analysis.exception.id);
        await workingHoursApi.createException(calendarId, dayException(day));
        return;
      }
      if (!draft) return;
      await runPlanOperations(workingHoursApi, calendarId, planOperations(draft, analysis.contexts));
    },
    onSuccess: async () => {
      await refresh();
      onSaved(message);
      onClose();
    },
    // Some steps may have gone through before one failed: show what is really stored.
    onError: () => void refresh(),
  });

  const canSave =
    range !== null &&
    problems.length === 0 &&
    analysisQuery.isSuccess &&
    conflictAgreed &&
    outsideAgreed &&
    exceptionAgreed &&
    !save.isPending;

  const toggleWeekday = (weekday: number) =>
    setWeekdays((current) =>
      current.includes(weekday) ? current.filter((d) => d !== weekday) : [...current, weekday],
    );

  const toggleActivity = (id: string) =>
    setChosen(activityIds.includes(id) ? activityIds.filter((x) => x !== id) : [...activityIds, id]);

  const allChosen = activities.length > 0 && activityIds.length === activities.length;
  const someChosen = activityIds.length > 0 && !allChosen;

  const weekRange = scope === 'week' ? range : null;

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>
        Rychlý plán
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 400, mt: 0.5 }}>
          Kalendář {calendarName}: otevírací doba i činnosti na den, týden, měsíc nebo vlastní období najednou.
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2 }}>
        <Stack spacing={3}>
          {/* ── 1. Kdy ── */}
          <Box>
            <SectionLabel>Na kdy plán platí</SectionLabel>
            <FilterChips<PlanScope>
              ariaLabel="Rozsah plánu"
              value={scope}
              onChange={setScope}
              options={[
                { key: 'day', label: 'Den' },
                { key: 'week', label: 'Týden' },
                { key: 'month', label: 'Měsíc' },
                { key: 'custom', label: 'Vlastní od–do' },
              ]}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2, alignItems: 'center' }}>
              {scope === 'day' || scope === 'week' ? (
                <TextField
                  type="date"
                  size="small"
                  label={scope === 'day' ? 'Datum' : 'Libovolný den v týdnu'}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              ) : null}
              {scope === 'month' ? (
                <TextField
                  type="month"
                  size="small"
                  label="Měsíc"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              ) : null}
              {scope === 'custom' ? (
                <>
                  <TextField
                    type="date"
                    size="small"
                    label="Od"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    type="date"
                    size="small"
                    label="Do"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    error={customTo < customFrom}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </>
              ) : null}
              {weekRange ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Týden {formatRange(weekRange)} (pondělí až neděle)
                </Typography>
              ) : null}
              {scope === 'custom' && customTo < customFrom ? (
                <Typography variant="body2" sx={{ color: 'error.main' }}>
                  Konec musí být stejný den nebo později než začátek.
                </Typography>
              ) : null}
            </Stack>
            {range && range.from < today ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                Plán sahá do minulosti (od {formatRange({ from: range.from, to: range.from })}). Změní se i
                dny, které už uplynuly.
              </Alert>
            ) : null}
          </Box>

          {scope === 'day' ? (
            <>
              <Alert severity="info">
                Jeden den se ukládá jako <strong>výjimka</strong>: mění jen otevírací dobu nebo den zavře.
                Činnosti a přestávka se pro jediný den nastavit nedají, platí ty {FROM_DAY[dayOfWeekOf(date)]}{' '}
                v základní pracovní době. Chcete-li pro jeden den jiné činnosti, zvolte „Vlastní od–do“ se
                stejným datem v obou polích.
              </Alert>
              <Box>
                <SectionLabel>Otevírací doba</SectionLabel>
                <FormControlLabel
                  control={<Switch checked={dayWorks} onChange={(e) => setDayWorks(e.target.checked)} />}
                  label={dayWorks ? 'V tento den se pracuje' : 'V tento den je zavřeno'}
                />
                <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                  <TextField
                    type="time"
                    size="small"
                    label="Od"
                    value={start}
                    disabled={!dayWorks}
                    onChange={(e) => setStart(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 140 }}
                  />
                  <TextField
                    type="time"
                    size="small"
                    label="Do"
                    value={end}
                    disabled={!dayWorks}
                    onChange={(e) => setEnd(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 140 }}
                  />
                  <TextField
                    size="small"
                    label="Důvod (nepovinné)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    sx={{ flex: 1 }}
                  />
                </Stack>
              </Box>
              {analysis?.exception ? (
                <Alert severity="warning">
                  Na {formatRange({ from: date, to: date })} už výjimka existuje (
                  {analysis.exception.isClosed
                    ? 'zavřeno'
                    : analysis.exception.startTime
                      ? `${analysis.exception.startTime.slice(0, 5)}–${analysis.exception.endTime?.slice(0, 5) ?? ''}`
                      : 'jiné nastavení'}
                  {analysis.exception.reason ? `, ${analysis.exception.reason}` : ''}). Uložením ji nahradíte.
                  <FormControlLabel
                    sx={{ display: 'flex', mt: 0.5 }}
                    control={
                      <Checkbox
                        checked={agreed.exception === exceptionKey}
                        onChange={(e) =>
                          setAgreed((a) => ({ ...a, exception: e.target.checked ? exceptionKey : null }))
                        }
                      />
                    }
                    label="Rozumím, stávající výjimku nahradit"
                  />
                </Alert>
              ) : null}
            </>
          ) : (
            <>
              {/* ── 2. Které dny ── */}
              <Box>
                <SectionLabel>Které dny v týdnu se pracuje</SectionLabel>
                <Box role="group" aria-label="Pracovní dny" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {WEEK_ORDER.map((weekday) => {
                    const on = weekdays.includes(weekday);
                    return (
                      <ButtonBase
                        key={weekday}
                        role="checkbox"
                        aria-checked={on}
                        aria-label={LONG_DAY[weekday]}
                        onClick={() => toggleWeekday(weekday)}
                        sx={{
                          borderRadius: 999,
                          minWidth: 52,
                          minHeight: 36,
                          px: 1.5,
                          fontSize: 13,
                          fontWeight: 600,
                          border: '1px solid',
                          borderColor: on ? 'primary.main' : 'divider',
                          bgcolor: on ? 'primary.main' : 'background.paper',
                          color: on ? 'primary.contrastText' : 'text.primary',
                          '&:hover': { bgcolor: on ? 'primary.dark' : 'action.hover' },
                        }}
                      >
                        {LONG_DAY[weekday].slice(0, 2)}
                      </ButtonBase>
                    );
                  })}
                </Box>
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.75 }}>
                  Ostatní dny budou v plánu zavřené.
                </Typography>
              </Box>

              {/* ── 3. Hodiny ── */}
              <Box>
                <SectionLabel>Otevírací doba</SectionLabel>
                <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', rowGap: 2 }}>
                  <TextField
                    type="time"
                    size="small"
                    label="Od"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 140 }}
                  />
                  <TextField
                    type="time"
                    size="small"
                    label="Do"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 140 }}
                  />
                  <TextField
                    type="time"
                    size="small"
                    label="Přestávka od"
                    value={breakStart}
                    onChange={(e) => setBreakStart(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 150 }}
                  />
                  <TextField
                    type="time"
                    size="small"
                    label="Přestávka do"
                    value={breakEnd}
                    onChange={(e) => setBreakEnd(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 150 }}
                  />
                </Stack>
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.75 }}>
                  Přestávka je nepovinná. Bez ní platí obědová přestávka kliniky z nastavení, pokud nějaká je.
                </Typography>
              </Box>

              {/* ── 4. Činnosti ── */}
              <Box>
                <SectionLabel>Které činnosti se dělají</SectionLabel>
                {activitiesQuery.isLoading ? (
                  <CircularProgress size={20} aria-label="Načítám činnosti" />
                ) : activitiesQuery.isError ? (
                  <Alert severity="error">{errorText(activitiesQuery.error, t)}</Alert>
                ) : activities.length === 0 ? (
                  <Alert severity="warning">
                    Tento kalendář nemá žádnou činnost, kterou by mohl nabízet. Činnosti se přiřazují službě
                    kalendáře v nastavení.
                  </Alert>
                ) : (
                  <>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={allChosen}
                          indeterminate={someChosen}
                          onChange={() => setChosen(allChosen ? [] : null)}
                        />
                      }
                      label={<strong>Všechny</strong>}
                    />
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                        columnGap: 2,
                      }}
                    >
                      {activities.map((activity) => (
                        <FormControlLabel
                          key={activity.id}
                          control={
                            <Checkbox
                              checked={activityIds.includes(activity.id)}
                              onChange={() => toggleActivity(activity.id)}
                            />
                          }
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                aria-hidden
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  bgcolor: activity.color,
                                  flexShrink: 0,
                                }}
                              />
                              <span>{activity.name}</span>
                              <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                                {activity.durationMinutes} min
                              </Typography>
                            </Box>
                          }
                        />
                      ))}
                    </Box>
                  </>
                )}
              </Box>

              {/* ── The existing period this meets ── */}
              {conflicts.length > 0 ? (
                <Alert severity="warning" data-testid="plan-conflicts">
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    V těchto dnech už platí jiná pracovní doba. Dvě období se v jednom kalendáři překrývat
                    nesmí, proto by se stávající změnilo:
                  </Typography>
                  <Stack spacing={0.5}>
                    {conflicts.map((conflict) => (
                      <Typography key={conflict.period.id} variant="body2">
                        {describeConflict(conflict)}
                      </Typography>
                    ))}
                  </Stack>
                  <FormControlLabel
                    sx={{ display: 'flex', mt: 0.5 }}
                    control={
                      <Checkbox
                        checked={conflictAgreed}
                        onChange={(e) =>
                          setAgreed((a) => ({
                            ...a,
                            conflict: e.target.checked ? `${range?.from}|${range?.to}|${conflictKey}` : null,
                          }))
                        }
                      />
                    }
                    label="Rozumím, stávající období upravit"
                  />
                </Alert>
              ) : null}
            </>
          )}

          {/* ── Preview and who is affected ── */}
          <SoftCard tone="soft" sx={{ p: 2 }}>
            <SectionLabel sx={{ mb: 0.5 }}>Náhled</SectionLabel>
            <Typography data-testid="plan-preview" sx={{ fontWeight: 600 }}>
              {scope === 'day'
                ? dayPreview(day)
                : draft
                  ? planPreview(draft)
                  : 'Doplňte data, na která má plán platit.'}
            </Typography>
          </SoftCard>

          {problems.map((problem) => (
            <Alert key={problem} severity="error">
              {problem}
            </Alert>
          ))}

          {range !== null ? (
            analysisQuery.isLoading ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <CircularProgress size={16} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Kontroluji rezervace v těchto dnech…
                </Typography>
              </Stack>
            ) : analysisQuery.isError ? (
              <Alert
                severity="error"
                action={
                  <Button color="inherit" size="small" onClick={() => void analysisQuery.refetch()}>
                    Zkusit znovu
                  </Button>
                }
              >
                Nepodařilo se ověřit rezervace: {errorText(analysisQuery.error, t)} Plán nejde uložit, dokud se
                to nepodaří.
              </Alert>
            ) : analysis ? (
              <ImpactNotice
                outside={outside}
                booked={analysis.appointments.length}
                impacted={analysis.contexts.reduce((sum, c) => sum + c.impactCount, 0)}
                agreed={outside.length === 0 || agreed.outside === outsideKey}
                onAgree={(value) => setAgreed((a) => ({ ...a, outside: value ? outsideKey : null }))}
              />
            ) : null
          ) : null}

          {save.error ? (
            <Alert severity="error">
              {errorText(save.error, t)} Něco z plánu se mohlo uložit - zkontrolujte pracovní dobu, nic se
              nevrací zpět samo.
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={save.isPending}>
          Zrušit
        </Button>
        <Button variant="contained" disabled={!canSave} onClick={() => save.mutate()}>
          {save.isPending ? 'Ukládám…' : 'Uložit plán'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ImpactNotice({
  outside,
  booked,
  impacted,
  agreed,
  onAgree,
}: {
  outside: DayAppointment[];
  booked: number;
  impacted: number;
  agreed: boolean;
  onAgree: (value: boolean) => void;
}) {
  if (outside.length === 0) {
    return (
      <Alert severity="success">
        {booked === 0
          ? 'V těchto dnech zatím nejsou žádné rezervace.'
          : `Všech ${booked} rezervací v těchto dnech do nového plánu zapadá.`}
      </Alert>
    );
  }

  const shown = outside.slice(0, 5);
  return (
    <Alert severity="warning" data-testid="plan-impact">
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {outside.length === 1
          ? '1 rezervace by byla mimo nový plán.'
          : `${outside.length} rezervací by bylo mimo nový plán.`}
      </Typography>
      <Typography variant="body2">
        Zůstanou v kalendáři a nikdo se neruší, ale v tomto čase už by se nový termín nedal objednat.
        {impacted > 0 ? ` Upravované období se týká ${impacted} rezervací celkem.` : ''}
      </Typography>
      <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
        {shown.map((a) => (
          <li key={a.id}>
            <Typography variant="body2">{formatPragueDateTime(a.startUtc)}</Typography>
          </li>
        ))}
        {outside.length > shown.length ? (
          <li>
            <Typography variant="body2">… a další ({outside.length - shown.length})</Typography>
          </li>
        ) : null}
      </Box>
      <FormControlLabel
        sx={{ display: 'flex', mt: 0.5 }}
        control={<Checkbox checked={agreed} onChange={(e) => onAgree(e.target.checked)} />}
        label="Beru na vědomí, tyto rezervace zůstanou mimo plán"
      />
    </Alert>
  );
}

export default QuickPlanDialog;
