import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Box, Typography, Paper, Card, CardContent, Button, Chip,
  Grid, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Skeleton,
} from '@mui/material';
import { Receipt, Add, Payments, CheckCircle, Pending, Search } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { billingApi } from '../api/billing';
import type { Invoice } from '../api/billing';
import { servicesApi } from '../api/services';
import type { ServiceItem } from '../api/services';
import type { Patient } from '../api/patients';
import PatientPicker from '../components/patients/PatientPicker';
import { NumberSeriesPreview } from '../components/NumberSeriesPreview';
import toast from 'react-hot-toast';

/* ── Status config: the states the server's InvoiceStatus can be in ── */
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  Draft: { label: 'Návrh', color: '#757575', bg: '#F5F5F5' },
  Issued: { label: 'Vystaveno', color: '#0288D1', bg: '#E1F5FE' },
  PartiallyPaid: { label: 'Částečně zaplaceno', color: '#ED6C02', bg: '#FFF3E0' },
  Paid: { label: 'Zaplaceno', color: '#2E7D32', bg: '#E8F5E9' },
  Refunded: { label: 'Vráceno', color: '#6A1B9A', bg: '#F3E5F5' },
  Cancelled: { label: 'Zrušeno', color: '#9E9E9E', bg: '#F5F5F5' },
};

/* ── Column definitions ── */
const COLUMNS = [
  { key: 'patientName', label: 'Pacient', width: 180 },
  { key: 'invoiceNumber', label: 'Číslo faktury', width: 140 },
  { key: 'totalCzk', label: 'Celkem (Kč)', width: 120 },
  { key: 'paidCzk', label: 'Zaplaceno (Kč)', width: 130 },
  { key: 'remainingCzk', label: 'Zbývá (Kč)', width: 120 },
  { key: 'status', label: 'Stav', width: 150 },
];

