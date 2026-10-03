/* ══════════════════════════════════════════════════════════════
   PŘIHLÁŠENÍ DO PORTÁLU  (route: /portal/prihlaseni, and /portal without a token)

   E-mail and password → POST /api/patient-portal/login → { token } → the
   token is kept in sessionStorage for this tab and the patient lands on
   /portal/{token}, the same page their personal link opens.

   The portal still works without a password: the link the clinic issues IS
   the identity. A password is a convenience the patient sets inside the
   portal, so the sign-in page says so rather than offering a "forgot
   password" it cannot honour.

   Phone: one field per row, "Přihlásit se" pinned at the bottom of the screen.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Link, TextField, Typography } from '@mui/material';
import { LockOutlined, PersonOutlined } from '@mui/icons-material';
import {
  PortalAuthError, portalLogin, portalSignInMessage, readPortalToken, rememberPortalToken,
} from '../../api/patientPortal';
import { useIsPhone } from '../../layout/useDevice';
import PublicLayout from './PublicLayout';
import { useSlotTexts } from '../../site/useSlotTexts';
import { BRAND } from '../../components/public/brand';
import { LANDING_PATH } from '../../components/public/PublicHeader';
import {
  LABEL_COLOR, PageTitle, Panel, PinnedBar, PublicMain, ctaSx,
} from '../../components/public/kit';

export const portalPath = (token: string): string => `/portal/${encodeURIComponent(token)}`;

export default function PatientSignIn() {
  const txt = useSlotTexts(['formulare.portal.signin.sub', 'formulare.portal.signin.no-password', 'formulare.portal.signin.forgot'] as const);
  const navigate = useNavigate();
  const phone = useIsPhone();
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
      <PublicMain maxWidth={520} gap={2.5}>
        <PageTitle sub={txt['formulare.portal.signin.sub']}>Přihlášení do portálu</PageTitle>

        <Panel component="div" sx={{ flex: phone ? 1 : undefined }}>
          <Box
            component="form"
            onSubmit={(event) => { void submit(event); }}
            noValidate
            sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}
          >
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

            <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>
              {txt['formulare.portal.signin.no-password']}
            </Typography>
            <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>
              {txt['formulare.portal.signin.forgot']}
            </Typography>

            <Box sx={{ borderTop: `1px solid ${BRAND.line}`, pt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>Ještě nemáte termín?</Typography>
              <Link component={RouterLink} to={LANDING_PATH} sx={{ fontWeight: 700, color: '#A8560D', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
                Objednat se
              </Link>
            </Box>

            <PinnedBar label="Přihlásit se">
              <Button
                type="submit"
                variant="contained"
                disabled={busy}
                startIcon={busy ? <CircularProgress size={18} sx={{ color: BRAND.ink }} /> : undefined}
                sx={ctaSx(50)}
              >
                {busy ? 'Přihlašuji…' : 'Přihlásit se'}
              </Button>
            </PinnedBar>
          </Box>
        </Panel>
      </PublicMain>
    </PublicLayout>
  );
}
