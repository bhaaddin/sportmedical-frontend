/*
 * The price list: what the ordinace charges, how long it takes and what it costs.
 *
 * These rows are "položky ceníku" on screen and not "služby", because that one
 * word meant two things in this application and misled the owner three times
 * in a day. A `činnost` is what you put in a calendar; a row here is what you
 * bill. One visit is scheduled as one činnost and billed as one or more of
 * these. The route and the type stay `api/services` and `ServiceItem` -
 * renaming those would reach into booking's `Activity.ServiceItemId` and into
 * invoicing and gain nothing, because it was the labels that misled, not the
 * identifiers.
 *
 * It was already here, already full - eight priced services off
 * `/api/services` - and reachable only by typing the address: not in the menu,
 * not in Nastavení. The owner asked where the price list was and the honest
 * answer was nowhere. It is in Nastavení -> Ordinace now.
 *
 * The button marked "Upravit ceník" was wired to nothing, while the server has
 * had create, update and archive all along. Editing is real from here on, and
 * every rule is checked in front, because the server checks almost none of
 * them - see `pricing/serviceForm.ts`.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Skeleton,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, Alert,
} from '@mui/material';
import { Search, AttachMoney, Add, Edit, Archive } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { servicesApi } from '../api/services';
import type { ServiceItem } from '../api/services';
import ServiceDialog from './pricing/ServiceDialog';

/*
 * A colour for any category, rather than for four of them.
 *
 * There used to be a fixed map here: Prohlídka, Diagnostika, Měření, Terapie.
 * Those four came from a seed the owner never wrote - his words, on
 * 13. 9. 2026: "zmaz to, tie kategórie som nikdy nerobil". The seed is gone
 * from the database and from the code, and a map naming those four would have
 * given them colours and everything the owner invents himself grey.
 *
 * Derived from the name, so it is stable for a given category and there is no
 * list to keep in step with anything.
 */
const CATEGORY_PALETTE = [
  { bg: '#E8F5E9', text: '#2E7D32' },
  { bg: '#E3F2FD', text: '#1565C0' },
  { bg: '#FFF3E0', text: '#E65100' },
  { bg: '#F3E5F5', text: '#7B1FA2' },
  { bg: '#E0F7FA', text: '#00838F' },
  { bg: '#FCE4EC', text: '#AD1457' },
];

export function categoryColour(category: string): { bg: string; text: string } {
  const name = category.trim();
  if (name === '') return { bg: '#F5F5F5', text: '#666' };
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) % 100_000;
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
}

export default function Cenik() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  /* `undefined` closed; `null` a new service; an item to change that one. */
  const [editing, setEditing] = useState<ServiceItem | null | undefined>(undefined);
  const [archiving, setArchiving] = useState<ServiceItem | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(() => {
    servicesApi.getAll()
      .then((items) => { setServices(items); setFailed(null); })
      .catch(() => setFailed('Ceník se nepodařilo načíst.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const confirmArchive = async () => {
    if (archiving === null) return;
    try {
      await servicesApi.archive(archiving.id);
      setArchiving(null);
      load();
    } catch {
      setFailed('Vyřazení se nepodařilo.');
      setArchiving(null);
    }
  };

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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AttachMoney color="primary" /> Ceník
            </Typography>
            <Typography variant="body2" color="text.secondary">Co ordinace účtuje — položky a ceny</Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setEditing(null)}
            sx={{ borderRadius: 2, px: 3, bgcolor: '#0D7377' }}
          >
            Nová položka
          </Button>
        </Box>
      </motion.div>

      {failed !== null && <Alert severity="warning" sx={{ mb: 2 }}>{failed}</Alert>}

      {/*
        * An empty price list is the normal state of a new installation now -
        * the eight demo rows were a seed and it has been removed from the code
        * as well as the database, so nothing reappears. Three zeroes and a
        * search box over nothing are furniture; this says what to do instead.
        */}
      {!loading && services.length === 0 && failed === null && (
        <Card sx={{ borderRadius: 3, textAlign: 'center', py: 6 }}>
          <CardContent>
            <AttachMoney sx={{ fontSize: 40, color: 'text.disabled' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, mt: 1 }}>
              Ceník je prázdný
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
              Přidejte první položku — co ordinace nabízí a kolik to stojí.
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setEditing(null)}
              sx={{ borderRadius: 2, px: 3, bgcolor: '#0D7377' }}
            >
              Nová položka
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      {services.length > 0 && (
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[
          { label: 'Celkem položek', value: totalServices, color: '#0D7377' },
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
      )}

      {/* Search */}
      {services.length > 0 && (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <TextField
          fullWidth
          placeholder="Hledat v ceníku..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          slotProps={{ input: {
            startAdornment: <InputAdornment position="start"><Search /></InputAdornment>,
          } }}
          sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
        />
      </motion.div>
      )}

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
            const colors = categoryColour(service.category);
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

                      {/*
                        * No length and no Kč/min.
                        *
                        * Length belongs to the činnost; booking measured that
                        * the price-list copy was read nowhere but in a
                        * comparison against it, and removed both the
                        * comparison and its warning. So the dialog stopped
                        * offering the field - and a number somebody can see
                        * but no longer change, and nobody maintains, is worse
                        * than either. Kč/min was arithmetic on it.
                        */}
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Box sx={{ flex: 1 }} />
                        {/* Named, not just drawn: an icon alone tells a screen
                            reader nothing, and a tooltip is not a name. */}
                        <Tooltip title="Upravit">
                          <IconButton
                            size="small"
                            aria-label={`Upravit položku ${service.name}`}
                            onClick={() => setEditing(service)}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Vyřadit z ceníku">
                          <IconButton
                            size="small"
                            aria-label={`Vyřadit položku ${service.name}`}
                            onClick={() => setArchiving(service)}
                          >
                            <Archive fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Only about the search. An empty price list has its own words above -
          "nic takového není" answers a question nobody asked when there is
          nothing to search through. */}
      {!loading && services.length > 0 && filtered.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">V ceníku nic takového není</Typography>
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

      {editing !== undefined && (
        <ServiceDialog
          open
          service={editing}
          existing={services}
          onClose={() => setEditing(undefined)}
          onSaved={load}
        />
      )}

      {/*
        * A one-way door, and it says so before it is opened. The list route on
        * the server is "active only", so a vyřazená služba is never returned
        * again and there is no screen that can find it to bring it back.
        */}
      <Dialog open={archiving !== null} onClose={() => setArchiving(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Vyřadit z ceníku?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>{archiving?.name}</strong> se přestane nabízet. Zpátky už se
            do ceníku vrátit nedá — kdybyste ji potřebovali znovu, bude se muset
            založit nová.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setArchiving(null)}>Zrušit</Button>
          <Button color="error" variant="contained" onClick={confirmArchive}>
            Vyřadit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
