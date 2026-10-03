import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Menu, MenuItem, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Tooltip, Typography,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { activitiesApi } from '../../api/activities';
import { workingHoursApi } from '../../api/workingHours';
import { warningDays } from '../../api/bookingContracts';
import type { ActivityWarning, DayActivityRow } from '../../api/bookingContracts';
import { AsyncSection } from './AsyncSection';
import { errorText } from './errorText';
import { offersNothingAtAll, offersNothingOn } from './dayActivityRule';

/**
 * Which activity is done on which day - contract screen 5.7.
 *
 * The grid belongs to the period, not to a working-hour row, because one day can
 * carry several rows (an even-week and an odd-week Monday) and the activities
 * would drift apart between them.
 *
 * A day with working hours but no activity offers nothing when booking. The
 * contract calls that the most common reason a calendar "looks broken", so the
 * screen says it in place rather than leaving it to be discovered.
 *
 * Quick ways to fill it (3. 10. 2026): a tri-state checkbox over every column
 * (one činnost on every working day), one in front of every row (every činnost
 * on that day) and "Kopírovat z jiného dne" on each row.
 */

/** Displayed Monday first, stored 0 = Sunday. */
const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0];

/** A window an activity is offered in; null = the whole working day. */
interface TimeWindow {
  from: string | null;
  to: string | null;
}

/** The ticks and the windows that go with them, as one unit so a copy keeps both. */
interface Draft {
  ids: Map<number, Set<string>>;
  windows: Map<number, Map<string, TimeWindow>>;
}

interface DayActivityGridProps {
  calendarId: string;
  periodId: string;
  /** Days that have working hours, so the screen can point out the empty ones. */
  workingDays: Set<number>;
  /**
   * The calendar's service. The server only offers the active activities of that
   * service, so the others are not shown: a tick on one would be dropped on save.
   * Left out, every activity is listed.
   */
  clinicServiceId?: string | null;
}

const cloneDraft = (draft: Draft): Draft => ({
  ids: new Map([...draft.ids].map(([day, ids]) => [day, new Set(ids)])),
  windows: new Map([...draft.windows].map(([day, w]) => [day, new Map(w)])),
});

