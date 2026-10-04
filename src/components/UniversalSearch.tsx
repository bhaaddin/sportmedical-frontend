/* ══════════════════════════════════════════════════════════════
   UNIVERSAL SEARCH — Command palette style search
   Searches across patients, appointments, invoices,
   staff, documents. Keyboard shortcut: Ctrl+K / Cmd+K.
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Dialog, DialogContent, TextField, Box, Typography, List, ListItem,
  ListItemIcon, ListItemText, InputAdornment, CircularProgress,
} from '@mui/material';
import {
  Search, People, CalendarMonth, Receipt,
  Person, Settings, Home,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { patientsApi, type Patient } from '../api/patients';
import { billingApi, type Invoice } from '../api/billing';
import { calendarApi, type Appointment } from '../api/calendar';
import { usePermission, usePermissions } from '../auth/usePermission';
import { normalizeText, searchSettingsItems, visibleSections } from '../pages/settings/catalogue';
import { DESIGN, StatusChip, type ChipTone } from './ui';
import { useIsPhone } from '../layout/useDevice';

/** Event the shell's search buttons fire; the palette listens for it (and for Ctrl+K). */
export const OPEN_SEARCH_EVENT = 'sm-open-search';

/**
 * Opens the palette from a button.
 *
 * The buttons used to dispatch a synthetic Ctrl+K on `document`; a keyboard
 * event made by hand does not bubble, so the listener on `window` never
 * heard it. A named event on `window` itself cannot be missed.
 */
export function openUniversalSearch(): void {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: 'patient' | 'appointment' | 'invoice' | 'staff' | 'page' | 'settings';
  icon: React.ReactNode;
  path: string;
}

/* What kind of thing a row is, said with the board's tones rather than a colour per type. */
const TYPE_LABEL: Record<SearchResult['type'], string> = {
  patient: 'Pacient', appointment: 'Termín',
  invoice: 'Faktura', staff: 'Tým', page: 'Stránka', settings: 'Nastavení',
};
const TYPE_TONE: Record<SearchResult['type'], ChipTone> = {
  patient: 'green', appointment: 'blue',
  invoice: 'beige', staff: 'grey', page: 'grey', settings: 'grey',
};

