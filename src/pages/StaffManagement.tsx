/* ══════════════════════════════════════════════════════════════
   STAFF MANAGEMENT — PLAN-01 Feature A11-A20
   - CRUD operations for staff members
   - Role-based access control
   - Work hours configuration
   - Status management
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, FormControl, InputLabel,
  Select, MenuItem, Chip, Avatar, Switch, FormControlLabel, Grid,
  Alert, Snackbar, Skeleton, Tooltip
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  Person as PersonIcon, Refresh as RefreshIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import client from '../api/client';

/* ── Types ── */
interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'Admin' | 'Doctor' | 'Nurse' | 'Receptionist' | 'HeadPhysician';
  specialization: string;
  isActive: boolean;
  avatar?: string;
  services: string[];
}

interface LoginAccount {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
}

interface ServiceOption {
  id: string;
  slug: string;
  name: string;
  providerName: string;
}

/* ── Role config ── */
const ROLE_LABELS: Record<string, string> = {
  Admin: 'Administrátor',
  Doctor: 'Lékař',
  Nurse: 'Sestra',
  Receptionist: 'Recepční',
  HeadPhysician: 'Primář',
};

const ROLE_COLORS: Record<string, string> = {
  Admin: '#D32F2F',
  Doctor: '#0288D1',
  Nurse: '#2E7D32',
  Receptionist: '#ED6C02',
  HeadPhysician: '#7B1FA2',
};

