/*
 * Služby - what the clinic does, with činnosti underneath.
 *
 * The owner's shape, in his own words: "kategória je moja služba... má byť
 * Sportovní lékařská prohlídka, jej činnosti základní komplexní spiroergo".
 *
 *     SLUŽBA      Sportovní lékařské prohlídky
 *       ČINNOST     základní · komplexní · spiroergo
 *     KALENDÁŘ    runs one service
 *
 * It is the first thing to set up and nothing else works without it: a
 * činnost must belong to a service, and a calendar that runs none offers
 * nothing on any day. So this screen leads with what is missing rather than
 * with a tidy list of names.
 */
import { useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions,
  DialogContent, DialogTitle, ListItemText, MenuItem, Stack,
  TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useDevice } from '../../layout/useDevice';
import ServiceDetail from '../settings/services/ServiceDetail';
import ServiceList, { countsLine } from '../settings/services/ServiceList';
import DeleteFlow, { type DeleteTarget } from '../settings/services/DeleteFlow';
import DuplicatesNotice from '../settings/services/DuplicatesNotice';
import { findDuplicateGroups } from '../settings/services/duplicates';
import { usePermission } from '../../auth/usePermission';
import { useTranslation } from 'react-i18next';
import { clinicServicesApi } from '../../api/clinicServices';
import type { ClinicService, ClinicServiceInput } from '../../api/clinicServices';
import { activitiesApi } from '../../api/activities';
import { calendarsApi } from '../../api/calendars';
import type { Activity, Calendar } from '../../api/bookingContracts';
import { AsyncSection } from '../../components/booking/AsyncSection';
import { errorText } from '../../components/booking/errorText';
import { isDuplicateName } from '../../api/duplicateName';
import { SettingsScreen } from '../settings/SettingsFrame';
import {
  movedFrom, offerable, partialFailureText, toAttach, under,
} from './serviceLinks';

/*
 * Etapa 4, D9: a služba is archived, never deleted. What already hangs off it
 * (appointments, blocks, orders, history) stays; it only stops being offered.
 * The wording lives here, not in cs.json, which several teams edit at once.
 */
const TEXT = {
  archive: 'Archivovat',
  restore: 'Obnovit',
  archiveTitle: 'Archivovat službu?',
  archiveBody: (name: string) => `Opravdu archivovat službu „${name}“?`,
  archiveStays:
    'Existující termíny, objednávky a historie zůstanou. Služba se přestane nabízet pro nové objednávky.',
  archivedHeading: (count: number) => `Archivované (${count})`,
  archivedChip: 'Archivovaná',
  duplicateFallback:
    'Služba s tímto názvem už existuje. Zvolte jiný název, nebo obnovte archivovanou službu.',
  nameHelp: 'Třeba „Sportovní lékařské prohlídky“ nebo „Sportovní diagnostika“.',
};

const emptyDraft = (sortOrder: number): ClinicServiceInput => ({
  name: '',
  description: '',
  sortOrder,
});

