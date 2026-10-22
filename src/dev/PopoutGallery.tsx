/*
 * DEV ONLY (`/audit/popouts?kind=...`, mounted by StaffApp only when `import.meta.env.DEV`): every KIND of pop-out the
 * application is built from, open, inside the real theme, so scripts/stage3b/audit-popouts.mjs can read their computed
 * colours in dark and light for every accent. The generic MUI kinds live here; the application's own pop-outs (the planner's
 * dialogs, the club editor, the command palette ...) are opened through the real UI by that script.
 * Nothing here ships: the route is behind a DEV check and this module is only reached through a dynamic import.
 */
import { useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  Select,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import { useSearchParams } from 'react-router-dom';

export const POPOUT_KINDS = ['dialog', 'confirm', 'popover', 'menu', 'select', 'tooltip', 'drawer', 'autocomplete', 'snackbar', 'alerts', 'form-controls'] as const;
export type PopoutKind = (typeof POPOUT_KINDS)[number];

const OPTIONS = ['Základní sportovní prohlídka', 'Komplexní sportovní prohlídka', 'Spiroergometrie', 'InBody'];

function FormBody() {
  return (
    <Stack spacing={2} sx={{ pt: 1 }}>
      <TextField label="Název klubu" defaultValue="FC Říčany" size="small" fullWidth />
      <TextField label="Poznámka" placeholder="Doplňte poznámku" size="small" fullWidth multiline minRows={2} />
      <TextField select label="Činnost" defaultValue={OPTIONS[0]} size="small" fullWidth slotProps={{ select: { native: true } }}>
        {OPTIONS.map((o) => <option key={o}>{o}</option>)}
      </TextField>
      <TextField label="Datum" type="date" defaultValue="2026-10-22" size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }} />
      <FormControlLabel control={<Checkbox defaultChecked />} label="Souhlas se zpracováním" />
      <FormControlLabel control={<Switch defaultChecked />} label="Poslat potvrzení e-mailem" />
      <Stack direction="row" spacing={1}>
        <Chip label="Aktivní" color="success" size="small" />
        <Chip label="Čeká" color="warning" size="small" />
        <Chip label="Zrušeno" color="error" size="small" variant="outlined" />
        <Chip label="Info" color="info" size="small" />
      </Stack>
    </Stack>
  );
}

export default function PopoutGallery() {
  const [params] = useSearchParams();
  const kind = (params.get('kind') ?? 'dialog') as PopoutKind;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [selectOpen, setSelectOpen] = useState(true);
  const close = () => undefined;

  return (
    <Box data-testid={`popout-${kind}`} sx={{ p: 3, minHeight: 600 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Pop-outs: {kind}</Typography>
      <Button ref={(el) => { if (el && anchor === null) setAnchor(el); }} variant="outlined">Kotva</Button>

      {kind === 'dialog' && (
        <Dialog open onClose={close} fullWidth maxWidth="sm">
          <DialogTitle>Upravit klub</DialogTitle>
          <DialogContent><FormBody /></DialogContent>
          <DialogActions><Button>Zrušit</Button><Button variant="contained">Uložit</Button></DialogActions>
        </Dialog>
      )}
      {kind === 'confirm' && (
        <Dialog open onClose={close}>
          <DialogTitle>Smazat objednávku?</DialogTitle>
          <DialogContent><DialogContentText>Tuto akci nelze vrátit zpět. Termíny se uvolní.</DialogContentText></DialogContent>
          <DialogActions><Button>Ponechat</Button><Button color="error" variant="contained">Smazat</Button></DialogActions>
        </Dialog>
      )}
      {kind === 'popover' && anchor && (
        <Popover open anchorEl={anchor} onClose={close} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
          <Box sx={{ p: 2, width: 300 }}>
            <Typography variant="subtitle1">Vyberte činnost</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Termín se vloží do kalendáře.</Typography>
            <Divider sx={{ mb: 1 }} />
            <Stack direction="row" spacing={1}><Button size="small">Zrušit</Button><Button size="small" variant="contained">Vložit</Button></Stack>
          </Box>
        </Popover>
      )}
      {kind === 'menu' && anchor && (
        <Menu open anchorEl={anchor} onClose={close}>
          <MenuItem><ListItemIcon><EditOutlined fontSize="small" /></ListItemIcon><ListItemText>Upravit</ListItemText></MenuItem>
          <MenuItem selected><ListItemText>Vybraná položka</ListItemText></MenuItem>
          <MenuItem disabled><ListItemText>Nedostupné</ListItemText></MenuItem>
          <Divider />
          <MenuItem><ListItemText sx={{ color: 'error.main' }}>Smazat</ListItemText></MenuItem>
        </Menu>
      )}
      {kind === 'select' && (
        <Select open={selectOpen} onClose={() => setSelectOpen(true)} value={OPTIONS[1]} size="small" sx={{ minWidth: 320 }}>
          {OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
        </Select>
      )}
      {kind === 'tooltip' && (
        <Tooltip open title="Základní sportovní prohlídka · 30 min · 1 200 Kč" placement="bottom" arrow>
          <IconButton aria-label="Informace"><InfoOutlined /></IconButton>
        </Tooltip>
      )}
      {kind === 'drawer' && (
        <Drawer open anchor="right" onClose={close}>
          <Box sx={{ width: 340, p: 2 }}>
            <Typography variant="h6">Detail termínu</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Pacient, činnost a poznámky.</Typography>
            <FormBody />
          </Box>
        </Drawer>
      )}
      {kind === 'autocomplete' && (
        <Autocomplete open options={OPTIONS} defaultValue={OPTIONS[0]} sx={{ width: 360 }} renderInput={(p) => <TextField {...p} label="Činnost" size="small" />} />
      )}
      {kind === 'snackbar' && (
        <>
          <Snackbar open message="Termín byl přesunut" action={<Button size="small">Zpět</Button>} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} />
          <Snackbar open anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} sx={{ bottom: 96 }}>
            <Alert severity="success" variant="filled">Uloženo</Alert>
          </Snackbar>
          <Snackbar open anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
            <Alert severity="error" variant="filled">Uložení se nepovedlo</Alert>
          </Snackbar>
        </>
      )}
      {kind === 'alerts' && (
        <Stack spacing={1} sx={{ maxWidth: 520 }}>
          {(['success', 'info', 'warning', 'error'] as const).map((s) => (
            <Stack spacing={1} key={s}>
              <Alert severity={s}>Standardní hláška ({s})</Alert>
              <Alert severity={s} variant="outlined">Obrysová hláška ({s})</Alert>
              <Alert severity={s} variant="filled">Plná hláška ({s})</Alert>
            </Stack>
          ))}
        </Stack>
      )}
      {kind === 'form-controls' && <Box sx={{ maxWidth: 520 }}><FormBody /></Box>}
    </Box>
  );
}
