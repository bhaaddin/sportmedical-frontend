import { useState } from 'react';
import { Box, Typography, Card, CardContent, Autocomplete, TextField } from '@mui/material';
import { Schedule as ScheduleIcon } from '@mui/icons-material';
import { WorkingHoursEditor } from '../components/WorkingHoursEditor';

const MOCK_CALENDARS = [
  { id: 'calendar-default', name: 'Hlavní kalendář' },
  { id: 'calendar-spiro', name: 'Spiroergometrie' },
  { id: 'calendar-usg', name: 'Ultrazvuk' },
];

export default function WorkingHoursPage() {
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('calendar-default');

  return (
    <Box maxWidth="lg" mx="auto">
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <ScheduleIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Pracovní doba</Typography>
          <Typography variant="body2" color="text.secondary">
            Nastavení pracovní doby a parity týdnů
          </Typography>
        </Box>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Autocomplete
            options={MOCK_CALENDARS}
            getOptionLabel={(option) => option.name}
            value={MOCK_CALENDARS.find((c) => c.id === selectedCalendarId) || null}
            onChange={(_, newValue) => setSelectedCalendarId(newValue?.id || 'calendar-default')}
            renderInput={(params) => (
              <TextField {...params} label="Kalendář" />
            )}
            fullWidth
          />
        </CardContent>
      </Card>

      <WorkingHoursEditor calendarId={selectedCalendarId} />
    </Box>
  );
}
