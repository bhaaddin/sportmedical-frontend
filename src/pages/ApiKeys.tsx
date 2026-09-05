/* ══════════════════════════════════════════════════════════════
   API KEYS — PLAN-01 Feature A96-A100
   - API key management
   - Create/revoke keys
   - Usage tracking
   ══════════════════════════════════════════════════════════════ */
import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
  Chip, Tooltip,
  TextField,
} from '@mui/material';
import {
  VpnKey as KeyIcon, Add as AddIcon, Delete as DeleteIcon,
  ContentCopy as CopyIcon, Visibility as ShowIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string;
  requests: number;
  active: boolean;
}

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([
    { id: '1', name: 'Mobile App', key: 'sk_live_abc123...xyz789', createdAt: '2026-08-01', lastUsed: '2026-09-03', requests: 12450, active: true },
    { id: '2', name: 'Webhook Integration', key: 'sk_live_def456...uvw012', createdAt: '2026-07-15', lastUsed: '2026-09-02', requests: 8920, active: true },
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const handleCreate = () => {
    if (!newKeyName) return;
    const generatedKey = `sk_live_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    setNewKey(generatedKey);
    setKeys([...keys, {
      id: Date.now().toString(),
      name: newKeyName,
      key: generatedKey.slice(0, 8) + '...' + generatedKey.slice(-4),
      createdAt: new Date().toISOString().slice(0, 10),
      lastUsed: 'Nikdy',
      requests: 0,
      active: true,
    }]);
    setNewKeyName('');
  };

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setSnackbar({ open: true, message: 'Klíč zkopírován', severity: 'success' });
  };

  const handleRevoke = (id: string) => {
    if (!window.confirm('Opravdu chcete zrušit tento klíč?')) return;
    setKeys(keys.filter(k => k.id !== id));
    setSnackbar({ open: true, message: 'Klíč zrušen', severity: 'success' });
  };

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <KeyIcon color="primary" /> API klíče
            </Typography>
            <Typography variant="body2" color="text.secondary">Správa API klíčů pro integrace</Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}
            sx={{ bgcolor: '#0D7377', '&:hover': { bgcolor: '#095456' } }}>
            Nový klíč
          </Button>
        </Box>
      </motion.div>

      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8f9fa' }}>
              <TableCell sx={{ fontWeight: 700 }}>Název</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Klíč</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Vytvořeno</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Poslední použití</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Požadavků</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Stav</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Akce</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {keys.map((apiKey) => (
              <TableRow key={apiKey.id} hover>
                <TableCell sx={{ fontWeight: 500 }}>{apiKey.name}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{apiKey.key}</Typography>
                    <Tooltip title="Kopírovat">
                      <IconButton size="small" onClick={() => handleCopy(apiKey.key)}><CopyIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell>{apiKey.createdAt}</TableCell>
                <TableCell>{apiKey.lastUsed}</TableCell>
                <TableCell>{apiKey.requests.toLocaleString()}</TableCell>
                <TableCell>
                  <Chip label={apiKey.active ? 'Aktivní' : 'Zrušený'} size="small"
                    color={apiKey.active ? 'success' : 'default'} />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Zrušit klíč">
                    <IconButton size="small" onClick={() => handleRevoke(apiKey.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setNewKey(''); }} maxWidth="sm" fullWidth>
        <DialogTitle>{newKey ? 'Nový API klíč' : 'Vytvořit API klíč'}</DialogTitle>
        <DialogContent>
          {newKey ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              Zkopírujte si klíč — znovu se nezobrazí!
            </Alert>
          ) : (
            <TextField fullWidth label="Název klíče" value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)} sx={{ mt: 1 }} />
          )}
          {newKey && (
            <Paper sx={{ p: 2, mt: 2, bgcolor: '#f5f5f5' }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{newKey}</Typography>
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => { setDialogOpen(false); setNewKey(''); }} sx={{ borderRadius: 2 }}>{newKey ? 'Zavřít' : 'Zrušit'}</Button>
          {!newKey && (
            <Button onClick={handleCreate} variant="contained" disabled={!newKeyName}
              sx={{ bgcolor: '#0D7377', '&:hover': { bgcolor: '#095456' } }}>Vytvořit</Button>
          )}
          {newKey && (
            <Button onClick={() => handleCopy(newKey)} variant="contained"
              sx={{ bgcolor: '#0D7377', '&:hover': { bgcolor: '#095456' } }}>Kopírovat</Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
