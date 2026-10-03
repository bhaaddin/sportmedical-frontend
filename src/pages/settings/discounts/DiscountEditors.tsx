/*
 * The three editors on the discounts screen - tiers, package discounts and the
 * manual-discount limit per role - and the live preview card.
 *
 * Each editor is one list in three layouts (brief, rule 3): on a phone every
 * row is a card with one field per line and 44 px buttons, from a tablet up it
 * is a table. Inputs are always labelled for the row they sit in ("Od kolika
 * osob - hladina 2"), so a screen reader and a test can tell them apart.
 */
import { Box, Button, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useState } from 'react';
import { useIsPhone } from '../../../layout/useDevice';
import { SectionLabel, SoftCard } from '../../../components/ui';
import { ResponsiveDataList, type DataColumn } from '../../../components/ui/ResponsiveDataList';
import { TYPE, settingsGrey } from '../../../components/settings/settingsStyle';
import {
  type DiscountErrors, type PackageRow, type PricedActivity, type RoleRow, type TierRange, type TierRow,
  dearestPriced, exampleLine, formatKc, formatPercent, headcountSentence, initialHeadcount, isOwnerRole,
  nextKey, parseWhole, rangeFor, rangeText, roleLabel,
} from './discountLogic';

/** A titled card: the section title (18/700) and one sentence under it. */
export function SectionCard({ id, title, caption, children }: { id: string; title: string; caption?: React.ReactNode; children: React.ReactNode }) {
  return (
    <SoftCard component="section" aria-labelledby={id}>
      <Typography id={id} component="h2" sx={TYPE.sectionTitle}>{title}</Typography>
      {caption !== undefined && <Typography sx={[TYPE.caption, { mt: 0.5, mb: 2, maxWidth: 720 }]}>{caption}</Typography>}
      {caption === undefined && <Box sx={{ mb: 2 }} />}
      {children}
    </SoftCard>
  );
}

const removeSx = { minHeight: 44, minWidth: 44, color: '#9B3B1B', borderColor: '#E3C3BA', fontWeight: 600 } as const;

function useFieldSize(): 'small' | 'medium' {
  return useIsPhone() ? 'medium' : 'small';
}

/* ── Tiers ── */