export default function Billing() {
  /* ── Data ── */
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceItem[]>([]);

  /* ── Filters ── */
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<string>('invoiceNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  /* ── Dialogs ── */
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newInvoice, setNewInvoice] = useState({ patientId: '', serviceId: '', notes: '' });
  const [invoicePatient, setInvoicePatient] = useState<Patient | null>(null);

  /* ── Fetch data ── */
  useEffect(() => {
    Promise.all([
      billingApi.getInvoices().catch(() => []),
      servicesApi.getAll().catch(() => []),
    ]).then(([inv, srv]) => {
      setInvoices(inv);
      setServices(srv);
    }).finally(() => setLoading(false));
  }, []);

  /* ── Filtered & sorted data ── */
  const filteredInvoices = useMemo(() => {
    let result = invoices;

    /* Search: patient name, invoice number or id */
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (inv) =>
          inv.patientName?.toLowerCase().includes(q) ||
          inv.invoiceNumber?.toLowerCase().includes(q) ||
          inv.patientId?.toLowerCase().includes(q) ||
          inv.id?.toLowerCase().includes(q),
      );
    }

    /* Status filter */
    if (statusFilter !== 'all') {
      result = result.filter((inv) => inv.status === statusFilter);
    }

    /* Sort */
    return [...result].sort((a, b) => {
      const aVal = (a as any)[sortBy] ?? '';
      const bVal = (b as any)[sortBy] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [invoices, search, statusFilter, sortBy, sortDir]);

  /* ── KPI stats ── */
  const stats = useMemo(() => {
    const total = invoices.length;
    const totalAmount = invoices.reduce((s, i) => s + i.totalCzk, 0);
    const outstanding = invoices.filter((i) => i.status === 'Issued' || i.status === 'PartiallyPaid');
    const outstandingAmount = outstanding.reduce((s, i) => s + i.remainingCzk, 0);
    const paidCount = invoices.filter((i) => i.status === 'Paid').length;

    return { total, totalAmount, outstandingCount: outstanding.length, outstandingAmount, paidCount };
  }, [invoices]);

  /* ── Sort ── */
  const handleSort = useCallback((col: string) => {
    setSortBy((prev) => {
      if (prev === col) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return col;
      }
      setSortDir('asc');
      return col;
    });
  }, []);

  /* ── Create invoice ── */
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const handleCreateInvoice = async () => {
    if (!newInvoice.patientId || selectedServices.length === 0) return;
    try {
      const inv = await billingApi.createInvoice({
        patientId: newInvoice.patientId,
        serviceId: selectedServices[0],
        notes: newInvoice.notes,
      });
      /* Add additional services as line items */
      for (let i = 1; i < selectedServices.length; i++) {
        try {
          await billingApi.addLineItem(inv.id, selectedServices[i]);
        } catch { /* skip failed line items */ }
      }
      toast.success('Faktura vytvořena');
      setCreateDialogOpen(false);
      setNewInvoice({ patientId: '', serviceId: '', notes: '' });
      setInvoicePatient(null);
      setSelectedServices([]);
      const refreshed = await billingApi.getInvoices();
      setInvoices(refreshed);
    } catch {
      toast.error('Chyba při vytváření faktury');
    }
  };

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceId) ? prev.filter(s => s !== serviceId) : [...prev, serviceId]
    );
  };

  const invoiceTotal = useMemo(() => {
    return services
      .filter(s => selectedServices.includes(s.id))
      .reduce((sum, s) => sum + (s.priceCzk || 0), 0);
  }, [services, selectedServices]);

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" width={200} height={40} sx={{ mb: 3 }} />
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {[1, 2, 3, 4].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
              <Skeleton variant="rounded" height={100} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3 }} />
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
              <Receipt color="primary" /> Fakturace
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Vystavené faktury a jejich úhrady
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreateDialogOpen(true)}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 3, fontWeight: 600 }}>
            Nová faktura
          </Button>
        </Box>
      </motion.div>

      {/* ── KPI Cards ── */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[
          { label: 'Celkem faktur', value: stats.total, color: '#0D7377', icon: <Receipt /> },
          { label: 'Celková částka', value: `${stats.totalAmount.toLocaleString('cs-CZ')} Kč`, color: '#2E7D32', icon: <Payments /> },
          { label: 'Čeká na úhradu', value: `${stats.outstandingCount} (${stats.outstandingAmount.toLocaleString('cs-CZ')} Kč)`, color: '#ED6C02', icon: <Pending /> },
          { label: 'Zaplaceno', value: stats.paidCount, color: '#2E7D32', icon: <CheckCircle /> },
        ].map((stat, i) => (
          <Grid key={stat.label} size={{ xs: 12, sm: 6, md: 3 }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ bgcolor: `${stat.color}14`, color: stat.color, p: 1.5, borderRadius: 2 }}>{stat.icon}</Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>{stat.label}</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: stat.color, fontSize: 16, whiteSpace: 'nowrap' }}>{stat.value}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* ── Filters ── */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Grid container spacing={2} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth size="small" placeholder="Hledat faktury..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: '#999' }} fontSize="small" /> } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField fullWidth size="small" select label="Stav" value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}>
              <MenuItem value="all">Všechny</MenuItem>
              {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                <MenuItem key={key} value={key}>{val.label}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* ── Invoice Table ── */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      borderBottom: '2px solid #e0e0e0',
                      fontWeight: 700,
                      fontSize: 12,
                      color: '#666',
                      width: col.width,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      position: 'sticky',
                      top: 0,
                      background: '#f8f9fa',
                      zIndex: 2,
                    }}
                  >
                    <span>
                      {col.label}
                      {sortBy === col.key && (
                        <span style={{ marginLeft: 4, fontSize: 10 }}>
                          {sortDir === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv, i) => {
                const st = STATUS_CONFIG[inv.status] ?? { label: inv.status, color: '#757575', bg: '#F5F5F5' };
                return (
                  <motion.tr
                    key={inv.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.5) }}
                    style={{ background: i % 2 ? '#fafbfc' : '#fff' }}
                  >
                    {/* Patient */}
                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>
                      {inv.patientName}
                    </td>

                    {/* Invoice # */}
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>
                      {inv.invoiceNumber}
                    </td>

                    {/* Total */}
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                      {inv.totalCzk.toLocaleString('cs-CZ')} Kč
                    </td>

                    {/* Paid */}
                    <td style={{ padding: '8px 12px', color: '#666' }}>
                      {inv.paidCzk.toLocaleString('cs-CZ')} Kč
                    </td>

                    {/* Remaining */}
                    <td style={{ padding: '8px 12px', color: inv.remainingCzk > 0 ? '#ED6C02' : '#2E7D32', fontWeight: 500 }}>
                      {inv.remainingCzk.toLocaleString('cs-CZ')} Kč
                    </td>

                    {/* Status */}
                    <td style={{ padding: '8px 12px' }}>
                      <Chip
                        label={st.label}
                        size="small"
                        sx={{ bgcolor: st.bg, color: st.color, fontWeight: 500, fontSize: 11 }}
                      />
                    </td>
                  </motion.tr>
                );
              })}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} style={{ padding: 48, textAlign: 'center' }}>
                    <Receipt sx={{ fontSize: 48, color: '#ddd', mb: 1 }} />
                    <Typography color="text.secondary">Žádné faktury k zobrazení</Typography>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Box>

        {/* Table footer */}
        <Box sx={{ p: 1.5, borderTop: '1px solid #e0e0e0' }}>
          <Typography variant="body2" color="text.secondary">
            Zobrazeno {filteredInvoices.length} z {invoices.length} faktur
          </Typography>
        </Box>
      </Paper>

      {/* ── Create Invoice Dialog ── */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Nová faktura</Typography>
        </DialogTitle>
        <DialogContent>
          {createDialogOpen && (
            <Box sx={{ mb: 2 }}>
              <NumberSeriesPreview documentType="FA" />
            </Box>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <PatientPicker
                value={invoicePatient}
                onChange={(patient) => {
                  setInvoicePatient(patient);
                  setNewInvoice((p) => ({ ...p, patientId: patient?.id ?? '' }));
                }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Služby (vyberte více)</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, maxHeight: 200, overflow: 'auto', p: 1, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                {services.filter(s => s.isActive).map((s) => (
                  <Chip
                    key={s.id}
                    label={`${s.name} — ${s.priceCzk?.toLocaleString('cs-CZ')} Kč`}
                    onClick={() => toggleService(s.id)}
                    color={selectedServices.includes(s.id) ? 'primary' : 'default'}
                    variant={selectedServices.includes(s.id) ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 500 }}
                  />
                ))}
              </Box>
              {selectedServices.length > 0 && (
                <Typography variant="body2" sx={{ mt: 1, fontWeight: 600, color: '#0D7377' }}>
                  Celkem: {invoiceTotal.toLocaleString('cs-CZ')} Kč ({selectedServices.length} služeb)
                </Typography>
              )}
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth multiline rows={2} label="Poznámky" value={newInvoice.notes}
                onChange={(e) => setNewInvoice((p) => ({ ...p, notes: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => { setCreateDialogOpen(false); setSelectedServices([]); }} sx={{ borderRadius: 2 }}>Zrušit</Button>
          <Button variant="contained" onClick={handleCreateInvoice}
            disabled={!newInvoice.patientId || selectedServices.length === 0}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 3, fontWeight: 600 }}>
            Vytvořit fakturu
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
