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
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, ListItemText, MenuItem, Stack,
  TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clinicServicesApi } from '../../api/clinicServices';
import type { ClinicService, ClinicServiceInput } from '../../api/clinicServices';
import { activitiesApi } from '../../api/activities';
import { calendarsApi } from '../../api/calendars';
import type { Activity, Calendar } from '../../api/bookingContracts';
import { AsyncSection } from '../../components/booking/AsyncSection';
import { errorText } from '../../components/booking/errorText';
import {
  SERVICE_GAP_TEXT, countsText, deletionWillBeRefused, serviceGap,
} from './clinicServiceState';
import {
  movedFrom, offerable, partialFailureText, toAttach, under,
} from './serviceLinks';

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

  const [draft, setDraft] = useState<ClinicServiceInput | null>(null);
  const [editing, setEditing] = useState<ClinicService | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ClinicService | null>(null);
  /* What is ticked in the dialog, before it is saved. */
  const [pickedActivities, setPickedActivities] = useState<string[]>([]);
  const [pickedCalendars, setPickedCalendars] = useState<string[]>([]);
  const [partlyFailed, setPartlyFailed] = useState<string[]>([]);

  const servicesQuery = useQuery({
    queryKey: ['clinic-services'],
    queryFn: clinicServicesApi.list,
    staleTime: 5 * 60 * 1000,
  });
  const services = [...(servicesQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

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

  const serviceNameOf = (id: string) => services.find((svc) => svc.id === id)?.name ?? null;

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
          sortOrder: a.sortOrder,
          serviceItemId: a.serviceItemId,
          clinicServiceId: serviceId,
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

  const remove = useMutation({
    mutationFn: (id: string) => clinicServicesApi.remove(id),
    onSuccess: async () => { await invalidate(); setConfirmDelete(null); },
  });

  /* Its own button, as with calendars: stopping something being offered and
     deleting it are different acts with different consequences. */
  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? clinicServicesApi.activate(id) : clinicServicesApi.deactivate(id),
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
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Služby</Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            Co ordinace dělá. Každá činnost patří pod jednu službu a kalendář jednu službu provozuje.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Nová služba
        </Button>
      </Box>

      <AsyncSection
        isLoading={servicesQuery.isLoading}
        isSettled={servicesQuery.isSuccess || servicesQuery.isError}
        error={servicesQuery.error}
        isEmpty={services.length === 0}
        emptyText="Zatím tu není žádná služba. Bez ní se nedá objednat nic — začněte tím, co ordinace dělá, třeba „Sportovní lékařské prohlídky“."
        onRetry={() => void servicesQuery.refetch()}
        skeletonRows={3}
      >
        <Stack spacing={2}>
          {services.map((service) => {
            const gap = serviceGap(service);
            return (
              <Card key={service.id} sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <MedicalServicesIcon sx={{ color: service.isActive ? '#0D7377' : 'text.disabled', mt: 0.5 }} />
                    <Box sx={{ minWidth: 160, flex: 1 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>{service.name}</Typography>
                        {!service.isActive && (
                          <Chip size="small" label="Neaktivní" />
                        )}
                      </Stack>
                      {service.description !== '' && (
                        <Typography variant="body2" color="text.secondary">
                          {service.description}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {countsText(service)}
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Upravit">
                        <IconButton aria-label={`Upravit službu ${service.name}`} onClick={() => openEdit(service)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={service.isActive ? 'Zneaktivnit' : 'Znovu aktivovat'}>
                        <IconButton
                          aria-label={`${service.isActive ? 'Zneaktivnit' : 'Znovu aktivovat'} službu ${service.name}`}
                          disabled={setActive.isPending}
                          onClick={() => setActive.mutate({ id: service.id, active: !service.isActive })}
                        >
                          {service.isActive ? <VisibilityOffIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Smazat">
                        <IconButton
                          aria-label={`Smazat službu ${service.name}`}
                          onClick={() => { remove.reset(); setConfirmDelete(service); }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>

                  {/* Said on the row, because it is invisible everywhere else:
                      a service with no činnosti or no calendar offers nothing,
                      and looks exactly like one that works. */}
                  {/*
                    * Said on the row, and fixed on the row.
                    *
                    * This button used to leave the screen - first to a blank
                    * form, then to a list to edit one row at a time. Both came
                    * back. It opens the service now, where the two pickers
                    * are, and the assignment happens in one place.
                    *
                    * "Založit novou" stays inside the dialog for when nothing
                    * exists to tick, which is the only case where leaving is
                    * the right answer.
                    */}
                  {gap !== 'none' && (
                    <Alert
                      severity="warning"
                      sx={{ mt: 1.5 }}
                      action={
                        <Button color="inherit" size="small" onClick={() => openEdit(service)}>
                          Přiřadit
                        </Button>
                      }
                    >
                      {SERVICE_GAP_TEXT[gap]}
                    </Alert>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Stack>
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
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                helperText="Třeba „Sportovní lékařské prohlídky“ nebo „Sportovní diagnostika“."
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
            onClick={() => draft && save.mutate(draft)}
          >
            Uložit
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Smazat službu?</DialogTitle>
        <DialogContent>
          <Typography>
            Opravdu smazat službu „{confirmDelete?.name}“?
          </Typography>

          {/*
            * Said before the click, not after it. The server refuses while
            * anything hangs off the service - and unlike a calendar that is
            * never final, so this is a "not yet" rather than a wall.
            */}
          {confirmDelete !== null && deletionWillBeRefused(confirmDelete) && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Zatím to nepůjde — {countsText(confirmDelete)}. Přesuňte je jinam
              a pak to zkuste znovu. Nebo ji jen zneaktivněte.
            </Alert>
          )}

          {remove.error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorText(remove.error, t)}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDelete(null)}>Zrušit</Button>
          <Button
            color="error"
            variant="contained"
            disabled={remove.isPending}
            onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}
          >
            Smazat
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
