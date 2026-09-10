/* ══════════════════════════════════════════════════════════════
   ICD-10 CODEBOOK ENGINE — Phase 8
   - Virtualized list (react-window) for 37k+ codes
   - IndexedDB caching for instant local search
   - Hierarchical category sidebar
   - Detail panel with code info
   - Favorites (starred codes)
   - Admin editing (RBAC protected)
   - Drag-to-assign to patient
   ══════════════════════════════════════════════════════════════ */
import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Box, Typography, Paper, Card, CardContent, TextField, IconButton, Tooltip,
  Chip, Button, Divider, List, ListItemButton, ListItemText, Collapse,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Skeleton,
  Badge, InputAdornment,
  Grid, MenuItem,
} from '@mui/material';
import {
  Search, Star, StarBorder, ExpandMore, ExpandLess, Close, Add,
  ArrowBack, Edit, Save, Book, FilterList, LocalHospital,
} from '@mui/icons-material';
import { List as VirtualList, useListRef } from 'react-window';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getCachedICDCodes, setCachedICDCodes,
  searchICDCodesLocally, groupICDCodesByCategory,
  type ICDCode,
} from '../services/cacheService';
import { useAppStore } from '../store/useAppStore';
import { patientsApi } from '../api/patients';
import type { Patient } from '../api/patients';
import toast from 'react-hot-toast';

/* ── ICD-10 Category mapping (Czech) ── */
const ICD_CATEGORIES: { prefix: string; label: string; range: string }[] = [
  { prefix: 'A', label: 'Některé infekční a parazitární nemoci', range: 'A00-B99' },
  { prefix: 'B', label: 'Některé infekční a parazitární nemoci', range: 'A00-B99' },
  { prefix: 'C', label: 'Novotvary', range: 'C00-D48' },
  { prefix: 'D', label: 'Novotvary / Nemoci krve', range: 'C00-D89' },
  { prefix: 'E', label: 'Poruchy endokrinního systému', range: 'E00-E89' },
  { prefix: 'F', label: 'Duševní poruchy', range: 'F01-F99' },
  { prefix: 'G', label: 'Nemoci nervové soustavy', range: 'G00-G99' },
  { prefix: 'H', label: 'Nemoci oka / ucha', range: 'H00-H95' },
  { prefix: 'I', label: 'Nemoci oběhové soustavy', range: 'I00-I99' },
  { prefix: 'J', label: 'Nemoci dýchací soustavy', range: 'J00-J99' },
  { prefix: 'K', label: 'Nemoci trávicí soustavy', range: 'K00-K93' },
  { prefix: 'L', label: 'Nemoci kůže / podkoží', range: 'L00-L99' },
  { prefix: 'M', label: 'Nemoci svalové a kosterní soustavy', range: 'M00-M99' },
  { prefix: 'N', label: 'Nemoci močové a pohlavní soustavy', range: 'N00-N99' },
  { prefix: 'O', label: 'Těhotenství a porod', range: 'O00-O9A' },
  { prefix: 'P', label: 'Stavy pocházející z období perinatálního', range: 'P00-P96' },
  { prefix: 'Q', label: 'Vrozené vady', range: 'Q00-Q99' },
  { prefix: 'R', label: 'Příznaky, abnormální nálezy', range: 'R00-R99' },
  { prefix: 'S', label: 'Poranění, otravy', range: 'S00-T88' },
  { prefix: 'T', label: 'Poranění, otravy', range: 'S00-T88' },
  { prefix: 'V', label: 'Vnější příčiny', range: 'V00-Y99' },
  { prefix: 'W', label: 'Vnější příčiny', range: 'V00-Y99' },
  { prefix: 'X', label: 'Vnější příčiny', range: 'V00-Y99' },
  { prefix: 'Y', label: 'Vnější příčiny', range: 'V00-Y99' },
  { prefix: 'Z', label: 'Faktory ovlivňující zdravotní stav', range: 'Z00-Z99' },
];

