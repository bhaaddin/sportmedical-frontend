/*
 * The price list: what the ordinace charges, how long it takes and what it costs.
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
 * It was already here, already full - eight priced services off
 * `/api/services` - and reachable only by typing the address: not in the menu,
 * not in Nastavení. The owner asked where the price list was and the honest
 * answer was nowhere. It is in Nastavení -> Ordinace now.
 *
 * The button marked "Upravit ceník" was wired to nothing, while the server has
 * had create, update and archive all along. Editing is real from here on, and
 * every rule is checked in front, because the server checks almost none of
 * them - see `pricing/serviceForm.ts`.
 *
 * Laid out as the board's tables (3. 10. 2026): one table, NÁZEV · KÓD · CENA
 * · STAV · AKCE. Two columns the brief named are not drawn. "KATEGORIE": the
 * owner had the category removed from the domain ("zmaz to"), so there is
 * nothing to put in it; the code stands where it stood. "DÉLKA": how long
 * something takes is a fact about the činnost, the dialog stopped editing it,
 * and the board's own settings nav keeps "Ceník" and "Délky a kapacity" apart.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, InputAdornment, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Skeleton,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Alert,
} from '@mui/material';
import { Search, Add } from '@mui/icons-material';
import { servicesApi } from '../api/services';
import { usePermission } from '../auth/usePermission';
import type { ServiceItem } from '../api/services';
import ServiceDialog from './pricing/ServiceDialog';
import { PageHeader, StatusChip, SoftCard, DESIGN } from '../components/ui';
import { czk } from './billing/money';

export default function Cenik() {
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

  const load = useCallback(() => {
    servicesApi.getAll()
      .then((items) => { setServices(items); setFailed(null); })
      .catch(() => setFailed('Ceník se nepodařilo načíst.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

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
    <Button variant="contained" startIcon={<Add />} onClick={() => setEditing(null)}>
      Nová položka
    </Button>
  );

  return (
    <Box>
      <PageHeader
        title="Ceník"
        subtitle="Položky a ceny, které vidí pacient i kalendář"
        actions={mayEdit && services.length > 0 ? newButton : undefined}
      />

      {failed !== null && <Alert severity="warning" sx={{ mb: 2 }}>{failed}</Alert>}

      {/*
        * An empty price list is the normal state of a new installation now -
        * the eight demo rows were a seed and it has been removed from the code
        * as well as the database, so nothing reappears. Three zeroes and a
        * search box over nothing are furniture; this says what to do instead.
        */}
      {!loading && services.length === 0 && failed === null && (
        <SoftCard sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6">Ceník je prázdný</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 3 }}>
            {mayEdit
              ? 'Přidejte první položku — co ordinace nabízí a kolik to stojí.'
              : 'Ceník vyplní ten, kdo smí měnit nastavení ordinace.'}
          </Typography>
          {mayEdit && newButton}
        </SoftCard>
      )}

      {/* Search */}
      {services.length > 0 && (
        <TextField
          fullWidth
          placeholder="Hledat v ceníku"
          value={search}
          onChange={e => setSearch(e.target.value)}
          slotProps={{ input: {
            startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
          } }}
          sx={{ mb: 2 }}
        />
      )}

      {loading ? (
        <Stack spacing={1.5}>
          <Skeleton variant="rounded" height={48} />
          <Skeleton variant="rounded" height={280} />
        </Stack>
      ) : services.length > 0 && (
        <TableContainer component={Paper} sx={{ overflow: 'hidden' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Název</TableCell>
                <TableCell>Kód</TableCell>
                <TableCell align="right">Cena</TableCell>
                <TableCell>Stav</TableCell>
                {mayEdit && <TableCell align="right">Akce</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(service => (
                <TableRow key={service.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{service.name}</Typography>
                    {service.description !== '' && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap title={service.description}>
                        {service.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{service.code}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {czk(service.priceCzk)}
                  </TableCell>
                  <TableCell>
                    <StatusChip tone={service.isActive ? 'green' : 'grey'}>
                      {service.isActive ? 'Aktivní' : 'Vyřazeno'}
                    </StatusChip>
                  </TableCell>
                  {/* Named, not just drawn: a screen reader needs to know
                      which row the button belongs to. */}
                  {mayEdit && (
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Button
                        size="small"
                        variant="text"
                        aria-label={`Upravit položku ${service.name}`}
                        onClick={() => setEditing(service)}
                      >
                        Upravit
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        aria-label={`Vyřadit položku ${service.name}`}
                        onClick={() => setArchiving(service)}
                        sx={{ color: DESIGN.danger }}
                      >
                        Vyřadit
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {/* Only about the search. An empty price list has its own words
                  above - "nic takového není" answers a question nobody asked
                  when there is nothing to search through. */}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={mayEdit ? 5 : 4} sx={{ py: 6, textAlign: 'center' }}>
                    <Typography sx={{ color: 'text.secondary' }}>V ceníku nic takového není</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
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
        <DialogActions>
          <Button variant="outlined" onClick={() => setArchiving(null)}>Zrušit</Button>
          <Button color="error" variant="contained" onClick={confirmArchive}>
            Vyřadit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
