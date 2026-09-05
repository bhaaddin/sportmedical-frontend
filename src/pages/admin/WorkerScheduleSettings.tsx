import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Switch,
  FormControlLabel, TextField, Button, Alert, Chip, Select,
  MenuItem, FormControl, InputLabel, Divider, Tabs, Tab,
  IconButton, Tooltip, Badge, Collapse
} from '@mui/material';
import {
  AccessTime, CalendarMonth, Save, Add, Delete, ContentCopy,
  ExpandMore, ExpandLess, Settings, PersonAdd, EventBusy,
  Repeat, Schedule, NotificationAdd
} from '@mui/icons-material';
import { publicBookingApi } from '../../api/publicBooking';
import client from '../../api/client';

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (mins: number) => {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

interface DaySchedule {
  dayOfWeek: number;
  isWorking: boolean;
  startTime: string;
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
  slotDuration: number;
}

interface SpecialDay {
  date: string;
  isWorking: boolean;
  startTime: string;
  endTime: string;
  reason: string;
}

interface WorkerSettings {
  workerId: string;
  workerName: string;
  weeklySchedule: DaySchedule[];
  specialDays: SpecialDay[];
  services: string[];
  maxPatientsPerDay: number;
  allowOnlineBooking: boolean;
  bufferMinutes: number;
  autoConfirm: boolean;
  reminderHours: number;
  maxAdvanceDays: number;
  cancellationDeadlineHours: number;
  enableWaitlist: boolean;
  workingDaysPerWeek: number;
}

const DAY_NAMES = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
const SLOT_DURATIONS = [15, 20, 30, 45, 60];

interface RealService {
  id: string;
  name: string;
  providerName: string;
}

export default function WorkerScheduleSettings() {
  const [workers, setWorkers] = useState<WorkerSettings[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<number>(0);
  const [activeTab, setActiveTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [realServices, setRealServices] = useState<RealService[]>([]);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  // ── Who is logged in? Non-admins only see their own schedule ──
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  }, []);
  const myName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim();
  const isAdmin = ['Admin', 'SuperAdmin', 'Owner', 'HeadPhysician'].includes(currentUser.role);

  useEffect(() => {
    loadWorkers();
    // Real booking services (patient-facing) — selection here assigns the service to the worker
    publicBookingApi.adminGetAll()
      .then(list => setRealServices((list ?? []).map((e: any) => ({
        id: e.id, name: e.name, providerName: e.providerName ?? '',
      }))))
      .catch(() => {});
  }, []);

  // Attach services to workers by provider-name match (only when changed)
  useEffect(() => {
    if (realServices.length === 0 || workers.length === 0) return;
    setWorkers(prev => {
      let changed = false;
      const next = prev.map(w => {
        const mine = realServices
          .filter(s => s.providerName.split(',').map(x => x.trim()).includes(w.workerName))
          .map(s => s.id);
        const same = mine.length === w.services.length && mine.every(id => w.services.includes(id));
        if (same) return w;
        changed = true;
        return { ...w, services: mine };
      });
      return changed ? next : prev;
    });
  }, [realServices, workers.length]);

  // Auto-select own schedule for workers (create one if missing)
  useEffect(() => {
    if (isAdmin || workers.length === 0 || !myName) return;
    const idx = workers.findIndex(w => w.workerName === myName);
    if (idx >= 0) {
      setSelectedWorker(idx);
    } else {
      setWorkers(prev => [...prev, {
        workerId: '', workerName: myName,
        weeklySchedule: blankWeek(), specialDays: [], services: [],
        maxPatientsPerDay: 20, allowOnlineBooking: true, bufferMinutes: 10,
        autoConfirm: true, reminderHours: 24, maxAdvanceDays: 30,
        cancellationDeadlineHours: 24, enableWaitlist: true, workingDaysPerWeek: 5,
      }]);
      setSelectedWorker(workers.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workers.length, isAdmin]);

  const blankWeek = (): DaySchedule[] => [0, 1, 2, 3, 4, 5, 6].map(d => ({
    dayOfWeek: d, isWorking: d >= 1 && d <= 5,
    startTime: '08:00', endTime: '18:00', breakStart: '12:00', breakEnd: '13:00', slotDuration: 30,
  }));

  const scheduleToWorker = (s: any, idx: number): WorkerSettings => {
    const week = blankWeek().map(d => ({ ...d, isWorking: false }));
    (s.intervals || []).forEach((iv: any) => {
      const d = week[iv.dayOfWeek];
      if (!d) return;
      d.isWorking = true;
      d.startTime = toTime(iv.startMinute);
      d.endTime = toTime(iv.endMinute);
    });
    const working = week.filter(d => d.isWorking).length;
    return {
      workerId: s.id, workerName: s.providerName,
      weeklySchedule: week, specialDays: [], services: [],
      maxPatientsPerDay: 20, allowOnlineBooking: true, bufferMinutes: 10,
      autoConfirm: true, reminderHours: 24, maxAdvanceDays: 30,
      cancellationDeadlineHours: 24, enableWaitlist: true,
      workingDaysPerWeek: working || 5,
    };
  };

  const loadWorkers = async () => {
    try {
      const schedules = await publicBookingApi.getAvailabilitySchedules();
      if (schedules.length === 0) {
        setWorkers([{
          workerId: '', workerName: 'MUDr. Jan Novák',
          weeklySchedule: blankWeek(), specialDays: [], services: [],
          maxPatientsPerDay: 20, allowOnlineBooking: true, bufferMinutes: 10,
          autoConfirm: true, reminderHours: 24, maxAdvanceDays: 30,
          cancellationDeadlineHours: 24, enableWaitlist: true, workingDaysPerWeek: 5,
        }]);
        return;
      }
      setWorkers(schedules.map(scheduleToWorker));
    } catch {
      setWorkers([{
        workerId: '', workerName: 'MUDr. Jan Novák',
        weeklySchedule: blankWeek(), specialDays: [], services: [],
        maxPatientsPerDay: 20, allowOnlineBooking: true, bufferMinutes: 10,
        autoConfirm: true, reminderHours: 24, maxAdvanceDays: 30,
        cancellationDeadlineHours: 24, enableWaitlist: true, workingDaysPerWeek: 5,
      }]);
    }
  };

  const updateDay = (workerIdx: number, dayIdx: number, field: string, value: unknown) => {
    setWorkers(prev => prev.map((w, wi) => {
      if (wi !== workerIdx) return w;
      const newSchedule = [...w.weeklySchedule];
      newSchedule[dayIdx] = { ...newSchedule[dayIdx], [field]: value } as DaySchedule;
      const workingDays = newSchedule.filter(d => d.isWorking).length;
      return { ...w, weeklySchedule: newSchedule, workingDaysPerWeek: workingDays };
    }));
  };

  const updateWorker = (workerIdx: number, field: string, value: unknown) => {
    setWorkers(prev => prev.map((w, wi) => wi === workerIdx ? { ...w, [field]: value } : w));
  };

  const copyScheduleToAll = (workerIdx: number) => {
    const worker = workers[workerIdx];
    // Copy Monday schedule to all workdays
    const monSchedule = worker.weeklySchedule[1];
    setWorkers(prev => prev.map((w, wi) => {
      if (wi !== workerIdx) return w;
      return {
        ...w,
        weeklySchedule: w.weeklySchedule.map((d, di) =>
          di >= 1 && di <= 5 ? { ...d, isWorking: true, startTime: monSchedule.startTime, endTime: monSchedule.endTime, breakStart: monSchedule.breakStart, breakEnd: monSchedule.breakEnd, slotDuration: monSchedule.slotDuration } : d
        ),
      };
    }));
  };

  const addSpecialDay = (workerIdx: number) => {
    const today = new Date().toISOString().split('T')[0];
    setWorkers(prev => prev.map((w, wi) => wi === workerIdx ? {
      ...w,
      specialDays: [...w.specialDays, { date: today, isWorking: false, startTime: '08:00', endTime: '18:00', reason: '' }],
    } : w));
  };

  const removeSpecialDay = (workerIdx: number, dayIdx: number) => {
    setWorkers(prev => prev.map((w, wi) => wi === workerIdx ? {
      ...w,
      specialDays: w.specialDays.filter((_, i) => i !== dayIdx),
    } : w));
  };

  // ── Smart work-days picker ──
  const setWorkingDaysCount = (workerIdx: number, count: number) => {
    setWorkers(prev => prev.map((w, wi) => {
      if (wi !== workerIdx) return w;
      const template = w.weeklySchedule.find(d => d.isWorking) ?? w.weeklySchedule[1];
      // Keep currently selected days first, fill up with Mon-Fri
      const selected = w.weeklySchedule.filter(d => d.isWorking).map(d => d.dayOfWeek);
      const order = [1, 2, 3, 4, 5, 6, 0];
      for (const d of order) {
        if (selected.length >= count) break;
        if (!selected.includes(d)) selected.push(d);
      }
      const keep = selected.slice(0, count);
      const weeklySchedule = w.weeklySchedule.map(d => ({
        ...d,
        isWorking: keep.includes(d.dayOfWeek),
        ...(keep.includes(d.dayOfWeek) ? { startTime: template.startTime, endTime: template.endTime, breakStart: template.breakStart, breakEnd: template.breakEnd, slotDuration: template.slotDuration } : {}),
      }));
      return { ...w, weeklySchedule, workingDaysPerWeek: count };
    }));
  };

  const toggleDaySmart = (workerIdx: number, dayOfWeek: number) => {
    setWorkers(prev => prev.map((w, wi) => {
      if (wi !== workerIdx) return w;
      const day = w.weeklySchedule.find(d => d.dayOfWeek === dayOfWeek);
      if (!day) return w;
      if (!day.isWorking) {
        // Enforce count: drop the last working day if at limit
        const working = w.weeklySchedule.filter(d => d.isWorking);
        const template = working[0] ?? w.weeklySchedule[1];
        let weeklySchedule = w.weeklySchedule.map(d => ({ ...d }));
        if (working.length >= w.workingDaysPerWeek) {
          const drop = working[working.length - 1].dayOfWeek;
          weeklySchedule = weeklySchedule.map(d => d.dayOfWeek === drop ? { ...d, isWorking: false } : d);
        }
        weeklySchedule = weeklySchedule.map(d => d.dayOfWeek === dayOfWeek
          ? { ...d, isWorking: true, startTime: template.startTime, endTime: template.endTime, breakStart: template.breakStart, breakEnd: template.breakEnd, slotDuration: template.slotDuration }
          : d);
        return { ...w, weeklySchedule };
      }
      const weeklySchedule = w.weeklySchedule.map(d =>
        d.dayOfWeek === dayOfWeek ? { ...d, isWorking: false } : d);
      return { ...w, weeklySchedule };
    }));
  };

  const applyPreset = (workerIdx: number, days: number[]) => {
    setWorkers(prev => prev.map((w, wi) => {
      if (wi !== workerIdx) return w;
      const template = w.weeklySchedule.find(d => d.isWorking) ?? w.weeklySchedule[1];
      const weeklySchedule = w.weeklySchedule.map(d => ({
        ...d,
        isWorking: days.includes(d.dayOfWeek),
        ...(days.includes(d.dayOfWeek) ? { startTime: template.startTime, endTime: template.endTime, breakStart: template.breakStart, breakEnd: template.breakEnd, slotDuration: template.slotDuration } : {}),
      }));
      return { ...w, weeklySchedule, workingDaysPerWeek: days.length };
    }));
  };

  const handleSave = async () => {
    const w = workers[selectedWorker];
    if (!w) return;
    setSaving(true);
    try {
      // Convert to backend intervals (split around break)
      const intervals: { dayOfWeek: number; startMinute: number; endMinute: number }[] = [];
      w.weeklySchedule.filter(d => d.isWorking).forEach(d => {
        const start = toMinutes(d.startTime);
        const end = toMinutes(d.endTime);
        if (d.breakStart && d.breakEnd) {
          const bs = toMinutes(d.breakStart);
          const be = toMinutes(d.breakEnd);
          if (bs > start) intervals.push({ dayOfWeek: d.dayOfWeek, startMinute: start, endMinute: bs });
          if (be < end) intervals.push({ dayOfWeek: d.dayOfWeek, startMinute: be, endMinute: end });
        } else {
          intervals.push({ dayOfWeek: d.dayOfWeek, startMinute: start, endMinute: end });
        }
      });
      const payload = { id: w.workerId || undefined, providerName: w.workerName, timeZone: 'Europe/Prague', intervals };
      const saved = await publicBookingApi.saveAvailabilitySchedule(payload as any);
      setWorkers(prev => prev.map((x, i) => i === selectedWorker ? { ...x, workerId: (saved as any).id } : x));

      // Sync service assignment (who performs which service → whose calendar gets the booking)
      for (const s of realServices) {
        const providers = s.providerName.split(',').map(x => x.trim()).filter(Boolean);
        const shouldHave = w.services.includes(s.id);
        const hasNow = providers.includes(w.workerName);
        if (shouldHave === hasNow) continue;
        const next = shouldHave ? [...providers, w.workerName] : providers.filter(p => p !== w.workerName);
        const get = await client.get(`/api/booking/event-types/${s.id}`);
        const full = get.data?.value ?? get.data;
        await client.put(`/api/booking/event-types/${s.id}`, { ...full, providerName: next.join(', ') });
      }
      const refreshed = await publicBookingApi.adminGetAll().catch(() => [] as any[]);
      setRealServices((refreshed ?? []).map((e: any) => ({ id: e.id, name: e.name, providerName: e.providerName ?? '' })));

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaved(false);
    } finally {
      setSaving(false);
    }
  };

  const worker = workers[selectedWorker];
  if (!worker) return <Typography>Načítání...</Typography>;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          <Schedule sx={{ mr: 1, verticalAlign: 'middle' }} />
          Nastavení rozvrhu pracovníků
        </Typography>
        <Button variant="contained" startIcon={<Save />} onClick={handleSave} disabled={saving}>
          {saving ? 'Ukládání...' : 'Uložit vše'}
        </Button>
      </Box>

      {saved && <Alert severity="success" sx={{ mb: 2 }}>Nastavení uloženo</Alert>}

      {/* Worker selector (admin only — workers see just their own) */}
      {isAdmin ? (
      <Paper sx={{ mb: 3, p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight={600}>Pracovník:</Typography>
          {workers.map((w, i) => (
            <Chip
              key={w.workerId || w.workerName}
              label={`${w.workerName} (${w.workingDaysPerWeek} dní/týden)`}
              onClick={() => setSelectedWorker(i)}
              color={selectedWorker === i ? 'primary' : 'default'}
              variant={selectedWorker === i ? 'filled' : 'outlined'}
            />
          ))}
          <Button size="small" startIcon={<PersonAdd />}>Přidat pracovníka</Button>
        </Box>
      </Paper>
      ) : (
      <Alert severity="info" sx={{ mb: 3 }}>
        Můj rozvrh — {worker.workerName}. Pacienti si mohou rezervovat termíny pouze ve dnech, které zde nastavíte.
      </Alert>
      )}

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab label="Týdenní rozvrh" icon={<CalendarMonth />} />
        <Tab label="Speciální dny" icon={<EventBusy />} />
        <Tab label="Nastavení služeb" icon={<Settings />} />
        <Tab label="Pokročilé" icon={<Settings />} />
      </Tabs>

      {/* Tab 0: Weekly Schedule */}
      {activeTab === 0 && (
        <Box>
          {/* ── Smart work-days picker ── */}
          <Paper sx={{ p: 2, mb: 2, bgcolor: '#f0f7f7' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                {worker.workerName} pracuje
              </Typography>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Dní v týdnu</InputLabel>
                <Select
                  value={worker.workingDaysPerWeek}
                  label="Dní v týdnu"
                  onChange={(e) => setWorkingDaysCount(selectedWorker, Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map(n => <MenuItem key={n} value={n}>{n} {n === 1 ? 'den' : n < 5 ? 'dny' : 'dní'}</MenuItem>)}
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary">
                ({worker.weeklySchedule.filter(d => d.isWorking).length} vybráno)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {[0, 1, 2, 3, 4, 5, 6].map(d => {
                const on = worker.weeklySchedule.find(x => x.dayOfWeek === d)?.isWorking;
                return (
                  <Chip
                    key={d}
                    label={DAY_NAMES[d]}
                    onClick={() => toggleDaySmart(selectedWorker, d)}
                    color={on ? 'primary' : 'default'}
                    variant={on ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 600 }}
                  />
                );
              })}
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button size="small" variant="outlined" onClick={() => applyPreset(selectedWorker, [1, 2, 3, 4, 5])}>Po–Pá</Button>
              <Button size="small" variant="outlined" onClick={() => applyPreset(selectedWorker, [1, 2, 3, 4])}>Po–Čt (4 dny)</Button>
              <Button size="small" variant="outlined" onClick={() => applyPreset(selectedWorker, [1, 3, 5])}>Po+St+Pá (3 dny)</Button>
              <Button size="small" variant="outlined" onClick={() => applyPreset(selectedWorker, [2, 4])}>Út+Čt (2 dny)</Button>
            </Box>
          </Paper>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button size="small" startIcon={<ContentCopy />} onClick={() => copyScheduleToAll(selectedWorker)}>
                Kopírovat pondělí na všechny dny
              </Button>
            </Box>
          </Grid>
          {worker.weeklySchedule.map((day, idx) => (
            <Grid size={{ xs: 12 }} key={day.dayOfWeek}>
              <Card variant="outlined" sx={{ borderColor: day.isWorking ? 'primary.main' : 'divider' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ width: 120 }}>
                      <Typography variant="subtitle1" fontWeight={600}>{DAY_NAMES[day.dayOfWeek]}</Typography>
                    </Box>
                    <FormControlLabel
                      control={<Switch checked={day.isWorking} onChange={(e) => updateDay(selectedWorker, idx, 'isWorking', e.target.checked)} />}
                      label={day.isWorking ? 'Pracovní den' : 'Volno'}
                    />
                    {day.isWorking && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
                        <TextField size="small" type="time" value={day.startTime} InputLabelProps={{ shrink: true }} sx={{ width: 110 }}
                          onChange={(e) => updateDay(selectedWorker, idx, 'startTime', e.target.value)} />
                        <Typography>—</Typography>
                        <TextField size="small" type="time" value={day.endTime} InputLabelProps={{ shrink: true }} sx={{ width: 110 }}
                          onChange={(e) => updateDay(selectedWorker, idx, 'endTime', e.target.value)} />
                        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                        <Typography variant="body2" color="text.secondary">Přestávka:</Typography>
                        <TextField size="small" type="time" value={day.breakStart || ''} InputLabelProps={{ shrink: true }} sx={{ width: 110 }}
                          onChange={(e) => updateDay(selectedWorker, idx, 'breakStart', e.target.value)} />
                        <Typography>—</Typography>
                        <TextField size="small" type="time" value={day.breakEnd || ''} InputLabelProps={{ shrink: true }} sx={{ width: 110 }}
                          onChange={(e) => updateDay(selectedWorker, idx, 'breakEnd', e.target.value)} />
                        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                        <FormControl size="small" sx={{ width: 100 }}>
                          <InputLabel>Slot</InputLabel>
                          <Select value={day.slotDuration} label="Slot" onChange={(e) => updateDay(selectedWorker, idx, 'slotDuration', e.target.value)}>
                            {SLOT_DURATIONS.map(d => <MenuItem key={d} value={d}>{d} min</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Box>
                    )}
                    {day.isWorking && (
                      <Chip size="small" label={`${Math.floor((new Date(`2000-01-01T${day.endTime}`).getTime() - new Date(`2000-01-01T${day.startTime}`).getTime()) / 3600000)}h`} color="primary" variant="outlined" />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
        </Box>
      )}

      {/* Tab 1: Special Days */}
      {activeTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Speciální dny (dovolená, svátky, mimořádné hodiny)</Typography>
            <Button variant="outlined" startIcon={<Add />} onClick={() => addSpecialDay(selectedWorker)}>Přidat den</Button>
          </Box>
          {worker.specialDays.length === 0 ? (
            <Alert severity="info">Žádné speciální dny nastaveny</Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {worker.specialDays.map((sd, idx) => (
                <Paper key={idx} sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                  <TextField size="small" type="date" label="Datum" value={sd.date} InputLabelProps={{ shrink: true }}
                    onChange={(e) => {
                      const newDays = [...worker.specialDays];
                      newDays[idx] = { ...newDays[idx], date: e.target.value };
                      updateWorker(selectedWorker, 'specialDays', newDays);
                    }} />
                  <FormControlLabel control={<Switch checked={sd.isWorking} onChange={(e) => {
                    const newDays = [...worker.specialDays];
                    newDays[idx] = { ...newDays[idx], isWorking: e.target.checked };
                    updateWorker(selectedWorker, 'specialDays', newDays);
                  }} />} label={sd.isWorking ? 'Pracovní den' : 'Volno'} />
                  {sd.isWorking && (
                    <>
                      <TextField size="small" type="time" value={sd.startTime} InputLabelProps={{ shrink: true }} sx={{ width: 110 }}
                        onChange={(e) => {
                          const newDays = [...worker.specialDays];
                          newDays[idx] = { ...newDays[idx], startTime: e.target.value };
                          updateWorker(selectedWorker, 'specialDays', newDays);
                        }} />
                      <Typography>—</Typography>
                      <TextField size="small" type="time" value={sd.endTime} InputLabelProps={{ shrink: true }} sx={{ width: 110 }}
                        onChange={(e) => {
                          const newDays = [...worker.specialDays];
                          newDays[idx] = { ...newDays[idx], endTime: e.target.value };
                          updateWorker(selectedWorker, 'specialDays', newDays);
                        }} />
                    </>
                  )}
                  <TextField size="small" label="Důvod" value={sd.reason} placeholder="Dovolená..."
                    onChange={(e) => {
                      const newDays = [...worker.specialDays];
                      newDays[idx] = { ...newDays[idx], reason: e.target.value };
                      updateWorker(selectedWorker, 'specialDays', newDays);
                    }} sx={{ minWidth: 200 }} />
                  <IconButton color="error" onClick={() => removeSpecialDay(selectedWorker, idx)}><Delete /></IconButton>
                </Paper>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Tab 2: Services (real patient-facing services) */}
      {activeTab === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Služby pracovníka</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Vyberte služby, které tento pracovník poskytuje. Rezervace těchto služeb půjdou do jeho kalendáře a oznámení.
          </Typography>
          {realServices.length === 0 ? (
            <Alert severity="info">Načítání služeb…</Alert>
          ) : (
          <Grid container spacing={1}>
            {realServices.map(service => {
              const selected = worker.services.includes(service.id);
              const others = service.providerName.split(',').map(x => x.trim()).filter(x => x && x !== worker.workerName);
              return (
              <Grid key={service.id}>
                <Chip
                  label={others.length > 0 && !selected ? `${service.name} (${others.join(', ')})` : service.name}
                  onClick={() => {
                    const services = selected
                      ? worker.services.filter(s => s !== service.id)
                      : [...worker.services, service.id];
                    updateWorker(selectedWorker, 'services', services);
                  }}
                  color={selected ? 'primary' : 'default'}
                  variant={selected ? 'filled' : 'outlined'}
                />
              </Grid>
              );
            })}
          </Grid>
          )}
        </Paper>
      )}

      {/* Tab 3: Advanced Settings */}
      {activeTab === 3 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>Rezervace</Typography>
                <FormControlLabel control={<Switch checked={worker.allowOnlineBooking}
                  onChange={(e) => updateWorker(selectedWorker, 'allowOnlineBooking', e.target.checked)} />}
                  label="Povolit online rezervace" />
                <FormControlLabel control={<Switch checked={worker.autoConfirm}
                  onChange={(e) => updateWorker(selectedWorker, 'autoConfirm', e.target.checked)} />}
                  label="Automatické potvrzení" />
                <FormControlLabel control={<Switch checked={worker.enableWaitlist}
                  onChange={(e) => updateWorker(selectedWorker, 'enableWaitlist', e.target.checked)} />}
                  label="Čekací listina" />
                <Divider sx={{ my: 2 }} />
                <TextField fullWidth size="small" label="Max pacientů/den" type="number" value={worker.maxPatientsPerDay}
                  onChange={(e) => updateWorker(selectedWorker, 'maxPatientsPerDay', parseInt(e.target.value))} sx={{ mb: 2 }} />
                <TextField fullWidth size="small" label="Buffer mezi termíny (min)" type="number" value={worker.bufferMinutes}
                  onChange={(e) => updateWorker(selectedWorker, 'bufferMinutes', parseInt(e.target.value))} sx={{ mb: 2 }} />
                <TextField fullWidth size="small" label="Max dní předem" type="number" value={worker.maxAdvanceDays}
                  onChange={(e) => updateWorker(selectedWorker, 'maxAdvanceDays', parseInt(e.target.value))} sx={{ mb: 2 }} />
                <TextField fullWidth size="small" label="Připomínka (hodiny před)" type="number" value={worker.reminderHours}
                  onChange={(e) => updateWorker(selectedWorker, 'reminderHours', parseInt(e.target.value))} sx={{ mb: 2 }} />
                <TextField fullWidth size="small" label="Zrušení (hodiny před)" type="number" value={worker.cancellationDeadlineHours}
                  onChange={(e) => updateWorker(selectedWorker, 'cancellationDeadlineHours', parseInt(e.target.value))} />
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>Přehled rozvrhu</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography color="text.secondary">Pracovních dnů:</Typography>
                    <Typography fontWeight={600}>{worker.workingDaysPerWeek} / 7</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography color="text.secondary">Speciálních dnů:</Typography>
                    <Typography fontWeight={600}>{worker.specialDays.length}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography color="text.secondary">Služeb:</Typography>
                    <Typography fontWeight={600}>{worker.services.length}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography color="text.secondary">Slot (min):</Typography>
                    <Typography fontWeight={600}>{worker.weeklySchedule.find(d => d.isWorking)?.slotDuration || 30}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography color="text.secondary">Buffer (min):</Typography>
                    <Typography fontWeight={600}>{worker.bufferMinutes}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography color="text.secondary">Online booking:</Typography>
                    <Chip size="small" label={worker.allowOnlineBooking ? 'ANO' : 'NE'} color={worker.allowOnlineBooking ? 'success' : 'default'} />
                  </Box>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Odhad slotů/týden:</Typography>
                {worker.weeklySchedule.filter(d => d.isWorking).map(d => {
                  const start = new Date(`2000-01-01T${d.startTime}`).getTime();
                  const end = new Date(`2000-01-01T${d.endTime}`).getTime();
                  const breakTime = d.breakStart && d.breakEnd ?
                    (new Date(`2000-01-01T${d.breakEnd}`).getTime() - new Date(`2000-01-01T${d.breakStart}`).getTime()) : 0;
                  const totalMins = (end - start - breakTime) / 60000;
                  const slots = Math.floor(totalMins / (d.slotDuration + worker.bufferMinutes));
                  return (
                    <Box key={d.dayOfWeek} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">{DAY_NAMES[d.dayOfWeek]}</Typography>
                      <Typography variant="body2" fontWeight={600}>{slots} slotů</Typography>
                    </Box>
                  );
                })}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
