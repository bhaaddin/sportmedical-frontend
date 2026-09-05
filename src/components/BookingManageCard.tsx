import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  CircularProgress,
  TextField,
  Stack,
  Paper,
} from '@mui/material';
import {
  Cancel as CancelIcon,
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import {
  useBookingDetails,
  useCancelBooking,
  useRescheduleBooking,
  selfServiceBookingApi,
  TimeSlot,
} from '../services/selfServiceBookingApi';

interface BookingManageCardProps {
  token: string;
}

export const BookingManageCard: React.FC<BookingManageCardProps> = ({ token }) => {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data: booking, isLoading, error } = useBookingDetails(token);
  const cancelMutation = useCancelBooking(token);
  const rescheduleMutation = useRescheduleBooking(token);

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(cancelReason || undefined);
      setSuccessMessage('Rezervace byla úspěšně zrušena');
      setCancelDialogOpen(false);
      toast.success('Rezervace zrušena');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Chyba při rušení rezervace');
    }
  };

  const handleReschedule = async () => {
    if (!selectedSlot) {
      toast.error('Vyberte nový termín');
      return;
    }

    try {
      await rescheduleMutation.mutateAsync(selectedSlot);
      setSuccessMessage('Rezervace byla úspěšně přesunuta');
      setRescheduleDialogOpen(false);
      toast.success('Rezervace přesunuta');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Chyba při přesouvání rezervace');
    }
  };

  const fetchAvailableSlots = async () => {
    setLoadingSlots(true);
    try {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 14);

      const slots = await selfServiceBookingApi.getAvailableSlots(
        token,
        start.toISOString(),
        end.toISOString()
      );
      setAvailableSlots(slots);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Chyba při načítání termínů');
    } finally {
      setLoadingSlots(false);
    }
  };

  if (successMessage) {
    return (
      <Card>
        <CardContent>
          <Box textAlign="center">
            <CheckCircleIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Úspěšně dokončeno
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {successMessage}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !booking) {
    return (
      <Card>
        <CardContent>
          <Box textAlign="center">
            <ErrorIcon color="error" sx={{ fontSize: 64, mb: 2 }} />
            <Typography variant="h5" gutterBottom color="error">
              Neplatný odkaz
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Tento odkaz je neplatný nebo vypršel.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent>
          <Typography variant="h4" gutterBottom align="center">
            Správa rezervace
          </Typography>

          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {booking.serviceName}
            </Typography>
            
            <Stack spacing={2}>
              <Box display="flex" alignItems="center" gap={1}>
                <CalendarIcon color="primary" />
                <Typography>
                  Datum: {new Date(booking.date).toLocaleDateString('cs-CZ', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Typography>
              </Box>
              
              <Box display="flex" alignItems="center" gap={1}>
                <TimeIcon color="primary" />
                <Typography>Čas: {booking.time}</Typography>
              </Box>
              
              <Box display="flex" alignItems="center" gap={1}>
                <ScheduleIcon color="primary" />
                <Typography>Status: </Typography>
                <Chip label={booking.status} color="primary" size="small" />
              </Box>
            </Stack>
          </Paper>

          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Platnost odkazu: {new Date(booking.expiresAt).toLocaleString('cs-CZ')}
            </Typography>
          </Alert>

          <Box display="flex" gap={2} justifyContent="center">
            {booking.canCancel && (
              <Button
                variant="contained"
                color="error"
                startIcon={<CancelIcon />}
                onClick={() => setCancelDialogOpen(true)}
              >
                Zrušit rezervaci
              </Button>
            )}
            
            {booking.canReschedule && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<CalendarIcon />}
                onClick={() => {
                  fetchAvailableSlots();
                  setRescheduleDialogOpen(true);
                }}
              >
                Přesunout rezervaci
              </Button>
            )}
          </Box>

          {(!booking.canCancel && !booking.canReschedule) && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Tato rezervace již nemůže být upravena. Kontaktujte prosím recepci.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Zrušit rezervaci</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Opravdu chcete zrušit tuto rezervaci?
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Důvod zrušení (nepovinné)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>Zpět</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleCancel}
            disabled={cancelMutation.isPending}
            startIcon={cancelMutation.isPending && <CircularProgress size={16} />}
          >
            {cancelMutation.isPending ? 'Rušení...' : 'Zrušit rezervaci'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onClose={() => setRescheduleDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Přesunout rezervaci</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Vyberte nový termín:
          </Typography>
          
          {loadingSlots ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : availableSlots.length === 0 ? (
            <Alert severity="info">
              Žádné volné termíny nejsou k dispozici
            </Alert>
          ) : (
            <List>
              {availableSlots.map((slot) => (
                <ListItemButton
                  key={slot.id}
                  selected={selectedSlot === slot.id}
                  onClick={() => setSelectedSlot(slot.id)}
                  sx={{ mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                >
                  <ListItemText
                    primary={new Date(slot.startAt).toLocaleDateString('cs-CZ', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                    secondary={`${new Date(slot.startAt).toLocaleTimeString('cs-CZ', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })} - ${new Date(slot.endAt).toLocaleTimeString('cs-CZ', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`}
                  />
                  {selectedSlot === slot.id && (
                    <CheckCircleIcon color="primary" />
                  )}
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRescheduleDialogOpen(false)}>Zpět</Button>
          <Button
            variant="contained"
            onClick={handleReschedule}
            disabled={!selectedSlot || rescheduleMutation.isPending}
            startIcon={rescheduleMutation.isPending && <CircularProgress size={16} />}
          >
            {rescheduleMutation.isPending ? 'Přesouvání...' : 'Přesunout rezervaci'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};