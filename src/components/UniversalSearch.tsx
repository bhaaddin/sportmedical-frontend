/* ══════════════════════════════════════════════════════════════
   UNIVERSAL SEARCH — Command palette style search
   Searches across patients, appointments, injuries, invoices,
   staff, documents. Keyboard shortcut: Ctrl+K / Cmd+K.
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Dialog, DialogContent, TextField, Box, Typography, List, ListItem,
  ListItemIcon, ListItemText, Chip, InputAdornment, CircularProgress,
} from '@mui/material';
import {
  Search, People, CalendarMonth, Warning, Receipt, Description,
  Person, Science, Settings,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { patientsApi, type Patient } from '../api/patients';
import { injuriesApi, type Injury } from '../api/injuries';
import { billingApi, type Invoice } from '../api/billing';
import { calendarApi, type Appointment } from '../api/calendar';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: 'patient' | 'appointment' | 'injury' | 'invoice' | 'staff' | 'page';
  icon: React.ReactNode;
  path: string;
  color: string;
}

export default function UniversalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  /* ── Keyboard shortcut Ctrl+K ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /* ── Focus input when dialog opens ── */
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  /* ── Static page results for navigation ── */
  const pages: SearchResult[] = useMemo(() => [
    { id: 'p-dashboard', title: 'Dashboard', subtitle: 'Přehled', type: 'page', icon: <Settings />, path: '/', color: '#0D7377' },
    { id: 'p-calendar', title: 'Kalendář', subtitle: 'Správa termínů', type: 'page', icon: <CalendarMonth />, path: '/calendar', color: '#0D7377' },
    { id: 'p-patients', title: 'Pacienti', subtitle: 'Seznam pacientů', type: 'page', icon: <People />, path: '/patients', color: '#0288D1' },
    { id: 'p-billing', title: 'Fakturace', subtitle: 'Správa faktur', type: 'page', icon: <Receipt />, path: '/billing', color: '#ED6C02' },
    { id: 'p-injuries', title: 'Poranění', subtitle: 'Evidence poranění', type: 'page', icon: <Warning />, path: '/injuries', color: '#D32F2F' },
    { id: 'p-diagnostics', title: 'Diagnostika', subtitle: 'Nová relace', type: 'page', icon: <Science />, path: '/diagnostics/new', color: '#7C3AED' },
    { id: 'p-reports', title: 'Reporty', subtitle: 'Analytika', type: 'page', icon: <Description />, path: '/reports', color: '#16A34A' },
    { id: 'p-settings', title: 'Nastavení', subtitle: 'Konfigurace', type: 'page', icon: <Settings />, path: '/settings', color: '#64748B' },
  ], []);

  /* ── Search across all data sources ── */
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    const lower = q.toLowerCase();

    try {
      const [patients, injuries, invoices, appointments] = await Promise.allSettled([
        patientsApi.search(q).catch(() => []),
        injuriesApi.getAll().catch(() => []),
        billingApi.getInvoices().catch(() => []),
        calendarApi.getAppointments().catch(() => []),
      ]);

      const found: SearchResult[] = [];

      /* Patients */
      if (patients.status === 'fulfilled') {
        for (const p of patients.value.slice(0, 5)) {
          found.push({
            id: `patient-${p.id}`,
            title: `${p.firstName} ${p.lastName}`,
            subtitle: `${p.email || ''} ${p.phone || ''} · ${p.dateOfBirth}`,
            type: 'patient',
            icon: <Person />,
            path: `/patients/${p.id}`,
            color: '#0288D1',
          });
        }
      }

      /* Injuries */
      if (injuries.status === 'fulfilled') {
        for (const i of injuries.value.filter(
          x => x.bodyRegion?.toLowerCase().includes(lower) ||
               x.diagnosis?.toLowerCase().includes(lower) ||
               x.patientId?.toLowerCase().includes(lower)
        ).slice(0, 3)) {
          found.push({
            id: `injury-${i.id}`,
            title: `Poranění: ${i.bodyRegion}`,
            subtitle: `${i.diagnosis || 'Bez diagnózy'} · ${i.practitioner}`,
            type: 'injury',
            icon: <Warning />,
            path: '/injuries',
            color: '#D32F2F',
          });
        }
      }

      /* Invoices */
      if (invoices.status === 'fulfilled') {
        for (const inv of invoices.value.filter(
          x => x.patientName?.toLowerCase().includes(lower) ||
               x.invoiceNumber?.toLowerCase().includes(lower)
        ).slice(0, 3)) {
          found.push({
            id: `invoice-${inv.id}`,
            title: `Faktura: ${inv.invoiceNumber}`,
            subtitle: `${inv.patientName} · ${inv.totalCzk.toLocaleString('cs-CZ')} Kč`,
            type: 'invoice',
            icon: <Receipt />,
            path: '/billing',
            color: '#ED6C02',
          });
        }
      }

      /* Appointments */
      if (appointments.status === 'fulfilled') {
        for (const a of appointments.value.filter(
          x => x.patientName?.toLowerCase().includes(lower) ||
               x.serviceType?.toLowerCase().includes(lower) ||
               x.practitionerName?.toLowerCase().includes(lower)
        ).slice(0, 3)) {
          found.push({
            id: `apt-${a.id}`,
            title: `Termín: ${a.serviceType}`,
            subtitle: `${a.patientName || a.patientId} · ${new Date(a.startTime).toLocaleDateString('cs-CZ')}`,
            type: 'appointment',
            icon: <CalendarMonth />,
            path: '/calendar',
            color: '#0D7377',
          });
        }
      }

      /* Pages */
      const matchedPages = pages.filter(p =>
        p.title.toLowerCase().includes(lower) || p.subtitle.toLowerCase().includes(lower)
      ).slice(0, 3);
      found.push(...matchedPages);

      setResults(found);
      setSelectedIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [pages]);

  /* ── Debounced search ── */
  useEffect(() => {
    const timer = setTimeout(() => { if (query) doSearch(query); }, 250);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  /* ── Keyboard navigation ── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      navigate(results[selectedIndex].path);
      setOpen(false);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const typeLabel: Record<string, string> = {
    patient: 'Pacient', appointment: 'Termín', injury: 'Poranění',
    invoice: 'Faktura', page: 'Stránka',
  };

  /* Smart suggestions based on partial input */
  const sportSuggestions: Record<string, string[]> = {
    f: ['Fotbal', 'Fyzioterapie', 'Florbal'],
    k: ['Koleno', 'Kardiologická prohlídka', 'Kondiční test'],
    v: ['VO2 Max', 'Vyšetření', 'Vazivová poranění'],
    d: ['Diagnostika', 'Dolní záda', 'Doppler'],
    s: ['Spiroergometrie', 'Sportovní prohlídka', 'Svalová hmota'],
    t: ['Trauma', 'Tréninkové zatížení', 'Termín'],
    p: ['Poranění', 'Pacient', 'Prohlídka'],
    m: ['Měření', 'Max tep', 'MRI'],
    i: ['InBody', 'Inklinace', 'Injekce'],
    b: ['Bolest', 'Blood pressure', 'Bone density'],
  };

  const suggestions = query.length === 1 ? (sportSuggestions[query.toLowerCase()] || []) : [];

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, overflow: 'hidden' } } }}>
      <DialogContent sx={{ p: 0 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          placeholder="Hledat pacienty, faktury, poranění, stránky..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  {loading ? <CircularProgress size={20} /> : <Search />}
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Chip label="Ctrl+K" size="small" sx={{ fontSize: 10, height: 20 }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ '& .MuiOutlinedInput-notchedOutline': { border: 'none' }, p: 1 }}
        />
        {suggestions.length > 0 && results.length === 0 && !loading && (
          <Box sx={{ p: 2, borderBottom: '1px solid #f0f0f0' }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Nápovědy</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {suggestions.map(s => (
                <Chip key={s} label={s} size="small" onClick={() => setQuery(s)}
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#E0F2F1' } }} />
              ))}
            </Box>
          </Box>
        )}
        {results.length > 0 && (
          <List sx={{ maxHeight: 400, overflow: 'auto', borderTop: '1px solid #f0f0f0' }}>
            {results.map((r, i) => (
              <ListItem key={r.id} onClick={() => { navigate(r.path); setOpen(false); }}
                sx={{
                  cursor: 'pointer', mx: 1, borderRadius: 2, mb: 0.5,
                  bgcolor: i === selectedIndex ? `${r.color}12` : 'transparent',
                  '&:hover': { bgcolor: `${r.color}08` },
                }}>
                <ListItemIcon sx={{ color: r.color, minWidth: 40 }}>
                  {r.icon}
                </ListItemIcon>
                <ListItemText
                  primary={r.title}
                  secondary={r.subtitle}
                  slotProps={{
                    /* One `slotProps` per element - two of them and JSX keeps
                       only the later. And these are system shorthands, so they
                       belong in `sx` rather than on the Typography itself. */
                    primary: { sx: { fontWeight: 600, fontSize: 14 } },
                    secondary: { sx: { fontSize: 12, color: 'text.secondary' } },
                  }}
                />
                <Chip label={typeLabel[r.type]} size="small"
                  sx={{ bgcolor: `${r.color}12`, color: r.color, fontSize: 10, height: 20 }} />
              </ListItem>
            ))}
          </List>
        )}
        {query.length >= 2 && !loading && results.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">Žádné výsledky pro "{query}"</Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Hook to open search programmatically ── */
let globalOpenSearch: (() => void) | null = null;
export function openSearch() { globalOpenSearch?.(); }
export function setSearchOpener(fn: () => void) { globalOpenSearch = fn; }
