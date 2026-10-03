/*
 * The price list: what the ordinace charges and what each činnost under it needs.
 *
 * These rows are "položky ceníku" on screen and not "služby", because that one
 * word meant two things in this application and misled the owner three times
 * in a day. A `činnost` is what you put in a calendar; a row here is what you
 * bill. One visit is scheduled as one činnost and billed as one or more of
 * these. The route and the type stay `api/services` and `ServiceItem` -
 * renaming those would reach into booking's `Activity.ServiceItemId` and into
 * invoicing and gain nothing, because it was the labels that misled, not the
 * identifiers.
 *
 * The prices live here and nowhere else (brief, rule 2): the calendar, the
 * invoices and the public web read them from this list.
 *
 * Etapa 2: under each row stand the činnosti that are billed by it, each with
 *   - the documents it makes the patient deliver (default none),
 *   - its colour (its own, or the shade of its služba), and
 *   - how many people it serves at once (used by the club-block planner),
 * edited in a dialog ("Upravit činnost"). The row itself carries the colour of
 * its služba. The price, code and active switch stay in "Upravit položku".
 *
 * Three layouts: a card per row on a phone, a three-column table on a tablet
 * (name with its činnosti, price, actions) and the full table from 1280 px.
 * Editing is real: the server has create, update and archive, and every rule
 * is checked in front, because the server checks almost none of them - see
 * `pricing/serviceForm.ts`. A failed load names what failed and offers
 * "Zkusit znovu".
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, InputAdornment, Stack, Skeleton,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Alert,
} from '@mui/material';
import { Search, Add } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { servicesApi } from '../api/services';
import { activitiesApi } from '../api/activities';
import { clinicServicesApi } from '../api/clinicServices';
import { documentsApi } from '../api/documents';
import { serviceColorsApi, SERVICE_COLORS_QUERY_KEY } from '../api/serviceColors';
import { usePermission } from '../auth/usePermission';
import { useIsPhone } from '../layout/useDevice';
import type { ServiceItem } from '../api/services';
import type { Activity } from '../api/bookingContracts';
import ServiceDialog from './pricing/ServiceDialog';
import ActivityLine from './cenik/ActivityLine';
import ActivityExtrasDialog from './cenik/ActivityExtrasDialog';
import { StatusChip, SoftCard, DESIGN } from '../components/ui';
import { ResponsiveDataList, type DataColumn } from '../components/ui/ResponsiveDataList';
import { TYPE } from '../components/settings/settingsStyle';

const NBSP = ' ';
/** "2 200 Kč" with a non-breaking space before the unit (brief, rule 9). */
const kc = (amount: number): string =>
  `${(Number.isFinite(amount) ? amount : 0).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace(/\s/g, NBSP)}${NBSP}Kč`;

const ACTIVITIES_KEY = ['cenik', 'activities'] as const;
const CLINIC_SERVICES_KEY = ['cenik', 'clinic-services'] as const;
const TEMPLATES_KEY = ['cenik', 'document-templates'] as const;

