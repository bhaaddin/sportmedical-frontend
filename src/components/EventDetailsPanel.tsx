/* ══════════════════════════════════════════════════════════════
   EVENT DETAILS PANEL — PLAN-01 Feature B141-B150
   - Show appointment details
   - Edit/confirm/cancel actions
   - Patient info display
   ══════════════════════════════════════════════════════════════ */
import { Box, Typography, Paper, Chip, Button, Divider, List, ListItem,
  ListItemIcon, ListItemText, IconButton, Avatar } from '@mui/material';
import {
  Edit as EditIcon, Delete as DeleteIcon, Check as CheckIcon,
  Close as CloseIcon, Person as PersonIcon, AccessTime as TimeIcon,
  LocalHospital as ServiceIcon, Email as EmailIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';

interface CalendarEvent {
  id: string;
  patientName: string;
  serviceType: string;
  start: string;
  duration: number;
  status: string;
  provider: string;
  notes?: string;
}

interface Props {
  event: CalendarEvent;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onCancel: (id: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Naplánovaný', confirmed: 'Potvrzený', 'in-progress': 'Probíhá',
  completed: 'Dokončený', cancelled: 'Zrušený',
};

export default function EventDetailsPanel({ event, onClose, onEdit, onCancel }: Props) {
  const startDate = parseISO(event.start);
  const endDate = new Date(startDate.getTime() + event.duration * 60 * 1000);

  return (
    <Paper sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Typography variant="h6">Detail termínu</Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </Box>

      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Avatar sx={{ bgcolor: '#0D7377', width: 56, height: 56 }}>
          <PersonIcon />
        </Avatar>
        <Box>
          <Typography variant="h6">{event.patientName}</Typography>
          <Chip label={STATUS_LABELS[event.status] || event.status} size="small" />
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      <List dense>
        <ListItem>
          <ListItemIcon><ServiceIcon /></ListItemIcon>
          <ListItemText primary="Služba" secondary={event.serviceType} />
        </ListItem>
        <ListItem>
          <ListItemIcon><TimeIcon /></ListItemIcon>
          <ListItemText primary="Termín"
            secondary={`${format(startDate, 'EEEE d. MMMM yyyy HH:mm', { locale: cs })} - ${format(endDate, 'HH:mm')}`} />
        </ListItem>
        <ListItem>
          <ListItemIcon><PersonIcon /></ListItemIcon>
          <ListItemText primary="Lékař" secondary={event.provider} />
        </ListItem>
      </List>

      <Divider sx={{ my: 2 }} />

      <Box display="flex" gap={1} flexWrap="wrap">
        <Button variant="contained" startIcon={<EditIcon />} onClick={() => onEdit(event)}
          sx={{ bgcolor: '#0D7377', '&:hover': { bgcolor: '#095456' } }}>
          Upravit
        </Button>
        <Button variant="outlined" color="error" startIcon={<DeleteIcon />}
          onClick={() => onCancel(event.id)}>
          Zrušit
        </Button>
      </Box>
    </Paper>
  );
}
