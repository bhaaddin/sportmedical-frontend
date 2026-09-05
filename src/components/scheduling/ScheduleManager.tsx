import { useState } from 'react';
import { Box, Typography, Paper, Grid, Button, TextField, Switch, FormControlLabel, Chip } from '@mui/material';
import { addDays, format } from 'date-fns';

interface WorkSchedule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isWorking: boolean;
  breakStart?: string;
  breakEnd?: string;
}

interface SpecialSchedule {
  date: string;
  startTime: string;
  endTime: string;
  isWorking: boolean;
  reason?: string;
}

interface ScheduleManagerProps {
  staffId: string;
  onSave: (schedule: WorkSchedule[], special: SpecialSchedule[]) => void;
}

const daysOfWeek = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];

export default function ScheduleManager({ staffId, onSave }: ScheduleManagerProps) {
  const [weeklySchedule, setWeeklySchedule] = useState<WorkSchedule[]>([
    { dayOfWeek: 1, startTime: '08:00', endTime: '18:00', isWorking: true, breakStart: '12:00', breakEnd: '13:00' },
    { dayOfWeek: 2, startTime: '08:00', endTime: '18:00', isWorking: true, breakStart: '12:00', breakEnd: '13:00' },
    { dayOfWeek: 3, startTime: '08:00', endTime: '18:00', isWorking: true, breakStart: '12:00', breakEnd: '13:00' },
    { dayOfWeek: 4, startTime: '08:00', endTime: '18:00', isWorking: true, breakStart: '12:00', breakEnd: '13:00' },
    { dayOfWeek: 5, startTime: '08:00', endTime: '16:00', isWorking: true, breakStart: '12:00', breakEnd: '13:00' },
    { dayOfWeek: 6, startTime: '09:00', endTime: '13:00', isWorking: false },
    { dayOfWeek: 0, startTime: '09:00', endTime: '13:00', isWorking: false },
  ]);

  const [specialDays, setSpecialDays] = useState<SpecialSchedule[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [specialStartTime, setSpecialStartTime] = useState('09:00');
  const [specialEndTime, setSpecialEndTime] = useState('17:00');
  const [specialReason, setSpecialReason] = useState('');

  const updateDaySchedule = (dayIndex: number, updates: Partial<WorkSchedule>) => {
    setWeeklySchedule(prev => prev.map((day, i) => i === dayIndex ? { ...day, ...updates } : day));
  };

  const addSpecialDay = () => {
    if (!selectedDate) return;
    setSpecialDays(prev => [...prev, { date: selectedDate, startTime: specialStartTime, endTime: specialEndTime, isWorking: true, reason: specialReason }]);
    setSelectedDate('');
    setSpecialReason('');
  };

  const removeSpecialDay = (date: string) => {
    setSpecialDays(prev => prev.filter(d => d.date !== date));
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>Pracovní rozvrh</Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Typography variant="subtitle1" gutterBottom>Týdenní rozvrh</Typography>
          {weeklySchedule.map((day, index) => (
            <Box key={day.dayOfWeek} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, p: 2, bgcolor: day.isWorking ? 'grey.50' : 'grey.100', borderRadius: 1 }}>
              <Box sx={{ width: 100 }}>
                <Typography variant="subtitle2">{daysOfWeek[day.dayOfWeek]}</Typography>
              </Box>
              <FormControlLabel control={<Switch checked={day.isWorking} onChange={(e) => updateDaySchedule(index, { isWorking: e.target.checked })} />} label="Pracovní den" />
              {day.isWorking && (
                <>
                  <TextField size="small" type="time" value={day.startTime} onChange={(e) => updateDaySchedule(index, { startTime: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ width: 120 }} />
                  <Typography>-</Typography>
                  <TextField size="small" type="time" value={day.endTime} onChange={(e) => updateDaySchedule(index, { endTime: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ width: 120 }} />
                  <Typography variant="body2" color="text.secondary">Přestávka:</Typography>
                  <TextField size="small" type="time" value={day.breakStart || ''} onChange={(e) => updateDaySchedule(index, { breakStart: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ width: 120 }} />
                  <Typography>-</Typography>
                  <TextField size="small" type="time" value={day.breakEnd || ''} onChange={(e) => updateDaySchedule(index, { breakEnd: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ width: 120 }} />
                </>
              )}
            </Box>
          ))}
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Typography variant="subtitle1" gutterBottom>Speciální dny</Typography>
          <Paper sx={{ p: 2, mb: 2 }}>
            <TextField fullWidth size="small" type="date" label="Datum" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ mb: 2 }} />
            <TextField fullWidth size="small" label="Důvod" value={specialReason} onChange={(e) => setSpecialReason(e.target.value)} sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField size="small" type="time" value={specialStartTime} onChange={(e) => setSpecialStartTime(e.target.value)} InputLabelProps={{ shrink: true }} />
              <TextField size="small" type="time" value={specialEndTime} onChange={(e) => setSpecialEndTime(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Box>
            <Button fullWidth variant="outlined" onClick={addSpecialDay} disabled={!selectedDate}>Přidat speciální den</Button>
          </Paper>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {specialDays.map((day) => (
              <Chip key={day.date} label={`${day.date}: ${day.startTime}-${day.endTime}${day.reason ? ` (${day.reason})` : ''}`} onDelete={() => removeSpecialDay(day.date)} />
            ))}
          </Box>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={() => onSave(weeklySchedule, specialDays)}>Uložit rozvrh</Button>
      </Box>
    </Paper>
  );
}
