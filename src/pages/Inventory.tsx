import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Card, CardContent, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Grid, Alert, Skeleton, LinearProgress,
} from '@mui/material';
import {
  Inventory2, Add, Warning, CheckCircle, Search, RestartAlt, Delete,
  Category, LocalShipping,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { inventoryApi } from '../api/inventory';
import type { InventoryItem } from '../api/inventory';
import toast from 'react-hot-toast';

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [restockDialog, setRestockDialog] = useState<{ open: boolean; item: InventoryItem | null; qty: number }>({
    open: false, item: null, qty: 0,
  });
  const [newItem, setNewItem] = useState({
    name: '', category: 'Pomůcky', quantity: 0, minQuantity: 5, unit: 'ks', location: 'Sklad 1', notes: '',
  });

  useEffect(() => {
    inventoryApi.getAll().catch(() => []).finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = items.filter(i => i.quantity <= i.minQuantity);
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  const handleRestock = async () => {
    if (!restockDialog.item || restockDialog.qty <= 0) return;
    try {
      await inventoryApi.restock(restockDialog.item.id, restockDialog.qty);
      toast.success('Doplněno');
      setRestockDialog({ open: false, item: null, qty: 0 });
      inventoryApi.getAll().then(setItems).catch(() => {});
    } catch {
      toast.error('Chyba');
    }
  };

  const handleCreate = async () => {
    if (!newItem.name) return;
    try {
      await inventoryApi.create(newItem);
      toast.success('Položka přidána');
      setDialogOpen(false);
      inventoryApi.getAll().then(setItems).catch(() => {});
    } catch {
      toast.error('Chyba');
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
              <Inventory2 color="primary" /> Sklad
            </Typography>
            <Typography variant="body2" color="text.secondary">{items.length} položek celkem</Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 3, fontWeight: 600 }}>
            Přidat položku
          </Button>
        </Box>
      </motion.div>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ bgcolor: '#0D737714', color: '#0D7377', p: 1.5, borderRadius: 2 }}><Category /></Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Celkem položek</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{totalItems} ks</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ bgcolor: '#ED6C0214', color: '#ED6C02', p: 1.5, borderRadius: 2 }}><Warning /></Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Nízký stav</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: lowStock.length > 0 ? '#ED6C02' : 'inherit' }}>
                  {lowStock.length} položek
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ bgcolor: '#2E7D3214', color: '#2E7D32', p: 1.5, borderRadius: 2 }}><CheckCircle /></Box>
              <Box>
                <Typography variant="body2" color="text.secondary">V pořádku</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{items.length - lowStock.length}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {lowStock.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          {lowStock.length} položek má nízký stav — doplnit zásoby
        </Alert>
      )}

      <TextField
        fullWidth size="small" placeholder="Hledat ve skladu..." value={search}
        onChange={e => setSearch(e.target.value)}
        sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        slotProps={{ input: { startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> } }}
      />

      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8f9fa' }}>
              <TableCell sx={{ fontWeight: 700 }}>Název</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Kategorie</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Množství</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Stav</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Umístění</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Expirace</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Akce</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((item, i) => {
              const isLow = item.quantity <= item.minQuantity;
              const pct = Math.min((item.quantity / Math.max(item.minQuantity * 2, 1)) * 100, 100);
              return (
                <motion.tr key={item.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  /* `bgcolor` is an MUI system prop, not a CSS property, and
                     this is a `motion.tr` with a plain `style` - so the low
                     stock highlight has never appeared. */
                  style={{ backgroundColor: isLow ? '#FFF8E1' : 'inherit' }}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 500 }}>{item.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={item.category} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
                      <Typography sx={{ fontWeight: 600, minWidth: 40 }}>{item.quantity}</Typography>
                      <LinearProgress
                        variant="determinate" value={pct}
                        sx={{
                          flex: 1, height: 6, borderRadius: 3,
                          bgcolor: '#f0f0f0',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: isLow ? '#ED6C02' : '#2E7D32',
                            borderRadius: 3,
                          },
                        }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={isLow ? <Warning /> : <CheckCircle />}
                      label={isLow ? 'Nízký stav' : 'OK'}
                      size="small"
                      sx={{
                        bgcolor: isLow ? '#ED6C0214' : '#2E7D3214',
                        color: isLow ? '#ED6C02' : '#2E7D32',
                        fontWeight: 500,
                      }}
                    />
                  </TableCell>
                  <TableCell>{item.location}</TableCell>
                  <TableCell>{item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : '—'}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Doplnit">
                      <IconButton size="small" onClick={() => setRestockDialog({ open: true, item, qty: 0 })}
                        sx={{ color: '#0D7377' }}>
                        <RestartAlt fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Smazat">
                      <IconButton size="small" onClick={async () => {
                        if (confirm('Opravdu smazat?')) {
                          await inventoryApi.delete(item.id);
                          toast.success('Smazáno');
                          inventoryApi.getAll().then(setItems).catch(() => {});
                        }
                      }} sx={{ color: '#D32F2F' }}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </motion.tr>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <Inventory2 sx={{ fontSize: 48, color: '#ddd', mb: 1 }} />
                  <Typography color="text.secondary">Sklad je prázdný</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle><Typography variant="h6" sx={{ fontWeight: 700 }}>Přidat položku</Typography></DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Název" value={newItem.name}
                onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Kategorie" value={newItem.category}
                onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}>
                {['Pomůcky', 'Diagnostika', 'Spotřební materiál', 'Ochranné prostředky', 'Úklid'].map(c => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField fullWidth type="number" label="Množství" value={newItem.quantity}
                onChange={e => setNewItem(p => ({ ...p, quantity: +e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField fullWidth type="number" label="Min. stav" value={newItem.minQuantity}
                onChange={e => setNewItem(p => ({ ...p, minQuantity: +e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="Umístění" value={newItem.location}
                onChange={e => setNewItem(p => ({ ...p, location: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: 2 }}>Zrušit</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!newItem.name}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 3, fontWeight: 600 }}>
            Přidat
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restock Dialog */}
      <Dialog open={restockDialog.open} onClose={() => setRestockDialog({ open: false, item: null, qty: 0 })}>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Doplnit — {restockDialog.item?.name}</Typography>
        </DialogTitle>
        <DialogContent>
          <TextField fullWidth type="number" label="Množství k doplnění" value={restockDialog.qty || ''}
            onChange={e => setRestockDialog(p => ({ ...p, qty: +e.target.value }))}
            sx={{ mt: 1, minWidth: 250 }} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRestockDialog({ open: false, item: null, qty: 0 })}>Zrušit</Button>
          <Button variant="contained" onClick={handleRestock} disabled={restockDialog.qty <= 0}
            sx={{ bgcolor: '#0D7377', borderRadius: 2 }}>
            Doplnit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
