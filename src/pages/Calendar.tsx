/* ══════════════════════════════════════════════════════════════
   ADVANCED CALENDAR ENGINE
   - Variable-duration blocks (10min → 7hrs)
   - Drag-to-create time ranges
   - Quick presets (10/20/30/60/420 min)
   - Conflict detection with resolution modal
   - Resize handle on bottom of blocks
   - Edit/Delete existing appointments
   - Current-time red line indicator
   - Break/Maintenance lockout overlays (Phase 4)
   - Real-time sync via WebSocket (Phase 9)
   ══════════════════════════════════════════════════════════════ */
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  Box, Typography, Paper, Card, CardContent, Button, Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Grid,
  ToggleButton, ToggleButtonGroup, Alert, Snackbar, Badge, Switch, Divider,
} from '@mui/material';
import {
  CalendarMonth, ChevronLeft, ChevronRight, Add, Close, Delete,
  Edit, AccessTime, Warning, DragIndicator, Lock, LockOpen, Print,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { calendarApi } from '../api/calendar';
import type { Appointment } from '../api/calendar';
import { patientsApi } from '../api/patients';
import type { Patient } from '../api/patients';
import BreakManager, { type CalendarLockout } from '../components/BreakManager';
import ForceOverrideModal from '../components/ForceOverrideModal';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

/* ── Czech holiday check (simple, no API call) ── */
const czechHolidays = new Set([
  '2024-01-01', '2024-01-06', '2024-02-24', '2024-03-29', '2024-03-30',
  '2024-04-01', '2024-05-01', '2024-05-8', '2024-05-8', '2024-07-5',
  '2024-07-6', '2024-7-6', '2024-07-28', '2024-09-28', '2024-10-28',
  '2024-11-17', '2024-12-24', '2024-12-25', '2024-12-26',
]);
const isCzechHoliday = (d: Date) => czechHolidays.has(d.toISOString().split('T')[0]);
import { useAppStore } from '../store/useAppStore';
import { useEscapeKey } from '../hooks/useKeyboardNav';

/* ── Constants ── */
const START_HOUR = 6;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);
const HOUR_PX = 80; // pixels per hour
const MINUTES_PER_HOUR = 60;
const PRESETS = [
  { label: '10 min', minutes: 10 },
  { label: '20 min', minutes: 20 },
  { label: '30 min', minutes: 30 },
  { label: '1 hodina', minutes: 60 },
  { label: '2 hodiny', minutes: 120 },
  { label: '4 hodiny', minutes: 240 },
  { label: '7 hodin', minutes: 420 },
];
const ROOMS = ['GreenLine 5.patro', 'Sál 1', 'Sál 2', 'Laboratoř'];
const SERVICE_COLORS: Record<string, string> = {
  'Základní prohlídka': '#0D7377',
  'Komplexní prohlídka': '#095456',
  'Spiroergometrie': '#2E7D32',
  'Základní diagnostika': '#0288D1',
  'Komplexní diagnostika': '#1565C0',
  'VO2max': '#ED6C02',
  'InBody770': '#9C27B0',
  'Video kompenzační plány': '#FF5722',
};

const LOCKOUT_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  break: { bg: 'rgba(237, 108, 2, 0.12)', border: '#ED6C02', text: '#E65100', label: 'Přestávka' },
  maintenance: { bg: 'rgba(117, 117, 117, 0.10)', border: '#757575', text: '#616161', label: 'Údržba' },
  emergency: { bg: 'rgba(211, 47, 47, 0.10)', border: '#D32F2F', text: '#C62828', label: 'Havárie' },
};

