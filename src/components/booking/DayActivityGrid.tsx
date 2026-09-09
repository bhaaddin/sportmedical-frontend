import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Typography,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { activitiesApi } from '../../api/activities';
import { workingHoursApi } from '../../api/workingHours';
import { warningDays } from '../../api/bookingContracts';
import type { ActivityWarning, DayActivityRow } from '../../api/bookingContracts';
import { AsyncSection } from './AsyncSection';
import { errorText } from './errorText';
import { readableTextOn } from '../../utils/calendarPalette';

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
 */

/** Displayed Monday first, stored 0 = Sunday. */
const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0];

interface DayActivityGridProps {
  calendarId: string;
  periodId: string;
  /** Days that have working hours, so the screen can point out the empty ones. */
  workingDays: Set<number>;
}

export function DayActivityGrid({ calendarId, periodId, workingDays }: DayActivityGridProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  /** Null until something is ticked; the server's grid stands until then. */
  const [edited, setEdited] = useState<Map<number, Set<string>> | null>(null);
  /** Warnings the owner has clicked away this session. */
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

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

  const serverGrid = useMemo(() => {
    const map = new Map<number, Set<string>>();
    for (const row of gridQuery.data?.rows ?? []) {
      map.set(row.dayOfWeek, new Set(row.activityIds));
    }
    return map;
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

  const grid = edited ?? serverGrid;
  const activities = useMemo(
    () => [...(activitiesQuery.data?.activities ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [activitiesQuery.data],
  );

  const save = useMutation({
    mutationFn: () => {
      // A full replacement: every day is sent, including the empty ones (4.2).
      const body: DayActivityRow[] = WEEK_DAYS.map((dayOfWeek) => ({
        dayOfWeek,
        activityIds: Array.from(grid.get(dayOfWeek) ?? []),
      }));
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

  const toggle = (dayOfWeek: number, activityId: string) => {
    const next = new Map<number, Set<string>>();
    for (const [day, ids] of grid) next.set(day, new Set(ids));
    const forDay = next.get(dayOfWeek) ?? new Set<string>();
    if (forDay.has(activityId)) forDay.delete(activityId);
    else forDay.add(activityId);
    next.set(dayOfWeek, forDay);
    setEdited(next);
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        {t('booking.dayActivities.title')}
      </Typography>
      <Typography sx={{ color: 'text.secondary', mb: 2 }}>
        {t('booking.dayActivities.subtitle')}
      </Typography>

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
            <TableHead>
              <TableRow>
                <TableCell>{t('booking.workingHours.day')}</TableCell>
                {activities.map((activity) => (
                  <TableCell key={activity.id} align="center">
                    <Box
                      sx={{
                        display: 'inline-block',
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        backgroundColor: activity.color,
                        color: readableTextOn(activity.color),
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {activity.name}
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {WEEK_DAYS.map((dayOfWeek) => {
                const forDay = grid.get(dayOfWeek) ?? new Set<string>();
                const works = workingDays.has(dayOfWeek);
                // Unsaved state is the client's to mark; the saved state is the
                // server's, and it names the day in the warning context (3.1).
                const bookableNothing = works && forDay.size === 0;
                const flaggedByServer = edited === null && flaggedDays.has(dayOfWeek);
                return (
                  <TableRow key={dayOfWeek} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography sx={{ fontWeight: works ? 600 : 400 }}>
                          {t(`booking.workingHours.weekday.${dayOfWeek}`)}
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
                                day: t(`booking.workingHours.weekday.${dayOfWeek}`),
                                activity: activity.name,
                              }),
                            },
                          }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>

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
