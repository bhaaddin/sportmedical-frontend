import {
  Alert,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { Button } from '@mui/material';
import {
  currentServices,
  dayLine,
  workerScheduleApi,
} from '../../api/workerSchedule';
import type { WhereSomebodyWorksEntry } from '../../api/workerSchedule';

/**
 * Which services this person works, and on what days.
 *
 * ── Read-only, and that is the point ──
 *
 * The owner's list asks to "přiřadit služby" to an employee. That assignment
 * IS the rota: a worker is named on a day of a calendar's working hours, and
 * a calendar belongs to one service. This shows the answer from the person's
 * side — which otherwise meant opening every calendar in turn — and sends
 * anybody who wants to change it to the screen where the rota is.
 *
 * Editing from here would be a second door onto one fact, and the two would
 * drift. The rota is the door, because the rota is what availability is
 * computed from.
 */
export function WhereSomebodyWorksDialog({
  userId,
  userName,
  onClose,
}: {
  userId: string | null;
  userName: string;
  onClose: () => void;
}) {
  const schedule = useQuery({
    queryKey: ['worker-schedule', userId],
    queryFn: () => workerScheduleApi.forUser(userId!),
    enabled: userId !== null,
  });

  const entries = schedule.data ?? [];
  const services = currentServices(entries);

  return (
    <Dialog open={userId !== null} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Kde pracuje {userName}</DialogTitle>
      <DialogContent>
        {schedule.isLoading && (
          <Stack sx={{ alignItems: 'center', py: 4 }}>
            <CircularProgress />
          </Stack>
        )}

        {schedule.isError && (
          <Alert severity="error">Rozvrh se nepodařilo načíst.</Alert>
        )}

        {schedule.isSuccess && entries.length === 0 && (
          <Alert severity="info">
            Tento člověk zatím není rozepsaný na žádný den. Služby se přidělují tak, že ho
            zapíšete do pracovní doby kalendáře té služby — jiný seznam k tomu není.
          </Alert>
        )}

        {schedule.isSuccess && entries.length > 0 && (
          <>
            {services.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
                  Nyní dělá:
                </Typography>
                {services.map((service) => (
                  <Chip key={service} size="small" color="primary" label={service} />
                ))}
              </Stack>
            )}

            <Stack divider={<Divider flexItem />} spacing={1.5}>
              {entries.map((entry) => (
                <Entry key={`${entry.calendarId}-${entry.schedulePeriodId}`} entry={entry} />
              ))}
            </Stack>
          </>
        )}
      </DialogContent>
      <Stack direction="row" spacing={1} sx={{ p: 2, justifyContent: 'flex-end' }}>
        <Button component={RouterLink} to="/working-hours" onClick={onClose}>
          Upravit pracovní dobu
        </Button>
        <Button variant="contained" onClick={onClose}>
          Zavřít
        </Button>
      </Stack>
    </Dialog>
  );
}

function Entry({ entry }: { entry: WhereSomebodyWorksEntry }) {
  return (
    <Stack spacing={0.5} sx={{ opacity: entry.isCurrent ? 1 : 0.65 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: entry.calendarColour,
            display: 'inline-block',
          }}
        />
        <Typography sx={{ fontWeight: 600 }}>{entry.clinicServiceName}</Typography>
        <Typography variant="body2" color="text.secondary">
          {entry.calendarName}
        </Typography>
        {/*
          A period that has ended is shown, not hidden: "nepracuje tu už" and
          "nikdy tu nepracoval" are different answers, and somebody asking why
          an old appointment carries his name needs the first one.
        */}
        {!entry.isCurrent && <Chip size="small" variant="outlined" label="už neplatí" />}
      </Stack>

      <Typography variant="caption" color="text.secondary">
        {entry.schedulePeriodName} · od {czechDate(entry.validFrom)}
        {entry.validTo !== null ? ` do ${czechDate(entry.validTo)}` : ''}
      </Typography>

      <Stack component="ul" sx={{ m: 0, pl: 2.5 }}>
        {entry.days.map((day, index) => (
          <Typography
            component="li"
            variant="body2"
            key={`${day.dayOfWeek}-${day.startTime}-${index}`}
          >
            {dayLine(day)}
          </Typography>
        ))}
      </Stack>
    </Stack>
  );
}

const czechDate = (iso: string): string => {
  const [year, month, day] = iso.split('-').map(Number);

  return new Date(year, month - 1, day).toLocaleDateString('cs-CZ');
};
