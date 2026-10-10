/*
 * The master list of Služby: one selectable row per služba with its colour,
 * its state and what hangs off it. Choosing a row opens that služba's detail
 * (`/nastaveni/sluzby/:serviceId`). Archived ones sit in a collapsed
 * "Archivované" list with "Obnovit"; a služba is archived, never deleted.
 */
import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, ButtonBase, Chip, Collapse, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import type { ClinicService } from '../../../api/clinicServices';
import { SERVICE_GAP_TEXT, serviceGap } from '../../booking/clinicServiceState';
import { SoftCard } from '../../../components/ui';
import { usePermission } from '../../../auth/usePermission';
import { TYPE, settingsHover, settingsSelected } from '../../../components/settings/settingsStyle';

export const SERVICE_LIST_TEXT = {
  archive: 'Archivovat',
  delete: 'Smazat',
  noPermission: 'Mazat může jen ten, kdo smí upravovat nastavení ordinace.',
  restore: 'Obnovit',
  archivedHeading: (count: number) => `Archivované (${count})`,
  archivedChip: 'Archivovaná',
  activeChip: 'Aktivní',
  search: 'Hledat službu',
  noMatch: 'Žádná služba neodpovídá hledání.',
};

export const plural = (n: number, one: string, few: string, many: string): string =>
  `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;

export function countsLine(service: ClinicService): string {
  return `${plural(service.activities, 'činnost', 'činnosti', 'činností')} · ${plural(service.calendars, 'kalendář', 'kalendáře', 'kalendářů')}`;
}

export default function ServiceList({
  services, selectedId, onSelect, onEdit, onArchive, onRestore, onDelete, restoring, priceOf,
}: {
  services: readonly ClinicService[];
  /**
   * "Ceny doplnit všude" (owner, 10. 10. 2026): the služba's price range ("od 1 600 Kč") and the
   * tooltip of its činnosti, from whoever holds the catalogue; absent while it is still loading.
   */
  priceOf?: (serviceId: string) => { text: string; tooltip: string } | null;
  selectedId: string | null;
  onSelect: (service: ClinicService) => void;
  onEdit: (service: ClinicService) => void;
  onArchive: (service: ClinicService) => void;
  onRestore: (service: ClinicService) => void;
  onDelete: (service: ClinicService) => void;
  restoring: boolean;
}) {
  const canEdit = usePermission('settings.clinic.manage');
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const { active, archived } = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('cs');
    const sorted = [...services]
      .filter((s) => q === '' || s.name.toLocaleLowerCase('cs').includes(q))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return { active: sorted.filter((s) => s.isActive), archived: sorted.filter((s) => !s.isActive) };
  }, [services, query]);
  const archivedTotal = services.filter((s) => !s.isActive).length;

  return (
    <Stack spacing={1.5} data-testid="service-list">
      <TextField
        size="small"
        placeholder={SERVICE_LIST_TEXT.search}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        slotProps={{
          htmlInput: { 'aria-label': SERVICE_LIST_TEXT.search },
          input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
        }}
        fullWidth
      />

      {active.length === 0 && query.trim() !== '' && (
        <Typography sx={TYPE.caption}>{SERVICE_LIST_TEXT.noMatch}</Typography>
      )}

      {active.map((service) => {
        const gap = serviceGap(service);
        const selected = service.id === selectedId;
        return (
          <SoftCard
            key={service.id}
            sx={{ p: 0, overflow: 'hidden', borderColor: selected ? 'primary.main' : undefined, borderWidth: selected ? 2 : 1 }}
          >
            <Stack direction="row" sx={{ alignItems: 'stretch', flexWrap: 'wrap' }}>
              <ButtonBase
                onClick={() => onSelect(service)}
                aria-label={`Otevřít službu ${service.name}`}
                aria-current={selected ? 'true' : undefined}
                sx={{
                  flex: '1 1 200px', minWidth: 0, minHeight: 64, p: 2, gap: 1.5, justifyContent: 'flex-start', textAlign: 'left',
                  bgcolor: selected ? settingsSelected : undefined, '&:hover': { bgcolor: settingsHover },
                }}
              >
                <Box sx={{ width: 6, alignSelf: 'stretch', borderRadius: 3, bgcolor: service.colorHex ?? 'primary.main', flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography sx={TYPE.itemName}>{service.name}</Typography>
                    <Chip size="small" color="success" variant="outlined" label={SERVICE_LIST_TEXT.activeChip} />
                  </Stack>
                  {(() => {
                    const price = priceOf?.(service.id) ?? null;
                    return (
                      <Typography sx={TYPE.caption} title={price?.tooltip || undefined} data-testid="service-row-line">
                        {countsLine(service)}
                        {price ? ` · ${price.text}` : ''}
                      </Typography>
                    );
                  })()}
                </Box>
              </ButtonBase>
              <Stack direction="row" sx={{ alignItems: 'center', pr: 0.5, pl: 1.5, pb: 0.5, ml: 'auto' }}>
                <Tooltip title="Upravit">
                  <IconButton aria-label={`Upravit službu ${service.name}`} onClick={() => onEdit(service)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={SERVICE_LIST_TEXT.archive}>
                  <IconButton aria-label={`${SERVICE_LIST_TEXT.archive} službu ${service.name}`} onClick={() => onArchive(service)}>
                    <ArchiveOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={canEdit ? SERVICE_LIST_TEXT.delete : SERVICE_LIST_TEXT.noPermission}>
                  <span>
                    <IconButton
                      aria-label={`${SERVICE_LIST_TEXT.delete} službu ${service.name}`}
                      disabled={!canEdit}
                      onClick={() => onDelete(service)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>
            {/* Said on the row: a služba with no činnost or no calendar offers nothing and looks like one that works. */}
            {gap !== 'none' && (
              <Alert
                severity="warning"
                sx={{ borderRadius: 0 }}
                action={<Button color="inherit" size="small" onClick={() => onEdit(service)}>Přiřadit</Button>}
              >
                {SERVICE_GAP_TEXT[gap]}
              </Alert>
            )}
          </SoftCard>
        );
      })}

      {archivedTotal > 0 && (
        <Box>
          <Button
            color="inherit"
            aria-expanded={showArchived}
            aria-controls="archived-services"
            endIcon={<ExpandMoreIcon sx={{ transform: showArchived ? 'rotate(180deg)' : 'none' }} />}
            onClick={() => setShowArchived((v) => !v)}
            sx={{ color: 'text.secondary', fontWeight: 600, minHeight: 44 }}
          >
            {SERVICE_LIST_TEXT.archivedHeading(archivedTotal)}
          </Button>
          <Collapse in={showArchived} unmountOnExit>
            <Stack id="archived-services" spacing={1} sx={{ mt: 1 }}>
              {archived.map((service) => (
                <SoftCard key={service.id} tone="muted" sx={{ p: 1.5 }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Box sx={{ minWidth: 140, flex: 1 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography sx={TYPE.itemName}>{service.name}</Typography>
                        <Chip size="small" variant="outlined" label={SERVICE_LIST_TEXT.archivedChip} />
                      </Stack>
                      <Typography sx={TYPE.caption}>{countsLine(service)}</Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<UnarchiveOutlinedIcon />}
                      aria-label={`${SERVICE_LIST_TEXT.restore} službu ${service.name}`}
                      disabled={restoring}
                      onClick={() => onRestore(service)}
                      sx={{ minHeight: 40 }}
                    >
                      {SERVICE_LIST_TEXT.restore}
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      startIcon={<DeleteOutlineIcon />}
                      aria-label={`${SERVICE_LIST_TEXT.delete} službu ${service.name}`}
                      disabled={!canEdit}
                      title={canEdit ? undefined : SERVICE_LIST_TEXT.noPermission}
                      onClick={() => onDelete(service)}
                      sx={{ minHeight: 40 }}
                    >
                      {SERVICE_LIST_TEXT.delete}
                    </Button>
                  </Stack>
                </SoftCard>
              ))}
            </Stack>
          </Collapse>
        </Box>
      )}
    </Stack>
  );
}