export function DayActivityGrid({ calendarId, periodId, workingDays, clinicServiceId }: DayActivityGridProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  /** Null until something is ticked; the server's grid stands until then. */
  const [edited, setEdited] = useState<Draft | null>(null);
  /** Warnings the owner has clicked away this session. */
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  /** The row whose "Kopírovat z jiného dne" menu is open. */
  const [copyMenu, setCopyMenu] = useState<{ day: number; anchor: HTMLElement } | null>(null);

  const activitiesQuery = useQuery({
    queryKey: ['activities'],
    queryFn: activitiesApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const gridQuery = useQuery({
    queryKey: ['day-activities', calendarId, periodId],
    queryFn: () => workingHoursApi.listDayActivities(calendarId, periodId),
    enabled: calendarId !== '' && periodId !== '',
  });

  const serverDraft = useMemo<Draft>(() => {
    const ids = new Map<number, Set<string>>();
    const windows = new Map<number, Map<string, TimeWindow>>();
    for (const row of gridQuery.data?.rows ?? []) {
      ids.set(row.dayOfWeek, new Set(row.activityIds));
      const forDay = new Map<string, TimeWindow>();
      for (const slot of row.activities ?? []) {
        if (slot.from !== null || slot.to !== null) forDay.set(slot.activityId, { from: slot.from, to: slot.to });
      }
      windows.set(row.dayOfWeek, forDay);
    }
    return { ids, windows };
  }, [gridQuery.data]);

  /**
   * 3.1: the same shape comes back from the read and from the write, so the
   * problem day is visible when the screen opens rather than after a save.
   */
  const warnings: ActivityWarning[] = (gridQuery.data?.warnings ?? []).filter(
    (warning) => !dismissed.has(warning.code),
  );

  /** Days the server has flagged, so the row can say so without re-deriving it. */
  const flaggedDays = useMemo(
    () => new Set(warnings.flatMap((warning) => warningDays(warning))),
    [warnings],
  );

  const draft = edited ?? serverDraft;
  const grid = draft.ids;
  const activities = useMemo(
    () =>
      [...(activitiesQuery.data?.activities ?? [])]
        .filter((a) => clinicServiceId === undefined || (a.isActive && a.clinicServiceId === clinicServiceId))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [activitiesQuery.data, clinicServiceId],
  );

  /** A column acts on the days that work; a calendar with none yet, on every day. */
  const columnDays = useMemo(() => {
    const working = WEEK_DAYS.filter((day) => workingDays.has(day));
    return working.length > 0 ? working : WEEK_DAYS;
  }, [workingDays]);

  const save = useMutation({
    mutationFn: () => {
      // A full replacement: every day is sent, including the empty ones (4.2).
      const body: DayActivityRow[] = WEEK_DAYS.map((dayOfWeek) => {
        const activityIds = Array.from(draft.ids.get(dayOfWeek) ?? []);
        const windows = draft.windows.get(dayOfWeek);
        const row: DayActivityRow = { dayOfWeek, activityIds };
        // Windows are carried through, never widened to the whole day by a save.
        if (windows && activityIds.some((id) => windows.has(id))) {
          row.activities = activityIds.map((activityId) => ({
            activityId,
            from: windows.get(activityId)?.from ?? null,
            to: windows.get(activityId)?.to ?? null,
          }));
        }
        return row;
      });
      return workingHoursApi.saveDayActivities(calendarId, periodId, body);
    },
    onSuccess: async () => {
      // The refetched grid carries its own warnings; nothing to keep here.
      await queryClient.invalidateQueries({
        queryKey: ['day-activities', calendarId, periodId],
      });
      setDismissed(new Set());
      setEdited(null);
    },
  });

  /** Applies one change to a copy of the current draft. */
  const change = (apply: (next: Draft) => void) => {
    const next = cloneDraft(draft);
    apply(next);
    setEdited(next);
  };

  const setCell = (next: Draft, dayOfWeek: number, activityId: string, on: boolean) => {
    const ids = next.ids.get(dayOfWeek) ?? new Set<string>();
    if (on) ids.add(activityId);
    else {
      ids.delete(activityId);
      next.windows.get(dayOfWeek)?.delete(activityId);
    }
    next.ids.set(dayOfWeek, ids);
  };

  const toggle = (dayOfWeek: number, activityId: string) =>
    change((next) => setCell(next, dayOfWeek, activityId, !(grid.get(dayOfWeek)?.has(activityId) ?? false)));

  const columnState = (activityId: string) => {
    const on = columnDays.filter((day) => grid.get(day)?.has(activityId)).length;
    return { checked: on === columnDays.length, indeterminate: on > 0 && on < columnDays.length };
  };

  const toggleColumn = (activityId: string) => {
    const turnOn = !columnState(activityId).checked;
    change((next) => columnDays.forEach((day) => setCell(next, day, activityId, turnOn)));
  };

  const rowState = (dayOfWeek: number) => {
    const forDay = grid.get(dayOfWeek) ?? new Set<string>();
    const on = activities.filter((a) => forDay.has(a.id)).length;
    return {
      checked: activities.length > 0 && on === activities.length,
      indeterminate: on > 0 && on < activities.length,
    };
  };

  const toggleRow = (dayOfWeek: number) => {
    const turnOn = !rowState(dayOfWeek).checked;
    change((next) => activities.forEach((a) => setCell(next, dayOfWeek, a.id, turnOn)));
  };

  const copyDay = (from: number, to: number) =>
    change((next) => {
      next.ids.set(to, new Set(next.ids.get(from) ?? []));
      next.windows.set(to, new Map(next.windows.get(from) ?? []));
    });

  const dayName = (dayOfWeek: number) => t(`booking.workingHours.weekday.${dayOfWeek}`);

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        {t('booking.dayActivities.title')}
      </Typography>
      <Typography sx={{ color: 'text.secondary', mb: 2 }}>
        {t('booking.dayActivities.subtitle')}
      </Typography>

      {/*
        * Said once, loudly, because it is a different fact from "Tuesday is
        * empty": an untouched grid means this calendar cannot be booked at
        * all, on any day, and the booking screen gives no hint why.
        */}
      {offersNothingAtAll(grid, workingDays) ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('booking.dayActivities.nothingAnywhere')}
        </Alert>
      ) : null}

      {warnings.map((warning) => (
        <Alert
          key={warning.code}
          severity="warning"
          sx={{ mb: 2 }}
          onClose={() => setDismissed((prev) => new Set(prev).add(warning.code))}
        >
          {warning.message}
        </Alert>
      ))}

      <AsyncSection
        isLoading={activitiesQuery.isLoading || gridQuery.isLoading}
        isSettled={activitiesQuery.isSuccess && gridQuery.isSuccess}
        error={activitiesQuery.error ?? gridQuery.error}
        isEmpty={activities.length === 0}
        emptyText={t('booking.dayActivities.noActivities')}
        onRetry={() => {
          void activitiesQuery.refetch();
          void gridQuery.refetch();
        }}
        skeletonRows={4}
      >
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            {/* The board's plain header: white, normal case - not the filled uppercase of other tables. */}
            <TableHead
              sx={{
                '& .MuiTableCell-head': {
                  backgroundColor: 'background.paper',
                  color: 'text.primary',
                  textTransform: 'none',
                  letterSpacing: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  verticalAlign: 'bottom',
                },
              }}
            >
              <TableRow>
                <TableCell>{t('booking.workingHours.day')}</TableCell>
                {activities.map((activity) => {
                  const state = columnState(activity.id);
                  return (
                    <TableCell key={activity.id} align="center" sx={{ minWidth: 112 }}>
                      <Stack sx={{ alignItems: 'center' }}>
                        <Tooltip title="Vybrat celý sloupec">
                          <Checkbox
                            size="small"
                            checked={state.checked}
                            indeterminate={state.indeterminate}
                            onChange={() => toggleColumn(activity.id)}
                            slotProps={{ input: { 'aria-label': `Vybrat celý sloupec: ${activity.name}` } }}
                          />
                        </Tooltip>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', justifyContent: 'center' }}>
                          <Box
                            aria-hidden
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              flexShrink: 0,
                              backgroundColor: activity.color,
                            }}
                          />
                          <span>{activity.name}</span>
                        </Stack>
                      </Stack>
                    </TableCell>
                  );
                })}
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {WEEK_DAYS.map((dayOfWeek) => {
                const forDay = grid.get(dayOfWeek) ?? new Set<string>();
                const works = workingDays.has(dayOfWeek);
                const row = rowState(dayOfWeek);
                // Unsaved state is the client's to mark; the saved state is the
                // server's, and it names the day in the warning context (3.1).
                const bookableNothing = offersNothingOn(dayOfWeek, grid, workingDays);
                const flaggedByServer = edited === null && flaggedDays.has(dayOfWeek);
                return (
                  <TableRow key={dayOfWeek} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Tooltip title="Vybrat celý řádek">
                          <Checkbox
                            size="small"
                            checked={row.checked}
                            indeterminate={row.indeterminate}
                            onChange={() => toggleRow(dayOfWeek)}
                            slotProps={{ input: { 'aria-label': `Vybrat celý řádek: ${dayName(dayOfWeek)}` } }}
                            sx={{ ml: -1 }}
                          />
                        </Tooltip>
                        <Typography sx={{ fontWeight: works ? 600 : 400 }}>
                          {dayName(dayOfWeek)}
                        </Typography>
                        {bookableNothing || flaggedByServer ? (
                          <Stack
                            direction="row"
                            spacing={0.5}
                            sx={{ alignItems: 'center', color: 'warning.main' }}
                          >
                            <WarningAmberIcon fontSize="small" />
                            <Typography sx={{ fontSize: 12 }}>
                              {t('booking.dayActivities.offersNothing')}
                            </Typography>
                          </Stack>
                        ) : null}
                        {!works ? (
                          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                            {t('booking.dayActivities.notWorking')}
                          </Typography>
                        ) : null}
                      </Stack>
                    </TableCell>
                    {activities.map((activity) => (
                      <TableCell key={activity.id} align="center">
                        <Checkbox
                          checked={forDay.has(activity.id)}
                          onChange={() => toggle(dayOfWeek, activity.id)}
                          slotProps={{
                            input: {
                              'aria-label': t('booking.dayActivities.cellLabel', {
                                day: dayName(dayOfWeek),
                                activity: activity.name,
                              }),
                            },
                          }}
                        />
                      </TableCell>
                    ))}
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Button
                        size="small"
                        color="inherit"
                        startIcon={<ContentCopyOutlinedIcon fontSize="small" />}
                        aria-label={`Kopírovat z jiného dne: ${dayName(dayOfWeek)}`}
                        onClick={(e) => setCopyMenu({ day: dayOfWeek, anchor: e.currentTarget })}
                      >
                        Kopírovat z jiného dne
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>

        <Menu
          open={copyMenu !== null}
          anchorEl={copyMenu?.anchor}
          onClose={() => setCopyMenu(null)}
        >
          {copyMenu
            ? WEEK_DAYS.filter((day) => day !== copyMenu.day).map((day) => (
                <MenuItem
                  key={day}
                  onClick={() => {
                    copyDay(day, copyMenu.day);
                    setCopyMenu(null);
                  }}
                >
                  {dayName(day)}
                </MenuItem>
              ))
            : null}
        </Menu>

        {save.error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorText(save.error, t)}
          </Alert>
        ) : null}

        <Box sx={{ mt: 2 }}>
          <Button
            variant="contained"
            /* A full replacement must never go out from a grid that never
               loaded: that would erase every day. */
            disabled={edited === null || save.isPending || !gridQuery.isSuccess}
            onClick={() => save.mutate()}
          >
            {t('booking.common.save')}
          </Button>
        </Box>
      </AsyncSection>
    </Box>
  );
}

export default DayActivityGrid;
