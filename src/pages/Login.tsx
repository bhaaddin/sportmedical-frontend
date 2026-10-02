import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Paper, Typography, TextField, Button, Alert,
  InputAdornment, IconButton, CircularProgress,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { authApi, isSecondFactorChallenge } from '../api/auth';
import { savePermissions, saveUser } from '../auth/localSession';
import { DESIGN } from '../components/ui';

/** What the sign-in says when the client ended a session nobody closed here. */
export const SESSION_EXPIRED_MESSAGE =
  'Vaše přihlášení vypršelo nebo bylo ukončeno. Přihlaste se prosím znovu.';

/*
 * The staff sign-in, in the board's look: the page background, one white
 * bordered card in the middle, the brand as text, the fields, one accent
 * button. Nothing moves and nothing glows - the calm is the point.
 */
export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get('reason') === 'expired';
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

  /* Two-factor flow: set once the password was right but a code is also needed. */
  const [secondFactorToken, setSecondFactorToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const finishLogin = (res: any) => {
    localStorage.setItem('token', res.accessToken);
    saveUser(res.account);

    /*
     * What this person may actually do, as the SERVER works it out.
     *
     * The client used to answer that question itself, from a table of 28
     * permission names and 5 role names in src/auth/rbac.ts — names the server
     * has never heard of, next to roles it does not have. Two models of who may
     * do what, disagreeing, with the screen hiding by one and the API refusing
     * by the other.
     *
     * The server has been sending this list on every login all along. Nothing
     * read it.
     */
    savePermissions(res.permissions ?? []);
    navigate('/');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login(email, password);
      if (isSecondFactorChallenge(res)) {
        setSecondFactorToken(res.challengeToken);
        setLoading(false);
        return;
      }
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

  const handleSecondFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (secondFactorToken === null) return;
    setLoading(true);
    setError('');
    try {
      const res = await authApi.completeSecondFactor(secondFactorToken, twoFactorCode.trim());
      if (res.account.mustChangePassword) {
        setSecondFactorToken(null);
        setMustChange(true);
        setLoading(false);
        return;
      }
      finishLogin(res);
    } catch (err: any) {
      if (!err.response) {
        setError('Server neodpovídá. Zkontrolujte, že běží, a zkuste to znovu.');
      } else {
        setError(err.response?.data?.message || 'Neplatný kód. Zkuste to znovu.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: 'background.default', p: 2,
    }}>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, maxWidth: 440, width: '100%', borderRadius: 3 }}>
        <Box sx={{ mb: 3.5 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            SportMedical
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Přihlášení pro ordinaci
          </Typography>
        </Box>

        {sessionExpired && !error && !mustChange && (
          <Alert severity="warning" sx={{ mb: 2 }}>{SESSION_EXPIRED_MESSAGE}</Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {secondFactorToken !== null ? (
        <form onSubmit={handleSecondFactor}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Zadejte šestimístný kód z ověřovací aplikace.
          </Alert>
          <TextField fullWidth label="Ověřovací kód" required value={twoFactorCode} autoFocus
            onChange={e => setTwoFactorCode(e.target.value)} margin="normal"
            slotProps={{
              htmlInput: { inputMode: 'numeric', maxLength: 10, style: { letterSpacing: 4, fontSize: 20, textAlign: 'center' } },
            }} />
          <Button type="submit" fullWidth variant="contained" size="large"
            disabled={loading || twoFactorCode.trim().length < 6}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
            sx={{ mt: 2 }}>
            {loading ? 'Ověřuji…' : 'Ověřit a přihlásit'}
          </Button>
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Button size="small" onClick={() => { setSecondFactorToken(null); setTwoFactorCode(''); setError(''); }}>
              Zpět na přihlášení
            </Button>
          </Box>
        </form>
        ) : mustChange ? (
        <form onSubmit={handlePasswordChange}>
          <Alert severity="info" sx={{ mb: 2 }}>
            První přihlášení — nastavte si vlastní heslo pro účet {email}.
          </Alert>
          <TextField fullWidth label="Nové heslo" required value={newPassword}
            type={showPassword ? 'text' : 'password'}
            onChange={e => setNewPassword(e.target.value)} margin="normal"
            helperText="Min. 15 znaků, velké + malé písmeno, číslice a speciální znak"
            sx={{ mb: 1 }} />
          <TextField fullWidth label="Nové heslo znovu" required value={confirmPassword}
            type={showPassword ? 'text' : 'password'}
            onChange={e => setConfirmPassword(e.target.value)} margin="normal" />
          <Button type="submit" fullWidth variant="contained" size="large" disabled={changing}
            startIcon={changing ? <CircularProgress size={20} color="inherit" /> : null}
            sx={{ mt: 2 }}>
            {changing ? 'Ukládání...' : 'Nastavit heslo a přihlásit'}
          </Button>
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Button size="small" onClick={() => { setMustChange(false); setError(''); }}>
              Zpět na přihlášení
            </Button>
          </Box>
        </form>
        ) : (
        <form onSubmit={handleSubmit}>
          <TextField fullWidth label="E-mail" type="email" required value={email}
            onChange={e => setEmail(e.target.value)} margin="normal" autoComplete="username"
            sx={{ mb: 1 }} />
          <TextField fullWidth label="Heslo" required value={password}
            type={showPassword ? 'text' : 'password'} autoComplete="current-password"
            onChange={e => setPassword(e.target.value)} margin="normal"
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                      aria-label={showPassword ? 'Skrýt heslo' : 'Zobrazit heslo'}
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }} />

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
          <Box sx={{ mt: 0.5, mb: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Zapomenuté heslo? Nové vám nastaví správce v sekci Tým.
            </Typography>
          </Box>

          <Button type="submit" fullWidth variant="contained" size="large" disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
            sx={{ mt: 1 }}>
            {loading ? 'Přihlašování...' : 'Přihlásit se'}
          </Button>

          {/*
            The same fault again, two lines down: "Požádat o přístup" was also
            `href="#"`. There is no self-registration - an account is only ever
            created by an administrator through `POST /api/v1/users` on the
            Tým screen - so the invitation to ask for one led nowhere.
          */}
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', mt: 3, pt: 2.5, borderTop: `1px solid ${DESIGN.line}` }}>
            Nemáte účet? Přístup zakládá správce ordinace.
          </Typography>
        </form>
        )}
      </Paper>
    </Box>
  );
}
