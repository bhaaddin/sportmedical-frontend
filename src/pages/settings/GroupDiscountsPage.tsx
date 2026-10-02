/* ══════════════════════════════════════════════════════════════
   SKUPINOVÉ SLEVY  (route: /nastaveni/skupinove-slevy)

   A bigger group booked together pays less, by how many people. The bands and
   percentages are the clinic's to set — nothing hard-coded. The server refuses
   overlapping bands and percentages out of range, and sends its own defaults so
   this screen keeps no copy of the rule.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AddOutlined, DeleteOutlined } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GROUP_DISCOUNTS_QUERY_KEY,
  readGroupDiscounts,
  saveGroupDiscounts,
} from '../../api/groupDiscounts';
import type { GroupDiscountSettings, GroupDiscountTier } from '../../api/groupDiscounts';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';

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

export default function GroupDiscountsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: GROUP_DISCOUNTS_QUERY_KEY, queryFn: readGroupDiscounts });
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

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Skupinové slevy</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Čím víc lidí přijde společně, tím větší sleva. Pásma a procenta jsou vaše — nastavte je,
          jak potřebujete. Sleva se použije automaticky podle počtu osob.
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ maxWidth: 680 }}>
        <CardContent>
          <Stack spacing={2}>
            {errors.tiers !== undefined ? <Alert severity="error">{errors.tiers}</Alert> : null}
            {problem !== null && errors.tiers === undefined ? (
              <Alert severity="error">{problem}</Alert>
            ) : null}
            {saved ? <Alert severity="success">Uloženo.</Alert> : null}

            <Stack
              direction="row"
              spacing={1}
              sx={{ px: 0.5, color: 'text.secondary', fontSize: 13, fontWeight: 600 }}
            >
              <Box sx={{ flex: 1 }}>Od (osob)</Box>
              <Box sx={{ flex: 1 }}>Do (osob)</Box>
              <Box sx={{ flex: 1 }}>Sleva %</Box>
              <Box sx={{ width: 40 }} />
            </Stack>

            {draft.map((row, index) => (
              <Stack key={index} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <TextField
                  size="small"
                  type="number"
                  value={row.min}
                  onChange={(e) => edit(index, { min: e.target.value })}
                  sx={{ flex: 1 }}
                  slotProps={{ htmlInput: { min: 1, step: 1 } }}
                />
                <TextField
                  size="small"
                  type="number"
                  placeholder="∞"
                  value={row.max}
                  onChange={(e) => edit(index, { max: e.target.value })}
                  sx={{ flex: 1 }}
                  slotProps={{ htmlInput: { min: 1, step: 1 } }}
                  helperText="prázdné = bez horní hranice"
                />
                <TextField
                  size="small"
                  type="number"
                  value={row.percent}
                  onChange={(e) => edit(index, { percent: e.target.value })}
                  sx={{ flex: 1 }}
                  slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
                />
                <IconButton
                  aria-label="Odebrat pásmo"
                  onClick={() => removeRow(index)}
                  size="small"
                >
                  <DeleteOutlined fontSize="small" />
                </IconButton>
              </Stack>
            ))}

            <Box>
              <Button
                startIcon={<AddOutlined />}
                onClick={addRow}
                disabled={draft.length >= maxTiers}
                size="small"
              >
                Přidat pásmo
              </Button>
            </Box>

            <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
              <Button
                variant="contained"
                onClick={() => save.mutate({ tiers: draft.map(toTier) })}
                disabled={save.isPending || rows === null}
              >
                {save.isPending ? 'Ukládám…' : 'Uložit'}
              </Button>
              <Button onClick={resetToDefaults} disabled={save.isPending}>
                Výchozí pásma
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
