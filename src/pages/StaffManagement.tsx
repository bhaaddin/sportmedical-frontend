/* ══════════════════════════════════════════════════════════════
   TÝM A ÚČTY

   One row per login account, because the account is the employee: its role,
   what it may do (per employee, "Co smí"), where it works ("Kde pracuje") and
   whether it may sign in at all.

   This screen used to keep a second record per person - a "staff member" in
   /api/staff with a free-text role, phone and department - and paired it with
   the account by e-mail. Nothing else read that record, the per-employee
   permissions and rota were offered only on accounts that lacked one, and
   "Smazat" archived the record while the login kept working. A dismissed
   employee is now switched off here, on the account, and the server ends
   their open sessions with it.
   ══════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, IconButton, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, TextField, MenuItem, Chip, Avatar, Grid,
  Alert, Snackbar, Skeleton, Tooltip,
} from '@mui/material';
import {
  Add as AddIcon, Person as PersonIcon, Refresh as RefreshIcon, LockReset as LockResetIcon,
  Block as BlockIcon, CheckCircle as CheckCircleIcon, Badge as BadgeIcon, Edit as EditIcon,
} from '@mui/icons-material';
import KeyIcon from '@mui/icons-material/VpnKey';
import EventNoteIcon from '@mui/icons-material/EventNote';
import { motion } from 'framer-motion';
import { UserPermissionsDialog } from '../components/admin/UserPermissionsDialog';
import { WhereSomebodyWorksDialog } from '../components/admin/WhereSomebodyWorksDialog';
import {
  userAccountsApi, accountRefusal, ROLE_LABELS, USER_ACCOUNT_ROLES,
} from '../api/userAccounts';
import type { UserAccount, UserAccountRole } from '../api/userAccounts';
import { usePermission } from '../auth/usePermission';

const ROLE_COLORS: Record<UserAccountRole, string> = {
  Owner: '#7B1FA2',
  Administrator: '#D32F2F',
  Staff: '#0288D1',
};

const nameOf = (a: UserAccount) => a.displayName || a.email;

const initialsOf = (a: UserAccount) =>
  nameOf(a)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

export default function StaffManagement() {
  /* Only somebody who may manage roles can give out or take the Owner role;
     the server refuses it for everybody else, so it is not offered either. */
  const canManageOwners = usePermission('roles.manage');
  const assignableRoles = USER_ACCOUNT_ROLES.filter((r) => r !== 'Owner' || canManageOwners);

  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const [permissionsFor, setPermissionsFor] = useState<
    { userId: string; name: string; isOwner: boolean } | null
  >(null);
  const [scheduleFor, setScheduleFor] = useState<{ userId: string; name: string } | null>(null);

  const [adding, setAdding] = useState(false);
  const [newAccount, setNewAccount] = useState({ displayName: '', email: '', role: 'Staff' as UserAccountRole });
  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [editDraft, setEditDraft] = useState({ displayName: '', email: '' });
  const [roleFor, setRoleFor] = useState<UserAccount | null>(null);
  const [roleChoice, setRoleChoice] = useState<UserAccountRole>('Staff');
  const [switchingOff, setSwitchingOff] = useState<UserAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  const say = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnackbar({ open: true, message, severity });

  const load = useCallback(() => {
    userAccountsApi.list()
      .then((list) => { setAccounts(list); setLoadFailed(false); })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  /* ── New account ── */
  const openAdd = () => {
    setNewAccount({ displayName: '', email: '', role: 'Staff' });
    setDialogError(null);
    setAdding(true);
  };

  const create = async () => {
    setBusy(true);
    setDialogError(null);
    try {
      const issued = await userAccountsApi.create({
        email: newAccount.email.trim(),
        displayName: newAccount.displayName.trim(),
        role: newAccount.role,
      });
      setAdding(false);
      setCredentials({ email: issued.account.email, password: issued.temporaryPassword });
      load();
    } catch (error) {
      setDialogError(accountRefusal(error));
    } finally {
      setBusy(false);
    }
  };

  /* ── Name and e-mail ── */
  const openEdit = (account: UserAccount) => {
    setEditDraft({ displayName: account.displayName, email: account.email });
    setDialogError(null);
    setEditing(account);
  };

  const saveEdit = async () => {
    if (editing === null) return;
    setBusy(true);
    setDialogError(null);
    try {
      await userAccountsApi.update(editing.userId, {
        displayName: editDraft.displayName.trim(),
        email: editDraft.email.trim(),
      });
      setEditing(null);
      say('Údaje zaměstnance uloženy.');
      load();
    } catch (error) {
      setDialogError(accountRefusal(error));
    } finally {
      setBusy(false);
    }
  };

  /* ── Password ── */
  const resetPassword = async (account: UserAccount) => {
    try {
      const issued = await userAccountsApi.resetPassword(account.userId);
      setCredentials({ email: account.email, password: issued.temporaryPassword });
      load();
    } catch (error) {
      say(accountRefusal(error), 'error');
    }
  };

  /* ── Role ── */
  const openRole = (account: UserAccount) => {
    setRoleChoice(account.role);
    setDialogError(null);
    setRoleFor(account);
  };

  const saveRole = async () => {
    if (roleFor === null) return;
    setBusy(true);
    setDialogError(null);
    try {
      await userAccountsApi.assignRole(roleFor.userId, roleChoice);
      setRoleFor(null);
      say('Role změněna.');
      load();
    } catch (error) {
      setDialogError(accountRefusal(error));
    } finally {
      setBusy(false);
    }
  };

  /* ── Access on / off ── */
  const switchOff = async () => {
    if (switchingOff === null) return;
    setBusy(true);
    setDialogError(null);
    try {
      await userAccountsApi.setActive(switchingOff.userId, false);
      say(`${nameOf(switchingOff)} se už nepřihlásí.`);
      setSwitchingOff(null);
      load();
    } catch (error) {
      setDialogError(accountRefusal(error));
    } finally {
      setBusy(false);
    }
  };

  const switchOn = async (account: UserAccount) => {
    try {
      await userAccountsApi.setActive(account.userId, true);
      say(`${nameOf(account)} se může znovu přihlásit.`);
      load();
    } catch (error) {
      say(accountRefusal(error), 'error');
    }
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" width={250} height={40} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  const active = accounts.filter((a) => a.isActive);

  return (
    <Box>
      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon color="primary" /> Tým a účty
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Kdo se přihlašuje, s jakou rolí, co smí a kde pracuje
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Obnovit">
              <IconButton aria-label="Obnovit" onClick={load}><RefreshIcon /></IconButton>
            </Tooltip>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}
              sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 3, fontWeight: 600 }}>
              Přidat zaměstnance
            </Button>
          </Box>
        </Box>
      </motion.div>

      {loadFailed && (
        <Alert severity="error" sx={{ mb: 2 }}>Seznam účtů se nepodařilo načíst.</Alert>
      )}

      {/* Stats: active accounts per role */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {USER_ACCOUNT_ROLES.map((role) => (
          <Grid key={role} size={{ xs: 6, sm: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: ROLE_COLORS[role] }}>
                {active.filter((a) => a.role === role).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">{ROLE_LABELS[role]}</Typography>
            </Paper>
          </Grid>
        ))}
        <Grid size={{ xs: 6, sm: 3 }}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#757575' }}>
              {accounts.length - active.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">Vypnutý přístup</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Accounts */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                <TableCell sx={{ fontWeight: 700 }}>Jméno</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>E-mail</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Naposledy přihlášen</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Přístup</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Akce</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.length === 0 && !loadFailed ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <PersonIcon sx={{ fontSize: 48, color: '#ddd', mb: 1 }} />
                    <Typography color="text.secondary">Žádné účty</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((acc) => {
                  const name = nameOf(acc);
                  return (
                    <TableRow key={acc.userId} sx={{ opacity: acc.isActive ? 1 : 0.6 }}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ bgcolor: ROLE_COLORS[acc.role] ?? '#90A4AE', width: 36, height: 36, fontSize: 14 }}>
                            {initialsOf(acc)}
                          </Avatar>
                          <Typography sx={{ fontWeight: 600 }}>{name}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{acc.email}</TableCell>
                      <TableCell>
                        <Chip label={ROLE_LABELS[acc.role] ?? acc.role} size="small"
                          sx={{ bgcolor: `${ROLE_COLORS[acc.role] ?? '#90A4AE'}18`, color: ROLE_COLORS[acc.role] ?? '#607D8B', fontWeight: 500 }} />
                      </TableCell>
                      <TableCell>
                        {acc.lastLoginAtUtc ? new Date(acc.lastLoginAtUtc).toLocaleString('cs-CZ') : '—'}
                      </TableCell>
                      <TableCell>
                        {acc.isActive ? (
                          <Chip size="small" color="success" label={acc.mustChangePassword ? 'Čeká na první přihlášení' : 'Aktivní'} />
                        ) : (
                          <Chip size="small" label="Vypnutý" />
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title="Co smí">
                          <IconButton
                            aria-label={`Co smí ${name}`}
                            onClick={() => setPermissionsFor({ userId: acc.userId, name, isOwner: acc.role === 'Owner' })}
                          >
                            <KeyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Kde pracuje">
                          <IconButton
                            aria-label={`Kde pracuje ${name}`}
                            onClick={() => setScheduleFor({ userId: acc.userId, name })}
                          >
                            <EventNoteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Upravit jméno a e-mail">
                          <IconButton aria-label={`Upravit ${name}`} onClick={() => openEdit(acc)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Změnit roli">
                          <IconButton aria-label={`Změnit roli ${name}`} onClick={() => openRole(acc)}>
                            <BadgeIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Resetovat heslo">
                          <IconButton
                            aria-label={`Resetovat heslo pro ${acc.email}`}
                            onClick={() => void resetPassword(acc)}
                          >
                            <LockResetIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {acc.isActive ? (
                          <Tooltip title="Vypnout přístup">
                            <IconButton
                              color="error"
                              aria-label={`Vypnout přístup ${name}`}
                              onClick={() => { setDialogError(null); setSwitchingOff(acc); }}
                            >
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Znovu zapnout přístup">
                            <IconButton
                              color="success"
                              aria-label={`Zapnout přístup ${name}`}
                              onClick={() => void switchOn(acc)}
                            >
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </motion.div>

      <WhereSomebodyWorksDialog
        userId={scheduleFor?.userId ?? null}
        userName={scheduleFor?.name ?? ''}
        onClose={() => setScheduleFor(null)}
      />

      <UserPermissionsDialog
        userId={permissionsFor?.userId ?? null}
        userName={permissionsFor?.name ?? ''}
        isOwner={permissionsFor?.isOwner ?? false}
        onClose={() => setPermissionsFor(null)}
      />

      {/* New account */}
      <Dialog open={adding} onClose={() => setAdding(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Přidat zaměstnance</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Jméno a příjmení" value={newAccount.displayName}
                onChange={(e) => setNewAccount({ ...newAccount, displayName: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="E-mail" type="email" value={newAccount.email}
                helperText="Tímhle e-mailem se bude přihlašovat."
                onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField select fullWidth label="Role" value={newAccount.role}
                helperText="Co role dává, se dá u každého zaměstnance upravit tlačítkem Co smí."
                onChange={(e) => setNewAccount({ ...newAccount, role: e.target.value as UserAccountRole })}>
                {assignableRoles.map((role) => (
                  <MenuItem key={role} value={role}>{ROLE_LABELS[role]}</MenuItem>
                ))}
              </TextField>
            </Grid>
            {dialogError && (
              <Grid size={{ xs: 12 }}><Alert severity="error">{dialogError}</Alert></Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setAdding(false)} sx={{ borderRadius: 2 }}>Zrušit</Button>
          <Button onClick={() => void create()} variant="contained"
            disabled={busy || newAccount.displayName.trim() === '' || newAccount.email.trim() === ''}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 3, fontWeight: 600 }}>
            Přidat
          </Button>
        </DialogActions>
      </Dialog>

      {/* Name and e-mail */}
      <Dialog open={editing !== null} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Upravit: {editing ? nameOf(editing) : ''}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Jméno a příjmení" value={editDraft.displayName}
                onChange={(e) => setEditDraft({ ...editDraft, displayName: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="E-mail" type="email" value={editDraft.email}
                helperText="Tímhle e-mailem se přihlašuje. Po změně se přihlásí novým."
                onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })} />
            </Grid>
            {dialogError && (
              <Grid size={{ xs: 12 }}><Alert severity="error">{dialogError}</Alert></Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setEditing(null)}>Zrušit</Button>
          <Button variant="contained" onClick={() => void saveEdit()}
            disabled={
              busy || editing === null
              || editDraft.displayName.trim() === '' || editDraft.email.trim() === ''
              || (editDraft.displayName.trim() === editing.displayName && editDraft.email.trim() === editing.email)
            }
            sx={{ bgcolor: '#0D7377' }}>
            Uložit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Role */}
      <Dialog open={roleFor !== null} onClose={() => setRoleFor(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Role: {roleFor ? nameOf(roleFor) : ''}</DialogTitle>
        <DialogContent>
          <TextField select fullWidth label="Role" value={roleChoice} sx={{ mt: 1 }}
            onChange={(e) => setRoleChoice(e.target.value as UserAccountRole)}>
            {USER_ACCOUNT_ROLES
              .filter((role) => assignableRoles.includes(role) || role === roleFor?.role)
              .map((role) => (
                <MenuItem key={role} value={role}>{ROLE_LABELS[role]}</MenuItem>
              ))}
          </TextField>
          {dialogError && <Alert severity="error" sx={{ mt: 2 }}>{dialogError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setRoleFor(null)}>Zrušit</Button>
          <Button variant="contained" onClick={() => void saveRole()}
            disabled={busy || roleFor === null || roleChoice === roleFor.role}
            sx={{ bgcolor: '#0D7377' }}>
            Uložit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Switching access off */}
      <Dialog open={switchingOff !== null} onClose={() => setSwitchingOff(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Vypnout přístup?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>{switchingOff ? nameOf(switchingOff) : ''}</strong> se už nepřihlásí a jeho
            otevřená přihlášení skončí hned. Účet i jeho historie zůstanou; přístup jde
            později znovu zapnout.
          </DialogContentText>
          {dialogError && <Alert severity="error" sx={{ mt: 2 }}>{dialogError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSwitchingOff(null)}>Zrušit</Button>
          <Button color="error" variant="contained" disabled={busy} onClick={() => void switchOff()}>
            Vypnout přístup
          </Button>
        </DialogActions>
      </Dialog>

      {/* One-time password, for a new account or a reset one */}
      <Dialog open={credentials !== null} onClose={() => setCredentials(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Přihlašovací údaje</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Předejte je zaměstnanci. Po prvním přihlášení si nastaví vlastní heslo.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            E-mail: <strong>{credentials?.email}</strong>
          </Typography>
          <Alert severity="success" sx={{ wordBreak: 'break-all' }}>
            Heslo: <strong>{credentials?.password}</strong>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => { navigator.clipboard?.writeText(credentials?.password ?? '').catch(() => {}); }}
            variant="outlined" sx={{ borderRadius: 2 }}
          >
            Kopírovat
          </Button>
          <Button onClick={() => setCredentials(null)} variant="contained"
            sx={{ bgcolor: '#0D7377', borderRadius: 2 }}>
            Hotovo
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} sx={{ borderRadius: 2 }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
