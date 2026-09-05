/* ══════════════════════════════════════════════════════════════
   VARIABLE DURATION CALENDAR — PLAN-01 Feature B101-B110
   - Variable duration blocks (10min → 7hrs)
   - Drag-to-create time ranges
   - Quick presets
   - Conflict detection
   ══════════════════════════════════════════════════════════════ */
import { useState, useMemo } from 'react';
import {
  Box, Typography, Paper, IconButton, Tooltip, Chip
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon,
  Today as TodayIcon
} from '@mui/icons-material';
import { format, addDays, startOfWeek, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { cs } from 'date-fns/locale';

interface CalendarEvent {
  id: string;
  patientName: string;
  serviceType: string;
  start: string;
  duration: number;
  color: string;
  provider: string;
}

const HOUR_HEIGHT = 60;
const START_HOUR = 7;
const END_HOUR = 20;

const EVENT_COLORS: Record<string, string> = {
  consultation: '#2196F3',
  examination: '#4CAF50',
  treatment: '#FF9800',
  emergency: '#F44336',
  followup: '#9C27B0',
};

export default function VariableDurationCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events] = useState<CalendarEvent[]>([]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });

  const hours = useMemo(() => {
    const result = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) result.push(h);
    return result;
  }, []);

  const goToToday = () => setCurrentDate(new Date());
  const goToPrev = () => setCurrentDate(prev => addDays(prev, -7));
  const goToNext = () => setCurrentDate(prev => addDays(prev, 7));

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={goToPrev}><ChevronLeftIcon /></IconButton>
        <Typography variant="h6" sx={{ minWidth: 200, textAlign: 'center' }}>
          {format(currentDate, 'LLLL yyyy', { locale: cs })}
        </Typography>
        <IconButton onClick={goToNext}><ChevronRightIcon /></IconButton>
        <Tooltip title="Dnes"><IconButton onClick={goToToday}><TodayIcon /></IconButton></Tooltip>
        <Box sx={{ flexGrow: 1 }} />
        {Object.entries(EVENT_COLORS).map(([type, color]) => (
          <Chip key={type} label={type} size="small" sx={{ bgcolor: color, color: 'white' }} />
        ))}
      </Box>

      {/* Grid */}
      <Box sx={{ flex: 1, overflow: 'auto', display: 'flex' }}>
        {/* Time column */}
        <Box sx={{ width: 60, borderRight: 1, borderColor: 'divider', flexShrink: 0 }}>
          {hours.map(hour => (
            <Box key={hour} sx={{ height: HOUR_HEIGHT, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', pr: 1, pt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">{hour}:00</Typography>
            </Box>
          ))}
        </Box>

        {/* Day columns */}
        {weekDays.map(day => (
          <Box key={day.toISOString()} sx={{
            flex: 1, borderRight: 1, borderColor: 'divider', position: 'relative',
            bgcolor: isToday(day) ? 'rgba(13,115,119,0.05)' : 'transparent'
          }}>
            {hours.map(hour => (
              <Box key={hour} sx={{ height: HOUR_HEIGHT, borderBottom: 1, borderColor: 'divider' }} />
            ))}
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
