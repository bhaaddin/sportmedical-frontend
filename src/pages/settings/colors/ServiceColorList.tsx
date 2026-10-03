/*
 * The služby with their colour, and under each the činnosti drawn in shades of
 * it. A table from a tablet up, a card per služba on a phone. The služba's
 * swatch and every činnost chip are buttons: they open the palette (the page
 * owns the popover).
 */
import { Box, Stack, Typography } from '@mui/material';
import { StatusChip } from '../../../components/ui';
import { ResponsiveDataList, type DataColumn } from '../../../components/ui/ResponsiveDataList';
import { TYPE, settingsLine } from '../../../components/settings/settingsStyle';
import type { ClinicService } from '../../../api/clinicServices';
import type { Activity } from '../../../api/bookingContracts';
import { drawnColor } from './colorLogic';

type Open<T> = (anchor: HTMLElement, target: T) => void;

export function ServiceColorList({
  services, activities, fallback, onService, onActivity,
}: {
  services: ClinicService[];
  activities: Activity[];
  /** What a služba without a colour is drawn in. */
  fallback: string;
  onService: Open<ClinicService>;
  onActivity: Open<Activity>;
}) {
  const sorted = [...services].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'cs'));
  const activitiesOf = (service: ClinicService) =>
    activities.filter((a) => a.clinicServiceId === service.id && a.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  const serviceButton = (service: ClinicService) => (
    <Box
      component="button"
      type="button"
      aria-label={`Změnit barvu služby ${service.name}`}
      onClick={(e: React.MouseEvent<HTMLElement>) => onService(e.currentTarget, service)}
      sx={{
        width: 44, height: 44, flexShrink: 0, borderRadius: 2, cursor: 'pointer',
        bgcolor: service.colorHex ?? fallback, border: '1px solid', borderColor: settingsLine,
        '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      }}
    />
  );

  const chips = (service: ClinicService) => {
    const list = activitiesOf(service);
    if (list.length === 0) return <Typography sx={TYPE.caption}>Bez činností</Typography>;
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {list.map((a) => (
          <Box
            key={a.id}
            component="button"
            type="button"
            aria-label={`Změnit barvu činnosti ${a.name}`}
            onClick={(e: React.MouseEvent<HTMLElement>) => onActivity(e.currentTarget, a)}
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 1, minHeight: 44, px: 1.5, cursor: 'pointer',
              border: '1px solid', borderColor: settingsLine, borderRadius: 999, bgcolor: 'background.paper',
              color: 'text.primary', fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
              '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 2 },
            }}
          >
            <Box aria-hidden component="span" sx={{ width: 14, height: 14, borderRadius: '4px', flexShrink: 0, bgcolor: drawnColor(a, service.colorHex, fallback) }} />
            {a.name}
            {a.colorHex != null && a.colorHex !== '' && <StatusChip size="sm">vlastní</StatusChip>}
          </Box>
        ))}
      </Box>
    );
  };

  const name = (service: ClinicService) => (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={TYPE.itemName}>{service.name}</Typography>
      {!service.isActive && <StatusChip size="sm">Vypnuto</StatusChip>}
    </Box>
  );

  const columns: DataColumn<ClinicService>[] = [
    { key: 'service', header: 'Služba', tablet: true, cell: (s) => <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>{serviceButton(s)}{name(s)}</Stack> },
    { key: 'activities', header: 'Činnosti v odstínech', tablet: true, cell: chips },
    { key: 'hex', header: 'Barva', tablet: true, cell: (s) => <Typography sx={[TYPE.caption, { fontVariantNumeric: 'tabular-nums' }]}>{s.colorHex ?? '—'}</Typography> },
  ];

  return (
    <ResponsiveDataList
      rows={sorted}
      rowKey={(s) => s.id}
      columns={columns}
      ariaLabel="Služby a jejich barvy"
      empty="Zatím žádná služba. Barva se přidělí automaticky, jakmile nějakou založíte."
      renderCard={(s) => (
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            {serviceButton(s)}
            <Box sx={{ minWidth: 0 }}>
              {name(s)}
              <Typography sx={[TYPE.caption, { fontVariantNumeric: 'tabular-nums' }]}>{s.colorHex ?? '—'}</Typography>
            </Box>
          </Stack>
          {chips(s)}
        </Stack>
      )}
    />
  );
}

export default ServiceColorList;
