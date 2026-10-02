/*
 * Pacienti - the whole register, a page at a time.
 *
 * `GET /api/patients` pages: twenty rows unless asked for more, a hundred at
 * most, plus `totalCount`. This screen used to take the first page, call it
 * the register, count it ("20 registrovaných pacientů") and search inside it,
 * so the twenty-first surname could not be found here at all. It now shows the
 * server's count, pages through the rest, and sends the search to the server,
 * which matches first and last names over every row, diacritics ignored.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Paper, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Avatar, Chip, InputAdornment, Grid, Card, CardContent, IconButton, Tooltip, ToggleButton, ToggleButtonGroup,
  TablePagination, Alert,
} from '@mui/material';
import { Search, People, ViewList, ViewModule, LocalHospital, HowToReg } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { patientsApi, PATIENT_PAGE_SIZE_MAX } from '../api/patients';
import type { Patient } from '../api/patients';
import { PatientListSkeleton } from '../components/SkeletonLoader';
import { usePermission } from '../auth/usePermission';
import { SENSITIVE_IDENTITY, shownFields, usePatientFields } from '../api/displaySettings';

const sexLabel = (s: string) => s === 'Male' ? 'Muž' : s === 'Female' ? 'Žena' : 'Jiné';
const sexColor = (s: string) => s === 'Male' ? '#0D7377' : s === 'Female' ? '#9C27B0' : '#666';

/* The record's own state, as the server keeps it - not a guess from the age. */
const statusChip = (p: Patient) =>
  p.status === 'Archived'
    ? { label: 'Archivovaný', color: '#757575' }
    : { label: 'Aktivní', color: '#2E7D32' };

/*
 * How each column the clinic may choose (Nastavení -> Údaje o pacientovi) is
 * drawn. Which of them appear, and in what order, is the setting; `recordId`
 * is drawn under the name rather than as a column of its own.
 */
const COLUMN_CELLS: Record<string, (p: Patient) => ReactNode> = {
  dateOfBirth: (p) => new Date(p.dateOfBirth).toLocaleDateString('cs-CZ'),
  sex: (p) => (
    <Chip label={sexLabel(p.sex)} size="small" sx={{ bgcolor: `${sexColor(p.sex)}14`, color: sexColor(p.sex), fontWeight: 500 }} />
  ),
  registeredAt: (p) => new Date(p.createdAtUtc).toLocaleDateString('cs-CZ'),
  status: (p) => {
    const status = statusChip(p);
    return <Chip label={status.label} size="small" sx={{ bgcolor: `${status.color}14`, color: status.color, fontWeight: 500 }} />;
  },
};

const PAGE_SIZES = [25, 50, PATIENT_PAGE_SIZE_MAX];
const SEARCH_DEBOUNCE_MS = 300;

