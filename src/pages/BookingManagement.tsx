import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Card, CardContent, Button, TextField, Grid, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Switch, FormControlLabel,
  MenuItem, Tooltip, Skeleton,
} from '@mui/material';
import {
  CalendarMonth, Add, Edit, Delete, ContentCopy, Settings, EventAvailable,
  People, TrendingUp, Cancel, CheckCircle,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { publicBookingApi } from '../api/publicBooking';
import client from '../api/client';
import type { PublicBookingEventType, BookingAvailabilitySchedule } from '../api/publicBooking';

const DAY_NAMES = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
const COLORS = ['#0D7377', '#095456', '#2E7D32', '#0288D1', '#1565C0', '#ED6C02', '#9C27B0', '#FF5722'];

export default function BookingManagement() {
  const [tab, setTab] = useState(0);
  const [events, setEvents] = useState<PublicBookingEventType[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [schedules, setSchedules] = useState<BookingAvailabilitySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Partial<PublicBookingEventType> | null>(null);
  const [staffNames, setStaffNames] = useState<string[]>([]);

  const splitProviders = (p?: string) =>
    (p || '').split(',').map(s => s.trim()).filter(Boolean);
  const joinProviders = (list: string[]) => list.join(', ');

  const toggleEventDoctor = (name: string) => {
    const cur = splitProviders(editingEvent?.providerName);
    setEditingEvent(p => ({
      ...p,
      providerName: cur.includes(name) ? joinProviders(cur.filter(n => n !== name)) : joinProviders([...cur, name]),
    }));
  };

  useEffect(() => {
    client.get('/api/staff').then(r => {
      const d = r.data?.value ?? r.data?.data ?? r.data;
      const list = Array.isArray(d) ? d : d?.items ?? [];
      setStaffNames(list.map((m: any) => m.fullName).filter(Boolean));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [evts, bkngs, stts, schs] = await Promise.all([
        publicBookingApi.adminGetAll().catch(() => []),
        publicBookingApi.adminGetBookings().catch(() => []),
        publicBookingApi.adminGetStats().catch(() => ({})),
        publicBookingApi.getAvailabilitySchedules().catch(() => []),
      ]);
      setEvents(evts);
      setBookings(bkngs);
      setStats(stts);
      setSchedules(schs);
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    try {
      const result = await publicBookingApi.adminSeed();
      toast.success(result.message || 'Event types seeded!');
      loadData();
    } catch {
      toast.error('Failed to seed event types');
    }
  };

  const handleCancelBooking = async (id: string) => {
    if (!window.confirm('Opravdu zrušit tuto rezervaci? Uvolní se termín v kalendáři.')) return;
    try {
      await client.delete(`/api/public/booking/bookings/${id}?reason=${encodeURIComponent('Zrušeno recepcí')}`);
      toast.success('Rezervace zrušena');
      loadData();
    } catch {
      toast.error('Zrušení selhalo');
    }
  };

  const handleSaveEvent = async () => {
    if (!editingEvent?.name) return;
    try {
      if (editingEvent.id) {
        await fetch(`/api/booking/event-types/${editingEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify(editingEvent),
        });
        toast.success('Event type updated!');
      } else {
        await fetch('/api/booking/event-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify(editingEvent),
        });
        toast.success('Event type created!');
      }
      setDialogOpen(false);
      setEditingEvent(null);
      loadData();
    } catch {
      toast.error('Failed to save event type');
    }
  };

  const copyBookingLink = (slug: string) => {
    const url = `${window.location.origin}/book/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Booking link copied!');
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" height={40} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={400} />
      </Box>
    );
  }

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarMonth color="primary" /> Správa Rezervací
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Veřejný booking systém pro pacienty — sdílejte odkaz a nechte je rezervovat sami
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={handleSeed} sx={{ borderRadius: 2 }}>
              Seed služeb z ceníku
            </Button>
            <Button variant="contained" startIcon={<Add />} onClick={() => {
              setEditingEvent({ name: '', slug: '', description: '', durationMinutes: 30, priceCzk: 0, room: 'GreenLine 5.patro', providerName: '', color: '#0D7377', isActive: true });
              setDialogOpen(true);
            }} sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 3, fontWeight: 600 }}>
              Nová služba
            </Button>
          </Box>
        </Box>
      </motion.div>

      {/* Stats */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Celkem rezervací', value: stats.totalBookings, icon: <CalendarMonth />, color: '#0D7377' },
            { label: 'Tento týden', value: stats.thisWeek, icon: <TrendingUp />, color: '#2E7D32' },
            { label: 'Dnes', value: stats.today, icon: <EventAvailable />, color: '#0288D1' },
            { label: 'Aktivních služeb', value: stats.activeEventTypes, icon: <People />, color: '#9C27B0' },
          ].map((stat, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${stat.color}14`, color: stat.color }}>
                    {stat.icon}
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>{stat.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Tabs */}
      <Paper sx={{ borderRadius: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid #e0e0e0' }}>
          <Tab label="Služby (Event Types)" />
          <Tab label="Rezervace" />
          <Tab label="Dostupnost (Availability)" />
        </Tabs>

        {/* Tab 0: Event Types */}
        {tab === 0 && (
          <Box sx={{ p: 3 }}>
            {events.length === 0 ? (
              <Alert severity="info" action={<Button onClick={handleSeed}>Seed z ceníku</Button>}>
                Žádné typy služeb. Klikněte "Seed služeb z ceníku" pro vytvoření základních služeb.
              </Alert>
            ) : (
              <Grid container spacing={2}>
                {events.map(event => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={event.id}>
                    <Card sx={{ borderRadius: 3, borderLeft: `4px solid ${event.color}` }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>{event.name}</Typography>
                          <Box>
                            <IconButton size="small" onClick={() => copyBookingLink(event.slug)}>
                              <Tooltip title="Kopírovat odkaz">
                                <ContentCopy fontSize="small" />
                              </Tooltip>
                            </IconButton>
                            <IconButton size="small" onClick={() => { setEditingEvent(event); setDialogOpen(true); }}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {event.description}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip label={`${event.durationMinutes} min`} size="small" />
                          <Chip label={event.room} size="small" />
                          {event.priceCzk > 0 && <Chip label={`${event.priceCzk} CZK`} size="small" color="primary" />}
                          <Chip label={event.isActive ? 'Aktivní' : 'Neaktivní'} size="small" color={event.isActive ? 'success' : 'default'} />
                        </Box>
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', bgcolor: '#f5f5f5', p: 0.5, borderRadius: 1 }}>
                            /book/{event.slug}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        )}

        {/* Tab 1: Bookings */}
        {tab === 1 && (
          <Box sx={{ p: 3 }}>
            {bookings.length === 0 ? (
              <Alert severity="info">Žádné rezervace. Sdílejte odkaz /book/slug s pacienty.</Alert>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Pacient</TableCell>
                      <TableCell>Služba</TableCell>
                        <TableCell>Datum a čas</TableCell>
                        <TableCell>Místnost</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Vytvořeno</TableCell>
                        <TableCell align="right">Akce</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bookings.map((b: any) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{b.inviteeName}</Typography>
                          <Typography variant="caption" color="text.secondary">{b.inviteeEmail}</Typography>
                        </TableCell>
                        <TableCell>{b.eventName}</TableCell>
                        <TableCell>
                          {new Date(b.startUtc).toLocaleDateString('cs-CZ')} {new Date(b.startUtc).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell>{b.room}</TableCell>
                        <TableCell>
                          <Chip
                            icon={b.status === 'Confirmed' ? <CheckCircle /> : <Cancel />}
                            label={b.status}
                            size="small"
                            color={b.status === 'Confirmed' ? 'success' : b.status === 'Cancelled' ? 'error' : 'default'}
                          />
                        </TableCell>
                        <TableCell>{new Date(b.createdAt).toLocaleDateString('cs-CZ')}</TableCell>
                        <TableCell align="right">
                          {b.status === 'Confirmed' && (
                            <Tooltip title="Zrušit rezervaci">
                              <IconButton size="small" color="error" onClick={() => handleCancelBooking(b.id)}>
                                <Cancel fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* Tab 2: Availability */}
        {tab === 2 && (
          <Box sx={{ p: 3 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Výchozí dostupnost: Po–So 08:00–18:00. Upravte zde pro individuální rozvrhy lékařů.
            </Alert>
            {schedules.length === 0 ? (
              <Typography color="text.secondary">Žádné individuální rozvrhy. Používá se výchozí (Po-So 08-18).</Typography>
            ) : (
              schedules.map(s => (
                <Paper key={s.id} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{s.providerName}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                    {s.intervals.map((i, idx) => (
                      <Chip key={idx} label={`${DAY_NAMES[i.dayOfWeek]} ${Math.floor(i.startMinute / 60)}:${(i.startMinute % 60).toString().padStart(2, '0')}–${Math.floor(i.endMinute / 60)}:${(i.endMinute % 60).toString().padStart(2, '0')}`} size="small" />
                    ))}
                  </Box>
                </Paper>
              ))
            )}
          </Box>
        )}
      </Paper>

      {/* Edit/Create Event Type Dialog */}
      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditingEvent(null); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingEvent?.id ? 'Upravit službu' : 'Nová služba'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth required label="Název" value={editingEvent?.name || ''}
                onChange={e => setEditingEvent(p => ({ ...p, name: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth select label="Kategorie" value={editingEvent?.category || 'Ostatní'}
                onChange={e => setEditingEvent(p => ({ ...p, category: e.target.value }))}>
                {['Sportovní prohlídky', 'Sportovní diagnostika', 'Ostatní'].map(c => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Popis" multiline rows={2} value={editingEvent?.description || ''}
                onChange={e => setEditingEvent(p => ({ ...p, description: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth required label="Slug (URL)" value={editingEvent?.slug || ''}
                onChange={e => setEditingEvent(p => ({ ...p, slug: e.target.value }))}
                helperText="Pro URL: /book/tento-slug" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth required type="number" label="Délka (min)" value={editingEvent?.durationMinutes || 30}
                onChange={e => setEditingEvent(p => ({ ...p, durationMinutes: parseInt(e.target.value) || 30 }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth type="number" label="Cena (CZK)" value={editingEvent?.priceCzk || 0}
                onChange={e => setEditingEvent(p => ({ ...p, priceCzk: parseFloat(e.target.value) || 0 }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Místnost" value={editingEvent?.room || 'GreenLine 5.patro'}
                onChange={e => setEditingEvent(p => ({ ...p, room: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Lékaři (kdo službu provádí)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {staffNames.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Žádní zaměstnanci — přidejte je v sekci Tým
                  </Typography>
                )}
                {staffNames.map(name => {
                  const selected = splitProviders(editingEvent?.providerName).includes(name);
                  return (
                    <Chip
                      key={name}
                      label={name}
                      onClick={() => toggleEventDoctor(name)}
                      color={selected ? 'primary' : 'default'}
                      variant={selected ? 'filled' : 'outlined'}
                    />
                  );
                })}
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Barva" value={editingEvent?.color || '#0D7377'}
                onChange={e => setEditingEvent(p => ({ ...p, color: e.target.value }))}>
                {COLORS.map(c => (
                  <MenuItem key={c} value={c}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: c }} />
                      {c}
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={<Switch checked={editingEvent?.isActive ?? true}
                  onChange={e => setEditingEvent(p => ({ ...p, isActive: e.target.checked }))} />}
                label="Aktivní (viditelná pro pacienty)"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setDialogOpen(false); setEditingEvent(null); }} sx={{ borderRadius: 2 }}>Zrušit</Button>
          <Button variant="contained" onClick={handleSaveEvent} disabled={!editingEvent?.name}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 3, fontWeight: 600 }}>
            Uložit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