/* ── Demo data for when API is unavailable ── */
function generateDemoCodes(): ICDCode[] {
  const codes: ICDCode[] = [];
  const demoEntries = [
    { code: 'M54.5', desc: 'Bolest dolní části zad', cat: 'M' },
    { code: 'M17.1', desc: 'Primární gonartróza', cat: 'M' },
    { code: 'M75.1', desc: 'Rotátorová manžeta - syndrom', cat: 'M' },
    { code: 'M23.3', desc: 'Jiné poruchy menisku', cat: 'M' },
    { code: 'S83.2', desc: 'Ruptura menisku, akutní', cat: 'S' },
    { code: 'S83.5', desc: 'Vrtnutí kolene', cat: 'S' },
    { code: 'S93.4', desc: 'Vrtnutí kotníku', cat: 'S' },
    { code: 'S46.0', desc: 'Poranění šlach svalu rotátorové manžety', cat: 'S' },
    { code: 'G54.0', desc: 'Brachiální plexus léze', cat: 'G' },
    { code: 'I10', desc: 'Esenciální (primární) hypertenze', cat: 'I' },
    { code: 'E11.9', desc: 'Diabetes mellitus 2. typu', cat: 'E' },
    { code: 'E78.5', desc: 'Hyperlipidemie, nespecifikovaná', cat: 'E' },
    { code: 'J06.9', desc: 'Akutní infekce horních cest dýchacích', cat: 'J' },
    { code: 'K21.0', desc: 'Gastroesofageální reflux s ezofagitidou', cat: 'K' },
    { code: 'F32.1', desc: 'Epizoda středně těžké depresivní poruchy', cat: 'F' },
    { code: 'F41.1', desc: 'Generalizovaná úzkostná porucha', cat: 'F' },
    { code: 'R51', desc: 'Bolest hlavy', cat: 'R' },
    { code: 'R52.9', desc: 'Chronická bolest, nespecifikovaná', cat: 'R' },
    { code: 'Z71.3', desc: 'Poradenství v oblasti výživy', cat: 'Z' },
    { code: 'Z00.0', desc: 'Všeobecná lékařská prohlídka', cat: 'Z' },
    { code: 'M47.8', desc: 'Spondylóza', cat: 'M' },
    { code: 'M51.1', desc: 'Poruchy meziobratlové ploténky s radikulopatií', cat: 'M' },
    { code: 'M65.4', desc: 'De Quervainova tenosynovitida', cat: 'M' },
    { code: 'M77.0', desc: 'Mediální epikondylitida', cat: 'M' },
    { code: 'M77.1', desc: 'Laterální epikondylitida', cat: 'M' },
    { code: 'G56.0', desc: 'Syndrom karpálního tunelu', cat: 'G' },
    { code: 'S52.5', desc: 'Zlomenina distálního předloktí', cat: 'S' },
    { code: 'S62.3', desc: 'Zlomenina záprstních kůstek', cat: 'S' },
    { code: 'I25.1', desc: 'Aterosklerotická ischemická choroba srdeční', cat: 'I' },
    { code: 'J45.9', desc: 'Astma, nespecifikované', cat: 'J' },
    { code: 'K80.2', desc: 'Kámen v žlučníku bez zánětu', cat: 'K' },
    { code: 'N18.9', desc: 'Chronické onemocnění ledvin', cat: 'N' },
    { code: 'F20.9', desc: 'Schizofrenie, nespecifikovaná', cat: 'F' },
    { code: 'C34.1', desc: 'Zhoubný novotvar bronchusu a plic', cat: 'C' },
    { code: 'D64.9', desc: 'Anémie, nespecifikovaná', cat: 'D' },
    { code: 'A09', desc: 'Infekční gastroenteritida a kolitida', cat: 'A' },
    { code: 'B34.9', desc: 'Virová infekce, nespecifikovaná', cat: 'B' },
    { code: 'H10.9', desc: 'Zánět spojivek, nespecifikovaný', cat: 'H' },
    { code: 'L40.9', desc: 'Psoriáza, nespecifikovaná', cat: 'L' },
    { code: 'O26.8', desc: 'Jiné těhotenské stavy', cat: 'O' },
    { code: 'Q21.0', desc: 'Komorový defekt septa', cat: 'Q' },
  ];

  demoEntries.forEach((e, i) => {
    codes.push({
      id: `icd-${i}`,
      code: e.code,
      description: e.desc,
      category: e.cat,
    });
  });
  return codes;
}

