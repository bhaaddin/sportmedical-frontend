/* Small pieces shared by the partners and the FAQ lists. */

import { Box, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Button } from '@mui/material';
import { ArrowDownward, ArrowUpward } from '@mui/icons-material';
import { settingsLine } from '../../../components/settings/settingsStyle';
import { useIsPhone } from '../../../layout/useDevice';

/** The list with item `id` moved one place up (-1) or down (+1), `sort` renumbered 1…n. */
export function moveItem<T extends { id: string; sort: number }>(items: readonly T[], id: string, direction: -1 | 1): T[] {
  const ordered = [...items].sort((a, b) => a.sort - b.sort);
  const from = ordered.findIndex((item) => item.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ordered.length) return ordered.map((item, index) => ({ ...item, sort: index + 1 }));
  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved);
  return ordered.map((item, index) => ({ ...item, sort: index + 1 }));
}

/** Items whose `sort` differs between two lists (what a reorder has to write). */
export function changedSort<T extends { id: string; sort: number }>(before: readonly T[], after: readonly T[]): T[] {
  const old = new Map(before.map((item) => [item.id, item.sort]));
  return after.filter((item) => old.get(item.id) !== item.sort);
}

export function ReorderButtons({ name, index, count, onMove, disabled }: {
  name: string;
  index: number;
  count: number;
  onMove: (direction: -1 | 1) => void;
  disabled?: boolean;
}) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
      <IconButton aria-label={`Posunout výš: ${name}`} onClick={() => onMove(-1)} disabled={disabled === true || index === 0} sx={{ width: 44, height: 44 }}>
        <ArrowUpward fontSize="small" />
      </IconButton>
      <IconButton aria-label={`Posunout níž: ${name}`} onClick={() => onMove(1)} disabled={disabled === true || index === count - 1} sx={{ width: 44, height: 44 }}>
        <ArrowDownward fontSize="small" />
      </IconButton>
    </Stack>
  );
}

export function ListRow({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="li"
      sx={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, py: 1.5, px: 2,
        borderTop: '1px solid', borderColor: settingsLine, '&:first-of-type': { borderTop: 'none' },
      }}
    >
      {children}
    </Box>
  );
}

export function ListBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box component="ul" aria-label={label} sx={{ listStyle: 'none', m: 0, p: 0, border: '1px solid', borderColor: settingsLine, borderRadius: 3, bgcolor: 'background.paper', overflow: 'hidden' }}>
      {children}
    </Box>
  );
}

/** A modal form: full-screen on a phone with the primary action pinned at the bottom. */
export function FormDialog({ title, open, onClose, onSubmit, submitLabel, submitDisabled, saving, children }: {
  title: string;
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled?: boolean;
  saving?: boolean;
  children: React.ReactNode;
}) {
  const phone = useIsPhone();
  return (
    <Dialog open={open} onClose={saving === true ? undefined : onClose} fullScreen={phone} fullWidth maxWidth="sm" aria-labelledby="form-dialog-title">
      <DialogTitle id="form-dialog-title" sx={{ fontSize: 18, fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack
          component="form"
          spacing={2}
          noValidate
          onSubmit={(event) => { event.preventDefault(); if (submitDisabled !== true) onSubmit(); }}
          sx={{ pt: 0.5 }}
        >
          {children}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1, ...(phone ? { position: 'sticky', bottom: 0, bgcolor: 'background.paper', '& > *': { flex: 1, m: 0 } } : {}) }}>
        <Button onClick={onClose} color="inherit" disabled={saving} sx={{ minHeight: 44, color: 'text.primary' }}>Zrušit</Button>
        <Button onClick={onSubmit} variant="contained" disabled={submitDisabled === true || saving === true} sx={{ minHeight: 44, fontWeight: 700 }}>
          {saving === true ? 'Ukládám…' : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
