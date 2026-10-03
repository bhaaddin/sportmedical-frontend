/* ══════════════════════════════════════════════════════════════
   SLEVY A CENOVÉ HLADINY  (route: /nastaveni/skupinove-slevy)

   A bigger group booked together is offered less per head, by how many people.
   The tiers are RECOMMENDATIONS: the discount a club actually gets is the
   administrator's own choice, made on the club's card (/clubs). The tiers and
   percentages are the clinic's to set — nothing hard-coded. The server refuses
   overlapping tiers and percentages out of range, and sends its own defaults so
   this screen keeps no copy of the rule.

   The board's screen 19: an editor table (NÁZEV HLADINY · OD · DO · SLEVA ·
   AKCE), "+ Přidat hladinu", a card saying how the recommendation is used with
   the way to the price list and to the clubs, and a "Příklad" card pricing a
   sample order on the dearest činnost so the owner sees what a tier would
   mean before saving it. "Zahodit" · "Uložit" sit top-right, as on every settings
   screen that saves.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { AddOutlined } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GROUP_DISCOUNTS_QUERY_KEY,
  readGroupDiscounts,
  saveGroupDiscounts,
} from '../../api/groupDiscounts';
import type { GroupDiscountSettings, GroupDiscountTier } from '../../api/groupDiscounts';
import { activitiesApi } from '../../api/activities';
import { formatCzk } from '../../components/booking/appointmentEdit';
import { SectionLabel, SoftCard, DESIGN } from '../../components/ui';
import { SettingsScreen } from './SettingsFrame';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';
import {
  dearestPriced,
  discountPreview,
  sampleHeadcount,
  tierName,
} from './groupDiscountPreview';

/** A tier as the row edits it — numbers as strings so a half-typed field is allowed. */
interface TierDraft {
  min: string;
  max: string;
  percent: string;
}

const toDraft = (tier: GroupDiscountTier): TierDraft => ({
  min: String(tier.minHeadcount),
  max: tier.maxHeadcount === null ? '' : String(tier.maxHeadcount),
  percent: String(tier.percent),
});

const toTier = (draft: TierDraft): GroupDiscountTier => ({
  minHeadcount: Number.parseInt(draft.min, 10) || 0,
  maxHeadcount: draft.max.trim() === '' ? null : Number.parseInt(draft.max, 10) || 0,
  percent: Number.parseFloat(draft.percent.replace(',', '.')) || 0,
});

/** A sample price for the preview when no činnost in the price list has one yet. */
const SAMPLE_UNIT_PRICE = 1000;

const cellInput = { width: 96 };

