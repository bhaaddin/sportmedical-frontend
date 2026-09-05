import { useState, useEffect } from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemText, ListItemSecondaryAction, Button, Chip, Alert, Snackbar } from '@mui/material';
import { format } from 'date-fns';

interface WaitlistEntry {
  id: string;
  patientName: string;
  patientEmail: string;
  serviceType: string;
  preferredDate: string;
  preferredTime: string;
  addedAt: string;
  status: 'waiting' | 'offered' | 'confirmed' | 'expired';
}

interface WaitlistManagerProps {
  serviceType?: string;
  onOfferAppointment: (entryId: string, slot: { date: string; time: string }) => void;
}

const statusColors: Record<string, 'warning' | 'info' | 'success' | 'default'> = {
  waiting: 'warning', offered: 'info', confirmed: 'success', expired: 'default',
};

const statusLabels: Record<string, string> = {
  waiting: 'Čeká', offered: 'Nabídnuto', confirmed: 'Potvrzeno', expired: 'Platnost vypršela',
};

export default function WaitlistManager({ serviceType, onOfferAppointment }: WaitlistManagerProps) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => { loadWaitlist(); }, [serviceType]);

  const loadWaitlist = async () => {
    try {
      const url = serviceType ? `/api/waitlist?serviceType=${serviceType}` : '/api/waitlist';
      const response = await fetch(url);
      if (response.ok) setEntries(await response.json());
    } catch (error) {
      console.error('Failed to load waitlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (entryId: string) => {
    try {
      const response = await fetch(`/api/waitlist/${entryId}`, { method: 'DELETE' });
      if (response.ok) {
        setEntries(prev => prev.filter(e => e.id !== entryId));
        setSnackbar({ open: true, message: 'Pacient odebrán ze čekací listiny', severity: 'success' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Chyba při odebírání', severity: 'error' });
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>Čekací listina</Typography>

      {entries.length === 0 ? (
        <Alert severity="info">Žádní pacienti v čekací listině</Alert>
      ) : (
        <List>
          {entries.map((entry) => (
            <ListItem key={entry.id} divider>
              <ListItemText
                primary={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Typography variant="subtitle1">{entry.patientName}</Typography><Chip label={statusLabels[entry.status]} size="small" color={statusColors[entry.status]} /></Box>}
                secondary={<><Typography component="span" variant="body2">{entry.serviceType} • Preferovaný termín: {entry.preferredDate} {entry.preferredTime}</Typography><br /><Typography component="span" variant="caption" color="text.secondary">Přidáno: {format(new Date(entry.addedAt), 'd. MMMM yyyy HH:mm')}</Typography></>}
              />
              <ListItemSecondaryAction>
                {entry.status === 'waiting' && (
                  <Button size="small" variant="outlined" onClick={() => onOfferAppointment(entry.id, { date: entry.preferredDate, time: entry.preferredTime })}>Nabídnout termín</Button>
                )}
                <Button size="small" color="error" onClick={() => handleRemove(entry.id)} sx={{ ml: 1 }}>Odebrat</Button>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Paper>
  );
}
