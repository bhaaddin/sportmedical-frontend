/*
 * "Načíst z ARES" - the one button, hook and caption every form with an IČO uses
 * (the club's payer record and the clinic's own Firma a faktury), Etapa 12.
 *
 * The hook asks the registry once when the IČO field loses focus with a valid
 * value it has not asked about yet, and again whenever the button is pressed.
 * What the registry sent overwrites the form's fields - the owner asked for
 * "everything" - and a field that held something else before gets a one-line
 * "Přepsáno z ARES" caption with "Vrátit", so nothing typed is ever lost silently.
 * Fields the registry does not answer (bank, contact, sleva) are never touched.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { AresError, aresApi, isPlausibleIco, normalizeIco, type AresSubject } from '../../api/ares';

/* ── Filling a form from a subject ── */

/**
 * The form after the subject is applied. `mapping` names, per form field, the
 * value the registry offers; `null`/empty means "the registry has nothing here"
 * and the field is left as it was. `overridden` keeps the previous value of every
 * field that held a different non-empty text, so the screen can offer "Vrátit".
 */
export function applyAresFill<F extends string>(
  current: Record<F, string>,
  mapping: Partial<Record<F, string | null | undefined>>,
): { next: Record<F, string>; overridden: Partial<Record<F, string>> } {
  const next: Record<F, string> = { ...current };
  const overridden: Partial<Record<F, string>> = {};
  for (const key of Object.keys(mapping) as F[]) {
    const incoming = mapping[key];
    if (typeof incoming !== 'string' || incoming.trim() === '') continue;
    const value = incoming.trim();
    const before = current[key] ?? '';
    if (before.trim() !== '' && before.trim() !== value) overridden[key] = before;
    next[key] = value;
  }
  return { next, overridden };
}

/* ── The hook ── */

/** How long after the IČO field loses focus the registry is asked. A blur that is at once followed by a focus asks nothing. */
export const ARES_BLUR_DELAY_MS = 300;

export interface UseAresFillOptions {
  /** The IČO as it stands in the form. */
  ico: string;
  /** The IČO the form opened with - a blur that leaves it unchanged asks nothing. */
  initialIco?: string;
  /** Called with the subject on every successful lookup; the form applies it. */
  onSubject: (subject: AresSubject) => void;
}

export interface AresFill {
  /** Eight digits with the right check digit - the button is enabled only then. */
  canLookup: boolean;
  loading: boolean;
  subject: AresSubject | null;
  error: AresError | null;
  /** The manual button: always asks, even for an IČO already looked up. */
  lookup: () => Promise<void>;
  /** For the IČO field's `onBlur`: asks once per new valid IČO, after a short delay. */
  onIcoBlur: () => void;
}

export function useAresFill({ ico, initialIco = '', onSubject }: UseAresFillOptions): AresFill {
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState<AresSubject | null>(null);
  const [error, setError] = useState<AresError | null>(null);

  const icoRef = useRef(ico);
  icoRef.current = ico;
  const onSubjectRef = useRef(onSubject);
  onSubjectRef.current = onSubject;
  /* The last IČO the registry was asked about (or the one the form opened with). */
  const askedRef = useRef<string>(normalizeIco(initialIco));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  /* A form that loads its data (Firma a faktury) knows its opening IČO only later: until the
     registry has been asked once, that late value is the one a blur must not repeat. */
  useEffect(() => {
    if (requestRef.current === 0) askedRef.current = normalizeIco(initialIco);
  }, [initialIco]);

  const run = useCallback(async (clean: string) => {
    const id = requestRef.current + 1;
    requestRef.current = id;
    askedRef.current = clean;
    setLoading(true);
    setError(null);
    try {
      const found = await aresApi.lookup(clean);
      if (!mountedRef.current || requestRef.current !== id) return;
      setSubject(found);
      onSubjectRef.current(found);
    } catch (e) {
      if (!mountedRef.current || requestRef.current !== id) return;
      setSubject(null);
      setError(e instanceof AresError ? e : new AresError('ares.failed', 'Načtení z ARES se nepodařilo.'));
    } finally {
      if (mountedRef.current && requestRef.current === id) setLoading(false);
    }
  }, []);

  const lookup = useCallback(async () => {
    const clean = normalizeIco(icoRef.current);
    if (!isPlausibleIco(clean)) return;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await run(clean);
  }, [run]);

  const onIcoBlur = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const clean = normalizeIco(icoRef.current);
      if (!isPlausibleIco(clean) || clean === askedRef.current) return;
      void run(clean);
    }, ARES_BLUR_DELAY_MS);
  }, [run]);

  return { canLookup: isPlausibleIco(ico), loading, subject, error, lookup, onIcoBlur };
}

