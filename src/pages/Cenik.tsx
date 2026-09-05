import { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Skeleton,
} from '@mui/material';
import { Search, AttachMoney, Timer, Devices, CheckCircle, Edit } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { servicesApi } from '../api/services';
import type { ServiceItem } from '../api/services';

const categoryColors: Record<string, { bg: string; text: string }> = {
  'Prohlídka': { bg: '#E8F5E9', text: '#2E7D32' },
  'Diagnostika': { bg: '#E3F2FD', text: '#1565C0' },
  'Měření': { bg: '#FFF3E0', text: '#E65100' },
  'Terapie': { bg: '#F3E5F5', text: '#7B1FA2' },
};

export default function Cenik() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    servicesApi.getAll()
      .then(setServices)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = services.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalServices = services.length;
  const avgPrice = services.length > 0 ? Math.round(services.reduce((a, s) => a + s.priceCzk, 0) / services.length) : 0;

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AttachMoney color="primary" /> Ceník služeb
            </Typography>
            <Typography variant="body2" color="text.secondary">Přehled nabízených služeb a ceník</Typography>
          </Box>
          <Button variant="outlined" startIcon={<Edit />} sx={{ borderRadius: 2, px: 3 }}>
            Upravit ceník
          </Button>
        </Box>
      </motion.div>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[
          { label: 'Celkem služeb', value: totalServices, color: '#0D7377' },
          { label: 'Průměrná cena', value: `${avgPrice.toLocaleString('cs-CZ')} Kč`, color: '#2E7D32' },
          { label: 'Kategorií', value: new Set(services.map(s => s.category)).size, color: '#ED6C02' },
        ].map((stat, i) => (
          <Grid key={stat.label} size={{ xs: 12, sm: 4 }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: stat.color }}>
                    {loading ? <Skeleton width={80} /> : stat.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Search */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <TextField
          fullWidth
          placeholder="Hledat službu..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search /></InputAdornment>,
          }}
          sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
        />
      </motion.div>

      {/* Service Cards */}
      {loading ? (
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map(i => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Skeleton variant="rounded" height={200} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Grid container spacing={3}>
          {filtered.map((service, i) => {
            const colors = categoryColors[service.category] || { bg: '#F5F5F5', text: '#666' };
            return (
              <Grid key={service.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                >
                  <Card sx={{ height: '100%', overflow: 'hidden' }}>
                    <Box sx={{ height: 4, bgcolor: colors.text }} />
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box>
                          <Chip label={service.code} size="small" sx={{ mb: 1, fontWeight: 700, bgcolor: colors.bg, color: colors.text }} />
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>{service.name}</Typography>
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 800, color: '#0D7377' }}>
                          {service.priceCzk.toLocaleString('cs-CZ')} Kč
                        </Typography>
                      </Box>

                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                        {service.description}
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip icon={<Timer sx={{ fontSize: 16 }} />} label={`${service.durationMinutes} min`} size="small" variant="outlined" />
                        <Chip icon={<AttachMoney sx={{ fontSize: 16 }} />} label={`${(service.priceCzk / service.durationMinutes).toFixed(0)} Kč/min`} size="small" variant="outlined" />
                      </Box>

                      {service.isActive && (
                        <Chip icon={<CheckCircle sx={{ fontSize: 14 }} />} label="Aktivní" size="small"
                          sx={{ mt: 2, bgcolor: '#E8F5E9', color: '#2E7D32' }} />
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            );
          })}
        </Grid>
      )}

      {!loading && filtered.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">Žádné služby nenalezeny</Typography>
        </Box>
      )}

      {/* Price Table View */}
      {!loading && services.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>Tabulkový přehled</Typography>
          <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Kód</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Název</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Kategorie</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Trvání</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Cena (Kč)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map(service => (
                  <TableRow key={service.id} hover>
                    <TableCell>
                      <Chip label={service.code} size="small" sx={{ fontWeight: 700 }} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{service.name}</TableCell>
                    <TableCell>{service.category}</TableCell>
                    <TableCell align="right">{service.durationMinutes} min</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#0D7377' }}>
                      {service.priceCzk.toLocaleString('cs-CZ')} Kč
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </motion.div>
      )}
    </Box>
  );
}
