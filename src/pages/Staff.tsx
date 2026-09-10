import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Card, CardContent, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Avatar, Chip, IconButton, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Grid, Alert, Skeleton,
} from '@mui/material';
import {
  People, Add, Edit, Block, CheckCircle, Search, PersonAdd, MedicalServices,
  AdminPanelSettings, Healing, SupportAgent,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { staffApi } from '../api/staff';
import type { StaffMember } from '../api/staff';
import toast from 'react-hot-toast';

const roleConfig: Record<string, { label: string; color: string; icon: React.ReactElement }> = {
  Admin: { label: 'Administrátor', color: '#D32F2F', icon: <AdminPanelSettings fontSize="small" /> },
  Doctor: { label: 'Lékař', color: '#0D7377', icon: <MedicalServices fontSize="small" /> },
  Nurse: { label: 'Sestra', color: '#2E7D32', icon: <Healing fontSize="small" /> },
  Receptionist: { label: 'Recepce', color: '#ED6C02', icon: <SupportAgent fontSize="small" /> },
};

export default function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newMember, setNewMember] = useState({ fullName: '', role: 'Doctor', department: 'Sportovni medicina', email: '', phone: '' });

  useEffect(() => {
    staffApi.getAll().then(setStaff).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = staff.filter(s =>
    s.fullName.toLowerCase().includes(search.toLowerCase()) ||
    s.role.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!newMember.fullName || !newMember.email) return;
    try {
      await staffApi.create(newMember);
      toast.success('Zaměstnanec přidán');
      setDialogOpen(false);
      staffApi.getAll().then(setStaff).catch(() => {});
    } catch {
      toast.error('Chyba při přidávání');
    }
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" width={200} height={40} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <People color="primary" /> Zaměstnanci
            </Typography>
            <Typography variant="body2" color="text.secondary">{staff.length} zaměstnanců</Typography>
          </Box>
          <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setDialogOpen(true)}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 3, fontWeight: 600 }}>
            Přidat zaměstnance
          </Button>
        </Box>
      </motion.div>

      {/* Role Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {Object.entries(roleConfig).map(([role, config], i) => {
          const count = staff.filter(s => s.role === role).length;
          return (
            <Grid key={role} size={{ xs: 6, md: 3 }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: `${config.color}18`, color: config.color, width: 44, height: 44 }}>
                      {config.icon}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" color="text.secondary">{config.label}</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>{count}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          );
        })}
      </Grid>

      {/* Search */}
      <TextField
        fullWidth size="small" placeholder="Hledat zaměstnance..." value={search}
        onChange={e => setSearch(e.target.value)}
        sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> } }}
      />

      {/* Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8f9fa' }}>
              <TableCell sx={{ fontWeight: 700 }}>Jméno</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Oddelení</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Telefon</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Stav</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Akce</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((member, i) => {
              const role = roleConfig[member.role] || roleConfig.Doctor;
              return (
                <motion.tr key={member.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ bgcolor: '#0D7377', width: 36, height: 36, fontSize: 13 }}>
                        {member.fullName.split(' ').map(n => n[0]).join('')}
                      </Avatar>
                      <Typography sx={{ fontWeight: 500 }}>{member.fullName}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip icon={role.icon} label={role.label} size="small"
                      sx={{ bgcolor: `${role.color}14`, color: role.color, fontWeight: 500 }} />
                  </TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{member.department || '—'}</TableCell>
                  <TableCell>{member.phone || '—'}</TableCell>
                  <TableCell>
                    <Chip
                      icon={member.isActive ? <CheckCircle /> : <Block />}
                      label={member.isActive ? 'Aktivní' : 'Neaktivní'}
                      size="small"
                      sx={{
                        bgcolor: member.isActive ? '#2E7D3214' : '#D32F2F14',
                        color: member.isActive ? '#2E7D32' : '#D32F2F',
                        fontWeight: 500,
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Upravit"><IconButton size="small"><Edit fontSize="small" /></IconButton></Tooltip>
                  </TableCell>
                </motion.tr>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <People sx={{ fontSize: 48, color: '#ddd', mb: 1 }} />
                  <Typography color="text.secondary">Žádní zaměstnanci</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Přidat zaměstnance</Typography>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Cele jmeno" value={newMember.fullName}
                onChange={e => setNewMember(p => ({ ...p, fullName: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Role" value={newMember.role}
                onChange={e => setNewMember(p => ({ ...p, role: e.target.value }))}>
                {Object.entries(roleConfig).map(([key, cfg]) => (
                  <MenuItem key={key} value={key}>{cfg.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Email" value={newMember.email} type="email"
                onChange={e => setNewMember(p => ({ ...p, email: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Telefon" value={newMember.phone}
                onChange={e => setNewMember(p => ({ ...p, phone: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Oddeleni" value={newMember.department}
                onChange={e => setNewMember(p => ({ ...p, department: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: 2 }}>Zrušit</Button>
          <Button variant="contained" onClick={handleCreate}
            disabled={!newMember.fullName || !newMember.email}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 3, fontWeight: 600 }}>
            Přidat
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