export default function GroupDiscountsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: GROUP_DISCOUNTS_QUERY_KEY, queryFn: readGroupDiscounts });
  /* The price list, for the preview only - the dearest činnost is what a club
     books by the dozen. A failed read leaves the sample price in its place. */
  const activities = useQuery({ queryKey: ['activities'], queryFn: () => activitiesApi.list() });
  const [rows, setRows] = useState<TierDraft[] | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (settings: GroupDiscountSettings) => saveGroupDiscounts(settings),
    onSuccess: (response) => {
      queryClient.setQueryData(GROUP_DISCOUNTS_QUERY_KEY, response);
      setRows(null);
      setSaved(true);
    },
    onError: () => setSaved(false),
  });

  if (query.isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (query.isError || !query.data) {
    return <Alert severity="error">Skupinové slevy se nepodařilo načíst.</Alert>;
  }

  const { defaults, maxTiers } = query.data;
  const draft = rows ?? query.data.settings.tiers.map(toDraft);
  const dirty = rows !== null;
  const errors = save.isError ? fieldErrorsOf(save.error) : {};
  const problem = save.isError ? problemMessageOf(save.error, 'Nastavení nelze uložit.') : null;

  const edit = (index: number, patch: Partial<TierDraft>) => {
    setSaved(false);
    setRows(draft.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const addRow = () => {
    setSaved(false);
    setRows([...draft, { min: '', max: '', percent: '' }]);
  };
  const removeRow = (index: number) => {
    setSaved(false);
    setRows(draft.filter((_, i) => i !== index));
  };
  const resetToDefaults = () => {
    setSaved(false);
    setRows(defaults.tiers.map(toDraft));
  };
  const discard = () => {
    setSaved(false);
    setRows(null);
  };

  /* The preview prices what is on screen - the unsaved tiers - so the owner
     sees a tier work before committing it. */
  const tiers = draft.map(toTier);
  const dearest = dearestPriced(activities.data?.activities ?? []);
  const unitPrice = dearest?.priceCzk ?? SAMPLE_UNIT_PRICE;
  const unitLabel = dearest?.name ?? 'vzorová cena';
  const preview = discountPreview(tiers, unitPrice, sampleHeadcount(tiers));

  return (
    <SettingsScreen
      title="Doporučené hladiny slev"
      subtitle="Doporučené hladiny — slevu klubu určuje administrátor na kartě klubu"
      actions={
        <>
          <Button variant="outlined" onClick={discard} disabled={!dirty || save.isPending}>
            Zahodit
          </Button>
          <Button
            variant="contained"
            onClick={() => save.mutate({ tiers })}
            disabled={save.isPending || !dirty}
          >
            {save.isPending ? 'Ukládám…' : 'Uložit'}
          </Button>
        </>
      }
    >
      <Stack spacing={2.5}>
        {errors.tiers !== undefined ? <Alert severity="error">{errors.tiers}</Alert> : null}
        {problem !== null && errors.tiers === undefined ? (
          <Alert severity="error">{problem}</Alert>
        ) : null}
        {saved ? <Alert severity="success">Uloženo.</Alert> : null}

        <TableContainer component={SoftCard} sx={{ p: 0 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Název hladiny</TableCell>
                <TableCell>Od</TableCell>
                <TableCell>Do</TableCell>
                <TableCell>Sleva</TableCell>
                <TableCell align="right">Akce</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {draft.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ color: 'text.secondary', py: 3 }}>
                    Zatím žádná hladina — každá skupina platí plnou cenu.
                  </TableCell>
                </TableRow>
              )}
              {draft.map((row, index) => (
                <TableRow key={index}>
                  {/* The API carries no tier names, so a tier is called by its
                      place. A name field would be a field that saves nowhere. */}
                  <TableCell sx={{ fontWeight: 600 }}>{tierName(index)}</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={row.min}
                      onChange={(e) => edit(index, { min: e.target.value })}
                      sx={cellInput}
                      slotProps={{ htmlInput: { min: 1, step: 1, 'aria-label': `${tierName(index)} od` } }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      placeholder="∞"
                      value={row.max}
                      onChange={(e) => edit(index, { max: e.target.value })}
                      sx={cellInput}
                      slotProps={{ htmlInput: { min: 1, step: 1, 'aria-label': `${tierName(index)} do` } }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={row.percent}
                      onChange={(e) => edit(index, { percent: e.target.value })}
                      sx={cellInput}
                      slotProps={{
                        htmlInput: { min: 0, max: 100, step: 1, 'aria-label': `${tierName(index)} sleva` },
                        input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      onClick={() => removeRow(index)}
                      sx={{ color: DESIGN.danger, fontWeight: 600 }}
                    >
                      Odebrat
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={5} sx={{ borderBottom: 0 }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Button
                      variant="outlined"
                      startIcon={<AddOutlined />}
                      onClick={addRow}
                      disabled={draft.length >= maxTiers}
                      sx={{ borderStyle: 'dashed', color: 'primary.main' }}
                    >
                      Přidat hladinu
                    </Button>
                    <Button size="small" onClick={resetToDefaults} disabled={save.isPending} sx={{ color: 'text.secondary' }}>
                      Obnovit výchozí hladiny
                    </Button>
                    {draft.length >= maxTiers && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Nejvýše {maxTiers} hladin.
                      </Typography>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 2fr) minmax(260px, 1fr)' },
            alignItems: 'start',
          }}
        >
          <SoftCard>
            <SectionLabel>Jak se hladiny použijí</SectionLabel>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Hladiny jsou jen doporučení: podle počtu osob ukazují, jakou slevu je rozumné
              klubu nabídnout. Skutečnou slevu určuje administrátor u každého klubu zvlášť
              na jeho kartě v sekci Kluby. Platba zůstává samostatný krok — sleva jen upraví
              částku k úhradě. Prázdné „Do“ znamená bez horní hranice.
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" component={RouterLink} to="/nastaveni/cenik">Otevřít ceník</Button>
              <Button variant="outlined" component={RouterLink} to="/clubs">Kluby</Button>
            </Stack>
          </SoftCard>

          <SoftCard>
            <SectionLabel>Příklad</SectionLabel>
            <Stack spacing={0.75}>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography variant="body2">
                  {preview.headcount} × {unitLabel}
                </Typography>
                <Typography variant="body2">{formatCzk(preview.subtotal)}</Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {preview.tierIndex >= 0
                    ? `${tierName(preview.tierIndex)} −${preview.percent} %`
                    : 'Bez hladiny'}
                </Typography>
                <Typography variant="body2" sx={{ color: DESIGN.danger }}>
                  {preview.discount > 0 ? `−${formatCzk(preview.discount)}` : formatCzk(0)}
                </Typography>
              </Stack>
              <Divider sx={{ my: 0.5 }} />
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Typography sx={{ fontWeight: 700 }}>Celkem</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 18 }}>{formatCzk(preview.total)}</Typography>
              </Stack>
            </Stack>
            {dearest === null && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.5 }}>
                Žádná činnost zatím nemá cenu v ceníku; příklad počítá se vzorovou cenou.
              </Typography>
            )}
          </SoftCard>
        </Box>
      </Stack>
    </SettingsScreen>
  );
}
