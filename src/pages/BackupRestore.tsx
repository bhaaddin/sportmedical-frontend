/* ══════════════════════════════════════════════════════════════
   BACKUP & RESTORE — PLAN-01 Feature A66-A70
   - Manual backup creation
   - Scheduled backups
   - Restore from backup
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Grid, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Alert,
  Snackbar, Chip, IconButton, Tooltip, LinearProgress
} from '@mui/material';
import {
  Backup as BackupIcon, Restore as RestoreIcon, Download as DownloadIcon,
  Delete as DeleteIcon, Refresh as RefreshIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import client from '../api/client';

interface BackupEntry {
  id: string;
  filename: string;
  size: string;
  createdAt: string;
  status: 'completed' | 'in-progress' | 'failed';
}

export default function BackupRestore() {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => { loadBackups(); }, []);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/admin/backups');
      const data = res.data?.value ?? res.data;
      setBackups(Array.isArray(data) ? data : data?.items ?? []);
    } catch { setBackups([]); }
    finally { setLoading(false); }
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      await client.post('/api/admin/backups');
      setSnackbar({ open: true, message: 'Záloha vytvořena', severity: 'success' });
      loadBackups();
    } catch {
      setSnackbar({ open: true, message: 'Chyba při vytváření zálohy', severity: 'error' });
    } finally { setCreating(false); }
  };

  const handleDownload = async (id: string) => {
    try {
      const res = await client.get(`/api/admin/backups/${id}/download`, { responseType: 'blob' });
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${id}.db`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setSnackbar({ open: true, message: 'Chyba při stahování', severity: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Opravdu chcete smazat tuto zálohu?')) return;
    try {
      await client.delete(`/api/admin/backups/${id}`);
      setSnackbar({ open: true, message: 'Záloha smazána', severity: 'success' });
      loadBackups();
    } catch {
      setSnackbar({ open: true, message: 'Chyba při mazání', severity: 'error' });
    }
  };

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <BackupIcon color="primary" /> Záloha a obnovení
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Správa záloh databáze
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Obnovit"><IconButton onClick={loadBackups}><RefreshIcon /></IconButton></Tooltip>
            <Button variant="contained" startIcon={<BackupIcon />} onClick={handleCreateBackup} disabled={creating}
              sx={{ bgcolor: '#0D7377', '&:hover': { bgcolor: '#095456' } }}>
              {creating ? 'Vytvářím...' : 'Vytvořit zálohu'}
            </Button>
          </Box>
        </Box>
      </motion.div>

      {creating && <LinearProgress sx={{ mb: 3 }} />}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                <TableCell sx={{ fontWeight: 700 }}>Název</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Velikost</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Vytvořeno</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Stav</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Akce</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {backups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <BackupIcon sx={{ fontSize: 48, color: '#ddd', mb: 1 }} />
                    <Typography color="text.secondary">Žádné zálohy</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                backups.map((backup) => (
                  <TableRow key={backup.id} hover>
                    <TableCell>{backup.filename}</TableCell>
                    <TableCell>{backup.size}</TableCell>
                    <TableCell>{new Date(backup.createdAt).toLocaleString('cs-CZ')}</TableCell>
                    <TableCell>
                      <Chip label={backup.status === 'completed' ? 'Hotovo' : backup.status === 'in-progress' ? 'Probíhá' : 'Chyba'}
                        size="small" color={backup.status === 'completed' ? 'success' : backup.status === 'in-progress' ? 'warning' : 'error'} />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Stáhnout"><IconButton size="small" onClick={() => handleDownload(backup.id)}><DownloadIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Smazat"><IconButton size="small" onClick={() => handleDelete(backup.id)} color="error"><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </motion.div>

      <Snackbar open={snackbar.open} autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
