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
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, Stack, TextField, Tooltip, Typography,
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
import { AsyncSection } from '../../components/booking/AsyncSection';
import { errorText } from '../../components/booking/errorText';
import {
  SERVICE_GAP_TEXT, countsText, deletionWillBeRefused, serviceGap,
} from './clinicServiceState';

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

  const servicesQuery = useQuery({
    queryKey: ['clinic-services'],
    queryFn: clinicServicesApi.list,
    staleTime: 5 * 60 * 1000,
  });
  const services = [...(servicesQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['clinic-services'] });
  const closeDialog = () => { setDraft(null); setEditing(null); };

  const save = useMutation({
    mutationFn: (input: ClinicServiceInput) =>
      editing ? clinicServicesApi.update(editing.id, input) : clinicServicesApi.create(input),
    onSuccess: async () => { await invalidate(); closeDialog(); },
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
    save.reset();
  };

  const openEdit = (service: ClinicService) => {
    setEditing(service);
    setDraft({
      name: service.name,
      description: service.description,
      sortOrder: service.sortOrder,
    });
    save.reset();
  };

  const nameIsValid = (draft?.name ?? '').trim() !== '';

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
                    <Box sx={{ minWidth: 220, flex: 1 }}>
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
                  {/* Said on the row, and with the way in.
                      A služba does not own its činnosti - the link lives on
                      the činnost and the server takes it from no other side -
                      so this screen can name the gap and cannot close it. The
                      owner met exactly that: a warning telling him to assign
                      činnosti, above a dialog with nowhere to assign them.
                      These carry the service to the screen that can. */}
                  {gap !== 'none' && (
                    <Alert
                      severity="warning"
                      sx={{ mt: 1.5 }}
                      action={
                        <Stack direction="row" spacing={1}>
                          {(gap === 'no-activities' || gap === 'nothing-set-up') && (
                            <Button
                              color="inherit"
                              size="small"
                              onClick={() => navigate('/activities', {
                                state: { clinicServiceId: service.id },
                              })}
                            >
                              Přidat činnost
                            </Button>
                          )}
                          {(gap === 'no-calendar' || gap === 'nothing-set-up') && (
                            <Button
                              color="inherit"
                              size="small"
                              onClick={() => navigate('/calendars', {
                                state: { clinicServiceId: service.id },
                              })}
                            >
                              Přiřadit kalendář
                            </Button>
                          )}
                        </Stack>
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
              {/* Asked for here and not offered, which is a question the
                  dialog should answer rather than leave. The server takes the
                  link from one side only - the činnost names its service, and
                  the calendar names the one it runs. So this says where, and
                  the row's buttons take you there. */}
              {editing !== null && (
                <Typography variant="body2" color="text.secondary">
                  Činnosti a kalendáře se nepřiřazují odsud. Činnost si svou službu
                  vybírá sama v Nastavení → Činnosti, kalendář v Nastavení → Kalendáře.
                </Typography>
              )}
              {save.error ? <Alert severity="error">{errorText(save.error, t)}</Alert> : null}
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
