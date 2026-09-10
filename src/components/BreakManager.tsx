/* ══════════════════════════════════════════════════════════════
   BREAK MANAGER — Phase 4
   Admin-only component for managing calendar lockouts:
   - Draw custom lockout rectangles on the calendar grid
   - Types: Strict Break, Maintenance, Emergency Lock
   - Backend validation (isLocked: true)
   - Force Unlock (SuperAdmin only)
   - RBAC-gated via PermissionGate
   ══════════════════════════════════════════════════════════════ */
import { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Card, CardContent, Button, Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Alert, Grid, List, ListItem, ListItemIcon, ListItemText, Divider, Snackbar,
} from '@mui/material';
import {
  Lock, LockOpen, Warning, Delete, Add, AccessTime, Build, EmergencyShare,
  Shield, Edit,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import toast from 'react-hot-toast';

/* ── Lockout types ── */
export interface CalendarLockout {
  id: string;
  dayOfWeek: number; // 0=Mon, 6=Sun
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  type: 'break' | 'maintenance' | 'emergency';
  reason: string;
  createdBy: string;
  createdAt: string;
  isLocked: boolean;
}

const LOCKOUT_TYPES = [
  { value: 'break', label: 'Přísná přestávka', color: '#ED6C02', icon: <AccessTime /> },
  { value: 'maintenance', label: 'Údržba', color: '#757575', icon: <Build /> },
  { value: 'emergency', label: 'Havarijní uzamčení', color: '#D32F2F', icon: <EmergencyShare /> },
];

const DAY_NAMES = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

interface BreakManagerProps {
  lockouts: CalendarLockout[];
  onAdd: (lockout: Omit<CalendarLockout, 'id' | 'createdAt' | 'isLocked'>) => void;
  onRemove: (id: string) => void;
  onForceUnlock: (id: string) => void;
  visible?: boolean;
}

export default function BreakManager({ lockouts, onAdd, onRemove, onForceUnlock, visible = false }: BreakManagerProps) {
  const currentUserRole = useAppStore((s) => s.currentUserRole);
  const currentUserName = useAppStore((s) => s.currentUserName);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newLockout, setNewLockout] = useState({
    dayOfWeek: 0,
    startHour: 12,
    startMinute: 0,
    endHour: 13,
    endMinute: 0,
    type: 'break' as const,
    reason: '',
  });

  const canManageLockouts = ['Admin', 'SuperAdmin', 'HeadPhysician'].includes(currentUserRole);
  const canForceUnlock = ['SuperAdmin'].includes(currentUserRole);

  const handleAdd = () => {
    if (!newLockout.reason) {
      toast.error('Zadejte důvod');
      return;
    }
    onAdd({
      ...newLockout,
      createdBy: currentUserName || currentUserRole,
    });
    setDialogOpen(false);
    setNewLockout({ dayOfWeek: 0, startHour: 12, startMinute: 0, endHour: 13, endMinute: 0, type: 'break', reason: '' });
    toast.success('Uzamčení přidáno');
  };

  const handleForceUnlock = (lockout: CalendarLockout) => {
    onForceUnlock(lockout.id);
    toast.success(`Uzamčení ${lockout.reason} odstraněno`);
  };

  if (!canManageLockouts || !visible) return null;

  return (
    <>
      {/* ── Lockout List ── */}
      <Paper sx={{ borderRadius: 3, mb: 2 }}>
        <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Lock sx={{ color: '#D32F2F' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Správa přestávek a uzamčení</Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} size="small" onClick={() => setDialogOpen(true)}
            sx={{ bgcolor: '#D32F2F', borderRadius: 2, fontWeight: 600 }}>
            Přidat uzamčení
          </Button>
        </Box>

        {lockouts.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Lock sx={{ fontSize: 48, color: '#ddd', mb: 1 }} />
            <Typography color="text.secondary">Žádná aktivní uzamčení</Typography>
          </Box>
        ) : (
          <List dense>
            {lockouts.map((lockout) => {
              const config = LOCKOUT_TYPES.find((t) => t.value === lockout.type) || LOCKOUT_TYPES[0];
              return (
                <ListItem key={lockout.id} sx={{ borderBottom: '1px solid #f0f0f0' }}
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {canForceUnlock && (
                        <Tooltip title="Vynutit odemčení (SuperAdmin)">
                          <IconButton size="small" color="warning" onClick={() => handleForceUnlock(lockout)}>
                            <LockOpen fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Odstranit">
                        <IconButton size="small" color="error" onClick={() => onRemove(lockout.id)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  }
                >
                  <ListItemIcon sx={{ color: config.color, minWidth: 40 }}>
                    {config.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={config.label} size="small" sx={{ bgcolor: `${config.color}14`, color: config.color, fontWeight: 600 }} />
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {DAY_NAMES[lockout.dayOfWeek]} {lockout.startHour.toString().padStart(2, '0')}:{lockout.startMinute.toString().padStart(2, '0')}
                          {' — '}
                          {lockout.endHour.toString().padStart(2, '0')}:{lockout.endMinute.toString().padStart(2, '0')}
                        </Typography>
                      </Box>
                    }
                    secondary={lockout.reason}
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </Paper>

      {/* ── Add Lockout Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Přidat uzamčení kalendáře</Typography>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth select label="Den" value={newLockout.dayOfWeek}
                onChange={(e) => setNewLockout((p) => ({ ...p, dayOfWeek: Number(e.target.value) }))}>
                {DAY_NAMES.map((name, i) => (
                  <MenuItem key={i} value={i}>{name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth type="number" label="Začátek (hodina)" value={newLockout.startHour}
                onChange={(e) => setNewLockout((p) => ({ ...p, startHour: Math.max(0, Math.min(23, Number(e.target.value))) }))}
                slotProps={{ htmlInput: { min: 0, max: 23 } }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth type="number" label="Začátek (minuta)" value={newLockout.startMinute}
                onChange={(e) => setNewLockout((p) => ({ ...p, startMinute: Math.max(0, Math.min(59, Number(e.target.value))) }))}
                slotProps={{ htmlInput: { min: 0, max: 59 } }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth type="number" label="Konec (hodina)" value={newLockout.endHour}
                onChange={(e) => setNewLockout((p) => ({ ...p, endHour: Math.max(0, Math.min(23, Number(e.target.value))) }))}
                slotProps={{ htmlInput: { min: 0, max: 23 } }} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth type="number" label="Konec (minuta)" value={newLockout.endMinute}
                onChange={(e) => setNewLockout((p) => ({ ...p, endMinute: Math.max(0, Math.min(59, Number(e.target.value))) }))}
                slotProps={{ htmlInput: { min: 0, max: 59 } }} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth select label="Typ uzamčení" value={newLockout.type}
                onChange={(e) => setNewLockout((p) => ({ ...p, type: e.target.value as any }))}>
                {LOCKOUT_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Důvod" value={newLockout.reason}
                onChange={(e) => setNewLockout((p) => ({ ...p, reason: e.target.value }))}
                placeholder="Např. Oběd, Údržba zařízení..." />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: 2 }}>Zrušit</Button>
          <Button variant="contained" onClick={handleAdd} disabled={!newLockout.reason}
            sx={{ bgcolor: '#D32F2F', borderRadius: 2, px: 3, fontWeight: 600 }}>
            Uzamknout
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