export default function UniversalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const phone = useIsPhone();
  const canBill = usePermission('billing.manage');
  const canSeePatients = usePermission('patients.view');
  /* The settings rows this person may open - the same smart search the rail
     has (label, keywords, description; no diacritics needed), so "obed" from
     Ctrl+K lands on Otevírací doba too. */
  const held = usePermissions();
  const settingsSections = useMemo(() => visibleSections(held), [held]);

  /* ── Keyboard shortcut Ctrl+K ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    const openFromButton = () => setOpen(true);
    window.addEventListener('keydown', handler);
    window.addEventListener(OPEN_SEARCH_EVENT, openFromButton);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener(OPEN_SEARCH_EVENT, openFromButton);
    };
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
    { id: 'p-dashboard', title: 'Přehled', subtitle: 'Úvodní plocha', type: 'page', icon: <Home />, path: '/prehled' },
    { id: 'p-calendar', title: 'Kalendář', subtitle: 'Správa termínů', type: 'page', icon: <CalendarMonth />, path: '/planovani' },
    ...(canSeePatients
      ? [{ id: 'p-patients', title: 'Pacienti', subtitle: 'Kartotéka kliniky', type: 'page' as const, icon: <People />, path: '/patients' }]
      : []),
    ...(canBill
      ? [{ id: 'p-billing', title: 'Fakturace', subtitle: 'Doklady a platby', type: 'page' as const, icon: <Receipt />, path: '/billing' }]
      : []),
    { id: 'p-today', title: 'Dnešní přehled', subtitle: 'Dnešní den na jeden pohled', type: 'page', icon: <CalendarMonth />, path: '/dnes' },
    { id: 'p-clubs', title: 'Kluby a týmy', subtitle: 'Hromadné objednávky a odkazy pro sportovce', type: 'page', icon: <People />, path: '/clubs' },
    { id: 'p-settings', title: 'Nastavení', subtitle: 'Konfigurace', type: 'page', icon: <Settings />, path: '/settings' },
  ], [canBill, canSeePatients]);

  /* ── Search across all data sources ── */
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    const lower = q.toLowerCase();
    const plain = normalizeText(q);

    try {
      const [patients, invoices, appointments] = await Promise.allSettled([
        canSeePatients ? patientsApi.search(q).catch(() => []) : Promise.resolve([] as Patient[]),
        canBill ? billingApi.getInvoices().catch(() => []) : Promise.resolve([] as Invoice[]),
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
          });
        }
      }

      /* Appointments */
      if (appointments.status === 'fulfilled') {
        /* This read returns cancelled appointments too, and search offered them
           with no sign they were cancelled - a receptionist reading the result
           would have told a patient a slot was still theirs. */
        for (const a of (appointments.value as Appointment[]).filter(
          x => x.status !== 'Cancelled' &&
              (x.patientName?.toLowerCase().includes(lower) ||
               x.serviceType?.toLowerCase().includes(lower) ||
               x.practitionerName?.toLowerCase().includes(lower))
        ).slice(0, 3)) {
          found.push({
            id: `apt-${a.id}`,
            title: `Termín: ${a.serviceType}`,
            subtitle: `${a.patientName || a.patientId} · ${new Date(a.startTime).toLocaleDateString('cs-CZ')}`,
            type: 'appointment',
            icon: <CalendarMonth />,
            path: '/planovani',
          });
        }
      }

      /* Pages */
      const matchedPages = pages.filter(p =>
        normalizeText(p.title).includes(plain) || normalizeText(p.subtitle).includes(plain)
      ).slice(0, 3);
      found.push(...matchedPages);

      /* Settings screens - best first, the way the rail's own search ranks them. */
      for (const hit of searchSettingsItems(settingsSections, q).slice(0, 5)) {
        found.push({
          id: `settings-${hit.section.id}-${hit.item.id}`,
          title: hit.item.label,
          subtitle: `${hit.section.label} · ${hit.item.description}`,
          type: 'settings',
          icon: <Settings />,
          path: hit.item.to,
        });
      }

      setResults(found);
      setSelectedIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [pages, canBill, canSeePatients, settingsSections]);

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

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      maxWidth="sm"
      fullWidth
      fullScreen={phone}
      transitionDuration={150}
      slotProps={{
        paper: {
          sx: {
            borderRadius: phone ? 0 : 3, overflow: 'hidden', border: '1px solid', borderColor: 'divider',
            boxShadow: DESIGN.shadow.menu,
          },
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          placeholder="Hledat pacienty, termíny, faktury nebo stránky…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  {loading ? <CircularProgress size={18} /> : <Search sx={{ color: 'text.secondary', fontSize: 20 }} />}
                </InputAdornment>
              ),
              endAdornment: phone ? undefined : (
                <InputAdornment position="end">
                  <Box
                    component="kbd"
                    sx={{
                      fontFamily: 'inherit', fontSize: 11, fontWeight: 600, color: 'text.secondary',
                      border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 0.75, py: 0.125,
                      bgcolor: 'background.default',
                    }}
                  >
                    Ctrl+K
                  </Box>
                </InputAdornment>
              ),
              sx: { fontSize: 15, '& input': { py: 1.75 } },
            },
          }}
          sx={{ '& .MuiOutlinedInput-notchedOutline': { border: 'none' }, px: 1 }}
        />
        {results.length > 0 && (
          <List sx={{ maxHeight: phone ? 'calc(100dvh - 72px)' : 400, overflow: 'auto', borderTop: '1px solid', borderColor: 'divider', py: 0.75 }}>
            {results.map((r, i) => (
              <ListItem
                key={r.id}
                onClick={() => { navigate(r.path); setOpen(false); }}
                aria-selected={i === selectedIndex}
                sx={{
                  cursor: 'pointer', mx: 1, width: 'auto', borderRadius: 2, mb: 0.25, py: 1, minHeight: 48,
                  bgcolor: i === selectedIndex ? 'action.selected' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <ListItemIcon sx={{ color: i === selectedIndex ? 'primary.main' : 'text.secondary', minWidth: 36, '& svg': { fontSize: 20 } }}>
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
                <StatusChip tone={TYPE_TONE[r.type]} size="sm">{TYPE_LABEL[r.type]}</StatusChip>
              </ListItem>
            ))}
          </List>
        )}
        {query.length >= 2 && !loading && results.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Žádné výsledky pro „{query}"</Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
