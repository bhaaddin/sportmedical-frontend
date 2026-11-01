/*
 * The door of the Administrace (every screen the catalogue puts in the `admin` area passes through it; the shell wraps them).
 *
 *   two_factor_required     the server refused an administrator without two-factor: the area shows ONLY "Pro administraci
 *                           zapněte dvoufázové ověření" and a button to the setup.
 *   reconfirmForAdmin       on entering, asks to reconfirm up front when the last confirmation is past (validUntil).
 *   adminIdleLock           after N idle minutes the area is locked (an overlay asks to reconfirm); the rest of the app is
 *                           not touched. The screens stay mounted underneath, hidden, so a form being typed is not lost.
 *
 * All three need the owner's switches (Bezpečnostní pravidla); with the switches off - the default - or on a server that
 * does not have the policy yet, the gate is invisible and passes its children through.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';
import LockOutlined from '@mui/icons-material/LockOutlined';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  askReconfirm, setTwoFactorRequired, subscribeTwoFactorRequired, twoFactorRequiredSnapshot,
} from '../../../auth/adminChallenge';
import { usePermissions } from '../../../auth/usePermission';
import { RECONFIRM_QUERY_KEY, isConfirmed, readReconfirm, useSecurityPolicy } from '../../../api/securityPolicy';
import { twoFactorApi } from '../../../api/twoFactor';
import { canSeeAdmin } from '../catalogue';

/** The pointer / key events that count as "somebody is here". */
const ACTIVITY = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

function Notice({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action: ReactNode }) {
  return (
    <Box
      role="region"
      aria-label={title}
      sx={{ display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 1.5, maxWidth: 440, mx: 'auto', py: { xs: 6, md: 10 }, px: 2 }}
    >
      <Box aria-hidden sx={{ color: 'text.secondary', display: 'grid', placeItems: 'center', '& svg': { fontSize: 44 } }}>{icon}</Box>
      <Typography component="h1" sx={{ fontSize: 20, fontWeight: 700 }}>{title}</Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: 15 }}>{text}</Typography>
      <Box sx={{ mt: 1 }}>{action}</Box>
    </Box>
  );
}

export default function AdminGate({ children }: { children: ReactNode }) {
  const allowed = canSeeAdmin(usePermissions());
  const { policy } = useSecurityPolicy(allowed);
  const twoFactorRequired = useSyncExternalStore(subscribeTwoFactorRequired, twoFactorRequiredSnapshot, () => false);

  /* The notice goes away by itself once the account has the second factor. */
  const factor = useQuery({ queryKey: ['two-factor-status'], queryFn: twoFactorApi.status, enabled: twoFactorRequired, staleTime: 0 });
  useEffect(() => {
    if (twoFactorRequired && factor.data?.enabled === true) setTwoFactorRequired(false);
  }, [twoFactorRequired, factor.data?.enabled]);

  const confirmation = useQuery({
    queryKey: RECONFIRM_QUERY_KEY,
    queryFn: readReconfirm,
    enabled: allowed && policy?.reconfirmForAdmin === true,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

  /* Idle lock: any activity inside the page restarts the clock; only this area is covered. */
  const [locked, setLocked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleMs = policy?.adminIdleLock === true ? policy.adminIdleLockMinutes * 60_000 : null;
  const arm = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    if (idleMs !== null) timer.current = setTimeout(() => setLocked(true), idleMs);
  }, [idleMs]);

  useEffect(() => {
    if (idleMs === null || locked) {
      if (timer.current !== null) clearTimeout(timer.current);
      return undefined;
    }
    arm();
    for (const type of ACTIVITY) window.addEventListener(type, arm, { passive: true, capture: true });
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
      for (const type of ACTIVITY) window.removeEventListener(type, arm, { capture: true });
    };
  }, [idleMs, locked, arm]);

  useEffect(() => { if (idleMs === null) setLocked(false); }, [idleMs]);

  const [asking, setAsking] = useState(false);
  const unlock = async () => {
    setAsking(true);
    const ok = await askReconfirm();
    setAsking(false);
    /* The window stored the new confirmation itself (the answer of the server), so there is nothing to ask again. */
    if (ok) setLocked(false);
  };

  if (!allowed) return <>{children}</>;

  if (twoFactorRequired) {
    return (
      <Notice
        icon={<ShieldOutlined />}
        title="Pro administraci zapněte dvoufázové ověření"
        text="Majitel ordinace vyžaduje, aby administrátoři měli k heslu i kód z ověřovací aplikace."
        action={
          <Button component={RouterLink} to="/nastaveni/zabezpeceni" variant="contained" sx={{ minHeight: 44 }}>
            Zapnout dvoufázové ověření
          </Button>
        }
      />
    );
  }

  /* Up front: wait for the answer rather than flash the screens and then cover them. */
  const mustConfirm = policy?.reconfirmForAdmin === true && (confirmation.isPending || !isConfirmed(confirmation.data));
  if (mustConfirm) {
    return confirmation.isPending ? null : (
      <Notice
        icon={<LockOutlined />}
        title="Potvrďte, že jste to vy"
        text="Administrace je chráněná. Pro vstup zadejte znovu své heslo."
        action={<Button variant="contained" onClick={() => { void unlock(); }} disabled={asking} sx={{ minHeight: 44 }}>Potvrdit</Button>}
      />
    );
  }

  return (
    <>
      {locked && (
        <Notice
          icon={<LockOutlined />}
          title="Administrace je zamčená"
          text="Chvíli jste nic nedělali, proto se zamkla. Pro pokračování potvrďte heslem."
          action={<Button variant="contained" onClick={() => { void unlock(); }} disabled={asking} sx={{ minHeight: 44 }}>Odemknout</Button>}
        />
      )}
      <Box
        hidden={locked}
        {...(locked ? { inert: true, 'aria-hidden': true } : {})}
        sx={locked ? { display: 'none' } : { display: 'contents' }}
      >
        {children}
      </Box>
    </>
  );
}
