/*
 * "Nalezeny možné duplicity (n)": a banner that opens a dialog with each group
 * side by side - what each one carries, and Smazat / Archivovat per item. The
 * buttons hand back to the screen, which runs the same flows as everywhere else.
 */
import { useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography,
} from '@mui/material';
import { useDevice } from '../../../layout/useDevice';
import { SoftCard } from '../../../components/ui';
import type { DuplicateCandidate, DuplicateGroup } from './duplicates';

export const DUPLICATES_TEXT = {
  banner: (n: number) => `Nalezeny možné duplicity (${n})`,
  show: 'Zobrazit',
  title: 'Možné duplicity',
  intro: 'Tyhle názvy se liší jen velikostí písmen, diakritikou nebo pořadím slov. Ponechte jednu a ostatní smažte, nebo archivujte.',
  group: (n: number) => `Skupina ${n}`,
  archived: 'Archivovaná',
  active: 'Aktivní',
  delete: 'Smazat',
  archive: 'Archivovat',
  close: 'Zavřít',
  noPermission: 'Mazat a archivovat může jen ten, kdo smí upravovat nastavení ordinace.',
};

export default function DuplicatesNotice<T extends DuplicateCandidate>({
  groups, noun, describe, canEdit, onDelete, onArchive,
}: {
  groups: readonly DuplicateGroup<T>[];
  /** "službu" / "činnost": used in button labels. */
  noun: string;
  /** What is known about one item (price line, counts, ...). */
  describe: (item: T) => string;
  canEdit: boolean;
  onDelete: (item: T) => void;
  onArchive: (item: T) => void;
}) {
  const device = useDevice();
  const [open, setOpen] = useState(false);
  if (groups.length === 0) return null;
  return (
    <>
      <Alert
        severity="info"
        data-testid="duplicates-banner"
        action={<Button color="inherit" size="small" onClick={() => setOpen(true)} sx={{ minHeight: 40 }}>{DUPLICATES_TEXT.show}</Button>}
        sx={{ mb: 2 }}
      >
        {DUPLICATES_TEXT.banner(groups.length)}
      </Alert>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md" fullScreen={device === 'phone'}>
        <DialogTitle sx={{ fontWeight: 700 }}>{DUPLICATES_TEXT.title}</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>{DUPLICATES_TEXT.intro}</Typography>
          {!canEdit && <Alert severity="info" sx={{ mb: 2 }}>{DUPLICATES_TEXT.noPermission}</Alert>}
          <Stack spacing={2.5}>
            {groups.map((group, gi) => (
              <Box key={group.key} data-testid="duplicate-group">
                <Typography sx={{ fontWeight: 700, mb: 1 }}>{DUPLICATES_TEXT.group(gi + 1)}</Typography>
                <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: device === 'phone' ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                  {group.items.map((item) => (
                    <SoftCard key={item.id} sx={{ p: 2 }}>
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                          <Typography sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{item.name}</Typography>
                          <Chip
                            size="small"
                            variant="outlined"
                            color={item.isActive ? 'success' : 'default'}
                            label={item.isActive ? DUPLICATES_TEXT.active : DUPLICATES_TEXT.archived}
                          />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">{describe(item)}</Typography>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            disabled={!canEdit}
                            aria-label={`${DUPLICATES_TEXT.delete} ${noun} ${item.name}`}
                            onClick={() => onDelete(item)}
                            sx={{ minHeight: 40 }}
                          >
                            {DUPLICATES_TEXT.delete}
                          </Button>
                          {item.isActive && (
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={!canEdit}
                              aria-label={`${DUPLICATES_TEXT.archive} ${noun} ${item.name}`}
                              onClick={() => onArchive(item)}
                              sx={{ minHeight: 40 }}
                            >
                              {DUPLICATES_TEXT.archive}
                            </Button>
                          )}
                        </Stack>
                      </Stack>
                    </SoftCard>
                  ))}
                </Box>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ minHeight: 44 }}>{DUPLICATES_TEXT.close}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
