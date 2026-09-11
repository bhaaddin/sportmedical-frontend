import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, TextField, Button, Alert,
  InputAdornment, IconButton, CircularProgress,
} from '@mui/material';
import { Visibility, VisibilityOff, LocalHospital, Email, Lock } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { authApi } from '../api/auth';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /* Password change flow */
  const [mustChange, setMustChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);

  const finishLogin = (res: any) => {
    const nameParts = (res.account.displayName || '').split(' ');
    const user = {
      id: res.account.userId,
      email: res.account.email,
      firstName: nameParts[0] || res.account.displayName,
      lastName: nameParts.slice(1).join(' ') || '',
      role: res.account.role,
    };
    localStorage.setItem('token', res.accessToken);
    localStorage.setItem('user', JSON.stringify(user));
    navigate('/');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login(email, password);
      if (res.account.mustChangePassword) {
        setMustChange(true);
        setLoading(false);
        return;
      }
      finishLogin(res);
    } catch (err: any) {
      // New account with temporary password → must set own password first
      if (err.response?.data?.code === 'account.password_change_required') {
        setMustChange(true);
        setError('');
      } else if (!err.response) {
        /*
         * Nothing answered - the server is down, or the network is. Saying
         * "Neplatné přihlašovací údaje" here is a claim the screen cannot make:
         * nobody checked the password. It sends people off to hunt for a
         * credential that was right all along, which is exactly what it did.
         */
        setError('Server neodpovídá. Zkontrolujte, že běží, a zkuste to znovu.');
      } else if (err.response.status >= 500) {
        setError('Server odpověděl chybou. S přihlašovacími údaji to nesouvisí.');
      } else {
        setError(err.response?.data?.message || 'Neplatné přihlašovací údaje');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 15) { setError('Heslo musí mít alespoň 15 znaků'); return; }
    if (newPassword.length > 128) { setError('Heslo je příliš dlouhé (max 128 znaků)'); return; }
    if (newPassword !== confirmPassword) { setError('Hesla se neshodují'); return; }
    const localPart = (email.split('@')[0] || '').toLowerCase();
    if (localPart.length >= 4 && newPassword.toLowerCase().includes(localPart)) {
      setError(`Heslo nesmí obsahovat vaše jméno z emailu ("${email.split('@')[0]}")`);
      return;
    }
    setChanging(true);
    setError('');
    try {
      await authApi.activate({
        email,
        temporaryPassword: password,
        newPassword,
        newPasswordConfirmation: confirmPassword,
      });
      const res = await authApi.login(email, newPassword);
      finishLogin(res);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Nepodařilo se nastavit heslo');
    } finally {
      setChanging(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0D7377 0%, #14A3A8 30%, #1A1A2E 100%)',
      p: 2, position: 'relative', overflow: 'hidden',
    }}>
      <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.15, 0.1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', top: -100, right: -100 }} />
      <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.05, 0.1, 0.05] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', bottom: -80, left: -80 }} />

      <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
        <Paper elevation={24} sx={{ p: 5, maxWidth: 440, width: '100%', borderRadius: 4, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <motion.div whileHover={{ rotate: 10, scale: 1.1 }} transition={{ type: 'spring', stiffness: 300 }}>
                <LocalHospital sx={{ fontSize: 56, color: '#0D7377', mb: 1.5 }} />
              </motion.div>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#0D7377' }}>SportMedical</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Diagnostics Platform</Typography>
            </Box>
          </motion.div>

          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>
            </motion.div>
          )}

          {mustChange ? (
          <motion.form onSubmit={handlePasswordChange} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
              První přihlášení — nastavte si vlastní heslo pro účet {email}.
            </Alert>
            <TextField fullWidth label="Nové heslo" required value={newPassword}
              type={showPassword ? 'text' : 'password'}
              onChange={e => setNewPassword(e.target.value)} margin="normal"
              helperText="Min. 15 znaků, velké + malé písmeno, číslice a speciální znak"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Lock color="action" /></InputAdornment> } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 }, mb: 1 }} />
            <TextField fullWidth label="Nové heslo znovu" required value={confirmPassword}
              type={showPassword ? 'text' : 'password'}
              onChange={e => setConfirmPassword(e.target.value)} margin="normal"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Lock color="action" /></InputAdornment> } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
              <Button type="submit" fullWidth variant="contained" size="large" disabled={changing}
                startIcon={changing ? <CircularProgress size={20} color="inherit" /> : null}
                sx={{
                  mt: 2, py: 1.5, borderRadius: 2, fontWeight: 700, fontSize: 16,
                  bgcolor: '#0D7377', boxShadow: '0 4px 20px rgba(13,115,119,0.4)',
                  '&:hover': { bgcolor: '#095456' },
                }}>
                {changing ? 'Ukládání...' : 'Nastavit heslo a přihlásit'}
              </Button>
            </motion.div>
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Button size="small" onClick={() => { setMustChange(false); setError(''); }}>
                Zpět na přihlášení
              </Button>
            </Box>
          </motion.form>
          ) : (
          <motion.form onSubmit={handleSubmit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <TextField fullWidth label="E-mail" type="email" required value={email}
              onChange={e => setEmail(e.target.value)} margin="normal"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Email color="action" /></InputAdornment> } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 }, mb: 1 }} />
            <TextField fullWidth label="Heslo" required value={password}
              type={showPassword ? 'text' : 'password'}
              onChange={e => setPassword(e.target.value)} margin="normal"
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start"><Lock color="action" /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />

            {/*
              This was `<Link href="#">Zapomenuté heslo?</Link>` - a link that
              looked like a way out and did nothing when clicked.

              The person who has forgotten their password is the only person who
              ever clicks it, so the silence lands on exactly the one who cannot
              afford it. It happened to the owner of this system on 11. 9. 2026,
              which is how it was found.

              There is no anonymous reset to point it at, and that is measured,
              not assumed: the API has two password routes and both require a
              session - `/api/v1/account/password` (change your own) and
              `/api/v1/users/{id}/reset-password` (admin, [Authorize]). Building
              a self-service reset to fill the gap would be a security surface
              invented on the side of another task - what proves the identity of
              whoever asks, how long a link lives, what happens to open
              sessions. That is its own job with its own brief.

              So it says what is true instead. Less pretty, and it stops
              promising.
            */}
            <Box sx={{ textAlign: 'right', mt: 0.5, mb: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Zapomenuté heslo? Nové vám nastaví správce v sekci Tým.
              </Typography>
            </Box>

            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
              <Button type="submit" fullWidth variant="contained" size="large" disabled={loading}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
                sx={{
                  mt: 1, py: 1.5, borderRadius: 2, fontWeight: 700, fontSize: 16,
                  bgcolor: '#0D7377', boxShadow: '0 4px 20px rgba(13,115,119,0.4)',
                  '&:hover': { bgcolor: '#095456', boxShadow: '0 6px 24px rgba(13,115,119,0.5)' },
                  transition: 'all 0.2s ease',
                }}>
                {loading ? 'Přihlašování...' : 'Přihlásit se'}
              </Button>
            </motion.div>

            {/*
              The same fault again, two lines down: "Požádat o přístup" was also
              `href="#"`. There is no self-registration - an account is only ever
              created by an administrator through `POST /api/v1/users` on the
              Tým screen - so the invitation to ask for one led nowhere.
            */}
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 3 }}>
              Nemáte účet? Přístup zakládá správce ordinace.
            </Typography>
          </motion.form>
          )}
        </Paper>
      </motion.div>
    </Box>
  );
}