export default function PatientList() {
  const navigate = useNavigate();
  const mayRegister = usePermission('patients.register');
  const maySeeSensitive = usePermission(SENSITIVE_IDENTITY);
  const fieldVisibility = usePatientFields();
  const listFields = shownFields(fieldVisibility.data, 'list', maySeeSensitive) ?? [];
  const showRecordId = listFields.some((field) => field.key === 'recordId');
  const columns = listFields.filter((field) => COLUMN_CELLS[field.key] !== undefined);
  const shows = (key: string) => listFields.some((field) => field.key === key);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [view, setView] = useState<'list' | 'grid'>('list');

  /* One request per pause in typing, and a new search starts on its first
     page. Only a search that changed resets the page: the timer used to run on
     mount too, and a click on the next page in the first moments after the
     list appeared was undone when it fired. */
  useEffect(() => {
    const next = search.trim();
    if (next === query) return;
    const timer = setTimeout(() => {
      setQuery(next);
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, query]);

  const patientsQuery = useQuery({
    queryKey: ['patients', 'register', query, page, pageSize],
    queryFn: () => patientsApi.list({ query, page: page + 1, pageSize }),
    placeholderData: keepPreviousData,
  });

  if (patientsQuery.isPending) return <PatientListSkeleton />;

  if (patientsQuery.isError) {
    const status = (patientsQuery.error as { response?: { status?: number } })?.response?.status;
    return (
      <Alert
        severity="error"
        action={status === 403 ? undefined : (
          <Button color="inherit" size="small" onClick={() => void patientsQuery.refetch()}>
            Zkusit znovu
          </Button>
        )}
      >
        {status === 403
          ? 'Nemáte oprávnění vidět pacienty.'
          : 'Seznam pacientů se nepodařilo načíst.'}
      </Alert>
    );
  }

  const patients = patientsQuery.data.items;
  const total = patientsQuery.data.totalCount;
  const emptyText = query === '' ? 'Zatím žádní pacienti.' : 'Nikdo takový v registru není.';

  const pagination = (
    <TablePagination
      component="div"
      count={total}
      page={page}
      onPageChange={(_, next) => setPage(next)}
      rowsPerPage={pageSize}
      rowsPerPageOptions={PAGE_SIZES}
      onRowsPerPageChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
      labelRowsPerPage="Na stránku:"
      labelDisplayedRows={({ from, to, count }) => `${from}–${to} z ${count}`}
    />
  );

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <People color="primary" /> Pacienti
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {query === '' ? `Registrovaných pacientů: ${total}` : `Nalezeno: ${total}`}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            {/* One way in. The thinner "Nový pacient" form wrote to a different
                endpoint and skipped the address, birth number and insurer, so
                which button the operator pressed decided how complete the record
                was. Editing an existing patient still uses that form. */}
            {mayRegister && (
              <Button variant="contained" startIcon={<HowToReg />} onClick={() => navigate('/patients/register')}
                sx={{ bgcolor: '#0D7377', borderRadius: 3, px: 3, py: 1.2, fontWeight: 600, boxShadow: '0 4px 16px rgba(13,115,119,0.3)',
                  '&:hover': { bgcolor: '#095456', boxShadow: '0 6px 20px rgba(13,115,119,0.4)' } }}>
                Registrace pacienta
              </Button>
            )}
          </Box>
        </Box>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Paper sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 2, borderRadius: 3 }}>
          <TextField fullWidth size="small" placeholder="Hledat podle jména nebo příjmení..." value={search}
            onChange={e => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
          <ToggleButtonGroup value={view} exclusive onChange={(_, v) => v && setView(v)} size="small">
            <ToggleButton value="list"><ViewList /></ToggleButton>
            <ToggleButton value="grid"><ViewModule /></ToggleButton>
          </ToggleButtonGroup>
        </Paper>
      </motion.div>

      {view === 'list' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <TableContainer component={Paper} sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Pacient</TableCell>
                  {columns.map((field) => (
                    <TableCell key={field.key} sx={{ fontWeight: 700 }}>{field.label}</TableCell>
                  ))}
                  <TableCell sx={{ fontWeight: 700 }} align="right">Akce</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {patients.map((p, i) => {
                  return (
                    <motion.tr key={p.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 20) * 0.03, duration: 0.3 }}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/patients/${p.id}`)}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ bgcolor: '#0D7377', width: 40, height: 40, fontSize: 14, fontWeight: 600 }}>
                            {p.firstName[0]}{p.lastName[0]}
                          </Avatar>
                          <Box>
                            <Typography sx={{ fontWeight: 600 }}>{p.firstName} {p.lastName}</Typography>
                            {showRecordId && (
                              <Typography variant="caption" color="text.secondary">{p.id.slice(0, 8)}...</Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      {columns.map((field) => (
                        <TableCell key={field.key}>{COLUMN_CELLS[field.key](p)}</TableCell>
                      ))}
                      <TableCell align="right">
                        <Tooltip title="Nová diagnostika">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigate(`/diagnostics/new?patientId=${p.id}`); }}
                            sx={{ color: '#0D7377' }}>
                            <People fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </motion.tr>
                  );
                })}
                {patients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length + 2} align="center" sx={{ py: 6 }}>
                      <LocalHospital sx={{ fontSize: 48, color: '#ddd', mb: 1 }} />
                      <Typography color="text.secondary">{emptyText}</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {pagination}
          </TableContainer>
        </motion.div>
      ) : (
        <>
          <Grid container spacing={2}>
            {patients.map((p, i) => {
              const status = statusChip(p);
              return (
                <Grid key={p.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(i, 20) * 0.05, duration: 0.3 }}
                    whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                    <Card sx={{ cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: '#0D7377' } }}
                      onClick={() => navigate(`/patients/${p.id}`)}>
                      <CardContent sx={{ textAlign: 'center', py: 3 }}>
                        <Avatar sx={{ bgcolor: '#0D7377', width: 56, height: 56, fontSize: 20, mx: 'auto', mb: 1.5, fontWeight: 600,
                          boxShadow: '0 4px 14px rgba(13,115,119,0.3)' }}>
                          {p.firstName[0]}{p.lastName[0]}
                        </Avatar>
                        <Typography sx={{ fontWeight: 600 }}>{p.firstName} {p.lastName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {[
                            shows('sex') ? sexLabel(p.sex) : null,
                            shows('dateOfBirth') ? new Date(p.dateOfBirth).toLocaleDateString('cs-CZ') : null,
                          ].filter((part) => part !== null).join(' • ')}
                        </Typography>
                        {shows('status') && (
                          <Chip label={status.label} size="small" sx={{ mt: 1.5, bgcolor: `${status.color}14`, color: status.color, fontWeight: 500 }} />
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </Grid>
              );
            })}
            {patients.length === 0 && (
              <Grid size={{ xs: 12 }}>
                <Card sx={{ textAlign: 'center', py: 6 }}>
                  <LocalHospital sx={{ fontSize: 48, color: '#ddd', mb: 1 }} />
                  <Typography color="text.secondary">{emptyText}</Typography>
                </Card>
              </Grid>
            )}
          </Grid>
          <Paper sx={{ mt: 2, borderRadius: 3 }}>{pagination}</Paper>
        </>
      )}
    </Box>
  );
}
