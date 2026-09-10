/* ══════════════════════════════════════════════════════════════
   BILLING SYSTEM — PLAN-01 Feature C231-C240
   - Invoice creation with line items
   - Tax calculation
   - Print/export functionality
   ══════════════════════════════════════════════════════════════ */
import { useState } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Divider
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Print as PrintIcon,
  Send as SendIcon
} from '@mui/icons-material';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Props {
  patientName?: string;
}

export default function BillingSystem({ patientName = '' }: Props) {
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [taxRate] = useState(21);

  const addItem = () => {
    setItems([...items, {
      id: Date.now().toString(),
      description: '', quantity: 1, unitPrice: 0, total: 0,
    }]);
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      updated.total = updated.quantity * updated.unitPrice;
      return updated;
    }));
  };

  const removeItem = (id: string) => setItems(items.filter(i => i.id !== id));

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Faktura</Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField fullWidth label="Pacient" value={patientName} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <TextField fullWidth type="date" label="Datum" defaultValue={new Date().toISOString().slice(0, 10)} slotProps={{ inputLabel: { shrink: true } }} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <TextField fullWidth type="date" label="Splatnost" defaultValue={new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)} slotProps={{ inputLabel: { shrink: true } }} />
        </Grid>
      </Grid>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1">Položky</Typography>
        <Button startIcon={<AddIcon />} onClick={addItem}>Přidat položku</Button>
      </Box>

      <TableContainer sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Popis</TableCell>
              <TableCell align="right">Množství</TableCell>
              <TableCell align="right">Cena/ks</TableCell>
              <TableCell align="right">Celkem</TableCell>
              <TableCell align="right"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <TextField size="small" value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} fullWidth />
                </TableCell>
                <TableCell align="right">
                  <TextField size="small" type="number" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)} sx={{ width: 80 }} />
                </TableCell>
                <TableCell align="right">
                  <TextField size="small" type="number" value={item.unitPrice} onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} sx={{ width: 100 }} />
                </TableCell>
                <TableCell align="right">{item.total} Kč</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => removeItem(item.id)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box display="flex" justifyContent="flex-end">
        <Box sx={{ minWidth: 300 }}>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography>Mezisoučet:</Typography><Typography>{subtotal} Kč</Typography>
          </Box>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography>DPH ({taxRate}%):</Typography><Typography>{tax} Kč</Typography>
          </Box>
          <Divider sx={{ my: 1 }} />
          <Box display="flex" justifyContent="space-between">
            <Typography variant="h6">Celkem:</Typography><Typography variant="h6">{total} Kč</Typography>
          </Box>
        </Box>
      </Box>

      <Box display="flex" justifyContent="flex-end" gap={1} mt={3}>
        <Button variant="outlined" startIcon={<PrintIcon />}>Tisknout</Button>
        <Button variant="contained" startIcon={<SendIcon />}
          sx={{ bgcolor: '#0D7377', '&:hover': { bgcolor: '#095456' } }}>Odeslat fakturu</Button>
      </Box>
    </Paper>
  );
}