/* ── Helpers ── */
function getWeekDays(date: Date): Date[] {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay() + 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function timeToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function minutesToTop(minutes: number): number {
  return ((minutes - START_HOUR * 60) / MINUTES_PER_HOUR) * HOUR_PX;
}

function blockHeight(startMin: number, endMin: number): number {
  return Math.max(((endMin - startMin) / MINUTES_PER_HOUR) * HOUR_PX, 24);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function getDayName(d: Date): string {
  return d.toLocaleDateString('cs-CZ', { weekday: 'short' });
}

/** Get day-of-week index (0=Mon) for a Date */
function getDayOfWeekIndex(d: Date): number {
  return (d.getDay() + 6) % 7; // JS Sunday=0 → Mon=0
}

/* ══════════════════════════════════════════════════════════════ */
export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState('all');
  const [selectedService, setSelectedService] = useState('all');
  const [serviceNames, setServiceNames] = useState<string[]>([]);
  const [view, setView] = useState<'week' | 'day'>('week');
  const [now, setNow] = useState(new Date());

  /* Dialog state */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);

  /* Form state */
  const [form, setForm] = useState({
    patientId: '', serviceType: '', practitionerName: '',
    room: 'GreenLine 5.patro', notes: '',
    startTime: '', endTime: '',
  });

  /* Drag-to-create */
  const [dragging, setDragging] = useState(false);
  const [dragDay, setDragDay] = useState<Date | null>(null);
  const [dragStartMin, setDragStartMin] = useState(0);
  const [dragEndMin, setDragEndMin] = useState(0);

  /* Drag-to-move (existing blocks) */
  const [movingBlock, setMovingBlock] = useState<Appointment | null>(null);
  const [moveOffsetMin, setMoveOffsetMin] = useState(0); // grab offset from block top
  const [moveTargetDay, setMoveTargetDay] = useState<Date | null>(null);
  const [moveTargetMin, setMoveTargetMin] = useState(0); // cursor position in minutes
  const [isMoving, setIsMoving] = useState(false);

  /* Conflict */
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictAppts, setConflictAppts] = useState<Appointment[]>([]);
  const [conflictLockouts, setConflictLockouts] = useState<CalendarLockout[]>([]);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);

  /* Break manager */
  const [lockouts, setLockouts] = useState<CalendarLockout[]>([]);
  const [showBreakManager, setShowBreakManager] = useState(false);

  /* Snackbar */
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' as 'success' | 'error' });

  /* ── Keyboard navigation ── */
  const [selectedCell, setSelectedCell] = useState<{ day: number; hour: number } | null>(null);

  /* ── Print calendar ── */
  const handlePrint = () => {
    const printContent = document.querySelector('[role="grid"]');
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Kalendář - ${weekDays[0].toLocaleDateString('cs-CZ')} - ${weekDays[6].toLocaleDateString('cs-CZ')}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 18px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
            th { background: #f5f5f5; font-weight: bold; }
            .appt { background: #E0F2F1; border-left: 3px solid #0D7377; padding: 4px; margin: 2px 0; border-radius: 2px; }
          </style>
        </head>
        <body>
          <h1>Kalendář: ${weekDays[0].toLocaleDateString('cs-CZ')} — ${weekDays[6].toLocaleDateString('cs-CZ')}</h1>
          <table>
            <thead>
              <tr>
                <th>Čas</th>
                ${weekDays.map(d => `<th>${getDayName(d)} ${d.getDate()}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${HOURS.map(hour => `
                <tr>
                  <td>${hour.toString().padStart(2, '0')}:00</td>
${weekDays.map(day => {
                      const isHoliday = isCzechHoliday(day);
                      const cellAppts = getApptsForCell(day, hour, selectedRoom);
                      return `<td${isHoliday ? ' title="Svátek - volno"' : ''}>${cellAppts.map(a => {
                        const s = new Date(a.startTime);
                        const e = new Date(a.endTime);
                        const holidayCls = isHoliday ? ' style="background: #ffe0e0; border-radius: 2px"' : '';
                        return `<div class="appt"${holidayCls}><strong>${a.patientName}</strong><br/>${a.serviceType}<br/>${s.getHours()}:${s.getMinutes().toString().padStart(2, '0')} - ${e.getHours()}:${e.getMinutes().toString().padStart(2, '0')}</div>`;
                      }).join('')}</td>`;
                    }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    toast.success('Kalendář otevřen pro tisk');
  };

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  /* ── Keyboard event handler ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if dialog is open or typing in input
      if (dialogOpen || conflictOpen || overrideModalOpen) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (selectedCell) {
            setSelectedCell(prev => prev ? { ...prev, day: Math.max(0, prev.day - 1) } : null);
          } else {
            navigateWeek(-1);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (selectedCell) {
            setSelectedCell(prev => prev ? { ...prev, day: Math.min(6, prev.day + 1) } : null);
          } else {
            navigateWeek(1);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (selectedCell) {
            setSelectedCell(prev => prev ? { ...prev, hour: Math.max(START_HOUR, prev.hour - 1) } : null);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (selectedCell) {
            setSelectedCell(prev => prev ? { ...prev, hour: Math.min(END_HOUR - 1, prev.hour + 1) } : null);
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedCell) {
            openCreateDialog(weekDays[selectedCell.day], selectedCell.hour, 60);
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedCell) {
            const cellAppts = getApptsForCell(weekDays[selectedCell.day], selectedCell.hour, selectedRoom);
            if (cellAppts.length === 1) {
              handleDelete(cellAppts[0].id);
            }
          }
          break;
        case 'Escape':
          setSelectedCell(null);
          break;
        case 'p':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handlePrint();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dialogOpen, conflictOpen, overrideModalOpen, selectedCell, weekDays, selectedRoom]);

  const gridRef = useRef<HTMLDivElement>(null);
  const currentUserRole = useAppStore((s) => s.currentUserRole);
  const canManageLockouts = ['Admin', 'SuperAdmin', 'HeadPhysician'].includes(currentUserRole);

  /* ── Real-time sync ── */
  const { connected } = useRealtimeSync({
    onSlotCreated: () => refresh(),
    onSlotUpdated: () => refresh(),
    onSlotDeleted: () => refresh(),
    onForceLogout: () => {},
    onMaintenanceMode: () => {},
  });

  /* ── Escape to close dialogs ── */
  useEscapeKey(() => {
    if (dialogOpen) setDialogOpen(false);
    else if (conflictOpen) setConflictOpen(false);
    else if (overrideModalOpen) setOverrideModalOpen(false);
  });

  /* ── Clock tick ── */
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(iv);
  }, []);

  /* ── Fetch data ── */
  useEffect(() => {
    const from = weekDays[0].toISOString();
    const to = new Date(weekDays[6].getTime() + 86_400_000).toISOString();
    Promise.all([
      calendarApi.getAppointments(from, to).catch(() => []),
      patientsApi.getAll().catch(() => []),
    ]).then(([appts, pats]) => {
      setAppointments(appts);
      setServiceNames([...new Set(appts.map((a: Appointment) => a.eventName).filter(Boolean))].sort());
      setPatients(pats);
    }).finally(() => setLoading(false));
  }, [currentDate]);

  /* ── Refresh helper ── */
  const refresh = useCallback(() => {
    const from = weekDays[0].toISOString();
    const to = new Date(weekDays[6].getTime() + 86_400_000).toISOString();
    calendarApi.getAppointments(from, to).then(appts => {
      setAppointments(appts);
      const names = [...new Set(appts.map(a => a.eventName).filter(Boolean))].sort();
      setServiceNames(names);
    }).catch(() => {});
  }, [weekDays]);

  /* ── Refresh when a new online booking arrives ── */
  useEffect(() => {
    const onNewBooking = () => refresh();
    window.addEventListener('booking:created', onNewBooking);
    return () => window.removeEventListener('booking:created', onNewBooking);
  }, [refresh]);

  /* ── Navigate ── */
  const navigateWeek = (dir: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + dir * 7);
    setCurrentDate(d);
  };

  /* ── Get appointments for a cell ── */
  const getApptsForCell = (day: Date, hour: number, room: string) => {
    return appointments.filter(a => {
      if (a.status === 'Cancelled') return false;
      if (selectedService !== 'all' && (a.eventName || '') !== selectedService) return false;
      const s = new Date(a.startTime);
      const e = new Date(a.endTime);
      const cellStart = new Date(day); cellStart.setHours(hour, 0, 0, 0);
      const cellEnd = new Date(day); cellEnd.setHours(hour + 1, 0, 0, 0);
      return (room === 'all' || a.room === room) && s < cellEnd && e > cellStart;
    });
  };

  /* ── Check lockouts for a time range ── */
  const getLockoutsForRange = (day: Date, startMin: number, endMin: number): CalendarLockout[] => {
    const dayIdx = getDayOfWeekIndex(day);
    return lockouts.filter(l => {
      if (l.dayOfWeek !== dayIdx) return false;
      const lockStart = l.startHour * 60 + l.startMinute;
      const lockEnd = l.endHour * 60 + l.endMinute;
      return startMin < lockEnd && endMin > lockStart;
    });
  };

  /* ── Check conflict ── */
  const checkConflict = (day: Date, startMin: number, endMin: number, room: string, ignoreId?: string): Appointment[] => {
    return appointments.filter(a => {
      if (ignoreId && a.id === ignoreId) return false;
      if (a.status === 'Cancelled') return false;
      const s = new Date(a.startTime);
      const e = new Date(a.endTime);
      if (a.room !== room) return false;
      if (!isSameDay(s, day)) return false;
      const aStart = timeToMinutes(s);
      const aEnd = timeToMinutes(e);
      return startMin < aEnd && endMin > aStart;
    });
  };

  /* ── Drag-to-create handlers ── */
  const handleMouseDown = (day: Date, hour: number, e: React.MouseEvent) => {
    if (dragging) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const extraMin = Math.round((y / HOUR_PX) * 60 / 15) * 15;
    const startMin = hour * 60 + extraMin;
    setDragging(true);
    setDragDay(day);
    setDragStartMin(startMin);
    setDragEndMin(startMin + 30);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top + gridRef.current.scrollTop;
    const totalMin = START_HOUR * 60 + (y / HOUR_PX) * 60;
    const snapped = Math.round(totalMin / 15) * 15;
    setDragEndMin(Math.max(snapped, dragStartMin + 15));
  }, [dragging, dragStartMin]);

  const handleMouseUp = useCallback(() => {
    if (!dragging || !dragDay) return;
    setDragging(false);

    const duration = dragEndMin - dragStartMin;
    if (duration < 15) return;

    const startH = Math.floor(dragStartMin / 60);
    const startM = dragStartMin % 60;
    const endH = Math.floor(dragEndMin / 60);
    const endM = dragEndMin % 60;

    const startTime = new Date(dragDay);
    startTime.setHours(startH, startM, 0, 0);
    const endTime = new Date(dragDay);
    endTime.setHours(endH, endM, 0, 0);

    // Check appointment conflicts
    const conflicts = checkConflict(dragDay, dragStartMin, dragEndMin, 'all');

    // Check lockout conflicts
    const lockoutConflicts = getLockoutsForRange(dragDay, dragStartMin, dragEndMin);

    if (lockoutConflicts.length > 0) {
      setConflictLockouts(lockoutConflicts);
      setConflictAppts(conflicts);
      setOverrideModalOpen(true);
    } else if (conflicts.length > 0) {
      setConflictAppts(conflicts);
      setConflictOpen(true);
    }

    setForm(prev => ({
      ...prev,
      startTime: startTime.toISOString().slice(0, 16),
      endTime: endTime.toISOString().slice(0, 16),
    }));
    setEditMode('create');
    setEditingId(null);
    setDialogOpen(true);
  }, [dragging, dragDay, dragStartMin, dragEndMin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  /* ── Drag-to-move handlers (move existing blocks) ── */
  const handleMoveStart = useCallback((appt: Appointment, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const s = new Date(appt.startTime);
    const grabMin = timeToMinutes(s);
    const cursorMin = START_HOUR * 60 + ((e.clientY - (gridRef.current?.getBoundingClientRect().top || 0) + (gridRef.current?.scrollTop || 0)) / HOUR_PX) * 60;
    setMovingBlock(appt);
    setMoveOffsetMin(Math.round((cursorMin - grabMin) / 15) * 15);
    setMoveTargetDay(null);
    setMoveTargetMin(grabMin);
    setIsMoving(true);
  }, []);

  const handleMoveMove = useCallback((e: MouseEvent) => {
    if (!isMoving || !movingBlock || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top + gridRef.current.scrollTop;
    const totalMin = START_HOUR * 60 + (y / HOUR_PX) * 60;
    const snapped = Math.round(totalMin / 15) * 15;
    setMoveTargetMin(Math.max(START_HOUR * 60, Math.min(snapped - moveOffsetMin, END_HOUR * 60 - 15)));

    // Determine which day column the cursor is over
    const dayWidth = (rect.width - 60) / 7;
    const x = e.clientX - rect.left;
    const col = Math.floor((x - 60) / dayWidth);
    if (col >= 0 && col < 7) {
      setMoveTargetDay(weekDays[col]);
    }
  }, [isMoving, movingBlock, moveOffsetMin, weekDays]);

  const handleMoveEnd = useCallback(() => {
    if (!isMoving || !movingBlock || !moveTargetDay) {
      setIsMoving(false);
      setMovingBlock(null);
      return;
    }

    const duration = timeToMinutes(new Date(movingBlock.endTime)) - timeToMinutes(new Date(movingBlock.startTime));
    const newStartMin = moveTargetMin;
    const newEndMin = newStartMin + duration;

    // Check if new position conflicts with existing appointments
    const conflicts = checkConflict(moveTargetDay, newStartMin, newEndMin, movingBlock.room, movingBlock.id);
    const lockoutConflicts = getLockoutsForRange(moveTargetDay, newStartMin, newEndMin);

    if (lockoutConflicts.length > 0 || conflicts.length > 0) {
      setSnack({ open: true, msg: 'Kolize s existujícími bloky — přesun zrušen', severity: 'error' });
    } else {
      // Build new start/end times
      const newStart = new Date(moveTargetDay);
      newStart.setHours(Math.floor(newStartMin / 60), newStartMin % 60, 0, 0);
      const newEnd = new Date(moveTargetDay);
      newEnd.setHours(Math.floor(newEndMin / 60), newEndMin % 60, 0, 0);

      // Optimistic update
      setAppointments(prev => prev.map(a => {
        if (a.id !== movingBlock.id) return a;
        return { ...a, startTime: newStart.toISOString(), endTime: newEnd.toISOString() };
      }));

      // Persist to backend
      calendarApi.create({
        ...movingBlock,
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
      } as any).then(() => {
        setSnack({ open: true, msg: 'Schůzka přesunuta', severity: 'success' });
      }).catch(() => {
        setSnack({ open: true, msg: 'Chyba při přesunu', severity: 'error' });
        refresh();
      });
    }

    setIsMoving(false);
    setMovingBlock(null);
  }, [isMoving, movingBlock, moveTargetDay, moveTargetMin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isMoving) {
      document.addEventListener('mousemove', handleMoveMove);
      document.addEventListener('mouseup', handleMoveEnd);
      return () => {
        document.removeEventListener('mousemove', handleMoveMove);
        document.removeEventListener('mouseup', handleMoveEnd);
      };
    }
  }, [isMoving, handleMoveMove, handleMoveEnd]);

  /* ── Open create dialog with preset ── */
  const openCreateDialog = (day: Date, hour: number, minutes: number = 60) => {
    const startTime = new Date(day); startTime.setHours(hour, 0, 0, 0);
    const endTime = new Date(startTime); endTime.setMinutes(endTime.getMinutes() + minutes);
    setForm(prev => ({
      ...prev, patientId: '', serviceType: '', practitionerName: '',
      notes: '',
      startTime: startTime.toISOString().slice(0, 16),
      endTime: endTime.toISOString().slice(0, 16),
    }));
    setEditMode('create');
    setEditingId(null);
    setDialogOpen(true);
  };

  /* ── Open edit dialog ── */
  const openEditDialog = (appt: Appointment) => {
    setForm({
      patientId: appt.patientId, serviceType: appt.serviceType,
      practitionerName: appt.practitionerName, room: appt.room,
      notes: appt.notes || '',
      startTime: new Date(appt.startTime).toISOString().slice(0, 16),
      endTime: new Date(appt.endTime).toISOString().slice(0, 16),
    });
    setEditMode('edit');
    setEditingId(appt.id);
    setDialogOpen(true);
  };

  /* ── Save (create or edit) ── */
  const handleSave = async () => {
    if (!form.patientId || !form.serviceType || !form.startTime || !form.endTime) {
      setSnack({ open: true, msg: 'Vyplňte všechny povinné údaje (pacient, typ služby, čas)', severity: 'error' });
      return;
    }
    try {
      if (editMode === 'edit' && editingId) {
        await calendarApi.update(editingId, form as any);
        setSnack({ open: true, msg: 'Schůzka upravena', severity: 'success' });
      } else {
        await calendarApi.create(form);
        setSnack({ open: true, msg: 'Schůzka vytvořena', severity: 'success' });
      }
      setDialogOpen(false);
      refresh();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Neznámá chyba — zkontrolujte připojení k backendu';
      setSnack({ open: true, msg: `Chyba při ukládání: ${msg}`, severity: 'error' });
    }
  };

  /* ── Delete ── */
  const handleDelete = async (id: string) => {
    try {
      await calendarApi.cancel(id);
      setSnack({ open: true, msg: 'Schůzka zrušena', severity: 'success' });
      setDialogOpen(false);
      refresh();
    } catch {
      setSnack({ open: true, msg: 'Chyba při mazání', severity: 'error' });
    }
  };

  /* ── Lockout management ── */
  const handleAddLockout = (lockout: Omit<CalendarLockout, 'id' | 'createdAt' | 'isLocked'>) => {
    const newLockout: CalendarLockout = {
      ...lockout,
      id: `lockout-${Date.now()}`,
      createdAt: new Date().toISOString(),
      isLocked: true,
    };
    setLockouts(prev => [...prev, newLockout]);
  };

  const handleRemoveLockout = (id: string) => {
    setLockouts(prev => prev.filter(l => l.id !== id));
  };

  const handleForceUnlock = (id: string) => {
    setLockouts(prev => prev.filter(l => l.id !== id));
  };

  /* ── Force override from modal ── */
  const handleForceOverride = () => {
    // Remove conflicting appointments (admin override)
    conflictAppts.forEach(a => {
      calendarApi.cancel(a.id).catch(() => {});
    });
    setSnack({ open: true, msg: `${conflictAppts.length} schůzek přepsáno`, severity: 'success' });
    refresh();
  };

  const handleShiftExisting = () => {
    // Shift conflicting appointments forward by the drag duration
    const shiftMinutes = dragEndMin - dragStartMin;
    conflictAppts.forEach(a => {
      const s = new Date(a.startTime);
      const e = new Date(a.endTime);
      s.setMinutes(s.getMinutes() + shiftMinutes);
      e.setMinutes(e.getMinutes() + shiftMinutes);
      calendarApi.create({
        ...a,
        startTime: s.toISOString(),
        endTime: e.toISOString(),
      } as any).then(() => {
        calendarApi.cancel(a.id);
      }).catch(() => {});
    });
    setSnack({ open: true, msg: `${conflictAppts.length} schůzek přesunuto`, severity: 'success' });
    refresh();
  };

  /* ── Current time position ── */
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = minutesToTop(nowMin);

  if (loading) {
    return (
      <Box>
        <Box sx={{ height: 40, width: 300, bgcolor: '#f0f0f0', borderRadius: 1, mb: 3 }} />
        <Box sx={{ height: 500, bgcolor: '#f0f0f0', borderRadius: 3 }} />
      </Box>
    );
  }

  return (
    <Box>
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarMonth color="primary" /> Kalendář
              {connected && (
                <Chip label="Live" size="small" sx={{ bgcolor: '#16A34A', color: '#fff', height: 20, fontSize: 10, fontWeight: 700 }} />
              )}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {weekDays[0].toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' })} — {weekDays[6].toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}
              <Badge badgeContent={appointments.length} color="primary" sx={{ ml: 1 }}>
                <AccessTime sx={{ fontSize: 16 }} />
              </Badge>
              {lockouts.length > 0 && (
                <Badge badgeContent={lockouts.length} color="warning" sx={{ ml: 1 }}>
                  <Lock sx={{ fontSize: 16 }} />
                </Badge>
              )}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <ToggleButtonGroup value={view} exclusive onChange={(_, v) => v && setView(v)} size="small">
              <ToggleButton value="week">Týden</ToggleButton>
              <ToggleButton value="day">Den</ToggleButton>
            </ToggleButtonGroup>
            <TextField select size="small" value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)}
              sx={{ minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
              <MenuItem value="all">Všechny sály</MenuItem>
              {ROOMS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField>
            <TextField select size="small" value={selectedService} onChange={e => setSelectedService(e.target.value)}
              sx={{ minWidth: 180, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
              <MenuItem value="all">Všechny služby</MenuItem>
              {serviceNames.map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
            </TextField>                            <IconButton onClick={() => navigateWeek(-1)} aria-label="Předchozí týden"><ChevronLeft /></IconButton>
            <Button variant="outlined" size="small" onClick={() => setCurrentDate(new Date())}
              sx={{ borderRadius: 2, px: 2 }}>Dnes</Button>                            <IconButton onClick={() => navigateWeek(1)} aria-label="Další týden"><ChevronRight /></IconButton>

            {/* Break manager toggle (admin only) */}
            {canManageLockouts && (
              <Tooltip title={showBreakManager ? 'Skrýt správu přestávek' : 'Správa přestávek'}>
                <IconButton onClick={() => setShowBreakManager(!showBreakManager)}
                  sx={{ color: showBreakManager ? '#D32F2F' : '#999', border: showBreakManager ? '1px solid #D32F2F' : 'none' }}>
                  {showBreakManager ? <LockOpen /> : <Lock />}
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title="Tisknout kalendář (Ctrl+P)">
              <IconButton onClick={handlePrint}>
                <Print />
              </IconButton>
            </Tooltip>
            <Button variant="contained" startIcon={<Add />} onClick={() => openCreateDialog(new Date(), 9, 60)}
              sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 3, fontWeight: 600 }}>
              Nová schůzka
            </Button>
          </Box>
        </Box>
      </motion.div>

      {/* ── Break Manager Panel (admin only) ── */}
      {canManageLockouts && (
        <BreakManager
          lockouts={lockouts}
          onAdd={handleAddLockout}
          onRemove={handleRemoveLockout}
          onForceUnlock={handleForceUnlock}
          visible={showBreakManager}
        />
      )}

      {/* ── Duration Preset Chips ── */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Rychlý preset:</Typography>
        {PRESETS.map(p => (
          <Chip key={p.minutes} label={p.label} size="small" variant="outlined"
            onClick={() => openCreateDialog(new Date(), 9, p.minutes)}
            sx={{ borderRadius: 2, cursor: 'pointer', '&:hover': { bgcolor: '#E0F2F1' } }} />
        ))}
        {lockouts.length > 0 && (
          <>
            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Uzamčení:</Typography>
            {Object.entries(LOCKOUT_COLORS).map(([type, cfg]) => {
              const count = lockouts.filter(l => l.type === type).length;
              if (count === 0) return null;
              return (
                <Chip key={type} label={`${cfg.label} (${count})`} size="small"
                  sx={{ bgcolor: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`, fontWeight: 600, fontSize: 11 }} />
              );
            })}
          </>
        )}
      </Box>

      {/* ── Legend ── */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Legenda:</Typography>
        {[
          { label: 'Naplánováno', color: '#ED6C02' },
          { label: 'Potvrzeno', color: '#2E7D32' },
          { label: 'Online rezervace', color: '#0288D1' },
          { label: 'Odbaveno', color: '#7B1FA2' },
          { label: 'Hotovo', color: '#9E9E9E' },
          { label: 'Zrušeno', color: '#D32F2F' },
        ].map(l => (
          <Chip key={l.label} size="small" variant="outlined"
            label={l.label}
            sx={{ fontSize: 11, '& .MuiChip-label': { display: 'flex', alignItems: 'center', gap: 0.5 } }}
            icon={<Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: l.color, ml: 0.5 }} />}
          />
        ))}
      </Box>

      {/* ── Week Grid ── */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        {/* Day Headers */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', borderBottom: '2px solid #0D7377', position: 'sticky', top: 0, zIndex: 20, bgcolor: '#fff' }}>
          <Box sx={{ p: 1, bgcolor: '#f8f9fa', borderRight: '1px solid #e0e0e0' }} />
          {weekDays.map((day, i) => (
            <Box key={i} sx={{
              p: 1.5, textAlign: 'center',
              bgcolor: isSameDay(day, now) ? '#E0F2F1' : ([0, 6].includes(day.getDay()) ? '#f1f3f5' : '#f8f9fa'),
              borderRight: i < 6 ? '1px solid #e0e0e0' : 'none',
              borderBottom: isSameDay(day, now) ? '3px solid #0D7377' : 'none',
            }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {getDayName(day)}
              </Typography>
              <Typography variant="h6" sx={{
                fontWeight: 700, width: 32, height: 32, borderRadius: '50%',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: isSameDay(day, now) ? '#0D7377' : 'transparent',
                color: isSameDay(day, now) ? '#fff' : 'inherit',
              }}>
                {day.getDate()}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Time Grid */}
        <Box ref={gridRef} role="grid" aria-label="Týdenní kalendář" sx={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto', position: 'relative' }}>
          {/* Current Time Indicator */}
          {weekDays.some(d => isSameDay(d, now)) && (
            <Box sx={{
              position: 'absolute', top: nowTop, left: 60, right: 0, height: 2,
              bgcolor: '#DC2626', zIndex: 10,
              '&::before': {
                content: '""', position: 'absolute', left: -5, top: -4,
                width: 10, height: 10, borderRadius: '50%', bgcolor: '#DC2626',
              },
            }} />
          )}

          {HOURS.map(hour => (
            <Box key={hour} sx={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', minHeight: HOUR_PX }}>
              {/* Time label */}
              <Box sx={{
                p: 1, textAlign: 'right', borderRight: '1px solid #e0e0e0',
                borderBottom: '1px solid #f0f0f0', position: 'sticky', left: 0, bgcolor: '#f8f9fa', zIndex: 5,
              }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                  {hour.toString().padStart(2, '0')}:00
                </Typography>
              </Box>

              {/* Day cells */}
              {weekDays.map((day, dayIdx) => {
                const cellAppts = getApptsForCell(day, hour, selectedRoom);
                const isDayToday = isSameDay(day, now);
                const isWeekendCell = [0, 6].includes(day.getDay());
                const dayOfWeekIdx = getDayOfWeekIndex(day);

                // Check if this hour is locked
                const hourStartMin = hour * 60;
                const hourEndMin = (hour + 1) * 60;
                const activeLockout = lockouts.find(l => {
                  if (l.dayOfWeek !== dayOfWeekIdx) return false;
                  const lockStart = l.startHour * 60 + l.startMinute;
                  const lockEnd = l.endHour * 60 + l.endMinute;
                  return hourStartMin < lockEnd && hourEndMin > lockStart;
                });

                // Check if any appointment starts in this cell (to avoid duplicate rendering)
                const startingAppts = cellAppts.filter(a => {
                  const s = new Date(a.startTime);
                  return s.getHours() === hour && isSameDay(s, day);
                });

                return (                    <Box
                    key={dayIdx}
                    onMouseDown={(e) => {
                      if (cellAppts.length === 0 && !activeLockout) handleMouseDown(day, hour, e);
                    }}
                    onClick={() => {
                      setSelectedCell({ day: dayIdx, hour });
                    }}
                    sx={{
                      borderRight: dayIdx < 6 ? '1px solid #e0e0e0' : 'none',
                      borderBottom: '1px solid #f0f0f0',
                      position: 'relative',
                      cursor: (cellAppts.length === 0 && !activeLockout) ? 'crosshair' : activeLockout ? 'not-allowed' : 'default',
                      transition: 'background 0.15s',
                      bgcolor: isDayToday ? 'rgba(13,115,119,0.05)' : isWeekendCell ? '#f7f8f9' : 'transparent',
                      '&:hover': (cellAppts.length === 0 && !activeLockout) ? { bgcolor: '#f0faf9' } : {},
                      border: selectedCell?.day === dayIdx && selectedCell?.hour === hour ? '2px solid #0D7377' : 'none',
                      overflow: 'visible',
                    }}
                  >
                    {/* Lockout overlay */}
                    {activeLockout && (() => {
                      const cfg = LOCKOUT_COLORS[activeLockout.type];
                      const lockStart = activeLockout.startHour * 60 + activeLockout.startMinute;
                      const lockEnd = activeLockout.endHour * 60 + activeLockout.endMinute;
                      const topPx = Math.max(0, ((Math.max(lockStart, hourStartMin) - hourStartMin) / MINUTES_PER_HOUR) * HOUR_PX);
                      const bottomPx = Math.min(HOUR_PX, ((Math.min(lockEnd, hourEndMin) - hourStartMin) / MINUTES_PER_HOUR) * HOUR_PX);
                      const heightPx = bottomPx - topPx;

                      return (
                        <Box
                          key={`lockout-${activeLockout.id}`}
                          sx={{
                            position: 'absolute', top: topPx, left: 0, right: 0, height: heightPx,
                            bgcolor: cfg.bg, borderLeft: `3px solid ${cfg.border}`,
                            zIndex: 4, pointerEvents: 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {hour === activeLockout.startHour && (
                            <Box sx={{
                              display: 'flex', alignItems: 'center', gap: 0.5,
                              bgcolor: cfg.border, color: '#fff', px: 0.8, py: 0.2,
                              borderRadius: 1, fontSize: 10, fontWeight: 700,
                            }}>
                              <Lock sx={{ fontSize: 10 }} />
                              {cfg.label}
                            </Box>
                          )}
                        </Box>
                      );
                    })()}

                    {/* Quarter-hour guide lines */}
                    {[15, 30, 45].map(m => (
                      <Box key={m} sx={{
                        position: 'absolute', top: (m / 60) * HOUR_PX,
                        left: 0, right: 0, height: 1, bgcolor: '#f5f5f5',
                      }} />
                    ))}

                    {/* Appointment blocks (only render ones that START in this hour) */}
                    {startingAppts.map(appt => {
                      const s = new Date(appt.startTime);
                      const e = new Date(appt.endTime);
                      const sMin = timeToMinutes(s);
                      const eMin = timeToMinutes(e);
                      const top = ((sMin - hour * 60) / MINUTES_PER_HOUR) * HOUR_PX;
                      const height = blockHeight(sMin, eMin);
                      const duration = eMin - sMin;
                      const color = SERVICE_COLORS[appt.serviceType] || '#0D7377';
                      const isOnline = (appt.notes || '').startsWith('Online rezervace:');
                      const statusColor = appt.status === 'Confirmed' ? '#2E7D32'
                        : appt.status === 'CheckedIn' ? '#7B1FA2'
                        : appt.status === 'Completed' ? '#9E9E9E'
                        : appt.status === 'Cancelled' ? '#D32F2F'
                        : isOnline ? '#0288D1' : '#ED6C02';

                      return (
                        <motion.div
                          key={appt.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          style={{
                            position: 'absolute', top, left: 2, right: 2, height,
                            zIndex: 6,
                          }}
                        >
                          <Card
                            role="button"
                            aria-label={`Schůzka: ${appt.patientName}, ${appt.serviceType}, ${formatDuration(duration)}`}
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditDialog(appt); } }}
                            onClick={(e) => { e.stopPropagation(); openEditDialog(appt); }}
                            sx={{
                              height: '100%', bgcolor: `${color}14`,
                              borderLeft: `4px solid ${color}`,
                              borderRadius: 1, cursor: isMoving && movingBlock?.id === appt.id ? 'grabbing' : 'pointer',
                              boxShadow: isMoving && movingBlock?.id === appt.id ? `0 4px 20px ${color}40` : 'none',
                              transition: 'all 0.15s',
                              overflow: 'hidden',
                              '&:hover': { boxShadow: `0 2px 12px ${color}30`, transform: 'scale(1.01)' },
                            }}
                          >
                            <CardContent sx={{ p: '4px 8px !important', '&:last-child': { pb: '4px !important' } }}>
                              {/* Drag handle — grab this area to move the block */}
                              <Box
                                onMouseDown={(e) => handleMoveStart(appt, e)}
                                sx={{
                                  cursor: 'grab', mb: 0.5, pb: 0.5,
                                  borderBottom: duration >= 60 ? `1px solid ${color}20` : 'none',
                                  '&:active': { cursor: 'grabbing' },
                                }}
                                data-tooltip="Přetáhnout"
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <DragIndicator sx={{ fontSize: 12, color: `${color}80`, flexShrink: 0 }} />
                                  <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.2, display: 'block', fontSize: 11 }}>
                                    {appt.patientName}
                                  </Typography>
                                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: statusColor, flexShrink: 0 }} title={appt.status} />
                                  {isOnline && (
                                    <Chip label="Online" size="small" sx={{ height: 14, fontSize: 8, fontWeight: 700, bgcolor: '#0288D1', color: '#fff', ml: 'auto' }} />
                                  )}
                                </Box>
                              </Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, display: 'block', fontWeight: 600 }}>
                                {s.getHours().toString().padStart(2, '0')}:{s.getMinutes().toString().padStart(2, '0')} — {e.getHours().toString().padStart(2, '0')}:{e.getMinutes().toString().padStart(2, '0')}
                              </Typography>
                              {duration >= 60 && (
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, display: 'block' }}>
                                  {appt.serviceType} · {formatDuration(duration)}
                                </Typography>
                              )}
                              {duration >= 120 && appt.room && (
                                <Chip label={appt.room} size="small" sx={{ mt: 0.5, height: 16, fontSize: 9, bgcolor: `${color}20` }} />
                              )}
                            </CardContent>
                            {/* Resize handle */}
                            <Box
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                const startY = e.clientY;
                                const startEndMin = eMin;
                                const onMove = (me: MouseEvent) => {
                                  const dy = me.clientY - startY;
                                  const extraMin = Math.round((dy / HOUR_PX) * 60 / 15) * 15;
                                  const newEnd = Math.max(sMin + 15, startEndMin + extraMin);
                                  // Update the appointment end time optimistically
                                  setAppointments(prev => prev.map(a => {
                                    if (a.id !== appt.id) return a;
                                    const newEndTime = new Date(a.endTime);
                                    newEndTime.setHours(Math.floor(newEnd / 60), newEnd % 60, 0, 0);
                                    return { ...a, endTime: newEndTime.toISOString() };
                                  }));
                                };
                                const onUp = () => {
                                  document.removeEventListener('mousemove', onMove);
                                  document.removeEventListener('mouseup', onUp);
                                  // Persist to backend
                                  calendarApi.create({ ...appt, endTime: new Date(appt.endTime).toISOString() } as any).catch(() => {});
                                };
                                document.addEventListener('mousemove', onMove);
                                document.addEventListener('mouseup', onUp);
                              }}
                              sx={{
                                height: 6, cursor: 'ns-resize',
                                bgcolor: `${color}40`, borderRadius: '0 0 4px 4px',
                                mx: 0.5, mb: 0.5,
                                transition: 'background 0.15s',
                                '&:hover': { bgcolor: `${color}80` },
                              }}
                            />
                          </Card>
                        </motion.div>
                      );
                    })}

                    {/* Drag preview (creating new block) */}
                    {dragging && dragDay && isSameDay(day, dragDay) && hour * 60 >= Math.min(dragStartMin, dragEndMin) - 60 && hour * 60 <= Math.max(dragStartMin, dragEndMin) && (
                      <Box sx={{
                        position: 'absolute',
                        top: Math.max(0, ((Math.min(dragStartMin, dragEndMin) - hour * 60) / 60) * HOUR_PX),
                        left: 2, right: 2,
                        height: blockHeight(
                          Math.max(Math.min(dragStartMin, dragEndMin), hour * 60),
                          Math.min(Math.max(dragStartMin, dragEndMin), (hour + 1) * 60)
                        ),
                        bgcolor: 'rgba(13, 115, 119, 0.15)',
                        border: '2px dashed #0D7377',
                        borderRadius: 1, zIndex: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: '#0D7377' }}>
                          {formatDuration(dragEndMin - dragStartMin)}
                        </Typography>
                      </Box>
                    )}

                    {/* Move preview (ghost of block being moved) */}
                    {isMoving && movingBlock && moveTargetDay && isSameDay(day, moveTargetDay) && (() => {
                      const duration = timeToMinutes(new Date(movingBlock.endTime)) - timeToMinutes(new Date(movingBlock.startTime));
                      const ghostTop = ((moveTargetMin - hour * 60) / MINUTES_PER_HOUR) * HOUR_PX;
                      const ghostHeight = blockHeight(moveTargetMin, moveTargetMin + duration);
                      if (ghostTop + ghostHeight < 0 || ghostTop > HOUR_PX) return null;
                      const color = SERVICE_COLORS[movingBlock.serviceType] || '#0D7377';
                      return (
                        <Box sx={{
                          position: 'absolute',
                          top: Math.max(0, ghostTop),
                          left: 2, right: 2,
                          height: ghostHeight,
                          bgcolor: `${color}20`,
                          border: `2px dashed ${color}`,
                          borderRadius: 1, zIndex: 8,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          pointerEvents: 'none',
                        }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color }}>
                            {movingBlock.patientName} · {formatDuration(duration)}
                          </Typography>
                        </Box>
                      );
                    })()}
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>
      </Paper>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {editMode === 'edit' ? 'Upravit schůzku' : 'Nová schůzka'}
            </Typography>
            {form.startTime && (
              <Typography variant="body2" color="text.secondary">
                {new Date(form.startTime).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}
                {' · '}
                {new Date(form.startTime).getHours().toString().padStart(2, '0')}:{new Date(form.startTime).getMinutes().toString().padStart(2, '0')}
                {' — '}
                {form.endTime && new Date(form.endTime).getHours().toString().padStart(2, '0')}:{form.endTime && new Date(form.endTime).getMinutes().toString().padStart(2, '0')}
                {form.startTime && form.endTime && (
                  <Chip label={formatDuration(timeToMinutes(new Date(form.endTime)) - timeToMinutes(new Date(form.startTime)))}
                    size="small" sx={{ ml: 1, height: 20, fontSize: 10 }} />
                )}
              </Typography>
            )}
          </Box>
          <IconButton onClick={() => setDialogOpen(false)}><Close /></IconButton>
        </DialogTitle>
        <DialogContent>
          {/* Quick duration presets inside dialog */}
          <Box sx={{ display: 'flex', gap: 0.5, mb: 2, mt: 1, flexWrap: 'wrap' }}>
            {PRESETS.map(p => (
              <Chip key={p.minutes} label={p.label} size="small"
                onClick={() => {
                  if (form.startTime) {
                    const s = new Date(form.startTime);
                    const e = new Date(s); e.setMinutes(e.getMinutes() + p.minutes);
                    setForm(prev => ({ ...prev, endTime: e.toISOString().slice(0, 16) }));
                  }
                }}
                sx={{ cursor: 'pointer' }} />
            ))}
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth select label="Pacient" value={form.patientId}
                onChange={e => setForm(p => ({ ...p, patientId: e.target.value }))}>
                {patients.map(p => <MenuItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Typ služby" value={form.serviceType}
                onChange={e => setForm(p => ({ ...p, serviceType: e.target.value }))}>
                {Object.keys(SERVICE_COLORS).map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Praktik" value={form.practitionerName}
                onChange={e => setForm(p => ({ ...p, practitionerName: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Začátek" type="datetime-local" value={form.startTime}
                onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Konec" type="datetime-local" value={form.endTime}
                onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Sál" value={form.room}
                onChange={e => setForm(p => ({ ...p, room: e.target.value }))}>
                {ROOMS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth multiline rows={2} label="Poznámky" value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          {editMode === 'edit' && editingId && (
            <Button startIcon={<Delete />} color="error" onClick={() => handleDelete(editingId)}
              sx={{ mr: 'auto', borderRadius: 2 }}>Smazat</Button>
          )}
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: 2 }}>Zrušit</Button>
          <Button variant="contained" onClick={handleSave}
            disabled={!form.patientId || !form.serviceType || !form.startTime || !form.endTime}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 3, fontWeight: 600 }}>
            {editMode === 'edit' ? 'Uložit' : 'Vytvořit'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Conflict Warning Dialog ── */}
      <Dialog open={conflictOpen} onClose={() => setConflictOpen(false)} maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="warning" /> Kolize termínů
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Vybraný čas koliduje s existujícími schůzkami:
          </Typography>
          {conflictAppts.map(a => (
            <Chip key={a.id} label={`${a.patientName} — ${a.serviceType}`} sx={{ m: 0.5 }} />
          ))}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Schůzka bude vytvořena i přes kolizi. Můžete ji později přesunout.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConflictOpen(false)} variant="contained" sx={{ bgcolor: '#0D7377', borderRadius: 2 }}>
            Pokračovat
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Force Override Modal (lockout conflicts) ── */}
      <ForceOverrideModal
        open={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        conflictingAppointments={conflictAppts}
        onForceOverride={handleForceOverride}
        onShiftExisting={handleShiftExisting}
        onCancel={() => setOverrideModalOpen(false)}
      />

      {/* ── Snackbar ── */}
      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} sx={{ borderRadius: 2 }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