export default function Cenik() {
  const phone = useIsPhone();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  /* `undefined` closed; `null` a new service; an item to change that one. */
  const [editing, setEditing] = useState<ServiceItem | null | undefined>(undefined);
  /* Everybody reads the price list - the desk quotes from it. Changing it is
     the clinic's configuration, and the server refuses it without this. */
  const mayEdit = usePermission('settings.clinic.manage');
  const [archiving, setArchiving] = useState<ServiceItem | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  const load = useCallback(() => {
    servicesApi.getAll()
      .then((items) => { setServices(items); setFailed(null); })
      .catch(() => setFailed('Ceník se nepodařilo načíst.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  /* The činnosti under the rows. None of this blocks the price list itself. */
  const activitiesQuery = useQuery({ queryKey: ACTIVITIES_KEY, queryFn: async () => (await activitiesApi.list()).activities, retry: false });
  const clinicServicesQuery = useQuery({ queryKey: CLINIC_SERVICES_KEY, queryFn: clinicServicesApi.list, retry: false });
  const templatesQuery = useQuery({ queryKey: TEMPLATES_KEY, queryFn: () => documentsApi.getTemplates(), retry: false, enabled: mayEdit });
  const paletteQuery = useQuery({ queryKey: SERVICE_COLORS_QUERY_KEY, queryFn: serviceColorsApi.get, retry: false, enabled: mayEdit });

  const activities = activitiesQuery.data ?? [];
  const clinicServices = clinicServicesQuery.data ?? [];
  const serviceColorOf = (activity: Activity): string | null =>
    clinicServices.find((s) => s.id === activity.clinicServiceId)?.colorHex ?? null;
  const drawnColor = (activity: Activity): string | null =>
    activity.effectiveColorHex ?? activity.colorHex ?? serviceColorOf(activity);
  const activitiesOf = (item: ServiceItem): Activity[] =>
    activities.filter((a) => a.serviceItemId === item.id && a.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  /* The row's colour is its služba's: the first činnost billed by it says which. */
  const rowColor = (item: ServiceItem): string | null => {
    const first = activitiesOf(item)[0];
    return first === undefined ? null : serviceColorOf(first) ?? drawnColor(first);
  };

  const confirmArchive = async () => {
    if (archiving === null) return;
    try {
      await servicesApi.archive(archiving.id);
      setArchiving(null);
      load();
    } catch {
      setFailed('Vyřazení se nepodařilo.');
      setArchiving(null);
    }
  };

  const filtered = services.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase())
  );

  const newButton = (
    <Button variant="contained" startIcon={<Add />} onClick={() => setEditing(null)} sx={{ minHeight: 44, fontWeight: 600 }}>
      Nová položka
    </Button>
  );

  const nameBlock = (service: ServiceItem, withStatus: boolean) => {
    const color = rowColor(service);
    const lines = activitiesOf(service);
    return (
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <Box
            role="img"
            aria-label={color === null ? `Položka ${service.name} nemá barvu` : `Barva položky ${service.name}: ${color}`}
            sx={{ width: 14, height: 14, borderRadius: '4px', flexShrink: 0, bgcolor: color ?? 'transparent', border: color === null ? '1px dashed' : 'none', borderColor: 'text.disabled' }}
          />
          <Typography sx={TYPE.itemName}>{service.name}</Typography>
          {withStatus && <StatusChip size="sm" tone={service.isActive ? 'green' : 'grey'}>{service.isActive ? 'Aktivní' : 'Vyřazeno'}</StatusChip>}
        </Stack>
        {service.description !== '' && <Typography sx={[TYPE.caption, { mt: 0.25 }]}>{service.description}</Typography>}
        <Box sx={{ mt: 1 }}>
          {lines.map((a) => (
            <ActivityLine key={a.id} activity={a} color={drawnColor(a)} onEdit={mayEdit ? () => setEditingActivity(a) : undefined} />
          ))}
          {lines.length === 0 && !activitiesQuery.isPending && !activitiesQuery.isError && (
            <Typography sx={TYPE.caption}>Zatím žádná činnost se podle této položky neúčtuje.</Typography>
          )}
        </Box>
      </Box>
    );
  };

  const actions = (service: ServiceItem) => (
    /* Named, not just drawn: a screen reader needs to know which row the button belongs to. */
    <Stack direction="row" spacing={0.5} sx={{ justifyContent: { sm: 'flex-end' } }}>
      <Button size="small" variant="text" aria-label={`Upravit položku ${service.name}`} onClick={() => setEditing(service)} sx={{ minHeight: 44, minWidth: 44 }}>
        Upravit
      </Button>
      <Button size="small" variant="text" aria-label={`Vyřadit položku ${service.name}`} onClick={() => setArchiving(service)} sx={{ minHeight: 44, minWidth: 44, color: DESIGN.danger }}>
        Vyřadit
      </Button>
    </Stack>
  );

  const price = (service: ServiceItem) => (
    <Typography sx={[TYPE.itemName, { whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }]}>{kc(service.priceCzk)}</Typography>
  );

  const columns: DataColumn<ServiceItem>[] = [
    { key: 'name', header: 'Název a činnosti', tablet: true, cell: (s) => nameBlock(s, false) },
    { key: 'code', header: 'Kód', cell: (s) => <Typography sx={[TYPE.caption, { whiteSpace: 'nowrap' }]}>{s.code}</Typography> },
    { key: 'price', header: 'Cena', tablet: true, align: 'right', cell: price },
    { key: 'status', header: 'Stav', cell: (s) => <StatusChip tone={s.isActive ? 'green' : 'grey'}>{s.isActive ? 'Aktivní' : 'Vyřazeno'}</StatusChip> },
    ...(mayEdit ? [{ key: 'actions', header: 'Akce', tablet: true, align: 'right' as const, cell: actions }] : []),
  ];

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' }, justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h1" sx={TYPE.pageTitle}>Ceník</Typography>
          <Typography sx={[TYPE.caption, { mt: 0.75, maxWidth: 760 }]}>
            Položky a ceny, které vidí pacient i kalendář. Cenu určuje jen ceník — kalendář, faktury i web ji berou odtud.
          </Typography>
        </Box>
        {mayEdit && services.length > 0 && <Box sx={{ flexShrink: 0 }}>{newButton}</Box>}
      </Stack>

      {failed !== null && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" sx={{ minHeight: 44 }} onClick={() => { setLoading(true); load(); }}>Zkusit znovu</Button>}>
          {failed}
        </Alert>
      )}
      {(activitiesQuery.isError || clinicServicesQuery.isError) && (
        <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" size="small" sx={{ minHeight: 44 }} onClick={() => { void activitiesQuery.refetch(); void clinicServicesQuery.refetch(); }}>Zkusit znovu</Button>}>
          Činnosti se nepodařilo načíst, pod položkami zatím chybí.
        </Alert>
      )}

      {/*
        * An empty price list is the normal state of a new installation now -
        * the eight demo rows were a seed and it has been removed from the code
        * as well as the database, so nothing reappears. Three zeroes and a
        * search box over nothing are furniture; this says what to do instead.
        */}
      {!loading && services.length === 0 && failed === null && (
        <SoftCard sx={{ textAlign: 'center', py: 6 }}>
          <Typography component="h2" sx={TYPE.sectionTitle}>Ceník je prázdný</Typography>
          <Typography sx={[TYPE.caption, { mt: 0.5, mb: 3 }]}>
            {mayEdit
              ? 'Přidejte první položku — co ordinace nabízí a kolik to stojí.'
              : 'Ceník vyplní ten, kdo smí měnit nastavení ordinace.'}
          </Typography>
          {mayEdit && newButton}
        </SoftCard>
      )}

      {services.length > 0 && (
        <TextField
          fullWidth
          placeholder="Hledat v ceníku"
          value={search}
          onChange={e => setSearch(e.target.value)}
          size={phone ? 'medium' : 'small'}
          slotProps={{ input: {
            startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
          }, htmlInput: { 'aria-label': 'Hledat v ceníku' } }}
          sx={{ mb: 2 }}
        />
      )}

      {loading ? (
        <Stack spacing={1.5} aria-busy="true" aria-label="Načítám ceník">
          <Skeleton variant="rounded" height={48} />
          <Skeleton variant="rounded" height={280} />
        </Stack>
      ) : services.length > 0 && (
        <ResponsiveDataList
          rows={filtered}
          rowKey={(s) => s.id}
          columns={columns}
          ariaLabel="Ceník"
          /* Only about the search. An empty price list has its own words above -
             "nic takového není" answers a question nobody asked when there is
             nothing to search through. */
          empty="V ceníku nic takového není"
          renderCard={(s) => (
            <Stack spacing={1.25}>
              <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                {nameBlock(s, false)}
                {price(s)}
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <StatusChip tone={s.isActive ? 'green' : 'grey'}>{s.isActive ? 'Aktivní' : 'Vyřazeno'}</StatusChip>
                <Typography sx={TYPE.caption}>{s.code}</Typography>
              </Stack>
              {mayEdit && actions(s)}
            </Stack>
          )}
        />
      )}

      {editing !== undefined && (
        <ServiceDialog
          open
          service={editing}
          existing={services}
          onClose={() => setEditing(undefined)}
          onSaved={load}
        />
      )}

      {editingActivity !== null && (
        <ActivityExtrasDialog
          activity={editingActivity}
          serviceColor={serviceColorOf(editingActivity)}
          templates={(templatesQuery.data ?? []).filter((t) => t.isActive)}
          templatesFailed={templatesQuery.isError}
          palette={paletteQuery.data?.palette ?? []}
          onClose={() => setEditingActivity(null)}
          onSaved={() => { void activitiesQuery.refetch(); }}
        />
      )}

      {/*
        * A one-way door, and it says so before it is opened. The list route on
        * the server is "active only", so a vyřazená služba is never returned
        * again and there is no screen that can find it to bring it back.
        */}
      <Dialog open={archiving !== null} onClose={() => setArchiving(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Vyřadit z ceníku?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>{archiving?.name}</strong> se přestane nabízet. Zpátky už se
            do ceníku vrátit nedá — kdybyste ji potřebovali znovu, bude se muset
            založit nová.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ '& > button': { minHeight: 44 } }}>
          <Button variant="outlined" onClick={() => setArchiving(null)}>Zrušit</Button>
          <Button color="error" variant="contained" onClick={confirmArchive}>
            Vyřadit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