/* ══════════════════════════════════════════════════════════════ */
export default function StaffManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [formData, setFormData] = useState<Partial<StaffMember>>({
    firstName: '', lastName: '', email: '', phone: '',
    role: 'Doctor', specialization: '', isActive: true, services: [],
  });
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [accounts, setAccounts] = useState<LoginAccount[]>([]);

  /* ── Load staff + services + login accounts ── */
  useEffect(() => {
    loadStaff();
    loadServices();
    loadAccounts();
  }, []);

  const splitName = (full: string) => {
    const parts = (full || '').trim().split(/\s+/);
    return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' };
  };

  const loadServices = async () => {
    try {
      const res = await client.get('/api/booking/event-types');
      const data = res.data?.value ?? res.data ?? [];
      const list = Array.isArray(data) ? data : [];
      setServices(list.map((e: any) => ({ id: e.id, slug: e.slug, name: e.name, providerName: e.providerName ?? '' })));
    } catch {
      setServices([]);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await client.get('/api/v1/users');
      const data = res.data?.value ?? res.data ?? [];
      setAccounts(Array.isArray(data) ? data : []);
    } catch {
      setAccounts([]);
    }
  };

  const accountFor = (email: string) =>
    accounts.find(a => (a.email || '').toLowerCase() === (email || '').toLowerCase());

  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/staff');
      const data = res.data?.value ?? res.data?.data ?? res.data;
      const list = Array.isArray(data) ? data : data?.items ?? [];
      const mapped: StaffMember[] = list.map((m: any) => {
        const { firstName, lastName } = splitName(m.fullName ?? '');
        return {
          id: m.id, firstName, lastName,
          email: m.email ?? '', phone: m.phone ?? '',
          role: m.role ?? 'Doctor', specialization: m.department ?? '',
          isActive: m.isActive ?? true, services: [],
        };
      });
      // Attach services by matching provider name
      try {
        const evRes = await client.get('/api/booking/event-types');
        const evData = evRes.data?.value ?? evRes.data ?? [];
        const evList = Array.isArray(evData) ? evData : [];
        mapped.forEach(s => {
          const full = `${s.firstName} ${s.lastName}`.trim();
          s.services = evList.filter((e: any) =>
            String(e.providerName ?? '').split(',').map((x: string) => x.trim()).includes(full)
          ).map((e: any) => e.id);
        });
      } catch { /* ignore */ }
      setStaff(mapped);
    } catch {
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  /* ── Save staff (+ login account + service assignment) ── */
  const [newTempPassword, setNewTempPassword] = useState('');
  const [newAccountEmail, setNewAccountEmail] = useState('');
  const handleSave = async () => {
    try {
      const fullName = `${formData.firstName ?? ''} ${formData.lastName ?? ''}`.trim();
      const payload = {
        fullName,
        role: formData.role ?? 'Doctor',
        department: formData.specialization ?? '',
        email: formData.email ?? '',
        schedule: null,
        phone: formData.phone ?? '',
      };
      if (editingStaff) {
        await client.put(`/api/staff/${editingStaff.id}`, { ...payload, isActive: formData.isActive ?? true });
      } else {
        await client.post('/api/staff', payload);
      }

      // Assign selected services to this doctor (patient bookings → his calendar)
      try {
        const prevServices = editingStaff?.services ?? [];
        const nextServices = formData.services ?? [];
        const toAssign = nextServices.filter(id => !prevServices.includes(id));
        const toUnassign = prevServices.filter(id => !nextServices.includes(id));
        const setProvider = async (id: string, provider: string) => {
          const get = await client.get(`/api/booking/event-types/${id}`);
          const full = get.data?.value ?? get.data;
          const cur = String(full.providerName ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);
          const next = provider
            ? (cur.includes(provider) ? cur : [...cur, provider])
            : cur.filter((n: string) => n !== fullName);
          await client.put(`/api/booking/event-types/${id}`, { ...full, providerName: next.join(', ') });
        };
        for (const id of toAssign) await setProvider(id, fullName);
        for (const id of toUnassign) {
          const ev = services.find(s => s.id === id);
          if (ev && ev.providerName.split(',').map(s => s.trim()).includes(fullName)) await setProvider(id, '');
        }
        await loadServices();
      } catch { /* service sync failed — staff saved */ }

      // New member → also create login account (email + generated password)
      if (!editingStaff && formData.email) {
        try {
          const accountRole = formData.role === 'Admin' ? 'Administrator' : 'Staff';
          const res = await client.post('/api/v1/users', {
            email: formData.email,
            displayName: fullName || formData.email,
            role: accountRole,
          });
          const temp = res.data?.temporaryPassword ?? res.data?.value?.temporaryPassword ?? '';
          setNewTempPassword(temp);
          setNewAccountEmail(formData.email);
          setSnackbar({ open: true, message: 'Zaměstnanec uložen + přihlašovací účet vytvořen.', severity: 'success' });
        } catch (e: any) {
          const msg = e?.response?.status === 409
            ? 'Zaměstnanec uložen. Přihlašovací účet s tímto emailem již existuje.'
            : 'Zaměstnanec uložen, ale vytvoření přihlašovacího účtu selhalo.';
          setSnackbar({ open: true, message: msg, severity: 'error' });
        }
        loadAccounts();
      } else {
        setSnackbar({ open: true, message: 'Zaměstnanec uložen', severity: 'success' });
      }
      setOpenDialog(false);
      loadStaff();
    } catch {
      setSnackbar({ open: true, message: 'Chyba při ukládání', severity: 'error' });
    }
  };

  /* ── Reset login password ── */
  const handleResetPassword = async (email: string) => {
    const acc = accountFor(email);
    if (!acc) return;
    try {
      const res = await client.post(`/api/v1/users/${acc.userId}/reset-password`);
      const temp = res.data?.temporaryPassword ?? res.data?.value?.temporaryPassword ?? '';
      setNewTempPassword(temp);
      setNewAccountEmail(email);
    } catch {
      setSnackbar({ open: true, message: 'Reset hesla selhal', severity: 'error' });
    }
  };

  /* ── Delete staff ── */
  const handleDelete = async (id: string) => {
    if (!window.confirm('Opravdu chcete smazat tohoto zaměstnance?')) return;
    
    try {
      await client.delete(`/api/staff/${id}`);
      setSnackbar({ open: true, message: 'Zaměstnanec smazán', severity: 'success' });
      loadStaff();
    } catch {
      setSnackbar({ open: true, message: 'Chyba při mazání', severity: 'error' });
    }
  };

  /* ── Open edit dialog ── */
  const handleEdit = (member: StaffMember) => {
    setEditingStaff(member);
    setFormData(member);
    setOpenDialog(true);
  };

  /* ── Open add dialog ── */
  const handleAdd = () => {
    setEditingStaff(null);
    setFormData({
      firstName: '', lastName: '', email: '', phone: '',
      role: 'Doctor', specialization: '', isActive: true, services: [],
    });
    setOpenDialog(true);
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" width={250} height={40} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon color="primary" /> Správa zaměstnanců
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Přidávání, úprava a mazání zaměstnanců
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Obnovit">
              <IconButton onClick={loadStaff}><RefreshIcon /></IconButton>
            </Tooltip>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}
              sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 3, fontWeight: 600 }}>
              Přidat zaměstnance
            </Button>
          </Box>
        </Box>
      </motion.div>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {Object.entries(ROLE_LABELS).map(([role, label]) => {
          const count = staff.filter(s => s.role === role).length;
          return (
            <Grid key={role} size={{ xs: 6, sm: 4, md: 2.4 }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: ROLE_COLORS[role] }}>{count}</Typography>
                  <Typography variant="body2" color="text.secondary">{label}</Typography>
                </Paper>
              </motion.div>
            </Grid>
          );
        })}
      </Grid>

      {/* Staff Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                <TableCell sx={{ fontWeight: 700 }}>Jméno</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Telefon</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Služby</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Přihlášení</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Stav</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Akce</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {staff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <PersonIcon sx={{ fontSize: 48, color: '#ddd', mb: 1 }} />
                    <Typography color="text.secondary">Žádní zaměstnanci</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                staff.map((member, i) => (
                  <motion.tr key={member.id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.5) }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ bgcolor: ROLE_COLORS[member.role], width: 36, height: 36 }}>
                          {member.firstName[0]}{member.lastName[0]}
                        </Avatar>
                        <Typography sx={{ fontWeight: 500 }}>{member.firstName} {member.lastName}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>{member.phone}</TableCell>
                    <TableCell>
                      <Chip label={ROLE_LABELS[member.role]} size="small"
                        sx={{ bgcolor: ROLE_COLORS[member.role] + '18', color: ROLE_COLORS[member.role], fontWeight: 500 }} />
                    </TableCell>
                    <TableCell>{member.specialization || (member.services ?? []).map(id => services.find(s => s.id === id)?.name).filter(Boolean).join(', ') || '—'}</TableCell>
                    <TableCell>
                      {(() => {
                        const acc = accountFor(member.email);
                        if (!acc) return <Chip label="Bez účtu" size="small" variant="outlined" />;
                        return (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Chip
                              label={acc.isActive ? acc.role : 'Neaktivní'}
                              size="small"
                              sx={{ bgcolor: acc.isActive ? '#E8F5E9' : '#F5F5F5', color: acc.isActive ? '#2E7D32' : '#757575' }}
                            />
                            <Tooltip title="Vygenerovat nové heslo">
                              <IconButton size="small" onClick={() => handleResetPassword(member.email)}>
                                <RefreshIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Chip label={member.isActive ? 'Aktivní' : 'Neaktivní'} size="small"
                        sx={{ bgcolor: member.isActive ? '#E8F5E9' : '#F5F5F5', color: member.isActive ? '#2E7D32' : '#757575' }} />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Upravit">
                        <IconButton size="small" onClick={() => handleEdit(member)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Smazat">
                        <IconButton size="small" onClick={() => handleDelete(member.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </motion.div>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingStaff ? 'Upravit zaměstnance' : 'Přidat zaměstnance'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth label="Jméno" value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth label="Příjmení" value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Email" type="email" value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Telefon" value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as any })} label="Role">
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>{label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Služby, které pracovník provádí
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Rezervace těchto služeb půjdou do jeho kalendáře a oznámení.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {services.length === 0 && (
                  <Typography variant="body2" color="text.secondary">Žádné služby k výběru</Typography>
                )}
                {services.map(s => {
                  const selected = (formData.services ?? []).includes(s.id);
                  const takenByOther = s.providerName && s.providerName !== `${formData.firstName ?? ''} ${formData.lastName ?? ''}`.trim();
                  return (
                    <Chip
                      key={s.id}
                      label={s.providerName && !selected ? `${s.name} (${s.providerName})` : s.name}
                      onClick={() => {
                        const cur = formData.services ?? [];
                        setFormData({
                          ...formData,
                          services: selected ? cur.filter(id => id !== s.id) : [...cur, s.id],
                        });
                      }}
                      color={selected ? 'primary' : 'default'}
                      variant={selected ? 'filled' : 'outlined'}
                      sx={takenByOther && !selected ? { opacity: 0.7 } : undefined}
                    />
                  );
                })}
              </Box>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel control={<Switch checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} />} label="Aktivní" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setOpenDialog(false)} sx={{ borderRadius: 2 }}>Zrušit</Button>
          <Button onClick={handleSave} variant="contained"
            disabled={!formData.firstName || !formData.lastName || !formData.email}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 3, fontWeight: 600 }}>
            {editingStaff ? 'Uložit' : 'Přidat'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Credentials dialog (new member login) */}
      <Dialog open={newTempPassword !== ''} onClose={() => setNewTempPassword('')} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Přihlašovací údaje vytvořeny</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Předejte je novému členovi týmu. Po prvním přihlášení si nastaví vlastní heslo.
          </Typography>
          {newAccountEmail && (
            <Typography variant="body2" sx={{ mb: 1 }}>
              Email: <strong>{newAccountEmail}</strong>
            </Typography>
          )}
          <Alert severity="success" sx={{ wordBreak: 'break-all' }}>
            Heslo: <strong>{newTempPassword}</strong>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => { navigator.clipboard?.writeText(newTempPassword).catch(() => {}); }}
            variant="outlined" sx={{ borderRadius: 2 }}
          >
            Kopírovat
          </Button>
          <Button onClick={() => setNewTempPassword('')} variant="contained"
            sx={{ bgcolor: '#0D7377', borderRadius: 2 }}>
            Hotovo
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} sx={{ borderRadius: 2 }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
