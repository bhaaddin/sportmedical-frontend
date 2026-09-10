/* ══════════════════════════════════════════════════════════════
   RECURRING APPOINTMENT DIALOG — PLAN-01 Feature B121-B130
   - Daily/weekly/biweekly/monthly patterns
   - End date or count limit
   - Day-of-week selection
   ══════════════════════════════════════════════════════════════ */
import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  FormControl, InputLabel, Select, MenuItem, TextField, Grid,
  FormGroup, FormControlLabel, Checkbox, FormLabel, Box, Typography
} from '@mui/material';
import { addMonths, format } from 'date-fns';

interface RecurringPattern {
  type: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
  endDate: string;
  daysOfWeek: number[];
  count: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (pattern: RecurringPattern) => void;
  appointmentDate: Date;
}

const DAY_NAMES = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

export default function RecurringAppointmentDialog({ open, onClose, onSave, appointmentDate }: Props) {
  const [pattern, setPattern] = useState<RecurringPattern>({
    type: 'none',
    endDate: format(addMonths(appointmentDate, 3), 'yyyy-MM-dd'),
    daysOfWeek: [appointmentDate.getDay()],
    count: 12,
  });

  const handleSave = () => { onSave(pattern); onClose(); };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Opakující se termín</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Typ opakování</InputLabel>
            <Select value={pattern.type} onChange={(e) => setPattern({ ...pattern, type: e.target.value as any })} label="Typ opakování">
              <MenuItem value="none">Žádné opakování</MenuItem>
              <MenuItem value="daily">Denně</MenuItem>
              <MenuItem value="weekly">Týdně</MenuItem>
              <MenuItem value="biweekly">Dvoutýdně</MenuItem>
              <MenuItem value="monthly">Měsíčně</MenuItem>
            </Select>
          </FormControl>

          {pattern.type !== 'none' && (
            <>
              {pattern.type === 'weekly' && (
                <Box sx={{ mb: 3 }}>
                  <FormLabel component="legend">Dny v týdnu</FormLabel>
                  <FormGroup row>
                    {DAY_NAMES.map((day, i) => (
                      <FormControlLabel key={i} control={
                        <Checkbox checked={pattern.daysOfWeek.includes(i)}
                          onChange={(e) => {
                            const newDays = e.target.checked
                              ? [...pattern.daysOfWeek, i]
                              : pattern.daysOfWeek.filter(d => d !== i);
                            setPattern({ ...pattern, daysOfWeek: newDays });
                          }} />
                      } label={day} />
                    ))}
                  </FormGroup>
                </Box>
              )}

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField fullWidth type="date" label="Koncové datum" value={pattern.endDate}
                    onChange={(e) => setPattern({ ...pattern, endDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField fullWidth type="number" label="Max počet" value={pattern.count}
                    onChange={(e) => setPattern({ ...pattern, count: parseInt(e.target.value) || 12 })} />
                </Grid>
              </Grid>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }}>Zrušit</Button>
        <Button onClick={handleSave} variant="contained"
          sx={{ bgcolor: '#0D7377', '&:hover': { bgcolor: '#095456' } }}>Uložit</Button>
      </DialogActions>
    </Dialog>
  );
}
