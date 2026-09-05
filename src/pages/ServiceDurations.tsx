/* ══════════════════════════════════════════════════════════════
   SERVICE DURATIONS — Settings for appointment service times
   Admin can edit prices and durations. Doctor can only edit times.
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, TextField, Button, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Tooltip, Chip, Alert,
} from '@mui/material';
import { Save, AccessTime, AttachMoney } from '@mui/icons-material';
import { billingApi, type ServiceItem } from '../api/billing';
import { useAppStore } from '../store/useAppStore';
import { usePermission } from '../auth/usePermission';
import toast from 'react-hot-toast';

export default function ServiceDurations() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ durationMinutes: number; priceCzk: number }>({ durationMinutes: 0, priceCzk: 0 });
  const canEditPrices = usePermission('settings:edit');

  useEffect(() => {
    billingApi.getServices().then(setServices).catch(() => {});
  }, []);

  const startEdit = (s: ServiceItem) => {
    setEditingId(s.id);
    setEditValues({ durationMinutes: s.durationMinutes, priceCzk: s.priceCzk });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setServices(prev => prev.map(s =>
      s.id === editingId
        ? { ...s, durationMinutes: editValues.durationMinutes, priceCzk: canEditPrices ? editValues.priceCzk : s.priceCzk }
        : s
    ));
    setEditingId(null);
    toast.success('Uloženo');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AccessTime sx={{ color: '#0D7377' }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Služby a ceník</Typography>
      </Box>
      <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
        {canEditPrices
          ? 'Máte oprávnění upravovat ceny i délky služeb.'
          : 'Můžete upravovat pouze délky služeb. Ceny upravuje administrátor.'}
      </Alert>

      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Služba</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Kód</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Kategorie</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Délka (min)</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Cena (Kč)</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 60 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {services.map(s => (
              <TableRow key={s.id} hover>
                <TableCell>
                  <Typography sx={{ fontWeight: 500 }}>{s.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.description}</Typography>
                </TableCell>
                <TableCell><Chip label={s.code} size="small" /></TableCell>
                <TableCell>{s.category}</TableCell>
                <TableCell>
                  {editingId === s.id ? (
                    <TextField size="small" type="number" value={editValues.durationMinutes}
                      onChange={e => setEditValues(v => ({ ...v, durationMinutes: Number(e.target.value) }))}
                      sx={{ width: 80, '& .MuiOutlinedInput-root': { borderRadius: 1 } }} />
                  ) : (
                    <Chip label={`${s.durationMinutes} min`} size="small"
                      sx={{ bgcolor: '#0D737712', color: '#0D7377' }} />
                  )}
                </TableCell>
                <TableCell>
                  {editingId === s.id && canEditPrices ? (
                    <TextField size="small" type="number" value={editValues.priceCzk}
                      onChange={e => setEditValues(v => ({ ...v, priceCzk: Number(e.target.value) }))}
                      sx={{ width: 100, '& .MuiOutlinedInput-root': { borderRadius: 1 } }} />
                  ) : (
                    <Typography sx={{ fontWeight: 600 }}>{s.priceCzk?.toLocaleString('cs-CZ')} Kč</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === s.id ? (
                    <Tooltip title="Uložit">
                      <IconButton size="small" onClick={saveEdit} color="primary"><Save fontSize="small" /></IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Upravit">
                      <IconButton size="small" onClick={() => startEdit(s)}><AccessTime fontSize="small" /></IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
