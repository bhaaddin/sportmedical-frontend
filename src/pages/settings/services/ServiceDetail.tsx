/*
 * One služba, opened: header (colour, name, state, archive) and five tabs -
 * Činnosti, Ceník, Kalendáře, Pravidla a dokumenty, Použití. Each tab is its
 * own section with its own loading, empty and error states. The route is
 * `/nastaveni/sluzby/:serviceId`.
 */
import { useState } from 'react';
import { Box, Button, Chip, FormControlLabel, Stack, Switch, Tab, Tabs, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import type { ClinicService } from '../../../api/clinicServices';
import { usePermission } from '../../../auth/usePermission';
import { SoftCard } from '../../../components/ui';
import { TYPE } from '../../../components/settings/settingsStyle';
import { useDevice } from '../../../layout/useDevice';
import ActivitiesSection from './ActivitiesSection';
import CalendarsSection from './CalendarsSection';
import PriceSection from './PriceSection';
import RulesSection from './RulesSection';
import UsageSection from './UsageSection';
import { countsLine } from './ServiceList';

export const TABS = [
  { id: 'cinnosti', label: 'Činnosti' },
  { id: 'cenik', label: 'Ceník' },
  { id: 'kalendare', label: 'Kalendáře' },
  { id: 'pravidla', label: 'Pravidla a dokumenty' },
  { id: 'pouziti', label: 'Použití' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function ServiceDetail({
  service, onEdit, onArchive, onRestore, onDelete, onBack, busy,
}: {
  service: ClinicService;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  /** Phone only: back to the list. */
  onBack?: () => void;
  busy: boolean;
}) {
  const device = useDevice();
  const canEdit = usePermission('settings.clinic.manage');
  const [tab, setTab] = useState<TabId>('cinnosti');

  return (
    <Stack spacing={2} data-testid="service-detail">
      {onBack !== undefined && (
        <Box>
          <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ minHeight: 44 }}>Všechny služby</Button>
        </Box>
      )}

      <SoftCard>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1.5 }}>
          <Box sx={{ width: 10, alignSelf: 'stretch', minHeight: 44, borderRadius: 3, bgcolor: service.colorHex ?? 'primary.main' }} />
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography component="h2" sx={TYPE.pageTitle}>{service.name}</Typography>
              <Chip
                size="small"
                color={service.isActive ? 'success' : 'default'}
                variant="outlined"
                label={service.isActive ? 'Aktivní' : 'Archivovaná'}
              />
            </Stack>
            {service.description !== '' && <Typography sx={TYPE.caption}>{service.description}</Typography>}
            <Typography sx={TYPE.caption}>{countsLine(service)}</Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={service.isActive}
                  disabled={!canEdit || busy}
                  onChange={(e) => (e.target.checked ? onRestore() : onArchive())}
                  slotProps={{ input: { 'aria-label': 'Služba je aktivní' } }}
                />
              }
              label="Aktivní"
            />
            <Button variant="outlined" startIcon={<EditIcon />} onClick={onEdit} disabled={!canEdit} sx={{ minHeight: 44 }}>
              Upravit službu
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={onDelete}
              disabled={!canEdit || busy}
              title={canEdit ? undefined : 'Mazat může jen ten, kdo smí upravovat nastavení ordinace.'}
              sx={{ minHeight: 44 }}
            >
              Smazat službu
            </Button>
          </Stack>
        </Stack>
      </SoftCard>

      <Tabs
        value={tab}
        onChange={(_, v: TabId) => setTab(v)}
        variant={device === 'desktop' ? 'standard' : 'scrollable'}
        scrollButtons={device === 'desktop' ? false : 'auto'}
        aria-label="Části služby"
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        {TABS.map((t) => (
          <Tab key={t.id} value={t.id} label={t.label} id={`service-tab-${t.id}`} aria-controls={`service-panel-${t.id}`} sx={{ minHeight: 48, fontWeight: 600 }} />
        ))}
      </Tabs>

      <Box role="tabpanel" id={`service-panel-${tab}`} aria-labelledby={`service-tab-${tab}`}>
        {tab === 'cinnosti' && <ActivitiesSection service={service} />}
        {tab === 'cenik' && <PriceSection service={service} />}
        {tab === 'kalendare' && <CalendarsSection service={service} />}
        {tab === 'pravidla' && <RulesSection service={service} />}
        {tab === 'pouziti' && <UsageSection service={service} />}
      </Box>
    </Stack>
  );
}