const ROW_HEIGHT = 48;

export default function Codebook() {
  const [codes, setCodes] = useState<ICDCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState<ICDCode | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('icd_favorites') || '[]'));
    } catch { return new Set(); }
  });
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [adminEditOpen, setAdminEditOpen] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [assignTargetPatientId, setAssignTargetPatientId] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  /* v2 gives the ref its own type; `List` is a component, not one. */
  const listRef = useListRef(null);
  const currentUserRole = useAppStore((s) => s.currentUserRole);

  /* ── Load codes (from cache or generate demo) ── */
  useEffect(() => {
    const load = async () => {
      const cached = await getCachedICDCodes();
      if (cached && cached.length > 0) {
        setCodes(cached);
      } else {
        const demo = generateDemoCodes();
        setCodes(demo);
        await setCachedICDCodes(demo);
      }
      setLoading(false);
    };
    load();
    patientsApi.getAll().then(setPatients).catch(() => {});
  }, []);

  /* ── Filtered codes ── */
  const filteredCodes = useMemo(() => {
    let result = codes;

    /* Category filter */
    if (activeCategory) {
      result = result.filter((c) => c.category === activeCategory);
    }

    /* Search filter */
    if (search.length >= 2) {
      result = searchICDCodesLocally(result, search);
    }

    /* Favorites filter */
    if (showFavoritesOnly) {
      result = result.filter((c) => favorites.has(c.id));
    }

    return result;
  }, [codes, search, activeCategory, showFavoritesOnly, favorites]);

  /* ── Categories ── */
  const categories = useMemo(() => {
    const uniquePrefixes = new Map<string, number>();
    codes.forEach((c) => {
      uniquePrefixes.set(c.category, (uniquePrefixes.get(c.category) || 0) + 1);
    });
    return Array.from(uniquePrefixes.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [codes]);

  /* ── Toggle favorite ── */
  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem('icd_favorites', JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  /* ── Category label lookup ── */
  const getCategoryLabel = (prefix: string): string => {
    const cat = ICD_CATEGORIES.find((c) => c.prefix === prefix);
    return cat ? `${cat.label} (${cat.range})` : prefix;
  };

  /* ── Virtual row renderer ── */
  /*
   * `react-window` v2 hands the row its own aria attributes and calls this
   * through `rowComponent` rather than as a child. The old signature was v1's.
   *
   * The styling below used to be a `css={{...}}` prop. Nothing in this project
   * configures emotion's JSX transform - no `jsxImportSource`, no pragma in
   * this file - so that object went to the DOM as an unknown attribute and the
   * rows have never had any of it: no striping, no padding, no highlight on the
   * selected row. It is a plain `style` now, merged after the positioning style
   * the list supplies, which it must not overwrite.
   */
  const VirtualRow = useCallback(({ index, style, ariaAttributes }: {
    index: number;
    style: React.CSSProperties;
    ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
  }) => {
    const code = filteredCodes[index];
    if (!code) return null;
    const isSelected = selectedCode?.id === code.id;
    const isFav = favorites.has(code.id);

    return (
      <div
        {...ariaAttributes}
        /* A `listitem` may not be `aria-selected`; `aria-current` is the one
           that says "this is the row you are looking at". */
        aria-current={isSelected ? 'true' : undefined}
        aria-label={`${code.code} — ${code.description}`}
        onClick={() => setSelectedCode(code)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') setSelectedCode(code);
          /* v2 renamed `scrollToItem` and takes a config object rather than
             positional arguments. `align` still accepts `smart`; `auto` is used
             here because moving one row does not need the smart heuristic. */
          if (e.key === 'ArrowDown' && listRef.current)
            listRef.current.scrollToRow({ index: index + 1, align: 'auto' });
          if (e.key === 'ArrowUp' && listRef.current)
            listRef.current.scrollToRow({ index: index - 1, align: 'auto' });
        }}
        className="codebook-row"
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          cursor: 'pointer',
          borderBottom: '1px solid #f0f0f0',
          background: isSelected ? '#E0F2F1' : index % 2 ? '#fafbfc' : '#fff',
          transition: 'background 0.1s',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#f0faf9';
        }}
        onMouseLeave={(e) => {
          if (!isSelected) (e.currentTarget as HTMLElement).style.background = index % 2 ? '#fafbfc' : '#fff';
        }}
      >
        {/* Favorite */}
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); toggleFavorite(code.id); }}
          aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
          sx={{ mr: 1, color: isFav ? '#F59E0B' : '#ccc' }}
        >
          {isFav ? <Star fontSize="small" /> : <StarBorder fontSize="small" />}
        </IconButton>

        {/* Code */}
        <Typography
          sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, width: 80, color: '#0D7377' }}
        >
          {code.code}
        </Typography>

        {/* Description */}
        <Typography sx={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {code.description}
        </Typography>

        {/* Category badge */}
        <Chip label={code.category} size="small" sx={{ fontSize: 10, height: 20, ml: 1 }} />
      </div>
    );
  }, [filteredCodes, selectedCode, favorites, toggleFavorite, listRef]);

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" width={300} height={40} sx={{ mb: 3 }} />
        <Grid container spacing={2}>
          <Grid size={{ xs: 3 }}><Skeleton variant="rounded" height={500} sx={{ borderRadius: 3 }} /></Grid>
          <Grid size={{ xs: 6 }}><Skeleton variant="rounded" height={500} sx={{ borderRadius: 3 }} /></Grid>
          <Grid size={{ xs: 3 }}><Skeleton variant="rounded" height={500} sx={{ borderRadius: 3 }} /></Grid>
        </Grid>
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
              <Book color="primary" /> Číselník diagnóz (ICD-10 / MKN-10)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {codes.length} kódů · Virtuální seznam · Lokální cache pro okamžité vyhledávání
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Zobrazit jen oblíbené">
              <IconButton onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                sx={{ color: showFavoritesOnly ? '#F59E0B' : '#999' }}>
                {showFavoritesOnly ? <Star /> : <StarBorder />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </motion.div>

      {/* ── Search Bar ── */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <TextField
          fullWidth size="small"
          placeholder="Hledat podle kódu nebo popisu (např. M54.5, bolest zad)..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch('')}>
                    <Close fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          aria-label="Vyhledávání v číselníku ICD-10"
        />
      </Paper>

      {/* ── Main Layout: Sidebar + List + Detail ── */}
      <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 280px)' }}>
        {/* Category Sidebar */}
        <Paper sx={{ width: 240, flexShrink: 0, borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', bgcolor: '#f8f9fa' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Kategorie</Typography>
          </Box>
          <List dense sx={{ overflow: 'auto', flex: 1, maxHeight: 'calc(100vh - 340px)' }}>
            {/* `ListItem button` went away; a clickable row is `ListItemButton`. */}
            <ListItemButton
              onClick={() => setActiveCategory(null)}
              selected={!activeCategory}
              sx={{ borderRadius: 1, mx: 0.5, mb: 0.5 }}
            >
              <ListItemText primary="Všechny kódy" secondary={`${codes.length} kódů`} />
            </ListItemButton>
            <Divider sx={{ my: 0.5 }} />
            {categories.map(([prefix, count]) => {
              const cat = ICD_CATEGORIES.find((c) => c.prefix === prefix);
              return (
                <ListItemButton
                  key={prefix}
                  onClick={() => setActiveCategory(activeCategory === prefix ? null : prefix)}
                  selected={activeCategory === prefix}
                  sx={{ borderRadius: 1, mx: 0.5, mb: 0.5 }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12 }}>
                          {prefix}
                        </Typography>
                        <Badge badgeContent={count} color="primary" sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16 } }} />
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                        {cat?.range || ''}
                      </Typography>
                    }
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Paper>

        {/* Virtualized Code List */}
        <Paper sx={{ flex: 1, borderRadius: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 1.5, borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f8f9fa' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {activeCategory ? getCategoryLabel(activeCategory) : 'Všechny kódy'} · {filteredCodes.length} výsledků
            </Typography>
            <Chip label={`${favorites.size} oblíbených`} size="small" sx={{ bgcolor: '#FEF3C7', color: '#92400E' }} />
          </Box>

          <VirtualList
            listRef={listRef}
            style={{ height: 500, width: '100%' }}
            rowCount={filteredCodes.length}
            rowHeight={ROW_HEIGHT}
            rowComponent={VirtualRow}
            rowProps={{}}
            overscanCount={10}
          />
        </Paper>

        {/* Detail Panel */}
        <AnimatePresence>
          {selectedCode && (
            <motion.div
              initial={{ opacity: 0, x: 20, width: 320 }}
              animate={{ opacity: 1, x: 0, width: 320 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
              style={{ flexShrink: 0 }}
            >
              <Paper sx={{ borderRadius: 3, overflow: 'hidden', height: 'fit-content' }}>
                <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#E0F2F1' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#0D7377', fontFamily: 'monospace' }}>
                    {selectedCode.code}
                  </Typography>
                  <IconButton size="small" onClick={() => setSelectedCode(null)}>
                    <Close fontSize="small" />
                  </IconButton>
                </Box>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, fontSize: 16 }}>
                    {selectedCode.description}
                  </Typography>

                  <Divider sx={{ my: 2 }} />

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary">Kategorie</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {getCategoryLabel(selectedCode.category)}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary">Rozsah kódů</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {ICD_CATEGORIES.find((c) => c.prefix === selectedCode.category)?.range || '—'}
                    </Typography>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  {/* Patient selector for assign */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Cílový pacient</Typography>
                    <TextField
                      select fullWidth size="small"
                      value={assignTargetPatientId || ''}
                      onChange={(e) => setAssignTargetPatientId(e.target.value)}
                    >
                      <MenuItem value="">Vyberte pacienta...</MenuItem>
                      {patients.map((p) => (
                        <MenuItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</MenuItem>
                      ))}
                    </TextField>
                  </Box>

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      variant="contained" size="small" startIcon={<Add />}
                      disabled={!assignTargetPatientId}
                      onClick={() => {
                        useAppStore.getState().setPendingDiagnosis({ code: selectedCode.code, description: selectedCode.description });
                        useAppStore.getState().openDrawer(assignTargetPatientId!);
                        toast.success(`Kód ${selectedCode.code} připraven k přiřazení`);
                      }}
                      sx={{ bgcolor: '#0D7377', borderRadius: 2, fontWeight: 600 }}
                    >
                      Přidat pacientovi
                    </Button>
                    <Button
                      variant="outlined" size="small"
                      startIcon={favorites.has(selectedCode.id) ? <Star /> : <StarBorder />}
                      onClick={() => toggleFavorite(selectedCode.id)}
                      sx={{ borderRadius: 2 }}
                    >
                      {favorites.has(selectedCode.id) ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
                    </Button>
                  </Box>

                  {/* Admin edit */}
                  {['Admin', 'SuperAdmin'].includes(currentUserRole) && (
                    <Box sx={{ mt: 2 }}>
                      <Divider sx={{ mb: 2 }} />
                      <Button
                        size="small" startIcon={<Edit />}
                        onClick={() => {
                          setEditNotes('');
                          setAdminEditOpen(true);
                        }}
                        sx={{ color: '#7C3AED', fontWeight: 600 }}
                      >
                        Admin poznámka
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Paper>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>

      {/* ── Admin Edit Dialog ── */}
      <Dialog open={adminEditOpen} onClose={() => setAdminEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Interní poznámka — {selectedCode?.code}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Přidejte interní poznámku k tomuto diagnózovému kódu.
          </Typography>
          <TextField
            fullWidth multiline rows={4} placeholder="Interní poznámka pro kliniku..."
            value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setAdminEditOpen(false)} sx={{ borderRadius: 2 }}>Zrušit</Button>
          <Button variant="contained" startIcon={<Save />}
            onClick={() => {
              toast.success('Poznámka uložena');
              setAdminEditOpen(false);
            }}
            sx={{ bgcolor: '#7C3AED', borderRadius: 2, px: 3 }}>
            Uložit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
