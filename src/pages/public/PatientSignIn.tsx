/* ══════════════════════════════════════════════════════════════
   PŘIHLÁŠENÍ DO PORTÁLU  (route: /portal/prihlaseni, and /portal without a token)

   E-mail and password → POST /api/patient-portal/login → { token } → the
   token is kept in sessionStorage for this tab and the patient lands on
   /portal/{token}, the same page their personal link opens.

   The portal still works without a password: the link the clinic issues IS
   the identity. A password is a convenience the patient sets inside the
   portal, so the sign-in page says so rather than offering a "forgot
   password" it cannot honour.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, CircularProgress, Container, Link, TextField, Typography } from '@mui/material';
import { LockOutlined, PersonOutlined } from '@mui/icons-material';
import {
  PortalAuthError, portalLogin, portalSignInMessage, readPortalToken, rememberPortalToken,
} from '../../api/patientPortal';
import PublicLayout from './PublicLayout';
import { BRAND } from '../../components/public/brand';
import { LANDING_PATH } from '../../components/public/PublicHeader';

export const portalPath = (token: string): string => `/portal/${encodeURIComponent(token)}`;

export default function PatientSignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [complaint, setComplaint] = useState<string | null>(null);

  /* A tab that already signed in goes straight to its portal. */
  useEffect(() => {
    const token = readPortalToken();
    if (token !== null) navigate(portalPath(token), { replace: true });
  }, [navigate]);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy) return;
    const trimmed = email.trim();
    if (trimmed === '' || password === '') {
      setComplaint('Vyplňte prosím e-mail i heslo.');
      return;
    }

    setBusy(true);
    setComplaint(null);
    try {
      const token = await portalLogin(trimmed, password);
      rememberPortalToken(token);
      navigate(portalPath(token));
    } catch (error) {
      setComplaint(
        error instanceof PortalAuthError
          ? portalSignInMessage(error.status, error.message)
          : portalSignInMessage(0, undefined),
      );
      setBusy(false);
    }
  };

  return (
    <PublicLayout hidePortalLink noFooter>
      <Box sx={{ bgcolor: BRAND.ink, color: '#FFFFFF', pt: { xs: 5, md: 7 }, pb: { xs: 9, md: 11 } }}>
        <Container maxWidth="xs">
          <Typography sx={{ color: BRAND.accent, fontWeight: 800, fontSize: 12.5, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Můj portál
          </Typography>
          <Typography component="h1" sx={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: { xs: 30, md: 36 }, mt: 1, lineHeight: 1.1 }}>
            Přihlášení
          </Typography>
          <Typography sx={{ color: BRAND.onInk, mt: 1 }}>
            Vaše termíny, dokumenty a doklady na jednom místě.
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="xs" sx={{ mt: { xs: -6, md: -7 }, pb: 8 }}>
        <Card sx={{ p: { xs: 2.5, md: 3.5 }, boxShadow: BRAND.shadow }}>
          <Box component="form" onSubmit={(event) => { void submit(event); }} noValidate sx={{ display: 'grid', gap: 2 }}>
            <TextField
              label="E-mail"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              fullWidth
              autoFocus
              slotProps={{ input: { startAdornment: <PersonOutlined sx={{ color: BRAND.muted, mr: 1 }} /> } }}
            />
            <TextField
              label="Heslo"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              fullWidth
              slotProps={{ input: { startAdornment: <LockOutlined sx={{ color: BRAND.muted, mr: 1 }} /> } }}
            />

            {complaint !== null && (
              <Alert severity="warning" role="alert">{complaint}</Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={busy}
              startIcon={busy ? <CircularProgress size={18} sx={{ color: BRAND.ink }} /> : undefined}
              sx={{ color: BRAND.ink }}
            >
              {busy ? 'Přihlašuji…' : 'Přihlásit se'}
            </Button>
          </Box>

          <Typography variant="body2" sx={{ color: BRAND.muted, mt: 3 }}>
            Nemáte heslo? Přístup vám vydá ordinace — nebo si ho nastavte z odkazu, který jste dostali.
          </Typography>

          <Box sx={{ borderTop: `1px solid ${BRAND.line}`, mt: 2.5, pt: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ color: BRAND.muted }}>Ještě nemáte termín?</Typography>
            <Link component={RouterLink} to={LANDING_PATH} sx={{ fontWeight: 700, color: BRAND.accentDark }}>
              Objednat se
            </Link>
          </Box>
        </Card>
      </Container>
    </PublicLayout>
  );
}