export function TierEditor({
  rows, errors, onChange,
}: { rows: TierRow[]; errors: DiscountErrors['tiers']; onChange: (rows: TierRow[]) => void }) {
  const size = useFieldSize();
  const edit = (key: string, patch: Partial<TierRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const position = (row: TierRow) => rows.findIndex((r) => r.key === row.key) + 1;

  const minField = (row: TierRow) => (
    <TextField
      size={size}
      value={row.min}
      onChange={(e) => edit(row.key, { min: e.target.value })}
      error={errors[row.key]?.min !== undefined}
      helperText={errors[row.key]?.min}
      label={size === 'medium' ? 'Od kolika osob' : undefined}
      fullWidth
      slotProps={{
        htmlInput: { inputMode: 'numeric', 'aria-label': `Od kolika osob — hladina ${position(row)}` },
        input: { endAdornment: <InputAdornment position="end">osob</InputAdornment> },
      }}
      sx={{ minWidth: 130 }}
    />
  );
  const percentField = (row: TierRow) => (
    <TextField
      size={size}
      value={row.percent}
      onChange={(e) => edit(row.key, { percent: e.target.value })}
      error={errors[row.key]?.percent !== undefined}
      helperText={errors[row.key]?.percent}
      label={size === 'medium' ? 'Sleva' : undefined}
      fullWidth
      slotProps={{
        htmlInput: { inputMode: 'decimal', 'aria-label': `Sleva hladiny ${position(row)} v procentech` },
        input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
      }}
      sx={{ minWidth: 120 }}
    />
  );
  const removeButton = (row: TierRow) => (
    <Button variant="outlined" color="inherit" sx={removeSx} aria-label={`Odebrat hladinu ${position(row)}`} onClick={() => onChange(rows.filter((r) => r.key !== row.key))}>
      Odebrat
    </Button>
  );

  const columns: DataColumn<TierRow>[] = [
    { key: 'min', header: 'Od kolika osob', tablet: true, cell: minField },
    { key: 'percent', header: 'Sleva', tablet: true, cell: percentField },
    { key: 'actions', header: 'Akce', tablet: true, align: 'right', cell: removeButton },
  ];

  const addButton = (
    <Button variant="outlined" color="inherit" startIcon={<AddIcon />} sx={{ minHeight: 44, borderStyle: 'dashed', color: 'primary.main', fontWeight: 600 }}
      onClick={() => onChange([...rows, { key: nextKey(), min: '', percent: '' }])}>
      Přidat hladinu
    </Button>
  );

  return (
    <ResponsiveDataList
      rows={rows}
      rowKey={(r) => r.key}
      columns={columns}
      ariaLabel="Hladiny slevy podle počtu osob"
      empty={
        <Stack spacing={2} sx={{ alignItems: 'center' }}>
          <Typography sx={TYPE.caption}>Zatím žádná hladina. Bez hladin se skupinová sleva podle počtu osob neuplatní.</Typography>
          {addButton}
        </Stack>
      }
      renderCard={(row) => (
        <Stack spacing={1.5}>
          <Typography sx={TYPE.itemName}>Hladina {position(row)}</Typography>
          {minField(row)}
          {percentField(row)}
          {removeButton(row)}
        </Stack>
      )}
      footer={<Box sx={{ p: 1.5 }}>{addButton}</Box>}
    />
  );
}

/* ── Package discounts ── */

export interface ActivityChoice { id: string; name: string; isActive: boolean }

export function PackageEditor({
  rows, errors, activities, onChange,
}: { rows: PackageRow[]; errors: DiscountErrors['packages']; activities: ActivityChoice[]; onChange: (rows: PackageRow[]) => void }) {
  const size = useFieldSize();
  const edit = (key: string, patch: Partial<PackageRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const position = (row: PackageRow) => rows.findIndex((r) => r.key === row.key) + 1;
  const used = new Set(rows.map((r) => r.activityId).filter((id) => id !== ''));
  const free = activities.filter((a) => a.isActive && !used.has(a.id));
  const nameOf = (id: string) => activities.find((a) => a.id === id)?.name ?? 'Činnost, která už neexistuje';

  const activityField = (row: PackageRow) => (
    <TextField
      select
      size={size}
      value={row.activityId}
      onChange={(e) => edit(row.key, { activityId: e.target.value })}
      error={errors[row.key]?.activity !== undefined}
      helperText={errors[row.key]?.activity}
      label={size === 'medium' ? 'Činnost' : undefined}
      fullWidth
      slotProps={{ select: { native: true }, htmlInput: { 'aria-label': `Činnost balíčku ${position(row)}` } }}
      sx={{ minWidth: 200 }}
    >
      <option value="">Vyberte činnost</option>
      {row.activityId !== '' && !free.some((a) => a.id === row.activityId) && <option value={row.activityId}>{nameOf(row.activityId)}</option>}
      {free.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
    </TextField>
  );
  const percentField = (row: PackageRow) => (
    <TextField
      size={size}
      value={row.percent}
      onChange={(e) => edit(row.key, { percent: e.target.value })}
      error={errors[row.key]?.percent !== undefined}
      helperText={errors[row.key]?.percent}
      label={size === 'medium' ? 'Sleva' : undefined}
      fullWidth
      slotProps={{
        htmlInput: { inputMode: 'decimal', 'aria-label': `Sleva balíčku ${position(row)} v procentech` },
        input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
      }}
      sx={{ minWidth: 120 }}
    />
  );
  const removeButton = (row: PackageRow) => (
    <Button variant="outlined" color="inherit" sx={removeSx} aria-label={`Odebrat balíčkovou slevu ${position(row)}`} onClick={() => onChange(rows.filter((r) => r.key !== row.key))}>
      Odebrat
    </Button>
  );

  const columns: DataColumn<PackageRow>[] = [
    { key: 'activity', header: 'Činnost', tablet: true, cell: activityField },
    { key: 'percent', header: 'Sleva', tablet: true, cell: percentField },
    { key: 'actions', header: 'Akce', tablet: true, align: 'right', cell: removeButton },
  ];

  const addButton = (
    <Button variant="outlined" color="inherit" startIcon={<AddIcon />} disabled={free.length === 0}
      sx={{ minHeight: 44, borderStyle: 'dashed', color: 'primary.main', fontWeight: 600 }}
      onClick={() => onChange([...rows, { key: nextKey(), activityId: '', percent: '' }])}>
      Přidat balíčkovou slevu
    </Button>
  );

  return (
    <ResponsiveDataList
      rows={rows}
      rowKey={(r) => r.key}
      columns={columns}
      ariaLabel="Balíčkové slevy podle činnosti"
      empty={
        <Stack spacing={2} sx={{ alignItems: 'center' }}>
          <Typography sx={TYPE.caption}>Zatím žádná balíčková sleva. Cena balíčku se pak počítá bez ní.</Typography>
          {addButton}
        </Stack>
      }
      renderCard={(row) => (
        <Stack spacing={1.5}>
          <Typography sx={TYPE.itemName}>{row.activityId === '' ? 'Nová sleva' : nameOf(row.activityId)}</Typography>
          {activityField(row)}
          {percentField(row)}
          {removeButton(row)}
        </Stack>
      )}
      footer={<Box sx={{ p: 1.5 }}>{addButton}</Box>}
    />
  );
}

/* ── Manual discount limit per role ── */

export function RoleLimitEditor({
  rows, errors, onChange,
}: { rows: RoleRow[]; errors: DiscountErrors['roles']; onChange: (rows: RoleRow[]) => void }) {
  const size = useFieldSize();
  const editable = rows.filter((r) => !isOwnerRole(r.role));
  const edit = (key: string, percent: string) => onChange(rows.map((r) => (r.key === key ? { ...r, percent } : r)));

  const percentField = (row: RoleRow) => (
    <TextField
      size={size}
      value={row.percent}
      onChange={(e) => edit(row.key, e.target.value)}
      error={errors[row.key]?.percent !== undefined}
      helperText={errors[row.key]?.percent}
      label={size === 'medium' ? 'Nejvýše' : undefined}
      fullWidth
      slotProps={{
        htmlInput: { inputMode: 'decimal', 'aria-label': `Nejvyšší ruční sleva — ${roleLabel(row.role)}` },
        input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
      }}
      sx={{ minWidth: 120 }}
    />
  );
  const columns: DataColumn<RoleRow>[] = [
    { key: 'role', header: 'Role', tablet: true, cell: (r) => <Typography sx={TYPE.itemName}>{roleLabel(r.role)}</Typography> },
    { key: 'limit', header: 'Ruční sleva nejvýše', tablet: true, cell: percentField },
  ];

  return (
    <Stack spacing={1.5}>
      <ResponsiveDataList
        rows={editable}
        rowKey={(r) => r.key}
        columns={columns}
        ariaLabel="Limit ruční slevy podle role"
        empty="Server zatím neposlal žádnou roli, které by šlo limit nastavit."
        renderCard={(row) => (
          <Stack spacing={1.5}>
            <Typography sx={TYPE.itemName}>{roleLabel(row.role)}</Typography>
            {percentField(row)}
          </Stack>
        )}
      />
      <Typography sx={TYPE.caption}>
        <strong>Vlastník</strong> — bez omezení. Ruční sleva nad limit role nezmizí: faktura zůstane ve stavu „Čeká na schválení“, dokud ji
        v Fakturaci neschválí Admin nebo Vlastník.
      </Typography>
    </Stack>
  );
}

/* ── Live preview ── */

export function DiscountPreview({ ranges, activities }: { ranges: TierRange[]; activities: PricedActivity[] }) {
  const [heads, setHeads] = useState(() => initialHeadcount(ranges));
  const n = parseWhole(heads);
  const range = n === null ? null : rangeFor(ranges, n);
  const dearest = dearestPriced(activities);
  const example = n !== null && n > 0 && dearest !== null && dearest.priceCzk !== null ? { name: dearest.name, ...exampleLine(range, n, dearest.priceCzk) } : null;

  return (
    <Stack spacing={2}>
      <Box component="ul" aria-label="Hladiny podle počtu osob" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.75 }}>
        {ranges.length === 0 && <Typography component="li" sx={TYPE.caption}>Zatím žádná platná hladina.</Typography>}
        {ranges.map((r) => (
          <Box component="li" key={r.from} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Typography sx={TYPE.itemName}>{rangeText(r)}</Typography>
            <Typography sx={[TYPE.itemName, { fontVariantNumeric: 'tabular-nums' }]}>{formatPercent(r.percent)}</Typography>
          </Box>
        ))}
      </Box>

      <Box>
        <SectionLabel sx={{ color: settingsGrey }}>Vyzkoušet</SectionLabel>
        <TextField
          size="small"
          value={heads}
          onChange={(e) => setHeads(e.target.value)}
          fullWidth
          slotProps={{
            htmlInput: { inputMode: 'numeric', 'aria-label': 'Vyzkoušet počet osob' },
            input: { endAdornment: <InputAdornment position="end">osob</InputAdornment> },
          }}
        />
        <Typography role="status" sx={[TYPE.itemName, { mt: 1 }]}>
          {n === null || n < 1 ? 'Zadejte počet osob.' : headcountSentence(ranges, n)}
        </Typography>
        {example !== null && n !== null && (
          <Typography sx={[TYPE.caption, { mt: 0.5 }]}>
            {n} × {example.name}: {formatKc(example.subtotal)}
            {range !== null ? `, sleva −${formatKc(example.discount)}, celkem ${formatKc(example.total)}` : ' bez slevy'}.
          </Typography>
        )}
      </Box>

      <Typography sx={TYPE.caption}>
        Sleva týmu a sleva podle počtu se nesčítají — platí vyšší. Balíčková sleva se použije jen na řádky balíčku.
      </Typography>
    </Stack>
  );
}
