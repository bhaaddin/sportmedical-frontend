import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Box,
  Chip,
  Switch,
  FormControlLabel,
  Divider,
  CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import {
  useWorkingHours,
  useCreateWorkingHour,
  useDeleteWorkingHour,
  WeekParity,
  WorkingHour,
} from '../services/workingHoursApi';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Neděle' },
  { value: 1, label: 'Pondělí' },
  { value: 2, label: 'Úterý' },
  { value: 3, label: 'Středa' },
  { value: 4, label: 'Čtvrtek' },
  { value: 5, label: 'Pátek' },
  { value: 6, label: 'Sobota' },
];

interface WorkingHoursEditorProps {
  calendarId: string;
}

export const WorkingHoursEditor: React.FC<WorkingHoursEditorProps> = ({ calendarId }) => {
  const { data: workingHours = [], isLoading } = useWorkingHours(calendarId);
  const createMutation = useCreateWorkingHour(calendarId);
  const deleteMutation = useDeleteWorkingHour(calendarId);

  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [weekParity, setWeekParity] = useState<WeekParity>(WeekParity.All);
  const [breakStart, setBreakStart] = useState('12:00');
  const [breakEnd, setBreakEnd] = useState('13:00');
  const [useBreak, setUseBreak] = useState(true);

  const getParityLabel = (parity: WeekParity) => {
    switch (parity) {
      case WeekParity.Odd: return 'Lichý týden';
      case WeekParity.Even: return 'Sudý týden';
      default: return 'Všechny týdny';
    }
  };

  const getParityColor = (parity: WeekParity): 'primary' | 'secondary' | 'default' => {
    switch (parity) {
      case WeekParity.Odd: return 'primary';
      case WeekParity.Even: return 'secondary';
      default: return 'default';
    }
  };

  const handleAdd = async () => {
    if (!startTime || !endTime) {
      toast.error('Vyplňte začátek a konec pracovní doby');
      return;
    }

    try {
      await createMutation.mutateAsync({
        dayOfWeek: selectedDay,
        startTime,
        endTime,
        weekParity,
        breakStart: useBreak ? breakStart : undefined,
        breakEnd: useBreak ? breakEnd : undefined,
      });
      
      toast.success('Pracovní doba přidána');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Chyba při přidávání');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Pracovní doba smazána');
    } catch (error) {
      toast.error('Chyba při mazání');
    }
  };

  const groupedByDay = workingHours.reduce((acc, wh) => {
    if (!acc[wh.dayOfWeek]) acc[wh.dayOfWeek] = [];
    acc[wh.dayOfWeek].push(wh);
    return acc;
  }, {} as Record<number, WorkingHour[]>);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Pracovní doba
        </Typography>

        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Den</InputLabel>
                <Select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(Number(e.target.value))}
                  label="Den"
                >
                  {DAYS_OF_WEEK.map((day) => (
                    <MenuItem key={day.value} value={day.value}>
                      {day.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 6, md: 2 }}>
              <TextField
                fullWidth
                size="small"
                label="Začátek"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid size={{ xs: 6, md: 2 }}>
              <TextField
                fullWidth
                size="small"
                label="Konec"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Týden</InputLabel>
                <Select
                  value={weekParity}
                  onChange={(e) => setWeekParity(Number(e.target.value) as WeekParity)}
                  label="Týden"
                >
                  <MenuItem value={WeekParity.All}>Všechny</MenuItem>
                  <MenuItem value={WeekParity.Odd}>Lichý</MenuItem>
                  <MenuItem value={WeekParity.Even}>Sudý</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={useBreak}
                    onChange={(e) => setUseBreak(e.target.checked)}
                    size="small"
                  />
                }
                label="Pauza"
              />
            </Grid>

            {useBreak && (
              <>
                <Grid size={{ xs: 6, md: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Od"
                    type="time"
                    value={breakStart}
                    onChange={(e) => setBreakStart(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Do"
                    type="time"
                    value={breakEnd}
                    onChange={(e) => setBreakEnd(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </>
            )}

            <Grid size={{ xs: 12 }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAdd}
                disabled={createMutation.isPending}
                size="small"
              >
                {createMutation.isPending ? 'Přidávám...' : 'Přidat'}
              </Button>
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ my: 2 }} />

        {DAYS_OF_WEEK.map((day) => (
          <Box key={day.value} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {day.label}
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {(groupedByDay[day.value] || []).map((wh) => (
                <Chip
                  key={wh.id}
                  label={`${wh.startTime} - ${wh.endTime}${wh.breakStart ? ` (pauza ${wh.breakStart}-${wh.breakEnd})` : ''} [${getParityLabel(wh.weekParity)}]`}
                  onDelete={() => handleDelete(wh.id)}
                  color={wh.isActive ? getParityColor(wh.weekParity) : 'default'}
                  variant={wh.isActive ? 'filled' : 'outlined'}
                  size="small"
                  disabled={!wh.isActive}
                />
              ))}
              {(!groupedByDay[day.value] || groupedByDay[day.value].length === 0) && (
                <Typography variant="body2" color="text.secondary">
                  Volno
                </Typography>
              )}
            </Box>
          </Box>
        ))}
      </CardContent>
    </Card>
  );
};