/* ── The pieces a form places ── */

export const ARES_BUTTON_LABEL = 'Načíst z ARES';

export function AresFillButton({ fill, fullWidth = false }: { fill: AresFill; fullWidth?: boolean }) {
  return (
    <Button
      variant="outlined"
      color="inherit"
      onClick={() => void fill.lookup()}
      disabled={!fill.canLookup || fill.loading}
      aria-busy={fill.loading || undefined}
      fullWidth={fullWidth}
      startIcon={fill.loading ? <CircularProgress size={16} color="inherit" aria-label="Načítám" /> : undefined}
      sx={{ minHeight: 44, whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600 }}
    >
      {ARES_BUTTON_LABEL}
    </Button>
  );
}

/** `10. 10. 2026` from the server's UTC instant, in the browser's own time. */
export function formatAresDate(fetchedAtUtc: string | null): string {
  const d = fetchedAtUtc === null ? new Date() : new Date(fetchedAtUtc);
  const date = Number.isNaN(d.getTime()) ? new Date() : d;
  return `${date.getDate()}. ${date.getMonth() + 1}. ${date.getFullYear()}`;
}

export const ARES_DISSOLVED_WARNING = 'Subjekt je zaniklý';

/**
 * One line under the IČO: what the registry said. Loading, the server's own
 * sentence on a refusal, "Načteno z ARES {date} · {name}" on success and the
 * zaniklý warning when the subject no longer exists.
 */
export function AresStatusLine({ fill }: { fill: AresFill }) {
  if (fill.loading) {
    return (
      <Typography variant="caption" role="status" sx={{ display: 'block', color: 'text.secondary' }} data-testid="ares-status">
        Načítám z ARES…
      </Typography>
    );
  }
  if (fill.error !== null) {
    return (
      <Typography variant="caption" role="alert" sx={{ display: 'block', color: 'error.main' }} data-testid="ares-status">
        {fill.error.message}
      </Typography>
    );
  }
  if (fill.subject !== null) {
    return (
      <Box data-testid="ares-status">
        <Typography variant="caption" role="status" sx={{ display: 'block', color: 'text.secondary' }}>
          {`Načteno z ARES ${formatAresDate(fill.subject.fetchedAtUtc)} · ${fill.subject.name}`}
        </Typography>
        {!fill.subject.isActive && (
          <Typography variant="caption" role="alert" sx={{ display: 'block', color: 'warning.dark', fontWeight: 600 }}>
            {ARES_DISSOLVED_WARNING}
          </Typography>
        )}
      </Box>
    );
  }
  return null;
}

/** Under a field the registry overwrote: says so, and gives the previous value back on request. */
export function AresOverrideCaption({ onRestore }: { onRestore: () => void }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: -0.5 }} data-testid="ares-override">
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>Přepsáno z ARES</Typography>
      <Button size="small" color="inherit" onClick={onRestore} sx={{ minHeight: 44, minWidth: 44, px: 1, fontWeight: 600 }}>
        Vrátit
      </Button>
    </Stack>
  );
}