export default function ClinicServicesPage() {
  /* The real translator, not a stub: `errorText` falls back to a fixed
     sentence when the server sends no message, and a stub returning '' would
     turn that fallback into a blank alert. */
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { serviceId } = useParams<{ serviceId: string }>();
  const device = useDevice();

  const [draft, setDraft] = useState<ClinicServiceInput | null>(null);
  const [editing, setEditing] = useState<ClinicService | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<ClinicService | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const canEdit = usePermission('settings.clinic.manage');
  /* What is ticked in the dialog, before it is saved. */
  const [pickedActivities, setPickedActivities] = useState<string[]>([]);
  const [pickedCalendars, setPickedCalendars] = useState<string[]>([]);
  const [partlyFailed, setPartlyFailed] = useState<string[]>([]);

  const servicesQuery = useQuery({
    queryKey: ['clinic-services'],
    queryFn: clinicServicesApi.list,
    staleTime: 5 * 60 * 1000,
  });
  const allServices = [...(servicesQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const services = allServices.filter((svc) => svc.isActive);
  const duplicateGroups = findDuplicateGroups(allServices);
  const selected = serviceId === undefined ? null : allServices.find((svc) => svc.id === serviceId) ?? null;

  /*
   * The two lists that can be ticked. Fetched here rather than on the screens
   * that own them, because the owner asked for the assignment to happen where
   * the service is - "okienko rozrolovacie kde si to uz len vybriem" - and
   * sending him elsewhere to do it is the thing he has now sent back twice.
   */
  const activitiesQuery = useQuery({
    queryKey: ['activities'],
    queryFn: activitiesApi.list,
    staleTime: 5 * 60 * 1000,
  });
  const calendarsQuery = useQuery({
    queryKey: ['calendars'],
    queryFn: calendarsApi.list,
    staleTime: 5 * 60 * 1000,
  });
  const allActivities: Activity[] = activitiesQuery.data?.activities ?? [];
  const allCalendars: Calendar[] = calendarsQuery.data ?? [];

  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['clinic-services'] }),
    queryClient.invalidateQueries({ queryKey: ['activities'] }),
    queryClient.invalidateQueries({ queryKey: ['calendars'] }),
  ]);
  const closeDialog = () => {
    setDraft(null);
    setEditing(null);
    setPartlyFailed([]);
  };

  const serviceNameOf = (id: string) => allServices.find((svc) => svc.id === id)?.name ?? null;

  /*
   * One button, several writes.
   *
   * The server keeps the link on the other side - a činnost names its service
   * and a calendar names the one it runs - so assigning from here is a `PUT`
   * per moved item. That is a screen's job, not his.
   *
   * `PUT` is the whole entity in this lane (3.1), so every field is sent back
   * as it came. Leaving one out is not "no change", it is clearing it: drop
   * `serviceItemId` and the činnost quietly loses its price.
   *
   * `allSettled`, not `all`: some of these can fail while others go through,
   * and the dialog must not close looking finished. The ones that failed are
   * named.
   */
  const applyLinks = async (serviceId: string): Promise<string[]> => {
    const activityMoves = toAttach(allActivities, serviceId, pickedActivities);
    const calendarMoves = toAttach(allCalendars, serviceId, pickedCalendars);

    const writes: { name: string; run: () => Promise<unknown> }[] = [];

    for (const id of activityMoves) {
      const a = allActivities.find((x) => x.id === id);
      if (a === undefined) continue;
      writes.push({
        name: a.name,
        run: () => activitiesApi.update(a.id, {
          name: a.name,
          durationMinutes: a.durationMinutes,
          color: a.color,
          publicNote: a.publicNote,
          isPubliclyBookable: a.isPubliclyBookable,
          // Carried, not defaulted. A PUT is the whole entity, so moving a
          // činnost to another služba would otherwise silently un-tick the
          // consents the clinic set on it.
          requiresReportByEmail: a.requiresReportByEmail,
          requiresClubSharing: a.requiresClubSharing,
          // Carried too, for the same reason as the consents above: a PUT is
          // the whole činnost, so moving one to another služba would otherwise
          // silently stop it asking for the questionnaire.
          questionnaireRequirement: a.questionnaireRequirement,
          sortOrder: a.sortOrder,
          serviceItemId: a.serviceItemId,
          clinicServiceId: serviceId,
          // And which questionnaire: left out, the move would switch the
          // činnost back to the clinic's default one.
          questionnaireDefinitionId: a.questionnaireDefinitionId,
        }),
      });
    }

    for (const id of calendarMoves) {
      const c = allCalendars.find((x) => x.id === id);
      if (c === undefined) continue;
      writes.push({
        name: c.name,
        run: () => calendarsApi.update(c.id, {
          name: c.name,
          color: c.color,
          location: c.location,
          displayStepMinutes: c.displayStepMinutes,
          isActive: c.isActive,
          sortOrder: c.sortOrder,
          clinicServiceId: serviceId,
          publicMinimumNoticeMinutes: c.publicMinimumNoticeMinutes,
          publicHorizonDays: c.publicHorizonDays,
          // Same reason: a calendar moved to another služba keeps how long it
          // holds a slot and how late a patient may cancel.
          publicHoldMinutes: c.publicHoldMinutes,
          publicCancellationHours: c.publicCancellationHours,
        }),
      });
    }

    const results = await Promise.allSettled(writes.map((w) => w.run()));
    return writes
      .filter((_, i) => results[i].status === 'rejected')
      .map((w) => w.name);
  };

  const save = useMutation({
    mutationFn: async (input: ClinicServiceInput) => {
      const saved = editing
        ? await clinicServicesApi.update(editing.id, input)
        : await clinicServicesApi.create(input);
      /* After the service exists, so a brand new one can be ticked in the
         same breath rather than saved and then reopened. */
      return { saved, failed: await applyLinks(saved.id) };
    },
    onSuccess: async ({ failed }) => {
      await invalidate();
      /* Open, with the names, when some of it did not go through. Closing on
         a partial success is the screen saying it did something it did not. */
      if (failed.length > 0) { setPartlyFailed(failed); return; }
      closeDialog();
    },
  });

  /* `DELETE` archives on the server (D9): nothing that references the služba is touched. */
  const archive = useMutation({
    mutationFn: (id: string) => clinicServicesApi.remove(id),
    onSuccess: async () => { await invalidate(); setConfirmArchive(null); },
  });

  /* Permanent delete: the server refuses (409) while anything references it, and DeleteFlow offers archiving then. */
  const afterDelete = async (outcome: 'deleted' | 'archived', done: DeleteTarget) => {
    await invalidate();
    if (outcome === 'deleted' && serviceId === done.id) navigate('/nastaveni/sluzby');
  };

  const restore = useMutation({
    mutationFn: (id: string) => clinicServicesApi.activate(id),
    onSuccess: invalidate,
  });

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft(services.length));
    setPickedActivities([]);
    setPickedCalendars([]);
    setPartlyFailed([]);
    save.reset();
  };

  const openEdit = (service: ClinicService) => {
    setEditing(service);
    setDraft({
      name: service.name,
      description: service.description,
      sortOrder: service.sortOrder,
    });
    /* Ticked as they actually are. A picker that opens empty is a picker that
       clears everything the moment somebody saves a renamed service. */
    setPickedActivities(under(allActivities, service.id));
    setPickedCalendars(under(allCalendars, service.id));
    setPartlyFailed([]);
    save.reset();
  };

  const nameIsValid = (draft?.name ?? '').trim() !== '';
  /* The server's duplicate-name refusal belongs to the name box, not to a banner. */
  const duplicate = isDuplicateName(save.error) ? (save.error.serverMessage ?? TEXT.duplicateFallback) : null;

  /*
   * What the dialog offers to tick.
   *
   * A retired one is not offered - except when it is already under this
   * service, where hiding it would make the service look emptier than it is
   * and unticking would be the only way to save.
   */
  const editingId = editing?.id ?? '';
  const activityOptions = offerable(allActivities, editingId);
  const calendarOptions = offerable(allCalendars, editingId);


  return (
    <SettingsScreen
      title="Služby"
      subtitle="Co ordinace dělá — každá činnost patří pod jednu službu a kalendář jednu službu provozuje"
      width={1100}
      aside={false}
      related={false}
      actions={
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Nová služba
        </Button>
      }
    >

      <DuplicatesNotice
        groups={duplicateGroups}
        noun="službu"
        describe={countsLine}
        canEdit={canEdit}
        onDelete={(svc) => setDeleteTarget({ id: svc.id, name: svc.name })}
        onArchive={(svc) => { archive.reset(); setConfirmArchive(svc); }}
      />

      <AsyncSection
        isLoading={servicesQuery.isLoading}
        isSettled={servicesQuery.isSuccess || servicesQuery.isError}
        error={servicesQuery.error}
        isEmpty={allServices.length === 0}
        emptyText="Zatím tu není žádná služba. Bez ní se nedá objednat nic — začněte tím, co ordinace dělá, třeba „Sportovní lékařské prohlídky“."
        onRetry={() => void servicesQuery.refetch()}
        skeletonRows={3}
      >
        {/*
          * Master-detail. A phone shows the list or the opened služba, never
          * both; a tablet and a desktop show the list beside the detail.
          */}
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            alignItems: 'start',
            gridTemplateColumns: device === 'phone' ? '1fr' : device === 'tablet' ? '280px minmax(0, 1fr)' : '360px 1fr',
          }}
          data-layout={device}
        >
          {(device !== 'phone' || selected === null) && (
            <ServiceList
              services={allServices}
              selectedId={selected?.id ?? null}
              onSelect={(svc) => navigate(`/nastaveni/sluzby/${svc.id}`)}
              onEdit={openEdit}
              onArchive={(svc) => { archive.reset(); setConfirmArchive(svc); }}
              onRestore={(svc) => restore.mutate(svc.id)}
              onDelete={(svc) => setDeleteTarget({ id: svc.id, name: svc.name })}
              restoring={restore.isPending}
            />
          )}
          {selected !== null && (
            <ServiceDetail
              key={selected.id}
              service={selected}
              busy={archive.isPending || restore.isPending}
              onEdit={() => openEdit(selected)}
              onArchive={() => { archive.reset(); setConfirmArchive(selected); }}
              onRestore={() => restore.mutate(selected.id)}
              onDelete={() => setDeleteTarget({ id: selected.id, name: selected.name })}
              onBack={device === 'phone' ? () => navigate('/nastaveni/sluzby') : undefined}
            />
          )}
          {selected === null && serviceId !== undefined && servicesQuery.isSuccess && (
            <Alert severity="warning">
              Tuhle službu se nepodařilo najít. Možná byla odstraněna — vyberte jinou ze seznamu.
            </Alert>
          )}
          {selected === null && serviceId === undefined && device !== 'phone' && (
            <Typography sx={{ color: 'text.secondary', pt: 2 }}>
              Vyberte službu vlevo — uvidíte její činnosti, ceny, kalendáře, pravidla a využití.
            </Typography>
          )}
        </Box>
      </AsyncSection>

      <Dialog open={draft !== null} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editing ? 'Upravit službu' : 'Nová služba'}
        </DialogTitle>
        <DialogContent>
          {draft !== null && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Název"
                value={draft.name}
                onChange={(e) => { if (save.isError) save.reset(); setDraft({ ...draft, name: e.target.value }); }}
                error={duplicate !== null || (draft.name !== '' && !nameIsValid)}
                helperText={duplicate ?? TEXT.nameHelp}
                required
                fullWidth
              />
              <TextField
                label="Popis"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                multiline
                minRows={2}
                helperText="Nepovinné. K čemu ta služba je."
                fullWidth
              />
              <TextField
                label="Pořadí"
                type="number"
                value={draft.sortOrder}
                onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })}
                sx={{ width: 160 }}
              />
              {/*
                * Ticked here, because this is where he looked for it - twice.
                *
                * The server keeps the link on the other side, so saving this
                * is a `PUT` per moved item. That is this screen's work to do,
                * not an errand to hand back to him: "to mi fakt nevies spravit
                * do pcici okienko rozrolovacie kde si to uz len vybriem".
                */}
              <TextField
                select
                label="Činnosti"
                value={pickedActivities}
                onChange={(e) => setPickedActivities(
                  typeof e.target.value === 'string'
                    ? e.target.value.split(',')
                    : (e.target.value as unknown as string[]),
                )}
                slotProps={{
                  select: {
                    multiple: true,
                    renderValue: (picked) => (picked as string[])
                      .map((id) => allActivities.find((a) => a.id === id)?.name ?? id)
                      .join(', '),
                  },
                }}
                helperText={
                  activityOptions.length === 0
                    ? 'Zatím žádná činnost — není co zaškrtnout.'
                    : 'Činnost patří pod jednu službu — zaškrtnutím se sem přesune.'
                }
                fullWidth
              >
                {activityOptions.map((a) => {
                  const from = movedFrom(allActivities, a.id, serviceNameOf);
                  const isHere = a.clinicServiceId === editingId;
                  return (
                    /* Already here cannot be unticked: the server refuses a
                       činnost with no service, so there is nowhere to put it.
                       Saying so beats offering a save that ends in a 400. */
                    <MenuItem key={a.id} value={a.id} disabled={isHere}>
                      <Checkbox checked={pickedActivities.includes(a.id)} />
                      <ListItemText
                        primary={a.name}
                        secondary={
                          isHere ? 'Patří sem — přesunout jde jen na jiné službě'
                            : from !== null ? `Přesune se sem z „${from}“` : undefined
                        }
                      />
                    </MenuItem>
                  );
                })}
              </TextField>

              <TextField
                select
                label="Kalendáře"
                value={pickedCalendars}
                onChange={(e) => setPickedCalendars(
                  typeof e.target.value === 'string'
                    ? e.target.value.split(',')
                    : (e.target.value as unknown as string[]),
                )}
                slotProps={{
                  select: {
                    multiple: true,
                    renderValue: (picked) => (picked as string[])
                      .map((id) => allCalendars.find((c) => c.id === id)?.name ?? id)
                      .join(', '),
                  },
                }}
                helperText={
                  calendarOptions.length === 0
                    ? 'Zatím žádný kalendář — není co zaškrtnout.'
                    : 'Kalendář provozuje jednu službu — zaškrtnutím se sem přepne.'
                }
                fullWidth
              >
                {calendarOptions.map((c) => {
                  const from = movedFrom(allCalendars, c.id, serviceNameOf);
                  const isHere = c.clinicServiceId === editingId;
                  return (
                    /* Cannot be unticked, same as a činnost. A calendar with
                       no service offers nothing on any day and says nothing
                       about why, so there is no road back to empty - it
                       leaves only by being ticked on another service. */
                    <MenuItem key={c.id} value={c.id} disabled={isHere}>
                      <Checkbox checked={pickedCalendars.includes(c.id)} />
                      <ListItemText
                        primary={c.name}
                        secondary={
                          isHere ? 'Provozuje tuhle službu — přepnout jde jen na jiné službě'
                            : from !== null ? `Přesune se sem z „${from}“` : undefined
                        }
                      />
                    </MenuItem>
                  );
                })}
              </TextField>

              {/*
                * The one case where leaving this screen is still right: there
                * is nothing to tick, so something has to be made first. The
                * service goes with it and the form opens ready for it.
                *
                * Only when the picker is empty, and only for a service that
                * already exists - there is nothing to hand over otherwise, and
                * navigating away from a half-typed new service would lose it.
                */}
              {editing !== null && (activityOptions.length === 0 || calendarOptions.length === 0) && (
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {activityOptions.length === 0 && (
                    <Button
                      size="small"
                      onClick={() => navigate('/activities', {
                        state: { clinicServiceId: editing.id },
                      })}
                    >
                      Založit činnost
                    </Button>
                  )}
                  {calendarOptions.length === 0 && (
                    <Button
                      size="small"
                      onClick={() => navigate('/calendars', {
                        state: { clinicServiceId: editing.id },
                      })}
                    >
                      Založit kalendář
                    </Button>
                  )}
                </Stack>
              )}

              {save.isError && duplicate === null && (
                <Alert severity="error">{errorText(save.error, t)}</Alert>
              )}

              {partlyFailed.length > 0 && (
                <Alert severity="warning">{partialFailureText(partlyFailed)}</Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog}>Zrušit</Button>
          <Button
            variant="contained"
            disabled={!nameIsValid || save.isPending}
            onClick={() => draft && nameIsValid && save.mutate({ ...draft, name: draft.name.trim() })}
          >
            Uložit
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmArchive !== null} onClose={() => setConfirmArchive(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>{TEXT.archiveTitle}</DialogTitle>
        <DialogContent>
          <Typography>{TEXT.archiveBody(confirmArchive?.name ?? '')}</Typography>
          <Typography sx={{ mt: 1.5 }} color="text.secondary">{TEXT.archiveStays}</Typography>

          {archive.error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorText(archive.error, t)}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmArchive(null)}>Zrušit</Button>
          <Button
            variant="contained"
            disabled={archive.isPending}
            onClick={() => confirmArchive && archive.mutate(confirmArchive.id)}
          >
            {TEXT.archive}
          </Button>
        </DialogActions>
      </Dialog>

      <DeleteFlow
        kind="service"
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        remove={clinicServicesApi.removePermanently}
        archive={clinicServicesApi.remove}
        onDone={afterDelete}
      />
    </SettingsScreen>
  );
}
